import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

export async function onRequestPost({ env, data }) {
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

    const resSites = await safeDelete('sites');
    const resInterventions = await safeDelete('interventions');
    const resFiche = await safeDelete('fiche_history');
    const resPresence = await safeDelete('presence_sessions');

    await env.DB.prepare(
      "INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES ('ticket_number', '1149')"
    ).run();

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        deleted: {
          sites: resSites?.meta?.changes || 0,
          interventions: resInterventions?.meta?.changes || 0,
          ficheHistory: resFiche?.meta?.changes || 0,
          presenceSessions: resPresence?.meta?.changes || 0
        }
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
