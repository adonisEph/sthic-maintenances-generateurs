import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, ymdToday, isSuperAdmin, userZone } from '../../../_utils/http.js';

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

    const intStmt = scopeZone
      ? env.DB.prepare(
          `SELECT
            COALESCE(i.id, 'epv:' || s.id || ':' || v.epv_type || ':' || v.planned_date) as id,
            s.id as site_id,
            s.id_site as site_code,
            s.name_site as site_name,
            COALESCE(s.zone, 'BZV/POOL') as zone,
            v.planned_date,
            v.epv_type,
            i.technician_user_id,
            i.technician_name,
            u.zone as technician_zone,
            COALESCE(i.status, 'planned') as status,
            fh.ticket_number,
            EXISTS(
              SELECT 1 FROM interventions d
              WHERE d.site_id = s.id AND d.epv_type = 'EPV1' AND d.status = 'done'
                AND substr(d.planned_date, 1, 7) = ?
              LIMIT 1
            ) as epv1_done_in_month,
            EXISTS(
              SELECT 1 FROM interventions d
              WHERE d.site_id = s.id AND d.epv_type = 'EPV2' AND d.status = 'done'
                AND substr(d.planned_date, 1, 7) = ?
              LIMIT 1
            ) as epv2_done_in_month
          FROM (
            SELECT id as site_id, substr(epv1, 1, 10) as planned_date, 'EPV1' as epv_type FROM sites WHERE retired = 0 AND substr(epv1, 1, 10) = ?
            UNION ALL
            SELECT id as site_id, substr(epv2, 1, 10) as planned_date, 'EPV2' as epv_type FROM sites WHERE retired = 0 AND substr(epv2, 1, 10) = ?
            UNION ALL
            SELECT id as site_id, substr(epv3, 1, 10) as planned_date, 'EPV3' as epv_type FROM sites WHERE retired = 0 AND substr(epv3, 1, 10) = ?
          ) v
          JOIN sites s ON s.id = v.site_id
          LEFT JOIN interventions i ON i.site_id = s.id AND i.epv_type = v.epv_type AND i.planned_date = v.planned_date
          LEFT JOIN users u ON u.id = i.technician_user_id
          LEFT JOIN fiche_history fh ON fh.intervention_id = i.id
          WHERE COALESCE(s.zone, 'BZV/POOL') = ?
          ORDER BY v.planned_date ASC, s.id_site ASC`
        ).bind(monthYyyyMm, monthYyyyMm, today, today, today, scopeZone)
      : env.DB.prepare(
          `SELECT
            COALESCE(i.id, 'epv:' || s.id || ':' || v.epv_type || ':' || v.planned_date) as id,
            s.id as site_id,
            s.id_site as site_code,
            s.name_site as site_name,
            COALESCE(s.zone, 'BZV/POOL') as zone,
            v.planned_date,
            v.epv_type,
            i.technician_user_id,
            i.technician_name,
            u.zone as technician_zone,
            COALESCE(i.status, 'planned') as status,
            fh.ticket_number,
            EXISTS(
              SELECT 1 FROM interventions d
              WHERE d.site_id = s.id AND d.epv_type = 'EPV1' AND d.status = 'done'
                AND substr(d.planned_date, 1, 7) = ?
              LIMIT 1
            ) as epv1_done_in_month,
            EXISTS(
              SELECT 1 FROM interventions d
              WHERE d.site_id = s.id AND d.epv_type = 'EPV2' AND d.status = 'done'
                AND substr(d.planned_date, 1, 7) = ?
              LIMIT 1
            ) as epv2_done_in_month
          FROM (
            SELECT id as site_id, substr(epv1, 1, 10) as planned_date, 'EPV1' as epv_type FROM sites WHERE retired = 0 AND substr(epv1, 1, 10) = ?
            UNION ALL
            SELECT id as site_id, substr(epv2, 1, 10) as planned_date, 'EPV2' as epv_type FROM sites WHERE retired = 0 AND substr(epv2, 1, 10) = ?
            UNION ALL
            SELECT id as site_id, substr(epv3, 1, 10) as planned_date, 'EPV3' as epv_type FROM sites WHERE retired = 0 AND substr(epv3, 1, 10) = ?
          ) v
          JOIN sites s ON s.id = v.site_id
          LEFT JOIN interventions i ON i.site_id = s.id AND i.epv_type = v.epv_type AND i.planned_date = v.planned_date
          LEFT JOIN users u ON u.id = i.technician_user_id
          LEFT JOIN fiche_history fh ON fh.intervention_id = i.id
          ORDER BY v.planned_date ASC, s.id_site ASC`
        ).bind(monthYyyyMm, monthYyyyMm, today, today, today);

    const [pmRes, intRes] = await Promise.all([pmStmt.all(), intStmt.all()]);

    const pmItems = Array.isArray(pmRes?.results) ? pmRes.results.map(mapPmRow).filter(Boolean) : [];
    const interventions = Array.isArray(intRes?.results) ? intRes.results.map(mapInterventionRow).filter(Boolean) : [];

    return json({ today, pmItems, interventions }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
