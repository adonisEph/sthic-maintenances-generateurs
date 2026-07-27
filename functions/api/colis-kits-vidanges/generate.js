import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone, readJson, isoNow, newId } from '../_utils/http.js';
import { nextTicketNumberForZone, touchLastUpdatedAt, ticketPrefixFromZone, formatTicket } from '../_utils/meta.js';

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

async function ensureSentIntervention(env, data, siteId, zone, plannedDate, epvType, technicianName) {
  const now = isoNow();
  const technicianUserId = await resolveTechnicianUserId(env, zone, technicianName);

  const existing = await env.DB.prepare(
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

function mapFicheRow(row, siteZone) {
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
    interventionId: row.intervention_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    warehouseFlowStatus: row.warehouse_flow_status || null,
    sentToWarehouseBy: row.sent_to_warehouse_by || null,
    sentToWarehouseAt: row.sent_to_warehouse_at || null,
  };
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'warehouse' && role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const requesterZone = String(userZone(data) || 'BZV/POOL').trim().toUpperCase();
    const canAllZones = role === 'warehouse' || isSuperAdmin(data) || role === 'manager_bzv_pool';
    const useWarehouseFlow = role === 'warehouse' || isSuperAdmin(data) || role === 'manager_bzv_pool';

    const body = await readJson(request);
    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return json({ error: 'Aucun site sélectionné.' }, { status: 400 });
    }

    if (items.length > 50) {
      return json({ error: 'Trop de sites (maximum 50 par lot).' }, { status: 400 });
    }

    const now = isoNow();
    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const siteId = String(item?.siteId || '').trim();
      const plannedDate = item?.plannedDate ? String(item.plannedDate).slice(0, 10) : '';
      const epvType = String(item?.epvType || '').trim();
      const technicianName = String(item?.technician || '').trim();
      const siteName = String(item?.siteName || '').trim();

      if (!siteId || !plannedDate || !epvType || !technicianName) {
        errors.push({ index: i, siteId, error: 'Champs manquants (siteId, plannedDate, epvType, technician).' });
        continue;
      }

      try {
        const site = await env.DB.prepare('SELECT id, zone, retired FROM sites WHERE id = ?').bind(siteId).first();
        if (!site) {
          errors.push({ index: i, siteId, error: 'Site introuvable.' });
          continue;
        }
        if (Boolean(site?.retired)) {
          errors.push({ index: i, siteId, error: 'Site retiré.' });
          continue;
        }

        const zone = String(site.zone || 'BZV/POOL');

        // Zone authorization: managers restricted to their zone
        if (!canAllZones) {
          const siteZone = zone.trim().toUpperCase();
          if (siteZone !== requesterZone) {
            errors.push({ index: i, siteId, error: 'Accès interdit: site hors zone.' });
            continue;
          }
        }

        // 1) Ensure intervention sent
        const interventionId = await ensureSentIntervention(env, data, siteId, zone, plannedDate, epvType, technicianName);

        // 2) Reserve ticket number
        const n = await nextTicketNumberForZone(env, zone);
        const ticketLabel = formatTicket(n, zone);

        // 3) Create fiche_history
        //    - Warehouse/Manager BZV-POOL: status 'En attente' + warehouse_flow_status 'pending' (goes to Fiches process)
        //    - Manager PNR/KOUILOU/UPCN: status 'En attente' + no warehouse flow (goes to Historique, manager finalizes directly)
        const ficheId = newId();
        await env.DB.prepare(
          `INSERT INTO fiche_history
          (id, ticket_number, site_id, site_name, technician, date_generated, status, planned_date, epv_type, created_by,
           signature_typed_name, signature_drawn_png, signed_by_email, signed_at, intervention_id,
           sent_to_warehouse_by, sent_to_warehouse_at, warehouse_flow_status,
           created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            ficheId,
            ticketLabel,
            siteId,
            siteName,
            technicianName,
            now,
            'En attente',
            plannedDate,
            epvType,
            data?.user?.email ? String(data.user.email) : null,
            null,
            null,
            null,
            null,
            interventionId,
            useWarehouseFlow ? (data?.user?.email ? String(data.user.email) : null) : null,
            useWarehouseFlow ? now : null,
            useWarehouseFlow ? 'pending' : null,
            now,
            now
          )
          .run();

        const created = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(ficheId).first();
        results.push(mapFicheRow(created, zone));
      } catch (e) {
        errors.push({ index: i, siteId, error: e?.message || 'Erreur lors de la génération.' });
      }
    }

    await touchLastUpdatedAt(env);

    return json({ fiches: results, errors, total: results.length }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
