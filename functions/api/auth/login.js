import { createSessionCookie, verifyPassword } from '../../_utils/auth.js';
import { ensureAdminUser } from '../_utils/db.js';

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureAdminUser(env);

    const { email, password } = await request.json().catch(() => ({}));
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!normalizedEmail || !rawPassword) {
      return json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    if (!env.DB) {
      return json({ error: 'Binding D1 manquant: DB' }, { status: 500 });
    }

    const user = await env.DB
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first();

    if (!user || user.disabled_at) {
      return json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    const ok = await verifyPassword(rawPassword, user.password_salt, user.password_iters, user.password_hash);
    if (!ok) {
      return json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    const secret = env.SESSION_SECRET;
    if (!secret) {
      return json({ error: 'Configuration serveur manquante (SESSION_SECRET).' }, { status: 500 });
    }

    const cookie = await createSessionCookie(secret, user);

    return json(
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          technicianName: user.technician_name || ''
        }
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': cookie
        }
      }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
