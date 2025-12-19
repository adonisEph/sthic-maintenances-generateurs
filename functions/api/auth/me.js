import { ensureAdminUser } from '../_utils/db.js';

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestGet({ env, data }) {
  await ensureAdminUser(env);

  if (!data.user) {
    return json({ user: null }, { status: 200 });
  }

  return json({ user: data.user }, { status: 200 });
}
