import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone, readJson, isoNow, newId } from '../_utils/http.js';
import { nextTicketNumberForZone, touchLastUpdatedAt } from '../_utils/meta.js';

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
    sentToWarehouseBy: row.sent_to_warehouse_by || null,
    sentToWarehouseAt: row.sent_to_warehouse_at || null,
    warehouseFlowStatus: row.warehouse_flow_status || null,
    warehouseFinalizedBy: row.warehouse_finalized_by || null,
    warehouseFinalizedAt: row.warehouse_finalized_at || null,
  };
}

async function loadCollaboratorRecipientIds(env, siteZone) {
  const z = String(siteZone || 'BZV/POOL');

  if (z === 'BZV/POOL') {
    // Collaborateur strict: superadmin BZV/POOL (admin + zone BZV/POOL) + manager_bzv_pool
    const adminsRes = await env.DB.prepare("SELECT id FROM users WHERE (role = 'admin' OR role = 'manager_bzv_pool') AND zone = ?")
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
  if (z === 'PNR/KOUILOU' && (r === 'manager' || r === 'manager_bzv_pool')) {
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

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

async function resolveTechnicianUserId(env, zone, technicianName) {
  const key = normalizeName(technicianName);
  if (!key) return null;

  const res = await env.DB.prepare(
    "SELECT id, technician_name FROM users WHERE role = 'technician' AND (disabled_at IS NULL OR disabled_at = '') AND zone = ?"
  )
    .bind(String(zone || 'BZV/POOL'))
    .all();

  const rows = Array.isArray(res?.results) ? res.results : [];
  const match = rows.find((r) => normalizeName(r?.technician_name) === key) || null;
  return match?.id ? String(match.id) : null;
}

async function ensureSentInterventionForFiche(env, data, fiche, zone) {
  const siteId = String(fiche?.site_id || '').trim();
  const plannedDate = fiche?.planned_date ? String(fiche.planned_date).slice(0, 10) : '';
  const epvType = String(fiche?.epv_type || '').trim();
  const technicianName = String(fiche?.technician || '').trim();

  if (!siteId || !plannedDate || !epvType || !technicianName) {
    return fiche?.intervention_id ? String(fiche.intervention_id) : null;
  }

  const now = isoNow();
  const technicianUserId = await resolveTechnicianUserId(env, zone, technicianName);

  const byId = fiche?.intervention_id
    ? await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(String(fiche.intervention_id)).first()
    : null;

  const existing = byId || await env.DB.prepare(
    'SELECT * FROM interventions WHERE site_id = ? AND planned_date = ? AND epv_type = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(siteId, plannedDate, epvType)
    .first();

  if (existing?.id) {
    if (String(existing.status || '').trim() !== 'done') {
      await env.DB.prepare(
        "UPDATE interventions SET technician_user_id = COALESCE(?, technician_user_id), technician_name = ?, status = CASE WHEN status = 'planned' THEN 'sent' ELSE status END, sent_at = CASE WHEN status = 'planned' THEN COALESCE(sent_at, ?) ELSE sent_at END, updated_at = ? WHERE id = ?"
      )
        .bind(technicianUserId, technicianName, now, now, String(existing.id))
        .run();
    }
    return String(existing.id);
  }

  const id = newId();
  await env.DB.prepare(
    'INSERT INTO interventions (id, site_id, zone, planned_date, epv_type, technician_user_id, technician_name, status, sent_at, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, siteId, zone, plannedDate, epvType, technicianUserId, technicianName, 'sent', now, data?.user?.id || null, now, now)
    .run();

  return id;
}

export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const role = String(data?.user?.role || '').trim();
    const canWarehouse = role === 'warehouse';
    const canManage = role === 'admin' || role === 'manager' || role === 'manager_bzv_pool';
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

    if (role === 'admin' && !isSuperAdmin(data)) {
      const z = String(userZone(data) || 'BZV/POOL');
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    if (role === 'manager') {
      const z = String(userZone(data) || 'BZV/POOL');
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const body = await readJson(request);
    const mode = String(body?.mode || '').trim().toLowerCase();

    const now = isoNow();

    // 0b) Manager/Admin: revoke a fiche previously sent to warehouse
    // (no physical warehouse / user mistake). Not a hard delete: mark as Annulée.
    if (mode === 'revoke-send-to-warehouse') {
      if (!canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      const flowStatus = String(existing?.warehouse_flow_status || '').trim();
      if (!(st === 'Envoyée au magasin' || flowStatus === 'pending' || flowStatus === 'reopened')) {
        return json({ error: 'Statut incompatible.' }, { status: 409 });
      }

      const linkedInterventionId = String(existing?.intervention_id || '').trim();
      if (linkedInterventionId) {
        const linked = await env.DB.prepare('SELECT id, status FROM interventions WHERE id = ?').bind(linkedInterventionId).first();
        if (linked?.id && String(linked.status || '').trim() !== 'done') {
          await env.DB.prepare(
            "UPDATE interventions SET status = 'planned', sent_at = NULL, updated_at = ? WHERE id = ?"
          )
            .bind(now, linkedInterventionId)
            .run();
        }
      }

      await env.DB.prepare(
        'UPDATE fiche_history SET status = ?, warehouse_flow_status = NULL, warehouse_finalized_by = NULL, warehouse_finalized_at = NULL, updated_at = ? WHERE id = ?'
      )
        .bind('Annulée', now, id)
        .run();

      await touchLastUpdatedAt(env);

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    if (mode === 'send-to-warehouse') {
      if (!canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      const flowStatus = String(existing?.warehouse_flow_status || '').trim();
      if (st && st !== 'Brouillon' && st !== 'Envoyée au magasin' && !(st === 'En attente' && (flowStatus === 'pending' || flowStatus === 'reopened'))) {
        return json({ error: 'Statut incompatible.' }, { status: 409 });
      }

      const alreadyTicket = String(existing?.ticket_number || '').trim();
      const ticketLabel = alreadyTicket || (await reserveTicketLabel(env, role, zone));

      const ensuredInterventionId = await ensureSentInterventionForFiche(env, data, existing, zone);

      await env.DB.prepare(
        "UPDATE fiche_history SET ticket_number = ?, status = ?, signature_typed_name = ?, signature_drawn_png = ?, signed_by_email = ?, signed_at = ?, intervention_id = COALESCE(?, intervention_id), sent_to_warehouse_by = ?, sent_to_warehouse_at = ?, warehouse_flow_status = ?, warehouse_finalized_by = NULL, warehouse_finalized_at = NULL, updated_at = ? WHERE id = ?"
      )
        .bind(ticketLabel, 'En attente', null, null, null, null, ensuredInterventionId, data?.user?.email ? String(data.user.email) : null, now, 'pending', now, id)
        .run();

      await touchLastUpdatedAt(env);

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    if (mode === 'warehouse-check') {
      if (!canWarehouse && !canManage) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      const flowStatus = String(existing?.warehouse_flow_status || '').trim();
      if (canWarehouse && !(st === 'Envoyée au magasin' || st === 'Contrôle magasin' || (st === 'En attente' && (flowStatus === 'pending' || flowStatus === 'reopened')))) {
        return json({ error: 'Fiche non disponible pour le magasin.' }, { status: 409 });
      }

      const air = boolToDb(body?.warehouseAirFilterOk);
      const coolant = boolToDb(body?.warehouseCoolant5lOk);

      if (air === 1) {
        const campaignMonth = String((existing?.planned_date || existing?.date_generated || '')).slice(0, 7);
        if (campaignMonth) {
          const already = await env.DB.prepare(
            `SELECT id
             FROM fiche_history
             WHERE site_id = ?
               AND id != ?
               AND warehouse_air_filter_ok = 1
               AND substr(COALESCE(planned_date, date_generated), 1, 7) = ?
               AND (status IS NULL OR status != 'Annulée')
             LIMIT 1`
          )
            .bind(String(existing.site_id), id, campaignMonth)
            .first();
          if (already?.id) {
            return json({ error: 'Filtre à air GE déjà sorti pour cette campagne.' }, { status: 409 });
          }
        }
      }

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

      await touchLastUpdatedAt(env);

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    if (mode === 'warehouse-submit') {
      if (!canWarehouse) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      if (st && st !== 'Envoyée au magasin' && st !== 'Contrôle magasin') {
        return json({ error: 'Fiche non renvoyable (statut incompatible).' }, { status: 409 });
      }

      await env.DB.prepare(
        "UPDATE fiche_history SET status = ?, warehouse_flow_status = ?, updated_at = ? WHERE id = ?"
      )
        .bind('Contrôle magasin', 'pending', now, id)
        .run();

      await touchLastUpdatedAt(env);

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    if (mode === 'warehouse-finalize') {
      if (!canWarehouse) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      const flowStatus = String(existing?.warehouse_flow_status || '').trim();
      if (st === 'Annulée' || st === 'Effectuée' || !(flowStatus === 'pending' || flowStatus === 'reopened' || st === 'Envoyée au magasin' || st === 'Contrôle magasin')) {
        return json({ error: 'Fiche non finalisable.' }, { status: 409 });
      }

      const ticketNumber = String(body?.ticketNumber || existing?.ticket_number || '').trim();
      const signatureDrawnPng = String(body?.signatureDrawnPng || '').trim();

      if (!ticketNumber) return json({ error: 'Ticket requis.' }, { status: 400 });
      if (!hasResponsibleSignature(signatureDrawnPng)) return json({ error: 'Signature responsable obligatoire.' }, { status: 400 });

      const dup = await env.DB.prepare('SELECT id FROM fiche_history WHERE ticket_number = ? AND id != ?').bind(ticketNumber, id).first();
      if (dup?.id) return json({ error: 'Fiche déjà sortie pour ce ticket.' }, { status: 409 });

      await env.DB.prepare(
        'UPDATE fiche_history SET ticket_number = ?, status = ?, signature_typed_name = ?, signature_drawn_png = ?, signed_by_email = ?, signed_at = ?, warehouse_flow_status = ?, warehouse_finalized_by = ?, warehouse_finalized_at = ?, updated_at = ? WHERE id = ?'
      )
        .bind(
          ticketNumber,
          'En attente',
          null,
          null,
          null,
          null,
          'finalized',
          data?.user?.email ? String(data.user.email) : null,
          now,
          now,
          id
        )
        .run();

      await touchLastUpdatedAt(env);

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    if (mode === 'warehouse-reopen') {
      if (!canWarehouse) return json({ error: 'Accès interdit.' }, { status: 403 });

      const st = String(existing?.status || '').trim();
      const flowStatus = String(existing?.warehouse_flow_status || '').trim();
      if (st === 'Effectuée') return json({ error: 'Fiche déjà clôturée avec intervention effectuée.' }, { status: 409 });
      if (flowStatus !== 'finalized') return json({ error: 'Fiche non rouvable.' }, { status: 409 });

      await env.DB.prepare(
        'UPDATE fiche_history SET warehouse_flow_status = ?, updated_at = ? WHERE id = ?'
      )
        .bind('reopened', now, id)
        .run();

      await touchLastUpdatedAt(env);

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    if (mode === 'finalize') {
      if (!canManage || role === 'manager_bzv_pool') return json({ error: 'Accès interdit.' }, { status: 403 });

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
          null,
          null,
          null,
          null,
          now,
          id
        )
        .run();

      await touchLastUpdatedAt(env);

      const updated = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
      return json({ fiche: mapRow(updated, zone) }, { status: 200 });
    }

    return json({ error: 'Mode invalide.' }, { status: 400 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
