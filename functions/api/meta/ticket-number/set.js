import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow } from '../../_utils/http.js';
import { formatTicket, touchLastUpdatedAt } from '../../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const next = Number(body?.next);
    if (!Number.isFinite(next) || Math.floor(next) !== next || next < 1) {
      return json({ error: 'Valeur invalide. Fournir un entier >= 1 dans { next }.' }, { status: 400 });
    }

    const current = next - 1;

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
