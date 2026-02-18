import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function normYmd(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    dateYmd: r.date_ymd,
    label: r.label || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'viewer') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const from = normYmd(url.searchParams.get('from'));
    const to = normYmd(url.searchParams.get('to'));

    let where = '1=1';
    const bind = [];

    if (from) {
      where += ' AND date_ymd >= ?';
      bind.push(from);
    }
    if (to) {
      where += ' AND date_ymd <= ?';
      bind.push(to);
    }

    const stmt = env.DB.prepare(`SELECT * FROM holidays WHERE ${where} ORDER BY date_ymd ASC`).bind(...bind);
    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    const scopeZone = (role === 'admin' || role === 'manager') && !isSuperAdmin(data) ? userZone(data) : null;

    return json({ holidays: rows.map(mapRow).filter(Boolean), scopeZone }, { status: 200 });
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
    const dateYmd = normYmd(body?.dateYmd);
    const label = String(body?.label || '').trim();

    if (!dateYmd) return json({ error: 'dateYmd invalide.' }, { status: 400 });

    const now = isoNow();
    const id = newId();

    await env.DB.prepare(
      'INSERT OR IGNORE INTO holidays (id, date_ymd, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(id, dateYmd, label || null, now, now)
      .run();

    await env.DB.prepare(
      'UPDATE holidays SET label = COALESCE(?, label), updated_at = ? WHERE date_ymd = ?'
    )
      .bind(label || null, now, dateYmd)
      .run();

    await touchLastUpdatedAt(env);

    const row = await env.DB.prepare('SELECT * FROM holidays WHERE date_ymd = ?').bind(dateYmd).first();
    return json({ holiday: mapRow(row) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const dateYmd = normYmd(body?.dateYmd);
    const id = String(body?.id || '').trim();

    if (!dateYmd && !id) return json({ error: 'id ou dateYmd requis.' }, { status: 400 });

    const res = id
      ? await env.DB.prepare('DELETE FROM holidays WHERE id = ?').bind(id).run()
      : await env.DB.prepare('DELETE FROM holidays WHERE date_ymd = ?').bind(dateYmd).run();

    if ((res?.meta?.changes || 0) > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, deleted: Number(res?.meta?.changes || 0) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
