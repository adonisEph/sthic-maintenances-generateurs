import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function mapTechRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    zone: row.zone || 'BZV/POOL',
    technicianName: row.technician_name || null
  };
}

export async function onRequestGet({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const z = userZone(data);
    const stmt = isSuperAdmin(data)
      ? env.DB.prepare(
          "SELECT id, email, role, zone, technician_name FROM users WHERE role = 'technician' ORDER BY technician_name ASC, email ASC"
        )
      : env.DB.prepare(
          "SELECT id, email, role, zone, technician_name FROM users WHERE role = 'technician' AND zone = ? ORDER BY technician_name ASC, email ASC"
        ).bind(z);

    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    return json({ technicians: rows.map(mapTechRow).filter(Boolean) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
