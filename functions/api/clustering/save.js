import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, requireAuth, readJson, isoNow, newId } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function normId(v) {
  const s = String(v ?? '').trim();
  return s || '';
}

function canonPair(a, b) {
  const x = normId(a);
  const y = normId(b);
  if (!x || !y) return null;
  if (x === y) return null;
  return x < y ? [x, y] : [y, x];
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const technicianId = normId(body?.technicianId);
    if (!technicianId) return json({ error: 'Technicien requis.' }, { status: 400 });

    const pairsIn = Array.isArray(body?.pairs) ? body.pairs : [];
    const unique = new Set();
    const outPairs = [];

    for (const p of pairsIn) {
      const c = canonPair(p?.siteId1, p?.siteId2);
      if (!c) continue;
      const key = `${c[0]}|${c[1]}`;
      if (unique.has(key)) continue;
      unique.add(key);
      outPairs.push({ siteId1: c[0], siteId2: c[1] });
    }

    const now = isoNow();

    await env.DB.prepare('DELETE FROM clustering_pairs WHERE technician_user_id = ?').bind(technicianId).run();

    let inserted = 0;
    for (const p of outPairs) {
      const id = newId();
      await env.DB.prepare(
        'INSERT INTO clustering_pairs (id, technician_user_id, site_id_1, site_id_2, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(id, technicianId, p.siteId1, p.siteId2, now, now)
        .run();
      inserted += 1;
    }

    await touchLastUpdatedAt(env);

    return json({ ok: true, inserted }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
