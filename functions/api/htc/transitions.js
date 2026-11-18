import { ensureAdminUser, newId, isoNow } from '../_utils/db.js';
import { json, requireAuth, readJson, ymdToday } from '../_utils/http.js';
import { isHtcManager, htcZoneOk, allocHtcNumber, mapMovement, htcStockMap } from './_utils.js';

// POST /api/htc/transitions — sortie de la quarantaine « Retour Site » (Entrepôt).
//   type = 'reinstatement' : matériel réparé → réintégré au stock disponible (RI-AAAA-NNNN)
//   type = 'client_return' : matériel non réparable → remis au client HTC (RM-AAAA-NNNN)
// Corps : { type, itemId, qty, condition, agentName, beneficiary?, reason?,
//           movementDate?, signatureName?, signatureImage? }
export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const body = await readJson(request);
    const type = String(body?.type || '').trim();
    if (!['reinstatement', 'client_return'].includes(type)) {
      return json({ error: 'Type invalide (reinstatement|client_return).' }, { status: 400 });
    }
    // Le HS n'est pas réparable : seuls defectueux / a_reparer peuvent réintégrer le stock.
    const condition = String(body?.condition || '').trim();
    const allowed = type === 'reinstatement' ? ['defectueux', 'a_reparer'] : ['defectueux', 'a_reparer', 'hs'];
    if (!allowed.includes(condition)) return json({ error: 'Condition invalide pour ce flux.' }, { status: 400 });

    const itemId = String(body?.itemId || '').trim();
    const item = itemId ? await env.DB.prepare('SELECT * FROM htc_items WHERE id = ?').bind(itemId).first() : null;
    if (!item) return json({ error: 'Article introuvable.' }, { status: 400 });

    const qty = Math.floor(Number(body?.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 10000) return json({ error: 'Quantité invalide.' }, { status: 400 });

    // Quarantaine disponible pour cette condition d'origine (temps réel).
    const sm = await htcStockMap(env);
    const remaining = Number((sm[item.id]?.siteCond || {})[condition] || 0);
    if (qty > remaining) {
      return json({ error: `Quantité > quarantaine (${remaining} unité(s) « ${condition} » disponible(s)).` }, { status: 400 });
    }

    const agentName = String(body?.agentName || '').trim()
      || String(data.user.technicianName || data.user.email || '');
    if (!agentName) return json({ error: 'Nom de l\'agent requis.' }, { status: 400 });
    const beneficiary = type === 'client_return'
      ? (String(body?.beneficiary || '').trim() || 'Client HTC')
      : '';

    const signatureName = String(body?.signatureName || '').trim();
    const signatureImage = String(body?.signatureImage || '');
    if (!signatureName && !signatureImage) {
      return json({ error: 'Signature requise (dessinée ou nom tapé).' }, { status: 400 });
    }

    const now = isoNow();
    const movId = newId();
    const number = await allocHtcNumber(env, type);
    const isReinstate = type === 'reinstatement';

    // 19 colonnes / 14 binds — location et provenance figées à 'entrepot'/'Entrepôt'
    // (la quarantaine Retour Site vit physiquement à l'Entrepôt).
    await env.DB.prepare(
      `INSERT INTO htc_movements (id, number, type, location, movement_date, site_id, site_name, reason,
        requester_name, requester_role, agent_name, provenance, beneficiary,
        signature_name, signature_image, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'entrepot', ?, '', ?, ?, ?, 'warehouse', ?, 'Entrepôt', ?, ?, ?, 'issued', ?, ?, ?)`
    ).bind(
      movId, number, type,
      String(body?.movementDate || '').trim() || ymdToday(),
      isReinstate ? 'Stock disponible' : 'Client HTC',
      String(body?.reason || '').trim(),
      agentName, agentName,
      beneficiary,
      signatureName, signatureImage && signatureImage.startsWith('data:image') ? signatureImage.slice(0, 60000) : '',
      String(data.user.id), now, now
    ).run();

    await env.DB.prepare(
      'INSERT INTO htc_movement_lines (id, movement_id, item_id, item_name, location, qty, qty_returned, item_condition) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
    ).bind(newId(), movId, item.id, item.name, 'entrepot', qty, condition).run();

    const mov = await env.DB.prepare(
      'SELECT m.*, rm.number AS return_of_number FROM htc_movements m LEFT JOIN htc_movements rm ON rm.id = m.return_of_movement_id WHERE m.id = ?'
    ).bind(movId).first();
    const ml = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(movId).all();
    return json({ ok: true, movement: mapMovement(mov, ml?.results || []) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
