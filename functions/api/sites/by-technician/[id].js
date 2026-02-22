import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../../_utils/http.js';

function normalizeZone(z) {
  return String(z || '')
    .trim()
    .toUpperCase();
}

function mapSiteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.zone || 'BZV/POOL',
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

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const userId = String(params?.id || '').trim();
    if (!userId) return json({ error: 'ID technicien requis.' }, { status: 400 });

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    if (!user) return json({ error: 'Technicien introuvable.' }, { status: 404 });

    if (String(user?.role || '') !== 'technician') return json({ error: 'Technicien invalide.' }, { status: 400 });

    const technicianName = String(user.technician_name || '').trim();
    if (!technicianName) return json({ error: 'Nom technicien manquant.' }, { status: 400 });

    const technicianEmail = String(user.email || '').trim();

    const z = userZone(data);

    if (!isSuperAdmin(data)) {
      const techZone = String(user?.zone || 'BZV/POOL');
      if (String(techZone) !== String(z)) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const stmt = env.DB.prepare(
      `SELECT * FROM sites
       WHERE TRIM(technician) = TRIM(?) COLLATE NOCASE
          OR (TRIM(?) != '' AND TRIM(technician) = TRIM(?) COLLATE NOCASE)
       ORDER BY id_site ASC`
    ).bind(technicianName, technicianEmail, technicianEmail);

    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    if (isSuperAdmin(data)) {
      return json(rows.map(mapSiteRow), { status: 200 });
    }

    const zn = normalizeZone(z || 'BZV/POOL');
    const filtered = rows.filter((r) => {
      const siteZone = r?.zone == null || String(r.zone).trim() === '' ? z : r.zone;
      return normalizeZone(siteZone || 'BZV/POOL') === zn;
    });

    return json(filtered.map(mapSiteRow), { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
