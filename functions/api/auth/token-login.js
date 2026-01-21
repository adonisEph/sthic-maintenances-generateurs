import { signSession, verifyPassword } from '../../_utils/auth.js';
import { ensureAdminUser } from '../_utils/db.js';
import { writeAuditLog } from '../_utils/audit.js';

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
      await writeAuditLog(env, null, {
        action: 'AUTH_TOKEN_LOGIN_FAIL',
        request,
        metadata: { reason: 'missing_credentials', email: normalizedEmail || null }
      });
      return json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    if (!env.DB) {
      return json({ error: 'Binding D1 manquant: DB' }, { status: 500 });
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalizedEmail).first();
    if (!user || user.disabled_at) {
      await writeAuditLog(env, null, {
        action: 'AUTH_TOKEN_LOGIN_FAIL',
        request,
        metadata: { reason: 'user_not_found_or_disabled', email: normalizedEmail }
      });
      return json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    const ok = await verifyPassword(rawPassword, user.password_salt, user.password_iters, user.password_hash);
    if (!ok) {
      await writeAuditLog(env, null, {
        action: 'AUTH_TOKEN_LOGIN_FAIL',
        request,
        metadata: { reason: 'invalid_password', email: normalizedEmail, userId: user.id }
      });
      return json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    const secret = env.SESSION_SECRET;
    if (!secret) {
      return json({ error: 'Configuration serveur manquante (SESSION_SECRET).' }, { status: 500 });
    }

    const expiresIn = 60 * 60 * 12;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      technicianName: user.technician_name || '',
      exp: Date.now() + expiresIn * 1000
    };

    const accessToken = await signSession(secret, payload);

    await writeAuditLog(env, null, {
      action: 'AUTH_TOKEN_LOGIN_SUCCESS',
      request,
      userId: user.id,
      email: user.email,
      role: user.role,
      metadata: { technicianName: user.technician_name || '' }
    });

    return json(
      {
        accessToken,
        tokenType: 'Bearer',
        expiresIn,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          technicianName: user.technician_name || ''
        }
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
