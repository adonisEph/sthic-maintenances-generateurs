import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer' || role === 'manager';
}

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const role = String(data?.user?.role || '');
    const scopeZone = isSuperAdmin(data) || role === 'viewer' ? null : String(userZone(data) || 'BZV/POOL');

    const res = await env.DB.prepare('SELECT * FROM pm_months ORDER BY month DESC').all();
    const months = Array.isArray(res?.results) ? res.results : [];

    const out = [];
    for (const m of months) {
      const monthId = String(m.id);
      const countRow = scopeZone
        ? await env.DB.prepare("SELECT COUNT(1) as c FROM pm_items WHERE month_id = ? AND COALESCE(region, zone, '') = ?")
            .bind(monthId, scopeZone)
            .first()
        : await env.DB.prepare('SELECT COUNT(1) as c FROM pm_items WHERE month_id = ?').bind(monthId).first();
      const lastImport = await env.DB.prepare(
        'SELECT imported_at FROM pm_imports WHERE month_id = ? ORDER BY imported_at DESC LIMIT 1'
      )
        .bind(monthId)
        .first();

      out.push({
        id: monthId,
        month: m.month,
        title: m.title,
        itemsCount: Number(countRow?.c || 0),
        lastImportAt: lastImport?.imported_at ? String(lastImport.imported_at) : null,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      });
    }

    return json({ months: out }, { status: 200 });
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
    const month = String(body?.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'Mois invalide (YYYY-MM).' }, { status: 400 });

    const title = String(body?.title || '').trim() || null;
    const existing = await env.DB.prepare('SELECT * FROM pm_months WHERE month = ?').bind(month).first();
    const now = isoNow();

    if (existing?.id) {
      await env.DB.prepare('UPDATE pm_months SET title = COALESCE(?, title), updated_at = ? WHERE id = ?')
        .bind(title, now, String(existing.id))
        .run();
      await touchLastUpdatedAt(env);
      const updated = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(String(existing.id)).first();
      return json({ month: updated }, { status: 200 });
    }

    const id = newId();
    await env.DB.prepare(
      'INSERT INTO pm_months (id, month, title, created_by_user_id, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        id,
        month,
        title,
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null,
        now,
        now
      )
      .run();

    await touchLastUpdatedAt(env);

    const created = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(id).first();
    return json({ month: created }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
