function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function isoNow() {
  return new Date().toISOString();
}

function safeJson(v) {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return JSON.stringify(null);
  }
}

function pickIp(request) {
  return (
    request?.headers?.get('CF-Connecting-IP') ||
    request?.headers?.get('X-Forwarded-For') ||
    request?.headers?.get('X-Real-IP') ||
    ''
  );
}

async function purgeOldAuditLogs(env, keepLimit = 50000, purgeBatch = 5000) {
  if (!env?.DB) return;
  const safeKeep = Math.max(1000, Math.min(200000, Number(keepLimit) || 50000));
  const safeBatch = Math.max(100, Math.min(20000, Number(purgeBatch) || 5000));

  const countRow = await env.DB.prepare('SELECT COUNT(1) as c FROM audit_logs').first();
  const count = Number(countRow?.c || 0);
  if (!Number.isFinite(count) || count <= safeKeep) return;

  const toDelete = Math.min(safeBatch, Math.max(0, count - safeKeep));
  if (toDelete <= 0) return;

  await env.DB.prepare(
    'DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY created_at_ms ASC LIMIT ?)'
  )
    .bind(toDelete)
    .run();
}

function looksLikeDbSizeError(err) {
  const msg = String(err?.message || err || '');
  return /Exceeded maximum DB size/i.test(msg) || /maximum DB size/i.test(msg) || /D1_ERROR/i.test(msg);
}

export async function writeAuditLog(env, data, details) {
  if (!env?.DB) return;
  const action = String(details?.action || '').trim();
  if (!action) return;

  const request = details?.request;
  const createdAt = isoNow();
  const createdAtMs = Date.now();

  const userId = data?.user?.id ? String(data.user.id) : details?.userId ? String(details.userId) : null;
  const email = data?.user?.email ? String(data.user.email) : details?.email ? String(details.email) : null;
  const role = data?.user?.role ? String(data.user.role) : details?.role ? String(details.role) : null;

  const method = request?.method ? String(request.method) : details?.method ? String(details.method) : null;
  const url = request?.url ? new URL(request.url) : null;
  const path = url ? url.pathname : details?.path ? String(details.path) : null;
  const query = url ? url.search : details?.query ? String(details.query) : null;
  const status = typeof details?.status === 'number' ? details.status : null;
  const ip = request ? pickIp(request) : details?.ip ? String(details.ip) : null;
  const userAgent = request?.headers?.get('User-Agent') || details?.userAgent || null;
  const metadataJson = safeJson(details?.metadata);

  const stmt = () =>
    env.DB.prepare(
      'INSERT INTO audit_logs (id, created_at, created_at_ms, user_id, email, role, action, method, path, query, status, ip, user_agent, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      newId(),
      createdAt,
      createdAtMs,
      userId,
      email,
      role,
      action,
      method,
      path,
      query,
      status,
      ip,
      userAgent,
      metadataJson
    );

  try {
    await stmt().run();
    return;
  } catch (e) {
    if (looksLikeDbSizeError(e)) {
      try {
        await purgeOldAuditLogs(env);
        await stmt().run();
        return;
      } catch {
        // ignore
      }
    }
    // best-effort audit logging: never break business flows
  }
}
