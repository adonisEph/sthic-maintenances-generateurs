import { ensureAdminUser, newId, isoNow } from '../_utils/db.js';
import { json, requireAuth, readJson, ymdToday } from '../_utils/http.js';
import { isHtcManager, htcZoneOk, allocHtcNumber, mapMovement, HTC_CONDITIONS } from './_utils.js';

// POST /api/htc/recoveries — BON DE RÉCUPÉRATION (RC-AAAA-NNNN)
// Matériel ramené d'un site qui n'a JAMAIS transité par le stock STHIC
// (installé par HTC directement). Corps :
//   { siteId, siteName, returnerName, movementDate?, reason?,
//     signatureName?, signatureImage?,
//     lines: [{ itemId | newItem:{name,location,category?,unit?,notes?}, qty, condition }] }
export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const body = await readJson(request);
    const inLines = Array.isArray(body?.lines) ? body.lines : [];
    if (!inLines.length || inLines.length > 50) return json({ error: 'Ajoute 1 à 50 lignes.' }, { status: 400 });

    const siteName = String(body?.siteName || '').trim();
    if (!siteName) return json({ error: 'Site de récupération requis.' }, { status: 400 });
    const returnerName = String(body?.returnerName || '').trim();
    if (!returnerName) return json({ error: 'Nom de la personne qui ramène le matériel requis.' }, { status: 400 });

    const signatureName = String(body?.signatureName || '').trim();
    const signatureImage = String(body?.signatureImage || '');
    if (!signatureName && !signatureImage) {
      return json({ error: 'Signature requise (dessinée ou nom tapé).' }, { status: 400 });
    }

    const now = isoNow();
    const clean = [];
    for (const l of inLines) {
      const qty = Math.floor(Number(l?.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > 10000) return json({ error: 'Quantité invalide.' }, { status: 400 });
      const condition = String(l?.condition || 'fonctionnel').trim();
      if (!HTC_CONDITIONS.includes(condition)) return json({ error: 'Condition invalide.' }, { status: 400 });

      let item = null;
      const itemId = String(l?.itemId || '').trim();
      if (itemId) {
        item = await env.DB.prepare('SELECT * FROM htc_items WHERE id = ?').bind(itemId).first();
        if (!item) return json({ error: 'Article introuvable.' }, { status: 400 });
      } else {
        // Création à la volée : matériel ramené jamais géré par STHIC.
        const ni = l?.newItem || {};
        const name = String(ni.name || '').trim();
        const location = String(ni.location || '').trim();
        if (!name) return json({ error: 'Désignation requise pour un nouvel article.' }, { status: 400 });
        if (!['entrepot', 'magasin'].includes(location)) return json({ error: 'Lieu invalide pour un nouvel article.' }, { status: 400 });
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
        item = { id: nid, name, location, unit: String(ni.unit || 'pièce') };
      }
      clean.push({ item, qty, condition });
    }

    const movId = newId();
    const number = await allocHtcNumber(env, 'recovery');
    const mainLoc = String(clean[0].item.location || 'entrepot');

    await env.DB.prepare(
      `INSERT INTO htc_movements (id, number, type, location, movement_date, site_id, site_name, reason,
        requester_name, requester_role, signature_name, signature_image, status, created_by, created_at, updated_at)
       VALUES (?, ?, 'recovery', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`
    ).bind(
      movId, number, mainLoc,
      String(body?.movementDate || '').trim() || ymdToday(),
      String(body?.siteId || '').trim(), siteName,
      String(body?.reason || '').trim(),
      returnerName, String(body?.returnerRole || '').trim() || 'technician',
      signatureName, signatureImage && signatureImage.startsWith('data:image') ? signatureImage.slice(0, 60000) : '',
      String(data.user.id), now, now
    ).run();

    for (const c of clean) {
      await env.DB.prepare(
        'INSERT INTO htc_movement_lines (id, movement_id, item_id, item_name, location, qty, qty_returned, item_condition) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
      ).bind(newId(), movId, c.item.id, c.item.name, c.item.location, c.qty, c.condition).run();
    }

    const mov = await env.DB.prepare('SELECT * FROM htc_movements WHERE id = ?').bind(movId).first();
    const ml = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(movId).all();
    return json({ ok: true, movement: mapMovement(mov, ml?.results || []) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
