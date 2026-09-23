import { json, requireAuth, isSuperAdmin, userZone } from '../../_utils/http.js';
import { effectiveTechnicianName, technicianMatches } from '../../_utils/nhCoherence.js';

const MANAGER_ROLES = ['admin', 'manager', 'manager_bzv_pool', 'controller', 'field_supervisor', 'viewer'];

const mapRow = (r) => ({
  id: r.id,
  readingDate: r.reading_date,
  nhValue: r.nh_value,
  prevNh2A: r.prev_nh2_a,
  prevDateA: r.prev_date_a,
  prevNh1DV: r.prev_nh1_dv,
  prevDateDV: r.prev_date_dv,
  isReset: Boolean(r.is_reset),
  source: r.source || '',
  quarantineId: r.quarantine_id || null,
  createdByEmail: r.created_by_email || '',
  createdAt: r.created_at
});

export async function onRequestGet({ env, data, params }) {
  try {
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const siteId = String(params?.id || '').trim();
    if (!siteId) return json({ error: 'Site requis.' }, { status: 400 });

    const site = await env.DB.prepare('SELECT id, zone, technician FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    const role = String(data?.user?.role || '');
    if (role === 'technician') {
      const techName = await effectiveTechnicianName(env, data);
      if (!technicianMatches(site?.technician, techName)) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    } else if (MANAGER_ROLES.includes(role)) {
      if (!isSuperAdmin(data) && role !== 'manager_bzv_pool') {
        const z = userZone(data);
        if (String(site.zone || 'BZV/POOL') !== z) {
          return json({ error: 'Accès interdit.' }, { status: 403 });
        }
      }
    } else {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    let rows = [];
    try {
      const res = await env.DB.prepare(
        'SELECT * FROM nh_readings WHERE site_id = ? ORDER BY reading_date DESC, created_at DESC LIMIT 100'
      )
        .bind(siteId)
        .all();
      rows = Array.isArray(res?.results) ? res.results : [];
    } catch {
      rows = [];
    }

    return json({ items: rows.map(mapRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
