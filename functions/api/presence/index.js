import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, requireAuth } from '../_utils/http.js';

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const ttlMs = 20000;
    const nowMs = Date.now();
    const cutoff = nowMs - ttlMs;

    await env.DB.prepare('DELETE FROM presence_sessions WHERE last_seen_ms < ?').bind(cutoff).run();

    const res = await env.DB
      .prepare('SELECT * FROM presence_sessions WHERE last_seen_ms >= ? ORDER BY last_seen_ms DESC LIMIT 500')
      .bind(cutoff)
      .all();

    const rows = Array.isArray(res?.results) ? res.results : [];
    const sessions = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      tabId: r.tab_id,
      email: r.email,
      role: r.role,
      technicianName: r.technician_name || '',
      activity: r.activity || '',
      lastSeenMs: r.last_seen_ms,
      updatedAt: r.updated_at
    }));

    return json({ sessions, nowMs }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
