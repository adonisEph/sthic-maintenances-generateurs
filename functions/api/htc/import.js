import { ensureAdminUser, newId, isoNow } from '../_utils/db.js';
import { json, requireAuth, readJson, ymdToday } from '../_utils/http.js';
import { isHtcManager, htcZoneOk, allocHtcNumber, mapMovement, HTC_CONDITIONS } from './_utils.js';

// POST /api/htc/import — Inventaire initial en masse.
// rows: [{ name, location, qty, condition, category?, unit?, notes? }]
// Crée les articles absents du catalogue (par nom+lieu), puis génère
// 1 BE (lignes « fonctionnel ») + 1 RC (lignes non-fonctionnelles).
export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const body = await readJson(request);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length || rows.length > 300) return json({ error: 'Fournis 1 à 300 lignes.' }, { status: 400 });

    const now = isoNow();
    const itemsRes = await env.DB.prepare('SELECT * FROM htc_items').all();
    const byKey = new Map((itemsRes?.results || []).map((r) => [`${String(r.name).trim().toLowerCase()}|${r.location}`, r]));

    const clean = [];
    let created = 0;
    let matched = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const n = i + 1;
      const name = String(r.name || '').trim();
      const location = String(r.location || '').trim();
      const qty = Math.floor(Number(r.qty));
      const condition = String(r.condition || 'fonctionnel').trim();
      if (!name) return json({ error: `Ligne ${n} : désignation vide.` }, { status: 400 });
      if (!['entrepot', 'magasin'].includes(location)) {
        return json({ error: `Ligne ${n} (« ${name} ») : lieu invalide — entrepot|magasin.` }, { status: 400 });
      }
      if (!Number.isFinite(qty) || qty < 0 || qty > 100000) {
        return json({ error: `Ligne ${n} (« ${name} ») : quantité invalide.` }, { status: 400 });
      }
      if (!HTC_CONDITIONS.includes(condition)) {
        return json({ error: `Ligne ${n} (« ${name} ») : condition invalide.` }, { status: 400 });
      }
      if (qty === 0) continue; // ligne informative → ignorée

      const key = `${name.toLowerCase()}|${location}`;
      let item = byKey.get(key);
      if (!item) {
        const nid = newId();
        await env.DB.prepare(
          'INSERT INTO htc_items (id, name, category, location, unit, notes, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)'
        ).bind(
          nid, name, String(r.category || 'other').trim() || 'other', location,
          String(r.unit || 'pièce').trim() || 'pièce', String(r.notes || '').trim(),
          String(data.user.id), now, now
        ).run();
        item = { id: nid, name, location };
        byKey.set(key, item);
        created += 1;
      } else {
        matched += 1;
      }
      clean.push({ item, qty, condition });
    }

    if (!clean.length) return json({ error: 'Aucune ligne exploitable (quantités > 0 requises).' }, { status: 400 });

    const signatureName = String(body?.signatureName || '').trim();
    const signatureImage = String(body?.signatureImage || '');
    const dateStr = String(body?.movementDate || '').trim() || ymdToday();
    const reason = String(body?.reason || '').trim() || 'Inventaire initial — migration';
    const magasinier = String(data.user.technicianName || data.user.email || 'Magasinier');

    const createMov = async (type, lines) => {
      const movId = newId();
      const number = await allocHtcNumber(env, type);
      await env.DB.prepare(
        `INSERT INTO htc_movements (id, number, type, location, movement_date, site_id, site_name, reason,
          requester_name, requester_role, signature_name, signature_image, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`
      ).bind(
        movId, number, type, String(lines[0].item.location || 'entrepot'), dateStr,
        '', type === 'recovery' ? 'Inventaire initial' : '',
        reason, magasinier, 'warehouse',
        signatureName, signatureImage && signatureImage.startsWith('data:image') ? signatureImage.slice(0, 60000) : '',
        String(data.user.id), now, now
      ).run();
      for (const c of lines) {
        await env.DB.prepare(
          'INSERT INTO htc_movement_lines (id, movement_id, item_id, item_name, location, qty, qty_returned, item_condition) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
        ).bind(newId(), movId, c.item.id, c.item.name, c.item.location, c.qty, c.condition).run();
      }
      const mov = await env.DB.prepare('SELECT * FROM htc_movements WHERE id = ?').bind(movId).first();
      const ml = await env.DB.prepare('SELECT * FROM htc_movement_lines WHERE movement_id = ?').bind(movId).all();
      return mapMovement(mov, ml?.results || []);
    };

    const funcLines = clean.filter((c) => c.condition === 'fonctionnel');
    const siteLines = clean.filter((c) => c.condition !== 'fonctionnel');
    const result = { itemsCreated: created, itemsMatched: matched, entry: null, recovery: null };
    if (funcLines.length) result.entry = await createMov('entry', funcLines);
    if (siteLines.length) result.recovery = await createMov('recovery', siteLines);

    return json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
