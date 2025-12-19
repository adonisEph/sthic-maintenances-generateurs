export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function requireAuth(data) {
  return Boolean(data?.user?.id);
}

export function requireAdmin(data) {
  return data?.user?.role === 'admin';
}

export function readJson(request) {
  return request.json().catch(() => ({}));
}

export function isoNow() {
  return new Date().toISOString();
}

export function ymdToday() {
  return new Date().toISOString().slice(0, 10);
}

export function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
