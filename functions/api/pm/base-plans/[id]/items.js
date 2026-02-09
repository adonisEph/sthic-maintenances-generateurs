import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer' || role === 'manager';
}

function mapItemRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    planId: r.plan_id,
    siteId: r.site_id,
    siteCode: r.site_code,
    siteName: r.site_name,
    region: r.region,
    zone: r.zone,
    assignedTo: r.assigned_to,
    pairGroup: r.pair_group,
    epvSlot: r.epv_slot,
    shortDescription: r.short_description,
    recommendedMaintenanceType: r.recommended_maintenance_type,
    plannedDate: r.planned_date,
    state: r.state,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function normStr(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const role = String(data?.user?.role || '');
    const scopeZone = isSuperAdmin(data) || role === 'viewer' ? null : String(userZone(data) || 'BZV/POOL');

    const planId = String(params?.id || '').trim();
    if (!planId) return json({ error: 'Plan requis.' }, { status: 400 });

    const plan = await env.DB.prepare('SELECT * FROM pm_base_plans WHERE id = ?').bind(planId).first();
    if (!plan) return json({ error: 'Plan introuvable.' }, { status: 404 });

    const stmt = scopeZone
      ? env.DB.prepare(
          "SELECT * FROM pm_base_plan_items WHERE plan_id = ? AND COALESCE(region, zone, '') = ? ORDER BY planned_date ASC, site_code ASC, site_name ASC"
        ).bind(planId, scopeZone)
      : env.DB.prepare('SELECT * FROM pm_base_plan_items WHERE plan_id = ? ORDER BY planned_date ASC, site_code ASC, site_name ASC').bind(planId);

    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json({ items: rows.map(mapItemRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const planId = String(params?.id || '').trim();
    if (!planId) return json({ error: 'Plan requis.' }, { status: 400 });

    const plan = await env.DB.prepare('SELECT * FROM pm_base_plans WHERE id = ?').bind(planId).first();
    if (!plan) return json({ error: 'Plan introuvable.' }, { status: 404 });

    const body = await readJson(request);
    const items = Array.isArray(body?.items) ? body.items : [];

    const now = isoNow();

    await env.DB.prepare('DELETE FROM pm_base_plan_items WHERE plan_id = ?').bind(planId).run();

    let inserted = 0;
    for (const it of items) {
      const plannedDate = String(it?.plannedDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) continue;

      const id = newId();
      await env.DB.prepare(
        'INSERT INTO pm_base_plan_items (id, plan_id, site_id, site_code, site_name, region, zone, assigned_to, pair_group, epv_slot, short_description, recommended_maintenance_type, planned_date, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          id,
          planId,
          normStr(it?.siteId),
          normStr(it?.siteCode),
          normStr(it?.siteName),
          normStr(it?.region),
          normStr(it?.zone),
          normStr(it?.assignedTo),
          normStr(it?.pairGroup),
          normStr(it?.epvSlot),
          normStr(it?.shortDescription),
          normStr(it?.recommendedMaintenanceType),
          plannedDate,
          String(it?.state || 'Planned'),
          now,
          now
        )
        .run();
      inserted += 1;
    }

    await env.DB.prepare('UPDATE pm_base_plans SET updated_at = ? WHERE id = ?').bind(now, planId).run();

    await touchLastUpdatedAt(env);

    return json({ ok: true, inserted }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
