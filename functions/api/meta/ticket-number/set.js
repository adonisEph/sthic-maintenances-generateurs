import { ensureAdminUser } from '../../_utils/db.js';
import { json, readJson, requireAdmin, requireAuth, isoNow } from '../../_utils/http.js';
import { formatTicket, touchLastUpdatedAt } from '../../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const raw = body?.ticketNumber ?? body?.ticket ?? body?.value ?? body?.next ?? body?.start;

    let desiredNext;
    if (typeof raw === 'number') {
      desiredNext = raw;
    } else {
      const digits = String(raw ?? '').match(/\d+/g)?.join('') || '';
      desiredNext = Number(digits);
    }

    if (!Number.isFinite(desiredNext) || desiredNext < 1) {
      return json(
        { error: 'Valeur invalide. Fournir par ex: { "ticket": "T01250" } ou { "ticketNumber": 1250 }.' },
        { status: 400 }
      );
    }

    const current = Math.max(0, Math.floor(desiredNext) - 1);
    const next = current + 1;

    await env.DB.prepare('INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES (?, ?)')
      .bind('ticket_number', String(current))
      .run();

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        current,
        next,
        nextTicket: formatTicket(next),
        setAt: isoNow()
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
