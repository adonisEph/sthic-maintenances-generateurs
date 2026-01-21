import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, requireAuth } from '../_utils/http.js';

function norm(v) {
  const s = String(v ?? '').trim();
  return s || '';
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const url = new URL(request.url);
    const sp = url.searchParams;

    const userId = norm(sp.get('userId'));
    const from = norm(sp.get('from'));
    const to = norm(sp.get('to'));
    const q = norm(sp.get('q'));
    const action = norm(sp.get('action'));

    let limit = Number(sp.get('limit') || 500);
    if (!Number.isFinite(limit) || limit <= 0) limit = 500;
    limit = Math.min(2000, Math.max(1, limit));

    const where = [];
    const bind = [];

    if (userId) {
      where.push('user_id = ?');
      bind.push(userId);
    }

    if (action) {
      where.push('action = ?');
      bind.push(action);
    }

    if (from) {
      const fromMs = new Date(from).getTime();
      if (Number.isFinite(fromMs)) {
        where.push('created_at_ms >= ?');
        bind.push(fromMs);
      }
    }

    if (to) {
      const end = new Date(to);
      const endMs = (() => {
        try {
          end.setHours(23, 59, 59, 999);
          return end.getTime();
        } catch {
          return NaN;
        }
      })();
      if (Number.isFinite(endMs)) {
        where.push('created_at_ms <= ?');
        bind.push(endMs);
      }
    }

    if (q) {
      where.push(
        '(' +
          ['email', 'action', 'method', 'path', 'query', 'ip', 'user_agent', 'metadata_json']
            .map((c) => `${c} LIKE ?`)
            .join(' OR ') +
          ')'
      );
      const like = `%${q}%`;
      bind.push(like, like, like, like, like, like, like, like);
    }

    const sql = `SELECT * FROM audit_logs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at_ms DESC LIMIT ?`;
    bind.push(limit);

    const res = await env.DB.prepare(sql).bind(...bind).all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    const logs = rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      createdAtMs: r.created_at_ms,
      userId: r.user_id,
      email: r.email,
      role: r.role,
      action: r.action,
      method: r.method,
      path: r.path,
      query: r.query,
      status: r.status,
      ip: r.ip,
      userAgent: r.user_agent,
      metadata: (() => {
        try {
          return r.metadata_json ? JSON.parse(r.metadata_json) : null;
        } catch {
          return null;
        }
      })()
    }));

    return json({ logs }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
