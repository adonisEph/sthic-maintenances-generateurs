import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAdmin, requireAuth } from '../../_utils/http.js';
import { formatTicket } from '../../_utils/meta.js';

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind('ticket_number').first();
    const current = Number(row?.meta_value || 0);
    const next = current + 1;

    return json(
      {
        current,
        next,
        nextTicket: formatTicket(next)
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
