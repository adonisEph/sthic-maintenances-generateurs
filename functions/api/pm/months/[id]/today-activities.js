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
    status: r.status
  };
}

export async function onRequestGet({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const role = String(data?.user?.role || '');

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const url = new URL(request.url);
    const dateParam = String(url.searchParams.get('date') || '').trim();
    const chosenDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : '';
    const today = chosenDate || ymdToday();

    const scopeZone = isSuperAdmin(data) || role === 'viewer' ? null : String(userZone(data) || 'BZV/POOL');

    const pmStmt = scopeZone
      ? env.DB.prepare(
          "SELECT p.*, u.zone as assigned_to_zone FROM pm_items p LEFT JOIN users u ON u.technician_name = p.assigned_to WHERE p.month_id = ? AND COALESCE(p.region, p.zone, '') = ? AND substr(p.scheduled_wo_date, 1, 10) = ? ORDER BY p.scheduled_wo_date ASC, p.number ASC"
        ).bind(monthId, scopeZone, today)
      : env.DB.prepare(
          'SELECT p.*, u.zone as assigned_to_zone FROM pm_items p LEFT JOIN users u ON u.technician_name = p.assigned_to WHERE p.month_id = ? AND substr(p.scheduled_wo_date, 1, 10) = ? ORDER BY p.scheduled_wo_date ASC, p.number ASC'
        ).bind(monthId, today);

    const intStmt = scopeZone
      ? env.DB.prepare(
          "SELECT i.*, s.id_site as site_code, s.name_site as site_name, COALESCE(s.zone, i.zone) as zone, u.zone as technician_zone FROM interventions i LEFT JOIN sites s ON s.id = i.site_id LEFT JOIN users u ON u.id = i.technician_user_id WHERE COALESCE(s.zone, i.zone) = ? AND i.planned_date = ? ORDER BY i.planned_date ASC"
        ).bind(scopeZone, today)
      : env.DB.prepare(
          'SELECT i.*, s.id_site as site_code, s.name_site as site_name, COALESCE(s.zone, i.zone) as zone, u.zone as technician_zone FROM interventions i LEFT JOIN sites s ON s.id = i.site_id LEFT JOIN users u ON u.id = i.technician_user_id WHERE i.planned_date = ? ORDER BY i.planned_date ASC'
        ).bind(today);

    const [pmRes, intRes] = await Promise.all([pmStmt.all(), intStmt.all()]);

    const pmItems = Array.isArray(pmRes?.results) ? pmRes.results.map(mapPmRow).filter(Boolean) : [];
    const interventions = Array.isArray(intRes?.results) ? intRes.results.map(mapInterventionRow).filter(Boolean) : [];

    return json({ today, pmItems, interventions }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
