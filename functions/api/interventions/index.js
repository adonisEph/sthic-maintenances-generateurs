import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, ymdToday, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.zone || 'BZV/POOL',
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
    const technicianUserId = url.searchParams.get('technicianUserId');

    let where = '1=1';
    const binds = [];

    const z = userZone(data);
    if (!isSuperAdmin(data) && (data.user.role === 'manager' || data.user.role === 'technician')) {
      where += ' AND zone = ?';
      binds.push(z);
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
      binds.push(data.user.id);
    } else if (data.user.role === 'admin' && technicianUserId) {
      where += ' AND technician_user_id = ?';
      binds.push(String(technicianUserId));
    }

    const stmt = env.DB.prepare(`SELECT * FROM interventions WHERE ${where} ORDER BY planned_date ASC`);
    const res = await stmt.bind(...binds).all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json(
      { interventions: rows.map(mapRow), today: ymdToday() },
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

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const plannedDate = String(body.plannedDate || '');
    const epvType = String(body.epvType || '');
    const siteId = String(body.siteId || '');
    const technicianUserId = body.technicianUserId ? String(body.technicianUserId) : null;
    const technicianName = String(body.technicianName || '');

    if (!plannedDate || !epvType || !siteId || !technicianName) {
      return json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    const site = await env.DB.prepare('SELECT id, zone FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });
    const zone = String(site.zone || 'BZV/POOL');
    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const id = newId();
    const now = isoNow();

    await env.DB.prepare(
      'INSERT INTO interventions (id, site_id, zone, planned_date, epv_type, technician_user_id, technician_name, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, siteId, zone, plannedDate, epvType, technicianUserId, technicianName, 'planned', data.user.id, now, now)
      .run();

    await touchLastUpdatedAt(env);

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

export async function onRequestDelete({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const id = String(body?.id || '').trim();
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const row = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    if (!row) return json({ ok: true, deleted: 0 }, { status: 200 });

    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if (String(row.zone || 'BZV/POOL') !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    if (String(row.status || '') === 'done') {
      return json({ error: 'Impossible de supprimer une intervention effectuée.' }, { status: 400 });
    }

    const res = await env.DB.prepare("DELETE FROM interventions WHERE id = ? AND status != 'done'")
      .bind(id)
      .run();

    if ((res?.meta?.changes || 0) > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, deleted: Number(res?.meta?.changes || 0) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
