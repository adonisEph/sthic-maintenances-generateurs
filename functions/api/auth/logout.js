import { clearSessionCookie } from '../../_utils/auth.js';

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestPost() {
  return json(
    { ok: true },
    {
      status: 200,
      headers: {
        'Set-Cookie': clearSessionCookie()
      }
    }
  );
}
