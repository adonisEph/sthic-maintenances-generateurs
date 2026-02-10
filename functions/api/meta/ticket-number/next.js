import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, isoNow, readJson } from '../../_utils/http.js';
import { nextTicketNumberForZone, formatTicket } from '../../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const zone = String(body?.zone || '').trim();

    const n = await nextTicketNumberForZone(env, zone);
    return json(
      {
        ticketNumber: n,
        ticket: formatTicket(n, zone),
        issuedAt: isoNow()
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
