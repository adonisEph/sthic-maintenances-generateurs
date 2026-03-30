import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone, readJson, isoNow } from '../_utils/http.js';
import { nextTicketNumberForZone, touchLastUpdatedAt } from '../_utils/meta.js';
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

async function loadCollaboratorRecipientIds(env, siteZone) {
  const z = String(siteZone || 'BZV/POOL');

  if (z === 'BZV/POOL') {
    // Collaborateur strict: superadmin BZV/POOL (admin + zone BZV/POOL)
    const adminsRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin' AND zone = ?")
      .bind('BZV/POOL')
      .all();
    return (Array.isArray(adminsRes?.results) ? adminsRes.results : [])
      .map((r) => String(r?.id || ''))
      .filter(Boolean);
  }

  // Collaborateur strict: manager de la zone
  const managersRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'manager' AND zone = ?")
    .bind(z)
    .all();
  return (Array.isArray(managersRes?.results) ? managersRes.results : [])
    .map((r) => String(r?.id || ''))
    .filter(Boolean);
}

async function reserveTicketLabel(env, role, zone) {
  const z = String(zone || '').trim().toUpperCase();
  const r = String(role || '').trim();

  // PNR/KOUILOU manager uses daily date-based sequence
  if (z === 'PNR/KOUILOU' && r === 'manager') {
    const nowIso = isoNow();
    const ymd = String(nowIso).slice(0, 10);
    const key = `ticket_number_pnr_day_${ymd}`;

    await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
      .bind(key, '0')
      .run();

    const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
    const current = Number(row?.meta_value || 0);
    const next = (Number.isFinite(current) ? current : 0) + 1;

    await env.DB.prepare('INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES (?, ?)')
      .bind(key, String(next))
      .run();

    await touchLastUpdatedAt(env);

    const [yy, mm, dd] = ymd.split('-');
    return `${dd}/${mm}/${yy}-${next}`;
  }

  const n = await nextTicketNumberForZone(env, z);
  // nextTicketNumberForZone already touches last_updated_at
  const prefix = z === 'UPCN' ? 'N' : z === 'PNR/KOUILOU' ? 'P' : 'T';
  return `${prefix}${String(n).padStart(5, '0')}`;
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
    if (canWarehouse) {
      const z = String(userZone(data) || 'BZV/POOL');
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    if (!isSuperAdmin(data) && role !== 'admin' && !canWarehouse) {
      const z = String(userZone(data) || 'BZV/POOL');
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const body = await readJson(request);
    const mode = String(body?.mode || '').trim().toLowerCase();

    const now = isoNow();

    // 0) Manager/Admin: send to warehouse (reserve ticket before warehouse control)
    if (mode === 'send-to-warehouse') {
      if (!canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      if (st && st !== 'Brouillon' && st !== 'Envoyée au magasin') {
        return json({ error: 'Statut incompatible.' }, { status: 409 });
      }

      const alreadyTicket = String(existing?.ticket_number || '').trim();
      const ticketLabel = alreadyTicket || (await reserveTicketLabel(env, role, zone));

      await env.DB.prepare(
        "UPDATE fiche_history SET ticket_number = ?, status = ?, signature_typed_name = ?, signature_drawn_png = ?, signed_by_email = ?, signed_at = ?, updated_at = ? WHERE id = ?"
      )
        .bind(ticketLabel, 'Envoyée au magasin', null, null, null, null, now, id)
        .run();

      try {
        const warehouseRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'warehouse' AND zone = ?")
          .bind(zone)
          .all();
        const warehouseIds = (Array.isArray(warehouseRes?.results) ? warehouseRes.results : [])
          .map((r) => String(r?.id || ''))
          .filter(Boolean);

        const recipients = warehouseIds;
        const title = 'Fiche envoyée au magasin';
        const bodyTxt = `${String(existing?.site_name || '') || 'Site'} - ticket ${ticketLabel}`;

        for (const uid of recipients) {
          await createNotification(env, {
            userId: uid,
            title,
            body: bodyTxt,
            kind: 'WAREHOUSE_INBOX',
            refId: String(id),
            zone
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

    // 1) Warehouse check (magasinier)
    if (mode === 'warehouse-check') {
      if (!canWarehouse && !canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      if (canWarehouse && st !== 'Envoyée au magasin' && st !== 'Contrôle magasin') {
        return json({ error: 'Fiche non disponible pour le magasin.' }, { status: 409 });
      }

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

          const recipients = await loadCollaboratorRecipientIds(env, siteZone);
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
      if (st && st !== 'Envoyée au magasin' && st !== 'Contrôle magasin') {
        return json({ error: 'Fiche non renvoyable (statut incompatible).' }, { status: 409 });
      }

      await env.DB.prepare(
        "UPDATE fiche_history SET status = ?, updated_at = ? WHERE id = ?"
      )
        .bind('Contrôle magasin', now, id)
        .run();

      try {
        const siteZone = String(zone || 'BZV/POOL');

        const recipients = await loadCollaboratorRecipientIds(env, siteZone);
        const title = 'Retour magasin - Fiche renvoyée';
        const bodyTxt = `${String(existing?.site_name || '') || 'Site'} - fiche traitée par le magasin et renvoyée pour finalisation.`;

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
