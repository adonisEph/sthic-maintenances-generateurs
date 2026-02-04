import { ensureAdminUser } from '../_utils/db.js';
import { json, readJson, requireAdmin } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

const BASE_PLAN_TABLES = ['pm_base_plan_items', 'pm_base_plans'];
const INTELLIGENT_PLAN_TABLES = ['pm_items', 'pm_imports', 'pm_noc_rows', 'pm_months', 'pm_assignments'];

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    if (!env.DB) {
      return json({ error: 'Binding D1 manquant: DB' }, { status: 500 });
    }

    const safeDelete = async (table) => {
      try {
        return await env.DB.prepare(`DELETE FROM ${table}`).run();
      } catch {
        return { meta: { changes: 0 } };
      }
    };

    const body = await readJson(request);
    const purgeBasePlans = Boolean(body?.purgeBasePlans);
    const purgeIntelligent = Boolean(body?.purgeIntelligent);

    if (!purgeBasePlans && !purgeIntelligent) {
      return json({ error: 'Aucune option de purge sélectionnée.' }, { status: 400 });
    }

    const tablesToPurge = [];
    if (purgeBasePlans) tablesToPurge.push(...BASE_PLAN_TABLES);
    if (purgeIntelligent) tablesToPurge.push(...INTELLIGENT_PLAN_TABLES);

    const deleted = {};
    for (const table of tablesToPurge) {
      const res = await safeDelete(table);
      deleted[table] = res?.meta?.changes || 0;
    }

    await touchLastUpdatedAt(env);

    return json({ ok: true, deleted }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
