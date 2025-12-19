import { hashPassword } from '../../_utils/auth.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export async function ensureAdminUser(env) {
  const adminEmail = normalizeEmail(env.ADMIN_EMAIL || 'admin@local');
  const adminPassword = String(env.ADMIN_PASSWORD || 'admin');

  if (!env.DB) {
    throw new Error('Binding DB manquant: DB');
  }

  let countRow;
  try {
    countRow = await env.DB.prepare('SELECT COUNT(1) as c FROM users').first();
  } catch (e) {
    throw new Error('Table users introuvable. Migration non appliquée sur la base bindée.');
  }

  const count = Number(countRow?.c || 0);
  if (count > 0) return;

  const { salt, iters, hash } = await hashPassword(adminPassword);
  const id = uuid();
  const now = nowIso();

  await env.DB.prepare(
    'INSERT INTO users (id, email, role, technician_name, password_hash, password_salt, password_iters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, adminEmail, 'admin', '', hash, salt, iters, now, now)
    .run();
}

export function mapUserPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    technicianName: row.technician_name || '',
    disabledAt: row.disabled_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function normalizeEmailInput(email) {
  return normalizeEmail(email);
}

export function newId() {
  return uuid();
}

export function isoNow() {
  return nowIso();
}
