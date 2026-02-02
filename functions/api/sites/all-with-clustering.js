import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function mapSiteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.zone || 'BZV/POOL',
    nameSite: row.name_site,
    idSite: row.id_site,
    technician: row.technician,
    technicianId: row.technician_user_id || null,
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
    retired: Boolean(row.retired),
    lastVidange: row.date_dv
  };
}

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const z = userZone(data);

    const query = isSuperAdmin(data)
      ? 'SELECT s.*, u.id as technician_user_id FROM sites s LEFT JOIN users u ON u.technician_name = s.technician ORDER BY s.id_site ASC'
      : 'SELECT s.*, u.id as technician_user_id FROM sites s LEFT JOIN users u ON u.technician_name = s.technician WHERE s.zone = ? ORDER BY s.id_site ASC';

    const stmt = isSuperAdmin(data) ? env.DB.prepare(query) : env.DB.prepare(query).bind(z);

    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json(rows.map(mapSiteRow), { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
