import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone, readJson, isoNow } from '../_utils/http.js';
import { createNotification, loadPushSubscriptionsForUsers, fanoutWebPushNoPayload } from '../_utils/notifications.js';

function mapRow(row, siteZone) {
  if (!row) return null;
  return {
    id: row.id,
    zone: siteZone || row.zone || 'BZV/POOL',
    ticketNumber: row.ticket_number,
    siteId: row.site_id,
    siteName: row.site_name,
    technician: row.technician,
    dateGenerated: row.date_generated,
    status: row.status,
    plannedDate: row.planned_date,
    epvType: row.epv_type,
    createdBy: row.created_by,
    dateCompleted: row.date_completed,
    intervalHours: row.interval_hours,
    contractSeuil: row.contract_seuil,
    isWithinContract: row.is_within_contract === null ? null : Boolean(row.is_within_contract),
    nh1DV: row.nh1_dv === undefined ? undefined : row.nh1_dv,
    dateDV: row.date_dv === undefined ? undefined : row.date_dv,
    nhNow: row.nh_now === undefined ? undefined : row.nh_now,
    interventionId: row.intervention_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signatureTypedName: row.signature_typed_name || null,
    signatureDrawnPng: row.signature_drawn_png || null,
    signedByEmail: row.signed_by_email || null,
    signedAt: row.signed_at || null,
    warehouseAirFilterOk: row.warehouse_air_filter_ok === null ? null : Boolean(row.warehouse_air_filter_ok),
    warehouseCoolant5lOk: row.warehouse_coolant_5l_ok === null ? null : Boolean(row.warehouse_coolant_5l_ok),
    warehouseCheckedBy: row.warehouse_checked_by || null,
    warehouseCheckedAt: row.warehouse_checked_at || null,
  };
}

function hasResponsibleSignature(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (v.startsWith('data:image/')) return true;
  if (v.startsWith('blob:')) return true;
  if (v.startsWith('http://') || v.startsWith('https://')) return true;
  if (v.startsWith('/')) return true;
  return false;
}

function boolToDb(v) {
  if (v === null) return null;
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'oui' || s === 'yes') return 1;
  if (s === '0' || s === 'false' || s === 'non' || s === 'no') return 0;
  return null;
}

export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const role = String(data?.user?.role || '').trim();
    const canWarehouse = role === 'warehouse';
    const canManage = role === 'admin' || role === 'manager';
    if (!canWarehouse && !canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

    const existing = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Fiche introuvable.' }, { status: 404 });

    const site = await env.DB.prepare('SELECT id, zone FROM sites WHERE id = ?').bind(existing.site_id).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    const zone = String(site.zone || 'BZV/POOL');
    if (!isSuperAdmin(data) && role !== 'admin' && !canWarehouse) {
      const z = String(userZone(data) || 'BZV/POOL');
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const body = await readJson(request);
    const mode = String(body?.mode || '').trim().toLowerCase();

    const now = isoNow();

    // 1) Warehouse check (magasinier)
    if (mode === 'warehouse-check') {
      if (!canWarehouse && !canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

      const air = boolToDb(body?.warehouseAirFilterOk);
      const coolant = boolToDb(body?.warehouseCoolant5lOk);

      const hadNoWarehouseCheck =
        existing?.warehouse_air_filter_ok === null &&
        existing?.warehouse_coolant_5l_ok === null &&
        existing?.warehouse_checked_at === null;

      await env.DB.prepare(
        'UPDATE fiche_history SET warehouse_air_filter_ok = ?, warehouse_coolant_5l_ok = ?, warehouse_checked_by = ?, warehouse_checked_at = ?, updated_at = ? WHERE id = ?'
      )
        .bind(
          air,
          coolant,
          data?.user?.email ? String(data.user.email) : null,
          now,
          now,
          id
        )
        .run();

      if (hadNoWarehouseCheck && (air !== null || coolant !== null)) {
        try {
          const siteZone = String(zone || 'BZV/POOL');

          const managersRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'manager' AND zone = ?")
            .bind(siteZone)
            .all();
          const managerIds = (Array.isArray(managersRes?.results) ? managersRes.results : [])
            .map((r) => String(r?.id || ''))
            .filter(Boolean);

          const adminsRes = await env.DB.prepare("SELECT id, zone FROM users WHERE role = 'admin'").all();
          const adminRows = Array.isArray(adminsRes?.results) ? adminsRes.results : [];
          const adminIds = adminRows
            .filter((r) => {
              const z = String(r?.zone || 'BZV/POOL');
              if (z === 'BZV/POOL') return true;
              return z === siteZone;
            })
            .map((r) => String(r?.id || ''))
            .filter(Boolean);

          const recipients = Array.from(new Set([...managerIds, ...adminIds])).filter(Boolean);
          const title = 'Retour magasin - Fiche prête';
          const bodyTxt = `${String(existing?.site_name || '') || 'Site'} - contrôle magasin effectué.`;

          for (const uid of recipients) {
            await createNotification(env, {
              userId: uid,
              title,
              body: bodyTxt,
              kind: 'WAREHOUSE_CHECK',
              refId: String(id),
              zone: siteZone
            });
          }

          const subs = await loadPushSubscriptionsForUsers(env, recipients);
          await fanoutWebPushNoPayload(env, subs);
        } catch {
          // ignore notification failures
        }
      }

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    // 1b) Warehouse submit/return to manager
    if (mode === 'warehouse-submit') {
      if (!canWarehouse) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      if (st && st !== 'Brouillon' && st !== 'Contrôle magasin') {
        return json({ error: 'Fiche non renvoyable (statut incompatible).' }, { status: 409 });
      }

      await env.DB.prepare(
        "UPDATE fiche_history SET status = ?, updated_at = ? WHERE id = ?"
      )
        .bind('Contrôle magasin', now, id)
        .run();

      try {
        const siteZone = String(zone || 'BZV/POOL');

        const managersRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'manager' AND zone = ?")
          .bind(siteZone)
          .all();
        const managerIds = (Array.isArray(managersRes?.results) ? managersRes.results : [])
          .map((r) => String(r?.id || ''))
          .filter(Boolean);

        const adminsRes = await env.DB.prepare("SELECT id, zone FROM users WHERE role = 'admin'").all();
        const adminRows = Array.isArray(adminsRes?.results) ? adminsRes.results : [];
        const adminIds = adminRows
          .filter((r) => {
            const z = String(r?.zone || 'BZV/POOL');
            if (z === 'BZV/POOL') return true;
            return z === siteZone;
          })
          .map((r) => String(r?.id || ''))
          .filter(Boolean);

        const recipients = Array.from(new Set([...managerIds, ...adminIds])).filter(Boolean);
        const title = 'Retour magasin - Fiche renvoyée';
        const bodyTxt = `${String(existing?.site_name || '') || 'Site'} - fiche renvoyée pour finalisation.`;

        for (const uid of recipients) {
          await createNotification(env, {
            userId: uid,
            title,
            body: bodyTxt,
            kind: 'WAREHOUSE_SUBMIT',
            refId: String(id),
            zone: siteZone
          });
        }

        const subs = await loadPushSubscriptionsForUsers(env, recipients);
        await fanoutWebPushNoPayload(env, subs);
      } catch {
        // ignore notification failures
      }

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    // 2) Finalize (manager/superadmin)
    if (mode === 'finalize') {
      if (!canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

      const ticketNumber = String(body?.ticketNumber || '').trim();
      const signatureTypedName = String(body?.signatureTypedName || '').trim();
      const signatureDrawnPng = String(body?.signatureDrawnPng || '').trim();

      if (!ticketNumber) return json({ error: 'Ticket requis.' }, { status: 400 });
      if (!hasResponsibleSignature(signatureDrawnPng)) return json({ error: 'Signature responsable obligatoire.' }, { status: 400 });

      const dup = await env.DB.prepare('SELECT id FROM fiche_history WHERE ticket_number = ? AND id != ?').bind(ticketNumber, id).first();
      if (dup?.id) return json({ error: 'Fiche déjà sortie pour ce ticket.' }, { status: 409 });

      await env.DB.prepare(
        'UPDATE fiche_history SET ticket_number = ?, status = ?, signature_typed_name = ?, signature_drawn_png = ?, signed_by_email = ?, signed_at = ?, updated_at = ? WHERE id = ?'
      )
        .bind(
          ticketNumber,
          'En attente',
          signatureTypedName,
          signatureDrawnPng,
          data?.user?.email ? String(data.user.email) : null,
          now,
          now,
          id
        )
        .run();

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    return json({ error: 'Mode invalide.' }, { status: 400 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
