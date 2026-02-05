import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, requireAdmin, isSuperAdmin, readJson, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function uniq(arr) {
  return Array.from(new Set((Array.isArray(arr) ? arr : []).map((v) => String(v || '').trim()).filter(Boolean)));
}

function chunkArray(arr, size) {
  const out = [];
  const src = Array.isArray(arr) ? arr : [];
  for (let i = 0; i < src.length; i += size) out.push(src.slice(i, i + size));
  return out;
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    if (!env.DB) {
      return json({ error: 'Binding D1 manquant: DB' }, { status: 500 });
    }

    const body = await readJson(request);
    const purgeBasePlans = Boolean(body?.purgeBasePlans);
    const purgeIntelligent = Boolean(body?.purgeIntelligent);
    const dryRun = Boolean(body?.dryRun);

    if (!purgeBasePlans && !purgeIntelligent) {
      return json({ error: 'Aucune option de purge sélectionnée.' }, { status: 400 });
    }

    const requestedZones = uniq(body?.zones);
    const fallbackZone = userZone(data);

    const allowedZones = (() => {
      if (isSuperAdmin(data)) {
        return requestedZones.length > 0 ? requestedZones : ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
      }
      return [fallbackZone];
    })();

    const zones = uniq(allowedZones);
    if (zones.length === 0) return json({ error: 'Zone requise.' }, { status: 400 });

    const deleted = {
      pmBasePlanItems: 0,
      pmBasePlans: 0,
      pmItems: 0,
      pmImports: 0,
      pmNocRows: 0,
      pmMonths: 0,
      pmAssignments: 0
    };

    const zoneDeleted = {};
    zones.forEach((z) => {
      zoneDeleted[z] = {
        pmBasePlanItems: 0,
        pmItems: 0,
        pmNocRows: 0,
        pmAssignments: 0,
        pmMonths: 0
      };
    });

    const placeholders = zones.map(() => '?').join(',');

    const preview = {
      pmBasePlanItems: 0,
      pmBasePlansToDelete: 0,
      pmItems: 0,
      pmNocRows: 0,
      pmAssignments: 0,
      pmMonthsToDelete: 0,
      pmImportsToDelete: 0
    };

    if (purgeBasePlans) {
      const baseItemsRow = await env.DB.prepare(
        `SELECT COUNT(1) as c FROM pm_base_plan_items WHERE COALESCE(region, zone, '') IN (${placeholders})`
      )
        .bind(...zones)
        .first();
      preview.pmBasePlanItems = Number(baseItemsRow?.c || 0);

      const basePlansRow = await env.DB.prepare(
        `SELECT COUNT(1) as c
         FROM pm_base_plans p
         LEFT JOIN pm_base_plan_items i
           ON i.plan_id = p.id
          AND COALESCE(i.region, i.zone, '') NOT IN (${placeholders})
         WHERE i.id IS NULL`
      )
        .bind(...zones)
        .first();
      preview.pmBasePlansToDelete = Number(basePlansRow?.c || 0);
    }

    if (purgeIntelligent) {
      const itemsRow = await env.DB.prepare(
        `SELECT COUNT(1) as c FROM pm_items WHERE COALESCE(region, zone, '') IN (${placeholders})`
      )
        .bind(...zones)
        .first();
      preview.pmItems = Number(itemsRow?.c || 0);

      const nocRow = await env.DB.prepare(
        `SELECT COUNT(1) as c
         FROM pm_noc_rows r
         WHERE EXISTS (
           SELECT 1
           FROM pm_items i
           WHERE i.month_id = r.month_id
             AND i.number = r.number
             AND COALESCE(i.region, i.zone, '') IN (${placeholders})
         )`
      )
        .bind(...zones)
        .first();
      preview.pmNocRows = Number(nocRow?.c || 0);

      const assignRow = await env.DB.prepare(
        `SELECT COUNT(1) as c
         FROM pm_assignments a
         WHERE EXISTS (
           SELECT 1
           FROM pm_items i
           WHERE i.number = a.pm_number
             AND COALESCE(i.region, i.zone, '') IN (${placeholders})
         )`
      )
        .bind(...zones)
        .first();
      preview.pmAssignments = Number(assignRow?.c || 0);

      const monthsRow = await env.DB.prepare(
        `SELECT COUNT(1) as c
         FROM pm_months m
         LEFT JOIN pm_items i
           ON i.month_id = m.id
          AND COALESCE(i.region, i.zone, '') NOT IN (${placeholders})
         WHERE i.id IS NULL`
      )
        .bind(...zones)
        .first();
      preview.pmMonthsToDelete = Number(monthsRow?.c || 0);

      const importsRow = await env.DB.prepare(
        `SELECT COUNT(1) as c
         FROM pm_imports imp
         WHERE imp.month_id IN (
           SELECT m.id
           FROM pm_months m
           LEFT JOIN pm_items i
             ON i.month_id = m.id
            AND COALESCE(i.region, i.zone, '') NOT IN (${placeholders})
           WHERE i.id IS NULL
         )`
      )
        .bind(...zones)
        .first();
      preview.pmImportsToDelete = Number(importsRow?.c || 0);
    }

    if (dryRun) {
      return json(
        {
          ok: true,
          dryRun: true,
          zones,
          preview
        },
        { status: 200 }
      );
    }

    if (purgeBasePlans) {
      const resItems = await env.DB.prepare(
        `DELETE FROM pm_base_plan_items WHERE COALESCE(region, zone, '') IN (${placeholders})`
      )
        .bind(...zones)
        .run();
      deleted.pmBasePlanItems = Number(resItems?.meta?.changes || 0);

      zones.forEach((z) => {
        // Best-effort per-zone counts are not available from D1 without an extra query; keep 0 or compute below if needed.
        zoneDeleted[z].pmBasePlanItems = 0;
      });

      const resPlans = await env.DB.prepare(
        'DELETE FROM pm_base_plans WHERE id NOT IN (SELECT DISTINCT plan_id FROM pm_base_plan_items)'
      ).run();
      deleted.pmBasePlans = Number(resPlans?.meta?.changes || 0);
    }

    if (purgeIntelligent) {
      const targetRowsRes = await env.DB.prepare(
        `SELECT month_id, number FROM pm_items WHERE COALESCE(region, zone, '') IN (${placeholders})`
      )
        .bind(...zones)
        .all();

      const targetRows = Array.isArray(targetRowsRes?.results) ? targetRowsRes.results : [];

      const byMonth = new Map();
      for (const r of targetRows) {
        const monthId = String(r?.month_id || '').trim();
        const num = String(r?.number || '').trim();
        if (!monthId || !num) continue;
        if (!byMonth.has(monthId)) byMonth.set(monthId, new Set());
        byMonth.get(monthId).add(num);
      }

      for (const [monthId, numberSet] of byMonth.entries()) {
        const numbers = Array.from(numberSet);
        const monthRow = await env.DB.prepare('SELECT month FROM pm_months WHERE id = ?').bind(monthId).first();
        const monthLabel = String(monthRow?.month || '').trim();

        for (const chunk of chunkArray(numbers, 40)) {
          const inPh = chunk.map(() => '?').join(',');

          const nocRes = await env.DB.prepare(
            `DELETE FROM pm_noc_rows WHERE month_id = ? AND number IN (${inPh})`
          )
            .bind(monthId, ...chunk)
            .run();
          deleted.pmNocRows += Number(nocRes?.meta?.changes || 0);

          const itemsRes = await env.DB.prepare(
            `DELETE FROM pm_items WHERE month_id = ? AND number IN (${inPh})`
          )
            .bind(monthId, ...chunk)
            .run();
          deleted.pmItems += Number(itemsRes?.meta?.changes || 0);

          if (monthLabel) {
            const assignRes = await env.DB.prepare(
              `DELETE FROM pm_assignments WHERE month = ? AND pm_number IN (${inPh})`
            )
              .bind(monthLabel, ...chunk)
              .run();
            deleted.pmAssignments += Number(assignRes?.meta?.changes || 0);
          }
        }

        const remainingRow = await env.DB.prepare('SELECT COUNT(1) as c FROM pm_items WHERE month_id = ?').bind(monthId).first();
        const remaining = Number(remainingRow?.c || 0);

        if (remaining === 0) {
          const rmNoc = await env.DB.prepare('DELETE FROM pm_noc_rows WHERE month_id = ?').bind(monthId).run();
          deleted.pmNocRows += Number(rmNoc?.meta?.changes || 0);

          const rmImports = await env.DB.prepare('DELETE FROM pm_imports WHERE month_id = ?').bind(monthId).run();
          deleted.pmImports += Number(rmImports?.meta?.changes || 0);

          const rmMonth = await env.DB.prepare('DELETE FROM pm_months WHERE id = ?').bind(monthId).run();
          deleted.pmMonths += Number(rmMonth?.meta?.changes || 0);

          if (monthLabel) {
            const rmAssign = await env.DB.prepare('DELETE FROM pm_assignments WHERE month = ?').bind(monthLabel).run();
            deleted.pmAssignments += Number(rmAssign?.meta?.changes || 0);
          }
        }
      }
    }

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        zones,
        preview,
        deleted,
        deletedByZone: zoneDeleted
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
