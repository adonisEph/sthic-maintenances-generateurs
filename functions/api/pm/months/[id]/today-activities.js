import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, ymdToday, isSuperAdmin, userZone } from '../../../_utils/http.js';
import { calculateEPVDates, calculateEstimatedNH } from '../../../_utils/calc.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer' || role === 'manager';
}

function mapPmRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    number: r.number,
    siteCode: r.site_code,
    siteName: r.site_name,
    zone: r.zone,
    region: r.region,
    maintenanceType: r.maintenance_type,
    shortDescription: r.short_description,
    scheduledWoDate: r.scheduled_wo_date,
    assignedTo: r.assigned_to,
    assignedToZone: r.assigned_to_zone || null,
    state: r.state,
    closedAt: r.closed_at,
    createdSource: r.created_source
  };
}

function mapInterventionRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    siteId: r.site_id,
    siteCode: r.site_code || null,
    siteName: r.site_name || null,
    zone: r.zone || 'BZV/POOL',
    plannedDate: r.planned_date,
    epvType: r.epv_type,
    technicianUserId: r.technician_user_id || null,
    technicianName: r.technician_name,
    technicianZone: r.technician_zone || null,
    status: r.status,
    ticketNumber: r.ticket_number || null,
    epv1DoneInMonth: Boolean(r.epv1_done_in_month),
    epv2DoneInMonth: Boolean(r.epv2_done_in_month)
  };
}

export async function onRequestGet({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const role = String(data?.user?.role || '');

    const url = new URL(request.url);
    const dateParam = String(url.searchParams.get('date') || '').trim();
    const chosenDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : '';
    const today = chosenDate || ymdToday();

    const monthYyyyMm = String(today).slice(0, 7);

    const scopeZone = isSuperAdmin(data) || role === 'viewer' ? null : String(userZone(data) || 'BZV/POOL');

    const pmStmt = scopeZone
      ? env.DB.prepare(
          "SELECT p.*, u.zone as assigned_to_zone FROM pm_items p LEFT JOIN users u ON u.technician_name = p.assigned_to WHERE COALESCE(p.region, p.zone, '') = ? AND substr(p.scheduled_wo_date, 1, 10) = ? ORDER BY p.scheduled_wo_date ASC, p.number ASC"
        ).bind(scopeZone, today)
      : env.DB.prepare(
          'SELECT p.*, u.zone as assigned_to_zone FROM pm_items p LEFT JOIN users u ON u.technician_name = p.assigned_to WHERE substr(p.scheduled_wo_date, 1, 10) = ? ORDER BY p.scheduled_wo_date ASC, p.number ASC'
        ).bind(today);

    const sitesStmt = scopeZone
      ? env.DB.prepare(
          'SELECT id, id_site, name_site, zone, technician, nh1_dv, nh2_a, date_a, regime, seuil, retired FROM sites WHERE retired = 0 AND zone = ? ORDER BY id_site ASC'
        ).bind(scopeZone)
      : env.DB.prepare(
          'SELECT id, id_site, name_site, zone, technician, nh1_dv, nh2_a, date_a, regime, seuil, retired FROM sites WHERE retired = 0 ORDER BY id_site ASC'
        );

    const [pmRes, sitesRes] = await Promise.all([pmStmt.all(), sitesStmt.all()]);

    const pmItems = Array.isArray(pmRes?.results) ? pmRes.results.map(mapPmRow).filter(Boolean) : [];

    const sites = Array.isArray(sitesRes?.results) ? sitesRes.results : [];
    const planned = [];

    for (const s of sites) {
      if (!s || Number(s.retired) === 1) continue;
      const zone = String(s.zone || 'BZV/POOL');
      const nhEstimated = calculateEstimatedNH(s.nh2_a, s.date_a, s.regime);
      const epv = calculateEPVDates(s.regime, s.nh1_dv, nhEstimated, s.seuil);
      const sid = String(s.id || '').trim();
      if (!sid) continue;
      const siteCode = String(s.id_site || '').trim() || null;
      const siteName = String(s.name_site || '').trim() || null;
      const technician = String(s.technician || '').trim() || '-';

      const add = (epvType, plannedDate) => {
        const d = String(plannedDate || '').slice(0, 10);
        if (d !== today) return;
        planned.push({
          siteId: sid,
          siteCode,
          siteName,
          zone,
          epvType,
          plannedDate: d,
          technicianName: technician
        });
      };

      add('EPV1', epv?.epv1);
      add('EPV2', epv?.epv2);
      add('EPV3', epv?.epv3);
    }

    const plannedKey = (p) => `${p.siteId}::${p.plannedDate}::${p.epvType}`;
    const plannedMap = new Map(planned.map((p) => [plannedKey(p), p]));

    const siteIds = Array.from(new Set(planned.map((p) => p.siteId).filter(Boolean)));
    const interventionsByKey = new Map();
    const monthDoneEpv1 = new Set();
    const monthDoneEpv2 = new Set();

    if (siteIds.length > 0) {
      const placeholders = siteIds.map(() => '?').join(',');

      const doneStmt = env.DB.prepare(
        `SELECT site_id, epv_type FROM interventions WHERE status = 'done' AND substr(planned_date, 1, 7) = ? AND epv_type IN ('EPV1','EPV2') AND site_id IN (${placeholders})`
      );
      const doneRes = await doneStmt.bind(monthYyyyMm, ...siteIds).all();
      const doneRows = Array.isArray(doneRes?.results) ? doneRes.results : [];
      for (const r of doneRows) {
        const sid = String(r?.site_id || '').trim();
        const t = String(r?.epv_type || '').trim().toUpperCase();
        if (!sid) continue;
        if (t === 'EPV1') monthDoneEpv1.add(sid);
        if (t === 'EPV2') monthDoneEpv2.add(sid);
      }

      const intStmt = env.DB.prepare(
        `SELECT i.*, u.zone as technician_zone, fh.ticket_number
         FROM interventions i
         LEFT JOIN users u ON u.id = i.technician_user_id
         LEFT JOIN fiche_history fh ON fh.intervention_id = i.id
         WHERE i.planned_date = ? AND i.epv_type IN ('EPV1','EPV2','EPV3') AND i.site_id IN (${placeholders})`
      );
      const intRes = await intStmt.bind(today, ...siteIds).all();
      const intRows = Array.isArray(intRes?.results) ? intRes.results : [];
      for (const r of intRows) {
        const key = `${String(r?.site_id || '').trim()}::${String(r?.planned_date || '').slice(0, 10)}::${String(r?.epv_type || '').trim().toUpperCase()}`;
        interventionsByKey.set(key, r);
      }
    }

    const interventions = Array.from(plannedMap.values()).map((p) => {
      const k = plannedKey(p);
      const row = interventionsByKey.get(k);
      const out = {
        id: row?.id || `epv:${p.siteId}:${p.epvType}:${p.plannedDate}`,
        site_id: p.siteId,
        site_code: p.siteCode,
        site_name: p.siteName,
        zone: p.zone,
        planned_date: p.plannedDate,
        epv_type: p.epvType,
        technician_user_id: row?.technician_user_id || null,
        technician_name: row?.technician_name || p.technicianName,
        technician_zone: row?.technician_zone || null,
        status: row?.status || 'planned',
        ticket_number: row?.ticket_number || null,
        epv1_done_in_month: monthDoneEpv1.has(p.siteId) ? 1 : 0,
        epv2_done_in_month: monthDoneEpv2.has(p.siteId) ? 1 : 0
      };
      return mapInterventionRow(out);
    }).filter(Boolean);

    return json({ today, pmItems, interventions }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
