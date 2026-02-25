import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson } from '../_utils/http.js';
import { getUnreadNotificationsCount, listNotifications, markNotificationsRead } from '../_utils/notifications.js';

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    body: r.body,
    kind: r.kind,
    refId: r.ref_id,
    zone: r.zone,
    createdAt: r.created_at,
    readAt: r.read_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unreadOnly') === '1';
    const limit = Number(url.searchParams.get('limit') || 50);

    const rows = await listNotifications(env, data.user.id, { unreadOnly, limit });
    const unreadCount = await getUnreadNotificationsCount(env, data.user.id);

    return json({ notifications: rows.map(mapRow), unreadCount }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const body = await readJson(request);
    const ids = Array.isArray(body?.ids) ? body.ids : [];

    const res = await markNotificationsRead(env, data.user.id, ids);
    const unreadCount = await getUnreadNotificationsCount(env, data.user.id);

    return json({ ok: true, ...res, unreadCount }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
