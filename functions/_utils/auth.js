import { fromBase64Url, hmacSign, pbkdf2Hash, toBase64Url, utf8 } from './crypto.js';

const SESSION_COOKIE = 'gma_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h
const PBKDF2_ITERS = 100000;

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function parseCookies(headerValue) {
  const str = headerValue || '';
  const out = {};
  str.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

export function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  parts.push('Path=/');
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iters = PBKDF2_ITERS;
  const hash = await pbkdf2Hash(password, salt, iters);
  return {
    salt: toBase64Url(salt),
    iters,
    hash: toBase64Url(hash)
  };
}

export async function verifyPassword(password, saltB64, iters, expectedHashB64) {
  const salt = fromBase64Url(saltB64);
  const hash = await pbkdf2Hash(password, salt, Number(iters));
  const expected = fromBase64Url(expectedHashB64);
  return timingSafeEqual(hash, expected);
}

export async function signSession(secret, payloadObj) {
  const payload = toBase64Url(utf8.encode(JSON.stringify(payloadObj)));
  const sigBytes = await hmacSign(secret, utf8.encode(payload));
  const sig = toBase64Url(sigBytes);
  return `${payload}.${sig}`;
}

export async function verifySession(secret, token) {
  const raw = String(token || '');
  const idx = raw.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expectedSig = toBase64Url(await hmacSign(secret, utf8.encode(payload)));
  if (sig !== expectedSig) return null;

  try {
    const json = utf8.decode(fromBase64Url(payload));
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object') return null;
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function createSessionCookie(secret, user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    zone: user.zone || 'BZV/POOL',
    technicianName: user.technician_name || '',
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const token = await signSession(secret, payload);
  return serializeCookie(SESSION_COOKIE, token, {
    maxAge: SESSION_TTL_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  });
}

export function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0 });
}
