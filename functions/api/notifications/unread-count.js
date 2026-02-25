import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth } from '../_utils/http.js';
import { getUnreadNotificationsCount } from '../_utils/notifications.js';

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const unreadCount = await getUnreadNotificationsCount(env, data.user.id);
    return json({ unreadCount }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
