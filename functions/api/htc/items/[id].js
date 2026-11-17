import { ensureAdminUser, isoNow } from '../../_utils/db.js';
import { json, requireAuth, readJson } from '../../_utils/http.js';
import { isHtcManager, htcZoneOk, mapItem } from '../_utils.js';

export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const id = String(params?.id || '');
    const body = await readJson(request);
    const fields = [];
    const binds = [];
    if (body?.name !== undefined) { fields.push('name = ?'); binds.push(String(body.name).trim()); }
    if (body?.category !== undefined) { fields.push('category = ?'); binds.push(String(body.category).trim()); }
    if (body?.location !== undefined) {
      if (!['entrepot', 'magasin'].includes(String(body.location))) return json({ error: 'Lieu invalide.' }, { status: 400 });
      fields.push('location = ?'); binds.push(String(body.location));
    }
    if (body?.unit !== undefined) { fields.push('unit = ?'); binds.push(String(body.unit).trim()); }
    if (body?.notes !== undefined) { fields.push('notes = ?'); binds.push(String(body.notes).trim()); }
    if (body?.active !== undefined) { fields.push('active = ?'); binds.push(body.active ? 1 : 0); }
    if (!fields.length) return json({ error: 'Rien à modifier.' }, { status: 400 });

    fields.push('updated_at = ?'); binds.push(isoNow()); binds.push(id);
    const res = await env.DB.prepare(`UPDATE htc_items SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
    if (!Number(res?.meta?.changes || 0)) return json({ error: 'Article introuvable.' }, { status: 404 });
    const row = await env.DB.prepare('SELECT * FROM htc_items WHERE id = ?').bind(id).first();
    return json({ ok: true, item: mapItem(row, null) });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestDelete({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isHtcManager(data)) return json({ error: 'Réservé au magasinier.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const id = String(params?.id || '');
    const res = await env.DB.prepare('UPDATE htc_items SET active = 0, updated_at = ? WHERE id = ?').bind(isoNow(), id).run();
    if (!Number(res?.meta?.changes || 0)) return json({ error: 'Article introuvable.' }, { status: 404 });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
