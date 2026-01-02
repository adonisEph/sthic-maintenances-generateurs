import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, readJson } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

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
    const includePm = Boolean(body?.includePm);

    const resSites = await safeDelete('sites');
    const resInterventions = await safeDelete('interventions');
    const resFiche = await safeDelete('fiche_history');
    const resPresence = await safeDelete('presence_sessions');

    const resPmMonths = includePm ? await safeDelete('pm_months') : { meta: { changes: 0 } };
    const resPmItems = includePm ? await safeDelete('pm_items') : { meta: { changes: 0 } };
    const resPmImports = includePm ? await safeDelete('pm_imports') : { meta: { changes: 0 } };
    const resPmNocRows = includePm ? await safeDelete('pm_noc_rows') : { meta: { changes: 0 } };

    await env.DB.prepare(
      "INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES ('ticket_number', '1179')"
    ).run();

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        deleted: {
          sites: resSites?.meta?.changes || 0,
          interventions: resInterventions?.meta?.changes || 0,
          ficheHistory: resFiche?.meta?.changes || 0,
          presenceSessions: resPresence?.meta?.changes || 0,
          pmMonths: resPmMonths?.meta?.changes || 0,
          pmItems: resPmItems?.meta?.changes || 0,
          pmImports: resPmImports?.meta?.changes || 0,
          pmNocRows: resPmNocRows?.meta?.changes || 0
        }
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
