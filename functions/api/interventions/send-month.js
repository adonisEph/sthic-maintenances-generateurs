import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const interventions = Array.isArray(body?.interventions) ? body.interventions : [];
    if (interventions.length === 0) {
      return json({ ok: true, created: 0, updated: 0, sent: 0 }, { status: 200 });
    }

    const now = isoNow();
    const canAllZones = isSuperAdmin(data) || role === 'manager' || role === 'manager_bzv_pool';
    const scopeZone = canAllZones ? null : userZone(data);

    let created = 0;
    let updated = 0;
    let sent = 0;

    const notifiedTechIds = new Set();
    let derivedMonth = '';

    for (const it of interventions) {
      const siteId = String(it?.siteId || '');
      const plannedDate = String(it?.plannedDate || '');
      const epvType = String(it?.epvType || '');
      let technicianUserId = it?.technicianUserId != null ? String(it.technicianUserId) : null;
      const technicianName = String(it?.technicianName || '').trim();

      if (!siteId || !plannedDate || !epvType || !technicianName) {
        continue;
      }

      if (!derivedMonth && /^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
        derivedMonth = String(plannedDate).slice(0, 7);
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

      // technicianUserId absent → résolution par nom (zone du site puis global),
      // comme POST /api/interventions — sinon la ligne serait silencieusement perdue.
      if (!technicianUserId) {
        try {
          const norm = (v) =>
            String(v || '')
              .normalize('NFD')
              .replace(/\p{M}/gu, '')
              .trim()
              .toLowerCase()
              .replace(/\s+/g, ' ');
          const key = norm(technicianName);
          if (key) {
            const res = await env.DB.prepare(
              "SELECT id, technician_name, zone FROM users WHERE role = 'technician' AND (disabled_at IS NULL OR disabled_at = '')"
            ).all();
            const rows = Array.isArray(res?.results) ? res.results : [];
            const inZone = rows.filter((r) => String(r?.zone || '') === zone);
            const pickFrom = (list) => {
              const exact = list.find((r) => norm(r?.technician_name) === key) || null;
              if (exact?.id) return exact;
              const partial = list.filter((r) => {
                const a = norm(r?.technician_name);
                return a && (a.includes(key) || key.includes(a));
              });
              return partial.length === 1 ? partial[0] : null;
            };
            const match = pickFrom(inZone) || pickFrom(rows);
            if (match?.id) technicianUserId = String(match.id);
          }
        } catch {
          // ignore : la ligne partira avec technician_user_id NULL (visibilité par nom)
        }
      }

      // Ré-ancrage : si une intervention encore ouverte existe pour ce site+type
      // à une AUTRE date (EPV recalculée après nouvelle saisie NH), on la déplace
      // sur la nouvelle date au lieu de créer un doublon de campagne.
      try {
        const re = await env.DB.prepare(
          `UPDATE interventions
           SET planned_date = ?, technician_user_id = ?, technician_name = ?,
               status = CASE WHEN status = 'planned' THEN 'sent' ELSE status END,
               sent_at = COALESCE(sent_at, ?), updated_at = ?
           WHERE id = (
             SELECT id FROM interventions
             WHERE site_id = ? AND epv_type = ? AND planned_date != ?
               AND status IN ('planned', 'sent')
             ORDER BY planned_date DESC LIMIT 1
           )`
        )
          .bind(plannedDate, technicianUserId, technicianName, now, now, siteId, epvType, plannedDate)
          .run();
        if ((re?.meta?.changes || 0) > 0) updated += 1;
      } catch {
        // collision unique : une ligne existe déjà à la date cible — le flux nominal reprend.
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
        "UPDATE interventions SET technician_user_id = ?, technician_name = ?, status = CASE WHEN status = 'planned' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE site_id = ? AND planned_date = ? AND epv_type = ? AND status IN ('planned', 'sent')"
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
        notifiedTechIds.add(String(technicianUserId));
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
