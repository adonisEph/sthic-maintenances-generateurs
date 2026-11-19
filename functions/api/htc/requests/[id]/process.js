import { ensureAdminUser, newId, isoNow } from '../../../_utils/db.js';
import { json, requireAuth, readJson, ymdToday } from '../../../_utils/http.js';
import { isHtcManager, htcZoneOk, allocHtcNumber, htcStockMap, mapRequest, mapMovement } from '../../_utils.js';

// POST { action: 'issue' | 'reject', rejectReason?, movementDate?, signatureName?, signatureImage?, force? }
// issue  -> crée le BON DE SORTIE (BS-AAAA-NNNN) + lie la demande
// reject -> refuse la demande avec motif
export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const id = String(params?.id || '');
    const body = await readJson(request);
    const action = String(body?.action || '').trim();

    const req = await env.DB.prepare('SELECT * FROM htc_requests WHERE id = ?').bind(id).first();
    if (!req) return json({ error: 'Demande introuvable.' }, { status: 404 });
    if (req.status !== 'pending') return json({ error: 'Demande déjà traitée.' }, { status: 409 });

    const now = isoNow();

    if (action === 'reject') {
      const reason = String(body?.rejectReason || '').trim();
      if (!reason) return json({ error: 'Motif de refus requis.' }, { status: 400 });
      await env.DB.prepare(
        "UPDATE htc_requests SET status = 'rejected', reject_reason = ?, processed_by = ?, processed_at = ?, updated_at = ? WHERE id = ?"
      ).bind(reason, String(data.user.id), now, now, id).run();
      const row = await env.DB.prepare('SELECT * FROM htc_requests WHERE id = ?').bind(id).first();
      const lr = await env.DB.prepare('SELECT * FROM htc_request_lines WHERE request_id = ?').bind(id).all();
      return json({ ok: true, request: mapRequest(row, lr?.results || []) });
    }

    if (action !== 'issue') return json({ error: 'Action inconnue.' }, { status: 400 });

    const linesRes = await env.DB.prepare('SELECT * FROM htc_request_lines WHERE request_id = ?').bind(id).all();
    const lines = linesRes?.results || [];
    if (!lines.length) return json({ error: 'Demande sans article.' }, { status: 409 });

    // Contrôle stock : alerte si sortie > dispo (confirmation via force)
    const stock = await htcStockMap(env);
    const shortages = [];
    for (const l of lines) {
      const avail = Number(stock[l.item_id] || 0);
      if (Number(l.qty) > avail) {
        shortages.push({ itemId: l.item_id, itemName: l.item_name, requested: Number(l.qty), available: avail });
      }
    }
    if (shortages.length && !body?.force) {
      return json({ ok: false, shortage: true, shortages, error: 'Stock insuffisant sur certaines lignes.' }, { status: 409 });
    }

    const signatureName = String(body?.signatureName || '').trim();
    const signatureImage = String(body?.signatureImage || '');
    if (!signatureName && !signatureImage) {
      return json({ error: 'Signature du demandeur requise (dessinée ou nom tapé).' }, { status: 400 });
    }

    const movementDate = String(body?.movementDate || '').trim() || ymdToday();
    const movId = newId();
    const isDotation = String(req.request_kind || 'site') === 'dotation';
    const movType = isDotation ? 'dotation' : 'exit';
    const number = await allocHtcNumber(env, movType);
    const mainLoc = String(lines[0].location || 'entrepot');

    const swoNumber = String(body?.swoNumber || req.swo_number || '').trim();
    const beneficiary = isDotation ? String(req.beneficiary_name || '').trim() : '';

    await env.DB.prepare(
      `INSERT INTO htc_movements (id, number, type, location, movement_date, site_id, site_name, reason,
        requester_name, requester_role, requested_by_user_id, request_id, swo_number, beneficiary,
        signature_name, signature_image, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`
    ).bind(
      movId, number, movType, mainLoc, movementDate,
      String(req.site_id || ''), String(req.site_name || ''),
      String(req.reason || ''),
      String(req.requester_name || ''), String(req.requester_role || ''),
      req.requested_by_user_id ? String(req.requested_by_user_id) : null,
      id, swoNumber, beneficiary,
      signatureName, signatureImage && signatureImage.startsWith('data:image') ? signatureImage.slice(0, 60000) : '',
      String(data.user.id), now, now
    ).run();

    for (const l of lines) {
      await env.DB.prepare(
        'INSERT INTO htc_movement_lines (id, movement_id, item_id, item_name, location, qty, qty_returned) VALUES (?, ?, ?, ?, ?, ?, 0)'
      ).bind(newId(), movId, l.item_id, l.item_name || '', l.location || '', Number(l.qty)).run();
    }

    await env.DB.prepare(
      "UPDATE htc_requests SET status = 'issued', exit_movement_id = ?, processed_by = ?, processed_at = ?, updated_at = ? WHERE id = ?"
    ).bind(movId, String(data.user.id), now, now, id).run();

    const mov = await env.DB.prepare('SELECT * FROM htc_movements WHERE id = ?').bind(movId).first();
    const ml = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(movId).all();
    const reqRow = await env.DB.prepare('SELECT * FROM htc_requests WHERE id = ?').bind(id).first();
    const rl = await env.DB.prepare('SELECT * FROM htc_request_lines WHERE request_id = ?').bind(id).all();

    return json({
      ok: true,
      movement: mapMovement(mov, ml?.results || []),
      request: mapRequest(reqRow, rl?.results || [])
    }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
