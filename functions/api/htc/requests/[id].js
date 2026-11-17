import { ensureAdminUser, isoNow } from '../../_utils/db.js';
import { json, requireAuth, readJson } from '../../_utils/http.js';
import { isHtcManager, htcZoneOk, mapRequest } from '../_utils.js';

// PATCH { action: 'cancel' } — le demandeur annule sa demande en attente ;
// le magasinier peut annuler toute demande en attente.
export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const id = String(params?.id || '');
    const body = await readJson(request);
    if (String(body?.action || '') !== 'cancel') return json({ error: 'Action inconnue.' }, { status: 400 });

    const row = await env.DB.prepare('SELECT * FROM htc_requests WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'Demande introuvable.' }, { status: 404 });
    if (row.status !== 'pending') return json({ error: 'Seules les demandes en attente sont annulables.' }, { status: 409 });

    const owner = String(row.requested_by_user_id || '') === String(data.user.id);
    if (!owner && !isHtcManager(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    await env.DB.prepare("UPDATE htc_requests SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(isoNow(), id).run();
    const updated = await env.DB.prepare('SELECT * FROM htc_requests WHERE id = ?').bind(id).first();
    const lr = await env.DB.prepare('SELECT * FROM htc_request_lines WHERE request_id = ?').bind(id).all();
    return json({ ok: true, request: mapRequest(updated, lr?.results || []) });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
