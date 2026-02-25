import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson } from '../_utils/http.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const body = await readJson(request);
    const endpoint = String(body?.endpoint || body?.subscription?.endpoint || '').trim();
    if (!endpoint) return json({ error: 'endpoint requis.' }, { status: 400 });

    const userId = String(data.user.id);

    const res = await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .bind(userId, endpoint)
      .run();

    return json({ ok: true, deleted: Number(res?.meta?.changes || 0) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
