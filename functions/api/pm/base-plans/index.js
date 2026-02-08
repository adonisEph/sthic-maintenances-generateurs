import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId } from '../../_utils/http.js';
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

    const res = await env.DB.prepare('SELECT * FROM pm_base_plans ORDER BY month DESC').all();
    const plans = Array.isArray(res?.results) ? res.results : [];

    const out = [];
    for (const p of plans) {
      const planId = String(p.id);
      const countRow = await env.DB.prepare('SELECT COUNT(1) as c FROM pm_base_plan_items WHERE plan_id = ?')
        .bind(planId)
        .first();
      out.push({
        id: planId,
        month: p.month,
        status: p.status,
        itemsCount: Number(countRow?.c || 0),
        generatedAt: p.generated_at || null,
        lockedAt: p.locked_at || null,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      });
    }

    return json({ plans: out }, { status: 200 });
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

    const now = isoNow();
    const existing = await env.DB.prepare('SELECT * FROM pm_base_plans WHERE month = ?').bind(month).first();

    if (existing?.id) {
      await env.DB.prepare('UPDATE pm_base_plans SET updated_at = ? WHERE id = ?').bind(now, String(existing.id)).run();
      await touchLastUpdatedAt(env);
      const updated = await env.DB.prepare('SELECT * FROM pm_base_plans WHERE id = ?').bind(String(existing.id)).first();
      return json({ plan: updated }, { status: 200 });
    }

    const id = newId();
    await env.DB.prepare(
      'INSERT INTO pm_base_plans (id, month, status, created_by_user_id, created_by_email, generated_at, locked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        id,
        month,
        'draft',
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null,
        null,
        null,
        now,
        now
      )
      .run();

    await touchLastUpdatedAt(env);

    const created = await env.DB.prepare('SELECT * FROM pm_base_plans WHERE id = ?').bind(id).first();
    return json({ plan: created }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
