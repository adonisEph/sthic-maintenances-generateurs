import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.site_zone || row.zone || 'BZV/POOL',
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
    updatedAt: row.updated_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    let where = '1=1';
    const binds = [];

    if (from) {
      where += ' AND fh.date_generated >= ?';
      binds.push(from);
    }
    if (to) {
      where += ' AND fh.date_generated <= ?';
      binds.push(to);
    }

    const role = String(data?.user?.role || '');

    if (role === 'technician') {
      where += ' AND fh.technician = ?';
      binds.push(String(data.user.technicianName || ''));
    }

    if (!isSuperAdmin(data) && (role === 'manager' || role === 'technician')) {
      where += ' AND s.zone = ?';
      binds.push(String(userZone(data) || 'BZV/POOL'));
    }

    const stmt = env.DB.prepare(
      `SELECT fh.*, s.zone as site_zone 
      FROM fiche_history fh
      LEFT JOIN sites s ON s.id = fh.site_id
      WHERE ${where}
      ORDER BY fh.date_generated DESC
      LIMIT 2000`
    );
    const res = await stmt.bind(...binds).all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    return json(
      { fiches: rows.map(mapRow) },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
