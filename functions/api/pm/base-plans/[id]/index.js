import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, requireAdmin, isoNow } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

export async function onRequestDelete({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const planId = String(params?.id || '').trim();
    if (!planId) return json({ error: 'Plan requis.' }, { status: 400 });

    const plan = await env.DB.prepare('SELECT * FROM pm_base_plans WHERE id = ?').bind(planId).first();
    if (!plan) return json({ error: 'Plan introuvable.' }, { status: 404 });

    const now = isoNow();

    const delItemsRes = await env.DB.prepare('DELETE FROM pm_base_plan_items WHERE plan_id = ?').bind(planId).run();
    const deletedItems = Number(delItemsRes?.meta?.changes || 0);

    const delPlanRes = await env.DB.prepare('DELETE FROM pm_base_plans WHERE id = ?').bind(planId).run();
    const deletedPlans = Number(delPlanRes?.meta?.changes || 0);

    await touchLastUpdatedAt(env);

    return json({ ok: true, planId, month: plan?.month || null, deletedItems, deletedPlans, deletedAt: now }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
