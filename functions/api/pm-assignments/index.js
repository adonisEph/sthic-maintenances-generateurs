import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    month: row.month,
    pmNumber: row.pm_number,
    siteId: row.site_id,
    siteCode: row.site_code,
    zone: row.zone || null,
    plannedDate: row.planned_date,
    maintenanceType: row.maintenance_type,
    technicianUserId: row.technician_user_id,
    technicianName: row.technician_name,
    status: row.status,
    pmState: row.pm_state || null,
    scheduledWoDate: row.scheduled_wo_date || null,
    closedAt: row.closed_at || null,
    reprogrammationDate: row.reprogrammation_date || null,
    reprogrammationStatus: row.reprogrammation_status || null,
    sentAt: row.sent_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'technician' && role !== 'manager') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const status = url.searchParams.get('status');
    const technicianUserId = url.searchParams.get('technicianUserId');

    let where = '1=1';
    const binds = [];

    // Scope zone: admin non-super-admin + manager => zone limitée
    if ((role === 'admin' || role === 'manager') && !isSuperAdmin(data)) {
      where += ' AND s.zone = ?';
      binds.push(userZone(data));
    }

    if (from) {
      where += ' AND planned_date >= ?';
      binds.push(from);
    }
    if (to) {
      where += ' AND planned_date <= ?';
      binds.push(to);
    }
    if (status) {
      where += ' AND status = ?';
      binds.push(status);
    }

    if (data.user.role === 'technician') {
      where += ' AND technician_user_id = ?';
      binds.push(String(data.user.id));
    } else if (data.user.role === 'admin' && technicianUserId) {
      where += ' AND technician_user_id = ?';
      binds.push(String(technicianUserId));
    }

    const stmt = env.DB.prepare(
      `SELECT a.*, s.zone AS zone, m.id AS pm_month_id, i.state AS pm_state, i.scheduled_wo_date, i.closed_at, i.reprogrammation_date, i.reprogrammation_status
       FROM pm_assignments a
       LEFT JOIN sites s ON s.id = a.site_id
       LEFT JOIN pm_months m ON m.month = a.month
       LEFT JOIN pm_items i ON i.month_id = m.id AND i.number = a.pm_number
       WHERE ${where}
       ORDER BY a.planned_date ASC, a.pm_number ASC`
    );
    const res = await stmt.bind(...binds).all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json({ assignments: rows.map(mapRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
