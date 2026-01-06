import { hashPassword } from '../../_utils/auth.js';
import { ensureAdminUser, isoNow } from '../_utils/db.js';
import { json, requireAuth, readJson } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const userId = String(data?.user?.id || '').trim();
    if (!userId) return json({ error: 'Non authentifié.' }, { status: 401 });

    const body = await readJson(request);
    const password = String(body?.password || '');
    if (!password) return json({ error: 'Mot de passe requis.' }, { status: 400 });
    if (password.length < 6) return json({ error: 'Mot de passe trop court (min 6 caractères).' }, { status: 400 });

    const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
    if (!existing) return json({ error: 'Utilisateur introuvable.' }, { status: 404 });

    const { salt, iters, hash } = await hashPassword(password);
    const now = isoNow();

    await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iters = ?, updated_at = ? WHERE id = ?')
      .bind(hash, salt, iters, now, userId)
      .run();

    await touchLastUpdatedAt(env);

    return json({ ok: true }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
