import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, isoNow, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.zone || 'BZV/POOL',
    siteId: row.site_id,
    plannedDate: row.planned_date,
    epvType: row.epv_type,
    technicianUserId: row.technician_user_id || null,
    technicianName: row.technician_name,
    status: row.status,
    sentAt: row.sent_at || null,
    doneAt: row.done_at || null,
    closeReason: row.close_reason || null,
    ticketNumber: row.ticket_number || null,
    ficheId: row.fiche_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function onRequestPost({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') return json({ error: 'Accès interdit.' }, { status: 403 });

    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const existing = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Intervention introuvable.' }, { status: 404 });

    if (String(existing.status || '') === 'done' || String(existing.status || '') === 'non_fait') {
      return json({ error: 'Impossible de déclencher une intervention effectuée.' }, { status: 400 });
    }

    if (role === 'admin' && !isSuperAdmin(data)) {
      const z = userZone(data);
      if (String(existing.zone || 'BZV/POOL') !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const now = isoNow();

    await env.DB.prepare(
      "UPDATE interventions SET status = 'sent', sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE id = ? AND status IN ('planned', 'sent')"
    )
      .bind(now, now, id)
      .run();

    await touchLastUpdatedAt(env);

    const updated = await env.DB.prepare(
      `SELECT i.*, fh.ticket_number, fh.id as fiche_id
       FROM interventions i
       LEFT JOIN fiche_history fh ON fh.intervention_id = i.id
       WHERE i.id = ?`
    )
      .bind(id)
      .first();

    return json({ intervention: mapRow(updated) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
