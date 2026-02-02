import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, readJson, isoNow, newId, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const interventions = Array.isArray(body?.interventions) ? body.interventions : [];
    if (interventions.length === 0) {
      return json({ ok: true, created: 0, updated: 0, sent: 0 }, { status: 200 });
    }

    const now = isoNow();

    let created = 0;
    let updated = 0;
    let sent = 0;

    for (const it of interventions) {
      const siteId = String(it?.siteId || '');
      const plannedDate = String(it?.plannedDate || '');
      const epvType = String(it?.epvType || '');
      const technicianUserId = it?.technicianUserId != null ? String(it.technicianUserId) : null;
      const technicianName = String(it?.technicianName || '').trim();

      if (!siteId || !plannedDate || !epvType || !technicianName || !technicianUserId) {
        continue;
      }

      const id = newId();

      const site = await env.DB.prepare('SELECT zone FROM sites WHERE id = ?').bind(siteId).first();
      const zone = String(site?.zone || 'BZV/POOL');
      if (!isSuperAdmin(data)) {
        const z = userZone(data);
        if (zone !== z) {
          continue;
        }
      }

      const insertRes = await env.DB.prepare(
        'INSERT OR IGNORE INTO interventions (id, site_id, zone, planned_date, epv_type, technician_user_id, technician_name, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(id, siteId, zone, plannedDate, epvType, technicianUserId, technicianName, 'planned', data.user.id, now, now)
        .run();

      if ((insertRes?.meta?.changes || 0) > 0) {
        created += 1;
      }

      const updateRes = await env.DB.prepare(
        "UPDATE interventions SET technician_user_id = ?, technician_name = ?, status = CASE WHEN status = 'planned' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE site_id = ? AND planned_date = ? AND epv_type = ? AND status != 'done'"
      )
        .bind(technicianUserId, technicianName, now, now, siteId, plannedDate, epvType)
        .run();

      if ((updateRes?.meta?.changes || 0) > 0) {
        updated += 1;
      }

      const row = await env.DB.prepare(
        'SELECT status FROM interventions WHERE site_id = ? AND planned_date = ? AND epv_type = ?'
      )
        .bind(siteId, plannedDate, epvType)
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
