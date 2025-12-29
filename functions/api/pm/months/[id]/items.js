import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth } from '../../../_utils/http.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer';
}

function mapItemRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    monthId: r.month_id,
    number: r.number,
    siteCode: r.site_code,
    siteName: r.site_name,
    region: r.region,
    zone: r.zone,
    shortDescription: r.short_description,
    maintenanceType: r.maintenance_type,
    scheduledWoDate: r.scheduled_wo_date,
    assignedTo: r.assigned_to,
    state: r.state,
    closedAt: r.closed_at,
    lastNocImportAt: r.last_noc_import_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const res = await env.DB.prepare('SELECT * FROM pm_items WHERE month_id = ? ORDER BY scheduled_wo_date ASC, number ASC')
      .bind(monthId)
      .all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json({ items: rows.map(mapItemRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
