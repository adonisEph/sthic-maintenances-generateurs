import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, requireAuth, readJson, isoNow, newId, ymdToday } from '../_utils/http.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    plannedDate: row.planned_date,
    epvType: row.epv_type,
    technicianUserId: row.technician_user_id || null,
    technicianName: row.technician_name,
    status: row.status,
    sentAt: row.sent_at || null,
    doneAt: row.done_at || null,
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
    const status = url.searchParams.get('status');

    let where = '1=1';
    const binds = [];

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

    if (data.user.role !== 'admin') {
      where += ' AND technician_user_id = ?';
      binds.push(data.user.id);
    }

    const stmt = env.DB.prepare(`SELECT * FROM interventions WHERE ${where} ORDER BY planned_date ASC`);
    const res = await stmt.bind(...binds).all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json({ interventions: rows.map(mapRow), today: ymdToday() }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const plannedDate = String(body.plannedDate || '');
    const epvType = String(body.epvType || '');
    const siteId = String(body.siteId || '');
    const technicianUserId = body.technicianUserId ? String(body.technicianUserId) : null;
    const technicianName = String(body.technicianName || '');

    if (!plannedDate || !epvType || !siteId || !technicianName) {
      return json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    const id = newId();
    const now = isoNow();

    await env.DB.prepare(
      'INSERT INTO interventions (id, site_id, planned_date, epv_type, technician_user_id, technician_name, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, siteId, plannedDate, epvType, technicianUserId, technicianName, 'planned', data.user.id, now, now)
      .run();

    const created = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    return json({ intervention: mapRow(created) }, { status: 201 });
  } catch (e) {
    const msg = String(e?.message || 'Erreur serveur.');
    if (msg.toLowerCase().includes('unique')) {
      return json({ error: 'Intervention déjà planifiée.' }, { status: 409 });
    }
    return json({ error: msg }, { status: 500 });
  }
}
