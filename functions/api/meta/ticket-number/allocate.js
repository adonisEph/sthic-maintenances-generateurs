import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow } from '../../_utils/http.js';
import { formatTicket, touchLastUpdatedAt } from '../../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    if (!env.DB) {
      return json({ error: 'Binding D1 manquant: DB' }, { status: 500 });
    }

    const body = await readJson(request);
    const count = Number(body?.count);
    if (!Number.isFinite(count) || Math.floor(count) !== count || count < 1 || count > 5000) {
      return json({ error: "Requête invalide. Fournir un entier 1..5000 dans { count }." }, { status: 400 });
    }

    // Ensure meta row exists
    await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
      .bind('ticket_number', '0')
      .run();

    let start = 0;
    let end = 0;
    let attempts = 0;

    while (attempts < 8) {
      attempts += 1;

      const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?')
        .bind('ticket_number')
        .first();

      const current = Number(row?.meta_value || 0);
      if (!Number.isFinite(current) || Math.floor(current) !== current || current < 0) {
        return json({ error: 'Valeur meta ticket_number invalide.' }, { status: 500 });
      }

      start = current + 1;
      end = current + count;

      const upd = await env.DB.prepare(
        'UPDATE meta SET meta_value = ? WHERE meta_key = ? AND meta_value = ?'
      )
        .bind(String(end), 'ticket_number', String(current))
        .run();

      if (Number(upd?.meta?.changes || 0) > 0) {
        break;
      }
    }

    if (end <= 0) {
      return json({ error: 'Impossible d\'allouer des tickets (conflit concurrent). Réessaie.' }, { status: 409 });
    }

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        start,
        end,
        count,
        startTicket: formatTicket(start),
        endTicket: formatTicket(end),
        allocatedAt: isoNow()
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
