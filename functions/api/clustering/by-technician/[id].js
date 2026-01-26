import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAdmin, requireAuth } from '../../_utils/http.js';

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const techId = String(params?.id || '').trim();
    if (!techId) return json({ error: 'ID technicien requis.' }, { status: 400 });

    const res = await env.DB.prepare(
      'SELECT id, technician_user_id, site_id_1, site_id_2, created_at, updated_at FROM clustering_pairs WHERE technician_user_id = ? ORDER BY created_at ASC'
    )
      .bind(techId)
      .all();

    const rows = Array.isArray(res?.results) ? res.results : [];
    return json(
      rows.map((r) => ({
        id: r.id,
        technicianId: r.technician_user_id,
        siteId1: r.site_id_1,
        siteId2: r.site_id_2,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
