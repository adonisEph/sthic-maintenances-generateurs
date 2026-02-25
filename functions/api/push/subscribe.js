import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId } from '../_utils/http.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const body = await readJson(request);
    const sub = body?.subscription || body;

    const endpoint = String(sub?.endpoint || '').trim();
    const p256dh = String(sub?.keys?.p256dh || '').trim();
    const auth = String(sub?.keys?.auth || '').trim();
    const userAgent = String(body?.userAgent || request.headers.get('User-Agent') || '').slice(0, 240);

    if (!endpoint || !p256dh || !auth) {
      return json({ error: 'Subscription invalide.' }, { status: 400 });
    }

    const id = newId();
    const now = isoNow();
    const userId = String(data.user.id);

    await env.DB.prepare(
      'INSERT OR IGNORE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, userId, endpoint, p256dh, auth, userAgent || null, now, now)
      .run();

    await env.DB.prepare(
      'UPDATE push_subscriptions SET p256dh = ?, auth = ?, user_agent = COALESCE(?, user_agent), updated_at = ? WHERE user_id = ? AND endpoint = ?'
    )
      .bind(p256dh, auth, userAgent || null, now, userId, endpoint)
      .run();

    const row = await env.DB.prepare(
      'SELECT id, user_id, endpoint, created_at, updated_at FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
    )
      .bind(userId, endpoint)
      .first();

    return json({ ok: true, subscription: row || { endpoint } }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
