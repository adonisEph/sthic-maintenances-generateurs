import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';
import { effectiveTechnicianName, technicianMatches } from '../_utils/nhCoherence.js';

const mapRow = (r) => ({
  id: r.id,
  siteId: r.site_id,
  siteName: r.name_site || '',
  idSite: r.id_site || '',
  technician: r.technician || '',
  zone: r.site_zone || r.zone || 'BZV/POOL',
  source: r.source,
  reason: r.reason,
  proposedNh2A: r.proposed_nh2_a,
  proposedDateA: r.proposed_date_a,
  prevNh1DV: r.prev_nh1_dv,
  prevDateDV: r.prev_date_dv,
  prevNh2A: r.prev_nh2_a,
  prevDateA: r.prev_date_a,
  detail: (() => { try { return r.detail ? JSON.parse(r.detail) : null; } catch { return null; } })(),
  status: r.status,
  treatment: r.treatment,
  treatedByEmail: r.treated_by_email,
  treatedAt: r.treated_at,
  createdByEmail: r.created_by_email,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

export async function onRequestGet({ request, env, data }) {
  try {
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const url = new URL(request.url);
    const status = String(url.searchParams.get('status') || 'pending').trim();

    let rows = [];
    try {
      const sql = status === 'all'
        ? `SELECT q.*, s.name_site, s.id_site, s.technician, s.zone AS site_zone
           FROM nh_quarantine q LEFT JOIN sites s ON s.id = q.site_id
           ORDER BY q.created_at DESC LIMIT 500`
        : `SELECT q.*, s.name_site, s.id_site, s.technician, s.zone AS site_zone
           FROM nh_quarantine q LEFT JOIN sites s ON s.id = q.site_id
           WHERE q.status = ? ORDER BY q.created_at DESC LIMIT 500`;
      const stmt = status === 'all'
        ? env.DB.prepare(sql)
        : env.DB.prepare(sql).bind(status);
      const res = await stmt.all();
      rows = Array.isArray(res?.results) ? res.results : [];
    } catch {
      // Table absente (migration non appliquée) → liste vide.
      return json({ items: [], pendingCount: 0, unavailable: true }, { status: 200 });
    }

    const role = String(data?.user?.role || '');

    if (role === 'technician') {
      const techName = await effectiveTechnicianName(env, data);
      rows = rows.filter((r) => technicianMatches(r?.technician, techName));
    } else if (!isSuperAdmin(data)) {
      const z = userZone(data);
      rows = rows.filter((r) => String(r?.site_zone || r?.zone || 'BZV/POOL') === z);
    }

    const items = rows.map(mapRow);
    const pendingCount = items.filter((i) => i.status === 'pending').length;

    return json({ items, pendingCount }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
