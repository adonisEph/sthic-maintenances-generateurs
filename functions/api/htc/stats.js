import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth } from '../_utils/http.js';
import { isHtcManager, htcZoneOk } from './_utils.js';

// GET /api/htc/stats — indicateurs du tableau de bord HTC (magasinier uniquement).
export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    // Demandes en attente de traitement.
    const pend = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM htc_requests WHERE status = 'pending'"
    ).first();

    // Matériel actuellement dehors : Σ(qty − qty_returned) sur les lignes des
    // bons de sortie non annulés et non soldés (issued / partial_return).
    const out = await env.DB.prepare(
      `SELECT COALESCE(SUM(l.qty - l.qty_returned), 0) AS units,
              COUNT(DISTINCT m.id) AS vouchers
       FROM htc_movement_lines l
       JOIN htc_movements m ON m.id = l.movement_id
       WHERE m.type IN ('exit', 'dotation') AND m.status IN ('issued', 'partial_return')`
    ).first();

    // Bons émis ce mois-ci par type (date du mouvement, pas created_at).
    const monthStart = new Date().toISOString().slice(0, 7) + '-01';
    const monthRes = await env.DB.prepare(
      `SELECT m.type AS t, COUNT(*) AS n FROM htc_movements m
       WHERE m.status != 'cancelled' AND m.movement_date >= ? GROUP BY m.type`
    ).bind(monthStart).all();
    const month = { entry: 0, exit: 0, return: 0, recovery: 0 };
    for (const r of monthRes?.results || []) month[r.t] = Number(r.n || 0);

    // Matériel non-fonctionnel documenté en stock « Retour Site » :
    // Σ récupérations non-fonctionnelles − Σ réintégrations − Σ remises client.
    const site = await env.DB.prepare(
      `SELECT COALESCE(SUM(
         CASE WHEN m.type = 'recovery' AND l.item_condition != 'fonctionnel' THEN l.qty
              WHEN m.type IN ('reinstatement', 'client_return') THEN -l.qty ELSE 0 END), 0) AS units
       FROM htc_movement_lines l
       JOIN htc_movements m ON m.id = l.movement_id
       WHERE m.status != 'cancelled'`
    ).first();

    return json({
      ok: true,
      stats: {
        pendingRequests: Number(pend?.n || 0),
        materialOutUnits: Number(out?.units || 0),
        openExitVouchers: Number(out?.vouchers || 0),
        siteReturnUnits: Number(site?.units || 0),
        monthMovements: month
      }
    });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
