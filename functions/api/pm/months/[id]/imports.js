import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth } from '../../../_utils/http.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer';
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const res = await env.DB.prepare('SELECT * FROM pm_imports WHERE month_id = ? ORDER BY imported_at DESC')
      .bind(monthId)
      .all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    return json(
      {
        imports: rows.map((r) => ({
          id: r.id,
          monthId: r.month_id,
          kind: r.kind,
          importedAt: r.imported_at,
          filename: r.filename,
          rowCount: r.row_count,
          createdByUserId: r.created_by_user_id,
          createdByEmail: r.created_by_email
        }))
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
