import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, isoNow, readJson } from '../../_utils/http.js';
import { nextTicketNumberForZone, formatTicket, touchLastUpdatedAt } from '../../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const zone = String(body?.zone || '').trim();

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
      const next = (Number.isFinite(current) ? current : 0) + 1;

      await env.DB.prepare('INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES (?, ?)')
        .bind(key, String(next))
        .run();

      await touchLastUpdatedAt(env);

      const [yy, mm, dd] = ymd.split('-');
      const ticket = `${dd}/${mm}/${yy}-${next}`;

      return json(
        {
          ticketNumber: next,
          ticket,
          issuedAt: nowIso
        },
        { status: 200 }
      );
    }

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
