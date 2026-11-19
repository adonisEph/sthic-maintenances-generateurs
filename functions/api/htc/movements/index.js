import { ensureAdminUser, newId, isoNow } from '../../_utils/db.js';
import { json, requireAuth, readJson, ymdToday } from '../../_utils/http.js';
import { isHtcManager, canHtcRequest, htcZoneOk, allocHtcNumber, mapMovement, HTC_ZONE } from '../_utils.js';

export async function onRequestGet({ env, data, request }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!canHtcRequest(data)) return json({ error: 'Accès interdit.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const url = new URL(request.url);
    const mine = url.searchParams.get('mine') === '1';
    const manager = isHtcManager(data);
    // Hors magasinier : uniquement ?mine=1 → les bons à son nom (demandeur,
    // agent, émetteur) pour consultation et export Excel.
    if (!manager && !mine) return json({ error: 'Réservé au magasinier.' }, { status: 403 });

    const type = String(url.searchParams.get('type') || '').trim();
    const location = String(url.searchParams.get('location') || '').trim();
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const from = String(url.searchParams.get('from') || '').trim();
    const to = String(url.searchParams.get('to') || '').trim();

    const clauses = ['1=1'];
    const binds = [];

    if (!manager && mine) {
      const u = await env.DB.prepare('SELECT technician_name, email FROM users WHERE id = ?')
        .bind(String(data.user.id)).first();
      const myName = String(u?.technician_name || data.user?.technicianName || data.user?.email || '').trim();
      clauses.push('(m.requested_by_user_id = ? OR m.created_by = ? OR LOWER(m.requester_name) = LOWER(?) OR LOWER(m.agent_name) = LOWER(?) OR LOWER(m.beneficiary) = LOWER(?))');
      binds.push(String(data.user.id), String(data.user.id), myName, myName, myName);
    }
    if (['exit', 'entry', 'return', 'recovery', 'reinstatement', 'client_return', 'dotation'].includes(type)) { clauses.push('m.type = ?'); binds.push(type); }
    if (['entrepot', 'magasin'].includes(location)) { clauses.push('m.location = ?'); binds.push(location); }
    if (from) { clauses.push('m.movement_date >= ?'); binds.push(from); }
    if (to) { clauses.push('m.movement_date <= ?'); binds.push(to); }
    if (q) {
      clauses.push('(LOWER(m.number) LIKE ? OR LOWER(m.requester_name) LIKE ? OR LOWER(m.site_name) LIKE ? OR LOWER(m.reason) LIKE ?)');
      const like = `%${q}%`;
      binds.push(like, like, like, like);
    }

    const res = await env.DB.prepare(
      `SELECT m.*, rm.number AS return_of_number FROM htc_movements m
       LEFT JOIN htc_movements rm ON rm.id = m.return_of_movement_id
       WHERE ${clauses.join(' AND ')} ORDER BY m.movement_date DESC, m.created_at DESC LIMIT 500`
    ).bind(...binds).all();
    const rows = res?.results || [];

    let linesByMov = {};
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const ph = ids.map(() => '?').join(',');
      const lr = await env.DB.prepare(`SELECT * FROM htc_movement_lines WHERE movement_id IN (${ph})`).bind(...ids).all();
      for (const l of lr?.results || []) (linesByMov[l.movement_id] ||= []).push(l);
    }

    return json({ ok: true, movements: rows.map((r) => mapMovement(r, linesByMov[r.id])) });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

// POST — BON D'ENTRÉE direct (réception matériel) : { lines:[{itemId, qty}], movementDate, siteId/siteName?, reason, signatureName/Image }
export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const body = await readJson(request);
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    if (!lines.length || lines.length > 50) return json({ error: 'Ajoute 1 à 50 lignes.' }, { status: 400 });

    const ids = lines.map((l) => String(l?.itemId || '').trim()).filter(Boolean);
    const items = new Map();
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      const itemsRes = await env.DB.prepare(`SELECT * FROM htc_items WHERE id IN (${ph})`).bind(...ids).all();
      for (const r of itemsRes?.results || []) items.set(r.id, r);
    }

    const now = isoNow();
    const clean = [];
    for (const l of lines) {
      const qty = Math.floor(Number(l?.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > 10000) return json({ error: 'Quantité invalide.' }, { status: 400 });
      const itemId = String(l?.itemId || '').trim();
      if (itemId) {
        const it = items.get(itemId);
        if (!it) return json({ error: 'Article introuvable.' }, { status: 400 });
        clean.push({ item: it, qty });
        continue;
      }
      // Article créé à la volée : réception d'un matériel jamais catalogué.
      // Anti-doublon : même désignation (casse ignorée) + même lieu → réutilisation.
      const ni = l?.newItem || {};
      const name = String(ni.name || '').trim();
      const location = String(ni.location || '').trim();
      if (!name) return json({ error: 'Désignation requise pour un nouvel article.' }, { status: 400 });
      if (!['entrepot', 'magasin'].includes(location)) return json({ error: 'Lieu invalide pour un nouvel article.' }, { status: 400 });
      let it = await env.DB.prepare('SELECT * FROM htc_items WHERE LOWER(TRIM(name)) = LOWER(?) AND location = ?').bind(name, location).first();
      if (!it) {
        const nid = newId();
        await env.DB.prepare(
          'INSERT INTO htc_items (id, name, category, location, unit, notes, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)'
        ).bind(
          nid, name,
          String(ni.category || 'other').trim() || 'other',
          location,
          String(ni.unit || 'pièce').trim() || 'pièce',
          String(ni.notes || '').trim(),
          String(data.user.id), now, now
        ).run();
        it = { id: nid, name, location, unit: 'pièce' };
      }
      clean.push({ item: it, qty });
    }

    const signatureName = String(body?.signatureName || '').trim();
    const signatureImage = String(body?.signatureImage || '');

    const movId = newId();
    const number = await allocHtcNumber(env, 'entry');
    const mainLoc = String(clean[0].item.location || 'entrepot');

    const senderType = ['htc', 'supplier'].includes(String(body?.senderType || '')) ? String(body.senderType) : '';

    await env.DB.prepare(
      `INSERT INTO htc_movements (id, number, type, location, movement_date, site_id, site_name, reason,
        requester_name, requester_role, sender_type, smr_number, beneficiary,
        signature_name, signature_image, status, created_by, created_at, updated_at)
       VALUES (?, ?, 'entry', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`
    ).bind(
      movId, number, mainLoc,
      String(body?.movementDate || '').trim() || ymdToday(),
      String(body?.siteId || '').trim(), String(body?.siteName || '').trim(),
      String(body?.reason || '').trim(),
      String(body?.supplierName || data.user.technicianName || data.user.email || '').trim(),
      String(body?.requesterRole || 'warehouse'),
      senderType,
      String(body?.smrNumber || '').trim(),
      String(body?.beneficiary || '').trim(),
      signatureName, signatureImage && signatureImage.startsWith('data:image') ? signatureImage.slice(0, 60000) : '',
      String(data.user.id), now, now
    ).run();

    for (const l of clean) {
      await env.DB.prepare(
        'INSERT INTO htc_movement_lines (id, movement_id, item_id, item_name, location, qty, qty_returned) VALUES (?, ?, ?, ?, ?, ?, 0)'
      ).bind(newId(), movId, l.item.id, l.item.name, l.item.location, l.qty).run();
    }

    const mov = await env.DB.prepare('SELECT * FROM htc_movements WHERE id = ?').bind(movId).first();
    const ml = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(movId).all();
    return json({ ok: true, movement: mapMovement(mov, ml?.results || []) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
