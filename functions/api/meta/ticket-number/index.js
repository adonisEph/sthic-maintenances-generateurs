import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth } from '../../_utils/http.js';
import { formatTicket, getLastUpdatedAt, touchLastUpdatedAt, getTicketCounter } from '../../_utils/meta.js';

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const url = new URL(request.url);
    const zone = String(url.searchParams.get('zone') || '').trim();

    const current = await getTicketCounter(env, zone);
    const next = current + 1;

    const v = await getLastUpdatedAt(env);
    if (!v) {
      await touchLastUpdatedAt(env);
    }

    return json(
      {
        current,
        next,
        nextTicket: formatTicket(next, zone)
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
