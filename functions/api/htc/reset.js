import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth } from '../_utils/http.js';
import { isHtcManager, htcZoneOk } from './_utils.js';

// POST /api/htc/reset — RÉINITIALISATION TOTALE du module Magasin & Stocks HTC.
// Réservé au magasinier (et admin). Supprime articles, demandes, bons
// (entrées / sorties / retours / récupérations) et remet les compteurs
// de numérotation à zéro. Usage : remise à blanc pour tests / reprise.
export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (String(body?.confirm || '') !== 'REINITIALISER') {
      return json({ error: 'Confirmation requise : confirm = "REINITIALISER".' }, { status: 400 });
    }

    const del = async (sql, ...binds) => {
      const r = await env.DB.prepare(sql).bind(...binds).run();
      return Number(r?.meta?.changes || 0);
    };

    const deleted = {};
    deleted.requestLines = await del('DELETE FROM htc_request_lines');
    deleted.requests = await del('DELETE FROM htc_requests');
    deleted.movementLines = await del('DELETE FROM htc_movement_lines');
    deleted.movements = await del('DELETE FROM htc_movements');
    deleted.items = await del('DELETE FROM htc_items');
    deleted.counters = await del("DELETE FROM meta WHERE meta_key LIKE 'htc_num_%'");

    return json({ ok: true, deleted });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
