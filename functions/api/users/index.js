import { hashPassword } from '../../_utils/auth.js';
import { ensureAdminUser, isoNow, mapUserPublic, newId, normalizeEmailInput } from '../_utils/db.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function requireAdmin(data) {
  return data?.user?.role === 'admin';
}

export async function onRequestGet({ env, data }) {
  await ensureAdminUser(env);

  if (!requireAdmin(data)) {
    return json({ error: 'Accès interdit.' }, { status: 403 });
  }

  const res = await env.DB.prepare('SELECT * FROM users ORDER BY email ASC').all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  return json({ users: rows.map(mapUserPublic) }, { status: 200 });
}

export async function onRequestPost({ request, env, data }) {
  await ensureAdminUser(env);

  if (!requireAdmin(data)) {
    return json({ error: 'Accès interdit.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmailInput(body.email);
  const role = String(body.role || 'viewer');
  const technicianName = String(body.technicianName || '');
  const password = String(body.password || '');

  if (!email) return json({ error: 'Email requis.' }, { status: 400 });
  if (!password) return json({ error: 'Mot de passe requis.' }, { status: 400 });
  if (!['admin', 'viewer', 'technician'].includes(role)) return json({ error: 'Rôle invalide.' }, { status: 400 });

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return json({ error: 'Cet email existe déjà.' }, { status: 409 });

  const { salt, iters, hash } = await hashPassword(password);
  const id = newId();
  const now = isoNow();

  await env.DB.prepare(
    'INSERT INTO users (id, email, role, technician_name, password_hash, password_salt, password_iters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, email, role, technicianName, hash, salt, iters, now, now)
    .run();

  await touchLastUpdatedAt(env);

  const created = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json({ user: mapUserPublic(created) }, { status: 201 });
}
