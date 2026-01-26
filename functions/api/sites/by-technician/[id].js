import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAdmin, requireAuth } from '../../_utils/http.js';

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
    nhOffset: row.nh_offset == null ? 0 : Number(row.nh_offset),
    regime: row.regime,
    nhEstimated: row.nh_estimated,
    diffNHs: row.diff_nhs,
    diffEstimated: row.diff_estimated,
    seuil: row.seuil,
    retired: Boolean(row.retired)
  };
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const userId = String(params?.id || '').trim();
    if (!userId) return json({ error: 'ID technicien requis.' }, { status: 400 });

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    if (!user) return json({ error: 'Technicien introuvable.' }, { status: 404 });

    const technicianName = String(user.technician_name || '').trim();
    if (!technicianName) return json({ error: 'Nom technicien manquant.' }, { status: 400 });

    const res = await env.DB.prepare('SELECT * FROM sites WHERE technician = ? ORDER BY id_site ASC').bind(technicianName).all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json(rows.map(mapSiteRow), { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
