import { hashPassword } from '../../../_utils/auth.js';
import { ensureAdminUser, isoNow } from '../../_utils/db.js';
import { mapUserPublic } from '../../_utils/db.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function requireAdmin(data) {
  return data?.user?.role === 'admin';
}

export async function onRequestPost({ request, env, data, params }) {
  await ensureAdminUser(env);

  if (!requireAdmin(data)) {
    return json({ error: 'Accès interdit.' }, { status: 403 });
  }

  const id = String(params?.id || '');
  if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

  const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Utilisateur introuvable.' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (!password) return json({ error: 'Mot de passe requis.' }, { status: 400 });

  const { salt, iters, hash } = await hashPassword(password);
  const now = isoNow();

  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iters = ?, updated_at = ? WHERE id = ?')
    .bind(hash, salt, iters, now, id)
    .run();

  await touchLastUpdatedAt(env);

  const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json({ user: mapUserPublic(updated) }, { status: 200 });
}
