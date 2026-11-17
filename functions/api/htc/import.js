import { ensureAdminUser, newId, isoNow } from '../_utils/db.js';
import { json, requireAuth, readJson } from '../_utils/http.js';
import { isHtcManager, htcZoneOk, HTC_CONDITIONS } from './_utils.js';

// POST /api/htc/import — Import catalogue en masse.
// rows: [{ name, location, qty, condition, category?, unit?, notes? }]
// Crée les articles absents du catalogue (par nom+lieu) — N'ÉMET AUCUN BON :
// les quantités reviennent résolues (itemId) pour pré-remplir un BE / RC
// via le canal prévu (avec expéditeur, N°SMR, fonction, signature).
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

    const resolved = [];
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
      resolved.push({ itemId: item.id, itemName: item.name, location, qty, condition });
    }

    return json({ ok: true, itemsCreated: created, itemsMatched: matched, rows: resolved }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
