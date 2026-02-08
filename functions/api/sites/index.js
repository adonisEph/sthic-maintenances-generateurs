import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

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

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    const z = userZone(data);

    let stmt = env.DB.prepare('SELECT * FROM sites ORDER BY id_site ASC');
    if (role === 'technician') {
      const techName = String(data?.user?.technicianName || '').trim();
      if (isSuperAdmin(data)) {
        stmt = env.DB.prepare('SELECT * FROM sites WHERE technician = ? ORDER BY id_site ASC').bind(techName);
      } else {
        stmt = env.DB.prepare('SELECT * FROM sites WHERE zone = ? AND technician = ? ORDER BY id_site ASC').bind(z, techName);
      }
    } else if (role === 'admin') {
      if (!isSuperAdmin(data)) {
        stmt = env.DB.prepare('SELECT * FROM sites WHERE zone = ? ORDER BY id_site ASC').bind(z);
      }
    } else if (role === 'manager' || role === 'viewer') {
      stmt = env.DB.prepare('SELECT * FROM sites WHERE zone = ? ORDER BY id_site ASC').bind(z);
    }

    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json({ sites: rows.map(mapSiteRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const id = newId();
    const now = isoNow();

    const zone = isSuperAdmin(data) ? String(body.zone || userZone(data) || 'BZV/POOL') : userZone(data);

    await env.DB.prepare(
      'INSERT INTO sites (id, zone, name_site, id_site, technician, generateur, capacite, kit_vidange, nh1_dv, date_dv, nh2_a, date_a, regime, nh_estimated, diff_nhs, diff_estimated, seuil, retired, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        id,
        zone,
        String(body.nameSite || ''),
        String(body.idSite || ''),
        String(body.technician || ''),
        String(body.generateur || ''),
        String(body.capacite || ''),
        String(body.kitVidange || ''),
        Number(body.nh1DV || 0),
        String(body.dateDV || ''),
        Number(body.nh2A || 0),
        String(body.dateA || ''),
        Number(body.regime || 0),
        Number(body.nhEstimated || 0),
        Number(body.diffNHs || 0),
        Number(body.diffEstimated || 0),
        Number(body.seuil || 250),
        body.retired ? 1 : 0,
        now,
        now
      )
      .run();

    await touchLastUpdatedAt(env);

    const created = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
    return json({ site: mapSiteRow(created) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
