import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, readJson, isoNow, newId, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
    if (assignments.length === 0) {
      return json({ ok: true, created: 0, updated: 0, sent: 0 }, { status: 200 });
    }

    const now = isoNow();

    const scopeZone = isSuperAdmin(data) ? null : userZone(data);

    let created = 0;
    let updated = 0;
    let sent = 0;

    for (const it of assignments) {
      const month = String(it?.month || '').trim();
      const pmNumber = String(it?.pmNumber || '').trim();
      const siteId = String(it?.siteId || '').trim();
      const siteCode = it?.siteCode != null ? String(it.siteCode).trim() : null;
      const plannedDate = String(it?.plannedDate || '').slice(0, 10);
      const maintenanceType = it?.maintenanceType != null ? String(it.maintenanceType).trim() : null;
      const technicianUserId = it?.technicianUserId != null ? String(it.technicianUserId) : null;
      const technicianName = String(it?.technicianName || '').trim();

      if (!month || !/^\d{4}-\d{2}$/.test(month)) continue;
      if (!pmNumber || !siteId || !plannedDate || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) continue;
      if (!technicianUserId || !technicianName) continue;

      if (String(maintenanceType || '').trim().toLowerCase() !== 'fullpmwo') {
        continue;
      }

      const id = newId();

      const site = await env.DB
        .prepare('SELECT zone, retired FROM sites WHERE id = ?')
        .bind(siteId)
        .first();

      const zone = String(site?.zone || 'BZV/POOL');
      const isRetired = Boolean(site?.retired);

      if (isRetired) {
        continue;
      }

      if (scopeZone && zone !== scopeZone) {
        continue;
      }

      const insertRes = await env.DB.prepare(
        'INSERT OR IGNORE INTO pm_assignments (id, month, pm_number, site_id, site_code, planned_date, maintenance_type, technician_user_id, technician_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' 
      )
        .bind(
          id,
          month,
          pmNumber,
          siteId,
          siteCode,
          plannedDate,
          maintenanceType,
          technicianUserId,
          technicianName,
          'planned',
          now,
          now
        )
        .run();

      if ((insertRes?.meta?.changes || 0) > 0) {
        created += 1;
      }

      const updateRes = await env.DB.prepare(
        "UPDATE pm_assignments SET month = ?, site_id = ?, site_code = COALESCE(?, site_code), planned_date = ?, maintenance_type = COALESCE(?, maintenance_type), technician_user_id = ?, technician_name = ?, status = CASE WHEN status = 'planned' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE pm_number = ? AND status != 'done'"
      )
        .bind(
          month,
          siteId,
          siteCode,
          plannedDate,
          maintenanceType,
          technicianUserId,
          technicianName,
          now,
          now,
          pmNumber
        )
        .run();

      if ((updateRes?.meta?.changes || 0) > 0) {
        updated += 1;
      }

      const row = await env.DB.prepare('SELECT status FROM pm_assignments WHERE pm_number = ?')
        .bind(pmNumber)
        .first();

      if (row?.status === 'sent') {
        sent += 1;
      }
    }

    if (created > 0 || updated > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, created, updated, sent }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
