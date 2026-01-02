import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, requireAdmin, readJson, isoNow } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer';
}

function mapItemRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    monthId: r.month_id,
    number: r.number,
    siteCode: r.site_code,
    siteName: r.site_name,
    region: r.region,
    zone: r.zone,
    shortDescription: r.short_description,
    maintenanceType: r.maintenance_type,
    scheduledWoDate: r.scheduled_wo_date,
    assignedTo: r.assigned_to,
    state: r.state,
    closedAt: r.closed_at,
    reprogrammationDate: r.reprogrammation_date,
    reprogrammationReason: r.reprogrammation_reason,
    reprogrammationStatus: r.reprogrammation_status,
    lastNocImportAt: r.last_noc_import_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const res = await env.DB.prepare('SELECT * FROM pm_items WHERE month_id = ? ORDER BY scheduled_wo_date ASC, number ASC')
      .bind(monthId)
      .all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json({ items: rows.map(mapItemRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

function normStr(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const body = await readJson(request);
    const id = String(body?.id || '').trim();
    if (!id) return json({ error: 'ID requis.' }, { status: 400 });

    const reprogrammationDateRaw = body?.reprogrammationDate;
    const reprogrammationStatusRaw = body?.reprogrammationStatus;
    const reprogrammationReasonRaw = body?.reprogrammationReason;

    const reprogrammationDate = reprogrammationDateRaw == null ? null : normStr(reprogrammationDateRaw);
    if (reprogrammationDate && !/^\d{4}-\d{2}-\d{2}$/.test(reprogrammationDate)) {
      return json({ error: 'Date invalide.' }, { status: 400 });
    }

    const reprogrammationStatus = reprogrammationStatusRaw == null ? null : normStr(reprogrammationStatusRaw);
    if (reprogrammationStatus && !['APPROVED', 'REJECTED', 'PENDING'].includes(reprogrammationStatus)) {
      return json({ error: 'Statut invalide.' }, { status: 400 });
    }

    const reprogrammationReason = reprogrammationReasonRaw == null ? null : normStr(reprogrammationReasonRaw);

    const existing = await env.DB.prepare('SELECT * FROM pm_items WHERE id = ? AND month_id = ?').bind(id, monthId).first();
    if (!existing) return json({ error: 'Ticket introuvable.' }, { status: 404 });

    const now = isoNow();
    await env.DB.prepare(
      'UPDATE pm_items SET reprogrammation_date = ?, reprogrammation_status = ?, reprogrammation_reason = ?, updated_at = ? WHERE id = ? AND month_id = ?'
    )
      .bind(reprogrammationDate, reprogrammationStatus, reprogrammationReason, now, id, monthId)
      .run();

    await touchLastUpdatedAt(env);

    const updated = await env.DB.prepare('SELECT * FROM pm_items WHERE id = ? AND month_id = ?').bind(id, monthId).first();
    return json({ item: mapItemRow(updated) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
