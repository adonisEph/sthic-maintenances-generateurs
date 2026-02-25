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
    zone: r.zone || 'BZV/POOL',
    plannedDate: r.planned_date,
    epvType: r.epv_type,
    technicianUserId: r.technician_user_id || null,
    technicianName: r.technician_name,
    status: r.status
  };
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const role = String(data?.user?.role || '');

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const today = ymdToday();

    const scopeZone = isSuperAdmin(data) || role === 'viewer' ? null : String(userZone(data) || 'BZV/POOL');

    const pmStmt = scopeZone
      ? env.DB.prepare(
          "SELECT * FROM pm_items WHERE month_id = ? AND COALESCE(region, zone, '') = ? AND substr(scheduled_wo_date, 1, 10) = ? ORDER BY scheduled_wo_date ASC, number ASC"
        ).bind(monthId, scopeZone, today)
      : env.DB.prepare(
          'SELECT * FROM pm_items WHERE month_id = ? AND substr(scheduled_wo_date, 1, 10) = ? ORDER BY scheduled_wo_date ASC, number ASC'
        ).bind(monthId, today);

    const intStmt = scopeZone
      ? env.DB.prepare(
          'SELECT * FROM interventions WHERE zone = ? AND planned_date = ? ORDER BY planned_date ASC'
        ).bind(scopeZone, today)
      : env.DB.prepare(
          'SELECT * FROM interventions WHERE planned_date = ? ORDER BY planned_date ASC'
        ).bind(today);

    const [pmRes, intRes] = await Promise.all([pmStmt.all(), intStmt.all()]);

    const pmItems = Array.isArray(pmRes?.results) ? pmRes.results.map(mapPmRow).filter(Boolean) : [];
    const interventions = Array.isArray(intRes?.results) ? intRes.results.map(mapInterventionRow).filter(Boolean) : [];

    return json({ today, pmItems, interventions }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
