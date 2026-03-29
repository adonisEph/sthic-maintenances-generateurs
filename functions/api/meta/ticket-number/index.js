import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, isoNow } from '../../_utils/http.js';
import { formatTicket, getLastUpdatedAt, touchLastUpdatedAt, getTicketCounter } from '../../_utils/meta.js';

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const url = new URL(request.url);
    const zone = String(url.searchParams.get('zone') || '').trim();

    const z = zone.toUpperCase();
    if (z === 'PNR/KOUILOU' && role === 'manager') {
      const nowIso = isoNow();
      const ymd = String(nowIso).slice(0, 10);
      const key = `ticket_number_pnr_day_${ymd}`;

      await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
        .bind(key, '0')
        .run();

      const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
      const current = Number(row?.meta_value || 0);
      const safeCurrent = Number.isFinite(current) ? current : 0;
      const next = safeCurrent + 1;

      const [yy, mm, dd] = ymd.split('-');
      const nextTicket = `${dd}/${mm}/${yy}-${next}`;

      const v = await getLastUpdatedAt(env);
      if (!v) {
        await touchLastUpdatedAt(env);
      }

      return json(
        {
          current: safeCurrent,
          next,
          nextTicket
        },
        { status: 200 }
      );
    }

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
