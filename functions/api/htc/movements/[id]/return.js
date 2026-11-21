import { ensureAdminUser, newId, isoNow } from '../../../_utils/db.js';
import { json, requireAuth, readJson, ymdToday } from '../../../_utils/http.js';
import { isHtcManager, htcZoneOk, allocHtcNumber, mapMovement } from '../../_utils.js';

// POST /api/htc/movements/{exitId}/return
// { lines:[{lineId, qty}], movementDate?, signatureName?, signatureImage?, reason? }
// Crée un BON DE RETOUR (BR-AAAA-NNNN) rattaché au bon de sortie, partiel autorisé.
export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const exitId = String(params?.id || '');
    const exit = await env.DB.prepare('SELECT * FROM htc_movements WHERE id = ?').bind(exitId).first();
    if (!exit) return json({ error: 'Bon de sortie introuvable.' }, { status: 404 });
    if (!['exit', 'dotation', 'component'].includes(exit.type)) return json({ error: 'Les retours se rattachent à un bon de sortie, de dotation ou de prélèvement.' }, { status: 400 });
    if (exit.status === 'cancelled') return json({ error: 'Bon de sortie annulé.' }, { status: 409 });
    if (exit.status === 'returned') return json({ error: 'Bon de sortie déjà totalement retourné.' }, { status: 409 });

    const body = await readJson(request);

    // ---- Retour de COMPOSANTS prélevés → BON PC (component_return) ----
    if (exit.type === 'component') {
      const inLines = Array.isArray(body?.lines) ? body.lines : [];
      if (!inLines.length) return json({ error: 'Sélectionne au moins un composant à retourner.' }, { status: 400 });

      const clRes = await env.DB.prepare('SELECT * FROM htc_component_lines WHERE movement_id = ?').bind(exitId).all();
      const clMap = new Map((clRes?.results || []).map((l) => [l.id, l]));

      const clean = [];
      for (const l of inLines) {
        const cl = clMap.get(String(l?.lineId || ''));
        if (!cl) return json({ error: 'Composant du bon de prélèvement introuvable.' }, { status: 400 });
        const qty = Math.floor(Number(l?.qty));
        const remaining = Number(cl.qty) - Number(cl.qty_returned || 0);
        if (!Number.isFinite(qty) || qty < 1) return json({ error: 'Quantité retournée invalide.' }, { status: 400 });
        if (qty > remaining) return json({ error: `Retour > restant pour « ${cl.component} » (reste ${remaining}).` }, { status: 400 });
        clean.push({ cl, qty });
      }

      const signatureName = String(body?.signatureName || '').trim();
      const signatureImage = String(body?.signatureImage || '');
      if (!signatureName && !signatureImage) {
        return json({ error: 'Signature requise (dessinée ou nom tapé).' }, { status: 400 });
      }

      const movId = newId();
      const now = isoNow();
      // Même série PC : allocHtcNumber('component') garantit l'unicité des numéros.
      const number = await allocHtcNumber(env, 'component');

      await env.DB.prepare(
        `INSERT INTO htc_movements (id, number, type, location, movement_date, site_id, site_name, reason,
          requester_name, requester_role, requested_by_user_id, return_of_movement_id,
          agent_name, provenance, beneficiary,
          signature_name, signature_image, status, created_by, created_at, updated_at)
         VALUES (?, ?, 'component_return', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`
      ).bind(
        movId, number, String(exit.location || 'entrepot'),
        String(body?.movementDate || '').trim() || ymdToday(),
        String(exit.site_id || ''), String(exit.site_name || ''),
        String(body?.reason || exit.reason || ''),
        String(body?.returnerName || exit.beneficiary || exit.requester_name || '').trim(),
        String(exit.requester_role || ''),
        exit.requested_by_user_id ? String(exit.requested_by_user_id) : null,
        exitId,
        String(body?.agentName || body?.returnerName || exit.beneficiary || exit.requester_name || '').trim(),
        String(body?.provenance || exit.site_name || '').trim(),
        String(exit.beneficiary || '').trim(),
        signatureName, signatureImage && signatureImage.startsWith('data:image') ? signatureImage.slice(0, 60000) : '',
        String(data.user.id), now, now
      ).run();

      for (const c of clean) {
        await env.DB.prepare(
          'INSERT INTO htc_component_lines (id, movement_id, component, qty, qty_returned, source_item_id, source_item_name, source_ref, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)'
        ).bind(newId(), movId, c.cl.component, c.qty, c.cl.source_item_id || '', c.cl.source_item_name || '', c.cl.source_ref || '', now).run();
        await env.DB.prepare('UPDATE htc_component_lines SET qty_returned = qty_returned + ? WHERE id = ?').bind(c.qty, c.cl.id).run();
      }

      const updated = await env.DB.prepare('SELECT qty, qty_returned FROM htc_component_lines WHERE movement_id = ?').bind(exitId).all();
      const allDone = (updated?.results || []).every((l) => Number(l.qty_returned || 0) >= Number(l.qty));
      await env.DB.prepare('UPDATE htc_movements SET status = ?, updated_at = ? WHERE id = ?')
        .bind(allDone ? 'returned' : 'partial_return', now, exitId).run();

      const mov = await env.DB.prepare('SELECT m.*, rm.number AS return_of_number FROM htc_movements m LEFT JOIN htc_movements rm ON rm.id = m.return_of_movement_id WHERE m.id = ?').bind(movId).first();
      const clOut = await env.DB.prepare('SELECT * FROM htc_component_lines WHERE movement_id = ?').bind(movId).all();
      return json({ ok: true, movement: mapMovement(mov, [], clOut?.results || []) }, { status: 201 });
    }
    const inLines = Array.isArray(body?.lines) ? body.lines : [];
    if (!inLines.length) return json({ error: 'Sélectionne au moins une ligne à retourner.' }, { status: 400 });

    const exitLinesRes = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(exitId).all();
    const exitLines = new Map((exitLinesRes?.results || []).map((l) => [l.id, l]));

    const clean = [];
    for (const l of inLines) {
      const lineId = String(l?.lineId || '');
      const el = exitLines.get(lineId);
      if (!el) return json({ error: 'Ligne du bon de sortie introuvable.' }, { status: 400 });
      const qty = Math.floor(Number(l?.qty));
      const remaining = Number(el.qty) - Number(el.qty_returned || 0);
      if (!Number.isFinite(qty) || qty < 1) return json({ error: 'Quantité retournée invalide.' }, { status: 400 });
      if (qty > remaining) return json({ error: `Retour > restant pour « ${el.item_name} » (reste ${remaining}).` }, { status: 400 });
      clean.push({ el, qty });
    }

    const signatureName = String(body?.signatureName || '').trim();
    const signatureImage = String(body?.signatureImage || '');
    if (!signatureName && !signatureImage) {
      return json({ error: 'Signature requise (dessinée ou nom tapé).' }, { status: 400 });
    }

    const movId = newId();
    const now = isoNow();
    const number = await allocHtcNumber(env, 'return');

    await env.DB.prepare(
      `INSERT INTO htc_movements (id, number, type, location, movement_date, site_id, site_name, reason,
        requester_name, requester_role, requested_by_user_id, return_of_movement_id,
        agent_name, provenance,
        signature_name, signature_image, status, created_by, created_at, updated_at)
       VALUES (?, ?, 'return', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`
    ).bind(
      movId, number, String(exit.location || 'entrepot'),
      String(body?.movementDate || '').trim() || ymdToday(),
      String(exit.site_id || ''), String(exit.site_name || ''),
      String(body?.reason || exit.reason || ''),
      String(body?.returnerName || exit.requester_name || '').trim(),
      String(exit.requester_role || ''),
      exit.requested_by_user_id ? String(exit.requested_by_user_id) : null,
      exitId,
      String(body?.agentName || body?.returnerName || exit.requester_name || '').trim(),
      String(body?.provenance || exit.site_name || '').trim(),
      signatureName, signatureImage && signatureImage.startsWith('data:image') ? signatureImage.slice(0, 60000) : '',
      String(data.user.id), now, now
    ).run();

    for (const c of clean) {
      await env.DB.prepare(
        'INSERT INTO htc_movement_lines (id, movement_id, item_id, item_name, location, qty, qty_returned) VALUES (?, ?, ?, ?, ?, ?, 0)'
      ).bind(newId(), movId, c.el.item_id, c.el.item_name || '', c.el.location || '', c.qty).run();
      await env.DB.prepare('UPDATE htc_movement_lines SET qty_returned = qty_returned + ? WHERE id = ?').bind(c.qty, c.el.id).run();
    }

    // Statut du bon de sortie : returned si toutes les lignes sont soldées, sinon partial_return
    const updated = await env.DB.prepare('SELECT qty, qty_returned FROM htc_movement_lines WHERE movement_id = ?').bind(exitId).all();
    const allDone = (updated?.results || []).every((l) => Number(l.qty_returned || 0) >= Number(l.qty));
    await env.DB.prepare('UPDATE htc_movements SET status = ?, updated_at = ? WHERE id = ?')
      .bind(allDone ? 'returned' : 'partial_return', now, exitId).run();

    const mov = await env.DB.prepare('SELECT m.*, rm.number AS return_of_number FROM htc_movements m LEFT JOIN htc_movements rm ON rm.id = m.return_of_movement_id WHERE m.id = ?').bind(movId).first();
    const ml = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(movId).all();
    return json({ ok: true, movement: mapMovement(mov, ml?.results || []) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
