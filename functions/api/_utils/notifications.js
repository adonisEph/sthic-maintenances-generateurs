import { isoNow, newId } from './http.js';

function base64UrlEncodeBytes(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function utf8Bytes(s) {
  return new TextEncoder().encode(String(s || ''));
}

function base64UrlEncodeJson(obj) {
  return base64UrlEncodeBytes(utf8Bytes(JSON.stringify(obj)));
}

function derToJoseRawEcdsa(sigDer, sizeBytes) {
  const bytes = sigDer instanceof Uint8Array ? sigDer : new Uint8Array(sigDer);
  if (bytes.length < 8 || bytes[0] !== 0x30) {
    throw new Error('Signature DER invalide.');
  }

  let offset = 2;
  if (bytes[1] & 0x80) {
    const lenBytes = bytes[1] & 0x7f;
    offset = 2 + lenBytes;
  }

  if (bytes[offset] !== 0x02) throw new Error('Signature DER invalide (r).');
  const rLen = bytes[offset + 1];
  const r = bytes.slice(offset + 2, offset + 2 + rLen);
  offset = offset + 2 + rLen;

  if (bytes[offset] !== 0x02) throw new Error('Signature DER invalide (s).');
  const sLen = bytes[offset + 1];
  const s = bytes.slice(offset + 2, offset + 2 + sLen);

  const out = new Uint8Array(sizeBytes * 2);

  const rTrim = r[0] === 0x00 ? r.slice(1) : r;
  const sTrim = s[0] === 0x00 ? s.slice(1) : s;

  if (rTrim.length > sizeBytes || sTrim.length > sizeBytes) {
    throw new Error('Signature DER invalide (taille).');
  }

  out.set(rTrim, sizeBytes - rTrim.length);
  out.set(sTrim, 2 * sizeBytes - sTrim.length);
  return out;
}

async function importVapidPrivateKey(env) {
  const raw = String(env?.VAPID_PRIVATE_JWK || '').trim();
  if (!raw) throw new Error('VAPID_PRIVATE_JWK manquant.');
  let jwk;
  try {
    jwk = JSON.parse(raw);
  } catch {
    throw new Error('VAPID_PRIVATE_JWK invalide (JSON requis).');
  }

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function buildVapidAuthHeader(env, endpointUrl) {
  const u = new URL(endpointUrl);
  const aud = `${u.protocol}//${u.host}`;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 60 * 60;

  const sub = String(env?.VAPID_SUBJECT || '').trim();
  if (!sub) throw new Error('VAPID_SUBJECT manquant.');

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud, exp, sub };
  const tokenUnsigned = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;

  const key = await importVapidPrivateKey(env);
  const sigDer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    utf8Bytes(tokenUnsigned)
  );

  const sigJose = derToJoseRawEcdsa(new Uint8Array(sigDer), 32);
  const jwt = `${tokenUnsigned}.${base64UrlEncodeBytes(sigJose)}`;

  const pub = String(env?.VAPID_PUBLIC_KEY || '').trim();
  if (!pub) throw new Error('VAPID_PUBLIC_KEY manquant.');

  return `vapid t=${jwt}, k=${pub}`;
}

export async function getUnreadNotificationsCount(env, userId) {
  const row = await env.DB.prepare(
    'SELECT COUNT(1) as c FROM notifications WHERE user_id = ? AND read_at IS NULL'
  )
    .bind(String(userId))
    .first();
  return Number(row?.c || 0);
}

export async function listNotifications(env, userId, { unreadOnly = false, limit = 50 } = {}) {
  const lim = Math.max(1, Math.min(200, Math.round(Number(limit || 50))));
  const where = unreadOnly ? 'user_id = ? AND read_at IS NULL' : 'user_id = ?';
  const res = await env.DB.prepare(
    `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ?`
  )
    .bind(String(userId), lim)
    .all();
  return Array.isArray(res?.results) ? res.results : [];
}

export async function markNotificationsRead(env, userId, ids = []) {
  const now = isoNow();
  const list = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (list.length === 0) return { updated: 0 };

  const ph = list.map(() => '?').join(',');
  const res = await env.DB.prepare(
    `UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND id IN (${ph})`
  )
    .bind(now, String(userId), ...list)
    .run();

  return { updated: Number(res?.meta?.changes || 0) };
}

export async function createNotification(env, { userId, title, body, kind, refId = null, zone = null }) {
  const id = newId();
  const now = isoNow();
  await env.DB.prepare(
    'INSERT INTO notifications (id, user_id, title, body, kind, ref_id, zone, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)'
  )
    .bind(id, String(userId), String(title || ''), String(body || ''), String(kind || ''), refId, zone, now)
    .run();
  return { id, createdAt: now };
}

export async function loadPushSubscriptionsForUsers(env, userIds) {
  const list = Array.isArray(userIds) ? userIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (list.length === 0) return [];
  const ph = list.map(() => '?').join(',');
  const res = await env.DB.prepare(
    `SELECT * FROM push_subscriptions WHERE user_id IN (${ph})`
  )
    .bind(...list)
    .all();
  return Array.isArray(res?.results) ? res.results : [];
}

export async function sendWebPushNoPayload(env, subscription) {
  const endpoint = String(subscription?.endpoint || '').trim();
  if (!endpoint) return { ok: false, status: 0 };

  const auth = await buildVapidAuthHeader(env, endpoint);
  const pub = String(env?.VAPID_PUBLIC_KEY || '').trim();

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      TTL: '60',
      Authorization: auth,
      ...(pub ? { 'Crypto-Key': `p256ecdsa=${pub}` } : {})
    }
  });

  return { ok: resp.ok, status: resp.status };
}

export async function fanoutWebPushNoPayload(env, subscriptions) {
  const subs = Array.isArray(subscriptions) ? subscriptions : [];
  let ok = 0;
  let gone = 0;
  for (const s of subs) {
    try {
      const res = await sendWebPushNoPayload(env, s);
      if (res.ok) ok += 1;
      if (res.status === 404 || res.status === 410) {
        gone += 1;
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(String(s.id)).run();
      }
    } catch {
    }
  }
  return { ok, gone, total: subs.length };
}
