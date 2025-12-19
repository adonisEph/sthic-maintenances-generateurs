import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth } from '../_utils/http.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
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
      where += ' AND date_generated >= ?';
      binds.push(from);
    }
    if (to) {
      where += ' AND date_generated <= ?';
      binds.push(to);
    }

    if (data.user.role === 'technician') {
      where += ' AND technician = ?';
      binds.push(String(data.user.technicianName || ''));
    }

    const stmt = env.DB.prepare(`SELECT * FROM fiche_history WHERE ${where} ORDER BY date_generated DESC LIMIT 2000`);
    const res = await stmt.bind(...binds).all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    return json({ fiches: rows.map(mapRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
