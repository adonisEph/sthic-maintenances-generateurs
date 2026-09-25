import { json, requireAuth, isoNow, isSuperAdmin, userZone } from '../_utils/http.js';

const ALLOWED_ROLES = ['admin', 'manager', 'manager_bzv_pool'];

// GET /api/notifications — notifications métier pour managers/admin.
// SuperAdmin : toutes zones. Managers : leur zone. L'utilisateur ne voit pas
// ses propres actions (actor_user_id != me). unreadCount = watermark
// notification_state.last_seen_at.
export async function onRequestGet({ request, env, data }) {
  try {
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '').trim();
    if (!ALLOWED_ROLES.includes(role)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const uid = String(data?.user?.id || '');
    const scopeZone = isSuperAdmin(data) ? null : userZone(data);

    try {
      const st = await env.DB.prepare('SELECT last_seen_at FROM notification_state WHERE user_id = ?')
        .bind(uid)
        .first();
      const lastSeen = String(st?.last_seen_at || '');

      const whereZone = scopeZone ? 'AND zone = ?' : '';
      const binds = scopeZone ? [scopeZone] : [];

      const res = await env.DB.prepare(
        `SELECT * FROM notifications
         WHERE audience = 'managers' AND (actor_user_id IS NULL OR actor_user_id != ?) ${whereZone}
         ORDER BY created_at DESC LIMIT 30`
      )
        .bind(uid, ...binds)
        .all();

      const items = (Array.isArray(res?.results) ? res.results : []).map((r) => ({
        id: r.id,
        type: r.type,
        zone: r.zone,
        title: r.title,
        body: r.body,
        siteId: r.site_id,
        refId: r.ref_id,
        actorEmail: r.actor_email,
        createdAt: r.created_at,
        read: Boolean(lastSeen) && String(r.created_at) <= lastSeen
      }));

      const unreadCount = items.filter((i) => !i.read).length;
      return json({ items, unreadCount }, { status: 200 });
    } catch {
      // Tables absentes (migration non appliquée) → vide, pas de 500.
      return json({ items: [], unreadCount: 0, unavailable: true }, { status: 200 });
    }
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

// POST /api/notifications — { action: 'mark_read' } : watermark = now.
export async function onRequestPost({ request, env, data }) {
  try {
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '').trim();
    if (!ALLOWED_ROLES.includes(role)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const uid = String(data?.user?.id || '');
    const now = isoNow();
    try {
      await env.DB.prepare(
        `INSERT INTO notification_state (user_id, last_seen_at) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`
      )
        .bind(uid, now)
        .run();
    } catch {
      return json({ ok: false, unavailable: true }, { status: 200 });
    }
    return json({ ok: true, lastSeenAt: now }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
