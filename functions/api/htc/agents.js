import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth } from '../_utils/http.js';
import { canHtcRequest, htcZoneOk, HTC_ZONE } from './_utils.js';

const AGENT_ROLES = ['admin', 'manager', 'manager_bzv_pool', 'warehouse', 'field_supervisor', 'technician'];
const ROLE_LABEL = {
  admin: 'SuperAdmin', manager: 'Manager', manager_bzv_pool: 'Manager BZV/POOL',
  warehouse: 'Magasinier', field_supervisor: 'Field Supervisor', technician: 'Technicien'
};

// GET /api/htc/agents — agents STHIC de la zone pouvant figurer sur les bons
// (demandeur, agent qui retourne / ramène / répare / remet). Les noms ne se
// saisissent plus à la main : ils viennent des comptes de l'app.
export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!canHtcRequest(data)) return json({ error: 'Accès interdit.' }, { status: 403 });
    if (!htcZoneOk(data)) return json({ error: 'Zone non couverte.' }, { status: 403 });

    const res = await env.DB.prepare(
      `SELECT id, email, role, zone, technician_name FROM users
       WHERE (disabled_at IS NULL OR disabled_at = '')
         AND (zone = ? OR role = 'admin')
       ORDER BY technician_name ASC, email ASC`
    ).bind(HTC_ZONE).all();

    const agents = (res?.results || [])
      .filter((r) => AGENT_ROLES.includes(String(r.role || '')))
      .map((r) => ({
        id: String(r.id),
        name: String(r.technician_name || r.email || '').trim(),
        email: String(r.email || ''),
        role: String(r.role || ''),
        roleLabel: ROLE_LABEL[String(r.role || '')] || String(r.role || '')
      }))
      .filter((a) => a.name);

    return json({ ok: true, agents });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
