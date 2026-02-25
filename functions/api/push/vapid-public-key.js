import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth } from '../_utils/http.js';

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const pub = String(env?.VAPID_PUBLIC_KEY || '').trim();
    if (!pub) return json({ error: 'VAPID_PUBLIC_KEY manquant.' }, { status: 500 });

    return json({ publicKey: pub }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
