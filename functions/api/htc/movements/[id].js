import { ensureAdminUser, isoNow } from '../../_utils/db.js';
import { json, requireAuth, readJson } from '../../_utils/http.js';
import { isHtcManager, canHtcRequest, htcZoneOk, mapMovement } from '../_utils.js';

// GET — détail d'un bon (+ lignes) : magasinier, ou le demandeur propriétaire.
export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!canHtcRequest(data)) return json({ error: 'Accès interdit.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const id = String(params?.id || '');
    const mov = await env.DB.prepare(
      'SELECT m.*, rm.number AS return_of_number FROM htc_movements m LEFT JOIN htc_movements rm ON rm.id = m.return_of_movement_id WHERE m.id = ?'
    ).bind(id).first();
    if (!mov) return json({ error: 'Bon introuvable.' }, { status: 404 });

    const owner = String(mov.requested_by_user_id || '') === String(data.user.id);
    if (!owner && !isHtcManager(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const lr = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(id).all();
    const returns = await env.DB.prepare('SELECT id, number, movement_date, status FROM htc_movements WHERE return_of_movement_id = ? ORDER BY movement_date').bind(id).all();
    return json({ ok: true, movement: mapMovement(mov, lr?.results || []), returns: returns?.results || [] });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

// PATCH { action: 'cancel' } — annule un bon (retours impossibles ensuite, exclu du stock).
export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const id = String(params?.id || '');
    const body = await readJson(request);
    if (String(body?.action || '') !== 'cancel') return json({ error: 'Action inconnue.' }, { status: 400 });

    const mov = await env.DB.prepare('SELECT * FROM htc_movements WHERE id = ?').bind(id).first();
    if (!mov) return json({ error: 'Bon introuvable.' }, { status: 404 });
    if (mov.status === 'cancelled') return json({ error: 'Déjà annulé.' }, { status: 409 });

    const hasReturns = await env.DB.prepare(
      "SELECT COUNT(1) AS c FROM htc_movements WHERE return_of_movement_id = ? AND status != 'cancelled'"
    ).bind(id).first();
    if (Number(hasReturns?.c || 0) > 0) return json({ error: 'Impossible : des retours sont rattachés à ce bon.' }, { status: 409 });

    await env.DB.prepare("UPDATE htc_movements SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(isoNow(), id).run();
    if (mov.request_id) {
      await env.DB.prepare("UPDATE htc_requests SET status = 'pending', exit_movement_id = NULL, processed_by = NULL, processed_at = NULL, updated_at = ? WHERE id = ?").bind(isoNow(), mov.request_id).run();
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
