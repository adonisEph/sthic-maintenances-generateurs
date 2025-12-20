import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow } from '../_utils/http.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const body = await readJson(request);
    const tabId = String(body?.tabId || '').trim();
    const activity = String(body?.activity || '').trim();

    if (!tabId) {
      return json({ error: 'tabId requis.' }, { status: 400 });
    }

    const nowMs = Date.now();
    const nowIso = isoNow();

    const id = `${data.user.id}|${tabId}`;

    await env.DB.prepare(
      'INSERT OR REPLACE INTO presence_sessions (id, user_id, tab_id, email, role, technician_name, activity, last_seen_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM presence_sessions WHERE id = ?), ?), ?)'
    )
      .bind(
        id,
        data.user.id,
        tabId,
        String(data.user.email || ''),
        String(data.user.role || ''),
        String(data.user.technicianName || ''),
        activity,
        nowMs,
        id,
        nowIso,
        nowIso
      )
      .run();

    return json({ ok: true, lastSeenMs: nowMs }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
