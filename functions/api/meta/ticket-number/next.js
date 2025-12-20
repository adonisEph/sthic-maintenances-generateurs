import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAdmin, requireAuth, isoNow } from '../../_utils/http.js';
import { nextTicketNumber, formatTicket } from '../../_utils/meta.js';

export async function onRequestPost({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const n = await nextTicketNumber(env);
    return json(
      {
        ticketNumber: n,
        ticket: formatTicket(n),
        issuedAt: isoNow()
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
