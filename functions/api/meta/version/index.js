import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth } from '../../_utils/http.js';
import { getLastUpdatedAt, touchLastUpdatedAt } from '../../_utils/meta.js';

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    let v = await getLastUpdatedAt(env);
    if (!v) {
      v = await touchLastUpdatedAt(env);
    }

    return json({ version: v }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
