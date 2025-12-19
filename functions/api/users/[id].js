import { hashPassword } from '../../_utils/auth.js';
import { ensureAdminUser, isoNow, mapUserPublic, normalizeEmailInput } from '../_utils/db.js';

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function requireAdmin(data) {
  return data?.user?.role === 'admin';
}

export async function onRequestPatch({ request, env, data, params }) {
  await ensureAdminUser(env);

  if (!requireAdmin(data)) {
    return json({ error: 'Accès interdit.' }, { status: 403 });
  }

  const id = String(params?.id || '');
  if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

  const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Utilisateur introuvable.' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const nextEmail = body.email != null ? normalizeEmailInput(body.email) : existing.email;
  const nextRole = body.role != null ? String(body.role) : existing.role;
  const nextTechnicianName = body.technicianName != null ? String(body.technicianName || '') : (existing.technician_name || '');

  if (!nextEmail) return json({ error: 'Email requis.' }, { status: 400 });
  if (!['admin', 'viewer', 'technician'].includes(nextRole)) return json({ error: 'Rôle invalide.' }, { status: 400 });

  if (existing.role === 'admin' && nextRole !== 'admin') {
    return json({ error: 'Impossible de rétrograder le compte admin.' }, { status: 400 });
  }

  if (nextEmail !== existing.email) {
    const emailTaken = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(nextEmail).first();
    if (emailTaken) return json({ error: 'Cet email existe déjà.' }, { status: 409 });
  }

  const now = isoNow();
  await env.DB.prepare('UPDATE users SET email = ?, role = ?, technician_name = ?, updated_at = ? WHERE id = ?')
    .bind(nextEmail, nextRole, nextTechnicianName, now, id)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json({ user: mapUserPublic(updated) }, { status: 200 });
}

export async function onRequestDelete({ env, data, params }) {
  await ensureAdminUser(env);

  if (!requireAdmin(data)) {
    return json({ error: 'Accès interdit.' }, { status: 403 });
  }

  const id = String(params?.id || '');
  if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

  const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Utilisateur introuvable.' }, { status: 404 });

  if (existing.role === 'admin') {
    return json({ error: 'Impossible de supprimer le compte admin.' }, { status: 400 });
  }

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return json({ ok: true }, { status: 200 });
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

  const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json({ user: mapUserPublic(updated) }, { status: 200 });
}
