import { ensureAdminUser, newId, isoNow } from '../../_utils/db.js';
import { json, requireAuth, readJson } from '../../_utils/http.js';
import { isHtcManager, canHtcRequest, htcZoneOk, htcStockMap, mapItem } from '../_utils.js';

export async function onRequestGet({ env, data, request }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!canHtcRequest(data)) return json({ error: 'Accès interdit.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const url = new URL(request.url);
    const location = String(url.searchParams.get('location') || '').trim();
    const includeInactive = url.searchParams.get('all') === '1' && isHtcManager(data);

    const clauses = [];
    const binds = [];
    if (!includeInactive) { clauses.push('active = 1'); }
    if (location === 'entrepot' || location === 'magasin') { clauses.push('location = ?'); binds.push(location); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const res = await env.DB.prepare(`SELECT * FROM htc_items ${where} ORDER BY name COLLATE NOCASE`).bind(...binds).all();
    const stock = await htcStockMap(env, location || null);

    return json({ ok: true, items: (res?.results || []).map((r) => mapItem(r, stock)) });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const body = await readJson(request);
    const name = String(body?.name || '').trim();
    const location = String(body?.location || '').trim();
    if (!name) return json({ error: 'Désignation requise.' }, { status: 400 });
    if (!['entrepot', 'magasin'].includes(location)) return json({ error: 'Lieu invalide (entrepot|magasin).' }, { status: 400 });

    const id = newId();
    const now = isoNow();
    await env.DB.prepare(
      'INSERT INTO htc_items (id, name, category, location, unit, notes, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)'
    ).bind(
      id, name,
      String(body?.category || 'other').trim() || 'other',
      location,
      String(body?.unit || 'pièce').trim() || 'pièce',
      String(body?.notes || '').trim(),
      data.user.id, now, now
    ).run();

    const row = await env.DB.prepare('SELECT * FROM htc_items WHERE id = ?').bind(id).first();
    return json({ ok: true, item: mapItem(row, {}) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
