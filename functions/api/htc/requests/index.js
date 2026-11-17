import { ensureAdminUser, newId, isoNow } from '../../_utils/db.js';
import { json, requireAuth, readJson } from '../../_utils/http.js';
import { isHtcManager, canHtcRequest, htcZoneOk, allocHtcNumber, mapRequest, HTC_ZONE } from '../_utils.js';

const REQ_ROLES = ['field_supervisor', 'technician', 'htc_supervisor', 'manager', 'warehouse', 'admin'];

export async function onRequestGet({ env, data, request }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!canHtcRequest(data)) return json({ error: 'Accès interdit.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const url = new URL(request.url);
    const status = String(url.searchParams.get('status') || '').trim();
    const manager = isHtcManager(data);
    const clauses = ['1=1'];
    const binds = [];
    if (!manager) { clauses.push('requested_by_user_id = ?'); binds.push(String(data.user.id)); }
    if (status) { clauses.push('status = ?'); binds.push(status); }

    const res = await env.DB.prepare(
      `SELECT * FROM htc_requests WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 500`
    ).bind(...binds).all();
    const rows = res?.results || [];

    let linesByReq = {};
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const ph = ids.map(() => '?').join(',');
      const lr = await env.DB.prepare(`SELECT * FROM htc_request_lines WHERE request_id IN (${ph})`).bind(...ids).all();
      for (const l of lr?.results || []) (linesByReq[l.request_id] ||= []).push(l);
    }

    const pendingRow = manager
      ? await env.DB.prepare("SELECT COUNT(1) AS c FROM htc_requests WHERE status = 'pending'").first()
      : null;

    return json({
      ok: true,
      requests: rows.map((r) => mapRequest(r, linesByReq[r.id])),
      pendingCount: Number(pendingRow?.c || 0)
    });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!canHtcRequest(data)) return json({ error: 'Accès interdit.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const body = await readJson(request);
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    if (!lines.length) return json({ error: 'Ajoute au moins un article.' }, { status: 400 });
    if (lines.length > 50) return json({ error: 'Trop de lignes (max 50).' }, { status: 400 });

    const onBehalf = body?.onBehalf && isHtcManager(data) ? body.onBehalf : null;
    const requesterRole = onBehalf ? String(onBehalf.role || 'htc_supervisor') : String(data.user.role);
    const requesterName = onBehalf
      ? String(onBehalf.name || '').trim()
      : String(data.user.technicianName || data.user.email || '').trim();
    if (!REQ_ROLES.includes(requesterRole)) return json({ error: 'Rôle demandeur invalide.' }, { status: 400 });
    if (!requesterName) return json({ error: 'Nom du demandeur requis.' }, { status: 400 });

    // Snapshot des articles demandés (existence + désignation + lieu)
    const ids = lines.map((l) => String(l?.itemId || '').trim()).filter(Boolean);
    if (ids.length !== lines.length) return json({ error: 'Article manquant sur une ligne.' }, { status: 400 });
    const ph = ids.map(() => '?').join(',');
    const itemsRes = await env.DB.prepare(`SELECT * FROM htc_items WHERE id IN (${ph}) AND active = 1`).bind(...ids).all();
    const items = new Map((itemsRes?.results || []).map((r) => [r.id, r]));

    const clean = [];
    for (const l of lines) {
      const qty = Math.floor(Number(l?.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > 10000) return json({ error: 'Quantité invalide (1..10000).' }, { status: 400 });
      const it = items.get(String(l.itemId));
      if (!it) return json({ error: `Article introuvable ou inactif.` }, { status: 400 });
      clean.push({ item: it, qty });
    }

    const id = newId();
    const now = isoNow();
    const number = await allocHtcNumber(env, 'request');

    await env.DB.prepare(
      `INSERT INTO htc_requests (id, request_number, status, requested_by_user_id, requester_name, requester_role,
        site_id, site_name, reason, notes, swo_number, zone, created_by, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, number,
      onBehalf ? null : String(data.user.id),
      requesterName, requesterRole,
      String(body?.siteId || '').trim(), String(body?.siteName || '').trim(),
      String(body?.reason || '').trim(), String(body?.notes || '').trim(),
      String(body?.swoNumber || '').trim(),
      HTC_ZONE, String(data.user.id), now, now
    ).run();

    for (const l of clean) {
      await env.DB.prepare(
        'INSERT INTO htc_request_lines (id, request_id, item_id, item_name, location, qty) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newId(), id, l.item.id, l.item.name, l.item.location, l.qty).run();
    }

    const row = await env.DB.prepare('SELECT * FROM htc_requests WHERE id = ?').bind(id).first();
    const lr = await env.DB.prepare('SELECT * FROM htc_request_lines WHERE request_id = ?').bind(id).all();
    return json({ ok: true, request: mapRequest(row, lr?.results || []) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
