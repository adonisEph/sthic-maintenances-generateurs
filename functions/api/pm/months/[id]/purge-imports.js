import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, requireAdmin, isSuperAdmin, readJson, userZone, isoNow } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

function uniq(arr) {
  return Array.from(new Set((Array.isArray(arr) ? arr : []).map((v) => String(v || '').trim()).filter(Boolean)));
}

function chunkArray(arr, size) {
  const out = [];
  const src = Array.isArray(arr) ? arr : [];
  for (let i = 0; i < src.length; i += size) out.push(src.slice(i, i + size));
  return out;
}

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const monthRow = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(monthId).first();
    if (!monthRow) return json({ error: 'Mois introuvable.' }, { status: 404 });

    const body = await readJson(request);
    const purgeGlobal = Boolean(body?.purgeGlobal);
    const purgeClient = Boolean(body?.purgeClient);
    const dryRun = Boolean(body?.dryRun);

    if (!purgeGlobal && !purgeClient) {
      return json({ error: 'Aucune option de purge sélectionnée.' }, { status: 400 });
    }

    const requestedZones = uniq(body?.zones);
    const fallbackZone = String(userZone(data) || 'BZV/POOL');

    const zones = (() => {
      if (isSuperAdmin(data)) {
        return requestedZones.length > 0 ? requestedZones : ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
      }
      return [fallbackZone];
    })();

    const zoneList = uniq(zones);
    if (zoneList.length === 0) return json({ error: 'Zone requise.' }, { status: 400 });

    const placeholders = zoneList.map(() => '?').join(',');
    const monthLabel = String(monthRow?.month || '').trim();

    const preview = {
      pmGlobalPlans: 0,
      pmGlobalPlanItems: 0,
      pmClientItems: 0,
      pmClientNocRows: 0,
      pmClientAssignments: 0
    };

    if (purgeGlobal) {
      const plansRow = await env.DB.prepare(
        `SELECT COUNT(1) as c FROM pm_global_plans WHERE month_id = ? AND zone IN (${placeholders})`
      )
        .bind(monthId, ...zoneList)
        .first();
      preview.pmGlobalPlans = Number(plansRow?.c || 0);

      const itemsRow = await env.DB.prepare(
        `SELECT COUNT(1) as c FROM pm_global_plan_items WHERE month_id = ? AND zone IN (${placeholders})`
      )
        .bind(monthId, ...zoneList)
        .first();
      preview.pmGlobalPlanItems = Number(itemsRow?.c || 0);
    }

    if (purgeClient) {
      const itemsRow = await env.DB.prepare(
        `SELECT COUNT(1) as c FROM pm_items WHERE month_id = ? AND COALESCE(region, zone, '') IN (${placeholders})`
      )
        .bind(monthId, ...zoneList)
        .first();
      preview.pmClientItems = Number(itemsRow?.c || 0);

      const nocRow = await env.DB.prepare(
        `SELECT COUNT(1) as c
         FROM pm_noc_rows r
         WHERE r.month_id = ?
           AND EXISTS (
             SELECT 1
             FROM pm_items i
             WHERE i.month_id = r.month_id
               AND i.number = r.number
               AND COALESCE(i.region, i.zone, '') IN (${placeholders})
           )`
      )
        .bind(monthId, ...zoneList)
        .first();
      preview.pmClientNocRows = Number(nocRow?.c || 0);

      const assignRow = await env.DB.prepare(
        `SELECT COUNT(1) as c
         FROM pm_assignments a
         WHERE a.month = ?
           AND EXISTS (
             SELECT 1
             FROM pm_items i
             WHERE i.month_id = ?
               AND i.number = a.pm_number
               AND COALESCE(i.region, i.zone, '') IN (${placeholders})
           )`
      )
        .bind(monthLabel, monthId, ...zoneList)
        .first();
      preview.pmClientAssignments = Number(assignRow?.c || 0);
    }

    if (dryRun) {
      return json(
        {
          ok: true,
          dryRun: true,
          monthId,
          month: monthLabel,
          zones: zoneList,
          preview
        },
        { status: 200 }
      );
    }

    const deleted = {
      pmGlobalPlans: 0,
      pmGlobalPlanItems: 0,
      pmClientItems: 0,
      pmClientNocRows: 0,
      pmClientAssignments: 0
    };

    if (purgeClient) {
      const targetRowsRes = await env.DB.prepare(
        `SELECT number FROM pm_items WHERE month_id = ? AND COALESCE(region, zone, '') IN (${placeholders})`
      )
        .bind(monthId, ...zoneList)
        .all();

      const numbers = uniq((targetRowsRes?.results || []).map((r) => String(r?.number || '').trim()).filter(Boolean));

      for (const chunk of chunkArray(numbers, 40)) {
        const inPh = chunk.map(() => '?').join(',');

        const nocRes = await env.DB.prepare(
          `DELETE FROM pm_noc_rows WHERE month_id = ? AND number IN (${inPh})`
        )
          .bind(monthId, ...chunk)
          .run();
        deleted.pmClientNocRows += Number(nocRes?.meta?.changes || 0);

        if (monthLabel) {
          const assignRes = await env.DB.prepare(
            `DELETE FROM pm_assignments WHERE month = ? AND pm_number IN (${inPh})`
          )
            .bind(monthLabel, ...chunk)
            .run();
          deleted.pmClientAssignments += Number(assignRes?.meta?.changes || 0);
        }
      }

      const itemsRes = await env.DB.prepare(
        `DELETE FROM pm_items WHERE month_id = ? AND COALESCE(region, zone, '') IN (${placeholders})`
      )
        .bind(monthId, ...zoneList)
        .run();
      deleted.pmClientItems = Number(itemsRes?.meta?.changes || 0);
    }

    if (purgeGlobal) {
      const itemsRes = await env.DB.prepare(
        `DELETE FROM pm_global_plan_items WHERE month_id = ? AND zone IN (${placeholders})`
      )
        .bind(monthId, ...zoneList)
        .run();
      deleted.pmGlobalPlanItems = Number(itemsRes?.meta?.changes || 0);

      const plansRes = await env.DB.prepare(
        `DELETE FROM pm_global_plans WHERE month_id = ? AND zone IN (${placeholders})`
      )
        .bind(monthId, ...zoneList)
        .run();
      deleted.pmGlobalPlans = Number(plansRes?.meta?.changes || 0);
    }

    const now = isoNow();
    await env.DB.prepare('UPDATE pm_months SET updated_at = ? WHERE id = ?').bind(now, monthId).run();
    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        dryRun: false,
        monthId,
        month: monthLabel,
        zones: zoneList,
        preview,
        deleted
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
