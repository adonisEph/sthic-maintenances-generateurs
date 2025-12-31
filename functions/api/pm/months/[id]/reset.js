import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, requireAdmin, readJson, isoNow } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const month = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(monthId).first();
    if (!month) return json({ error: 'Mois introuvable.' }, { status: 404 });

    const body = await readJson(request);
    const mode = String(body?.mode || '').trim().toLowerCase();
    if (mode !== 'imports' && mode !== 'all') {
      return json({ error: 'Mode invalide. (imports|all)' }, { status: 400 });
    }

    const now = isoNow();

    const nocRowsRes = await env.DB.prepare('DELETE FROM pm_noc_rows WHERE month_id = ?').bind(monthId).run();
    const importsRes = await env.DB.prepare('DELETE FROM pm_imports WHERE month_id = ?').bind(monthId).run();

    let itemsDeleted = 0;
    if (mode === 'all') {
      const itemsRes = await env.DB.prepare('DELETE FROM pm_items WHERE month_id = ?').bind(monthId).run();
      itemsDeleted = Number(itemsRes?.meta?.changes || 0);
    }

    await env.DB.prepare('UPDATE pm_months SET updated_at = ? WHERE id = ?').bind(now, monthId).run();
    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        mode,
        deleted: {
          nocRows: Number(nocRowsRes?.meta?.changes || 0),
          imports: Number(importsRes?.meta?.changes || 0),
          items: itemsDeleted
        }
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
