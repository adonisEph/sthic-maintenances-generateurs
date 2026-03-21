import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth } from '../_utils/http.js';
import { getUnreadNotificationsCount, getUnreadNotificationsCountByKinds } from '../_utils/notifications.js';

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    let kinds = [];
    try {
      const url = new URL(data?.request?.url || 'http://local');
      const kindsRaw = url.searchParams.get('kinds');
      if (kindsRaw) {
        kinds = String(kindsRaw)
          .split(',')
          .map((k) => String(k || '').trim())
          .filter(Boolean);
      }
    } catch {
      // ignore
    }

    const unreadCount = kinds.length > 0
      ? await getUnreadNotificationsCountByKinds(env, data.user.id, kinds)
      : await getUnreadNotificationsCount(env, data.user.id);

    return json({ unreadCount }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
