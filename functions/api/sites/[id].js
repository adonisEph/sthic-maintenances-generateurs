import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, readJson, isoNow } from '../_utils/http.js';

function mapSiteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    nameSite: row.name_site,
    idSite: row.id_site,
    technician: row.technician,
    generateur: row.generateur,
    capacite: row.capacite,
    kitVidange: row.kit_vidange,
    nh1DV: row.nh1_dv,
    dateDV: row.date_dv,
    nh2A: row.nh2_a,
    dateA: row.date_a,
    regime: row.regime,
    nhEstimated: row.nh_estimated,
    diffNHs: row.diff_nhs,
    diffEstimated: row.diff_estimated,
    seuil: row.seuil,
    retired: Boolean(row.retired)
  };
}

export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const id = String(params?.id || '');
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const existing = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Site introuvable.' }, { status: 404 });

    const body = await readJson(request);
    const now = isoNow();

    const next = {
      nameSite: body.nameSite != null ? String(body.nameSite) : existing.name_site,
      idSite: body.idSite != null ? String(body.idSite) : existing.id_site,
      technician: body.technician != null ? String(body.technician) : existing.technician,
      generateur: body.generateur != null ? String(body.generateur) : existing.generateur,
      capacite: body.capacite != null ? String(body.capacite) : existing.capacite,
      kitVidange: body.kitVidange != null ? String(body.kitVidange) : existing.kit_vidange,
      nh1DV: body.nh1DV != null ? Number(body.nh1DV) : existing.nh1_dv,
      dateDV: body.dateDV != null ? String(body.dateDV) : existing.date_dv,
      nh2A: body.nh2A != null ? Number(body.nh2A) : existing.nh2_a,
      dateA: body.dateA != null ? String(body.dateA) : existing.date_a,
      regime: body.regime != null ? Number(body.regime) : existing.regime,
      nhEstimated: body.nhEstimated != null ? Number(body.nhEstimated) : existing.nh_estimated,
      diffNHs: body.diffNHs != null ? Number(body.diffNHs) : existing.diff_nhs,
      diffEstimated: body.diffEstimated != null ? Number(body.diffEstimated) : existing.diff_estimated,
      seuil: body.seuil != null ? Number(body.seuil) : existing.seuil,
      retired: body.retired != null ? (body.retired ? 1 : 0) : existing.retired
    };

    await env.DB.prepare(
      'UPDATE sites SET name_site = ?, id_site = ?, technician = ?, generateur = ?, capacite = ?, kit_vidange = ?, nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, seuil = ?, retired = ?, updated_at = ? WHERE id = ?'
    )
      .bind(
        next.nameSite,
        next.idSite,
        next.technician,
        next.generateur,
        next.capacite,
        next.kitVidange,
        next.nh1DV,
        next.dateDV,
        next.nh2A,
        next.dateA,
        next.regime,
        next.nhEstimated,
        next.diffNHs,
        next.diffEstimated,
        next.seuil,
        next.retired,
        now,
        id
      )
      .run();

    const updated = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
    return json({ site: mapSiteRow(updated) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestDelete({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const id = String(params?.id || '');
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const existing = await env.DB.prepare('SELECT id FROM sites WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Site introuvable.' }, { status: 404 });

    await env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM interventions WHERE site_id = ?').bind(id).run();

    return json({ ok: true }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
