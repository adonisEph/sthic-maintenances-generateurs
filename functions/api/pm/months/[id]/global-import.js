import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, userZone, isSuperAdmin } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

function normStr(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const monthRow = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(monthId).first();
    if (!monthRow) return json({ error: 'Mois introuvable.' }, { status: 404 });

    const body = await readJson(request);
    const items = Array.isArray(body?.items) ? body.items : [];
    const filename = normStr(body?.filename);

    const requestZone = isSuperAdmin(data)
      ? normStr(body?.zone) || normStr(userZone(data)) || 'BZV/POOL'
      : String(userZone(data) || 'BZV/POOL');

    const month = String(monthRow?.month || '').trim();
    if (!month) return json({ error: 'Mois invalide.' }, { status: 400 });

    const now = isoNow();

    const zoneForItem = (it) => {
      const z = normStr(it?.zone) || normStr(it?.region) || null;
      return z || String(requestZone || 'BZV/POOL');
    };

    const itemsByZone = new Map();
    for (const it of items) {
      const z = String(zoneForItem(it) || '').trim();
      if (!z) continue;
      if (!isSuperAdmin(data) && z !== requestZone) continue;
      if (!itemsByZone.has(z)) itemsByZone.set(z, []);
      itemsByZone.get(z).push(it);
    }

    if (itemsByZone.size === 0) {
      return json({ error: 'Aucune ligne importable (zone/région manquante ou filtrée).' }, { status: 400 });
    }

    const imported = [];
    let totalInserted = 0;

    for (const [zone, zoneItems] of itemsByZone.entries()) {
      const existingPlan = await env.DB.prepare('SELECT * FROM pm_global_plans WHERE month_id = ? AND zone = ?')
        .bind(monthId, zone)
        .first();

      const planId = existingPlan?.id ? String(existingPlan.id) : newId();

      if (existingPlan?.id) {
        await env.DB.prepare(
          'UPDATE pm_global_plans SET imported_at = ?, filename = ?, row_count = ?, created_by_user_id = ?, created_by_email = ? WHERE id = ?'
        )
          .bind(
            now,
            filename,
            Number(zoneItems.length || 0),
            data?.user?.id ? String(data.user.id) : null,
            data?.user?.email ? String(data.user.email) : null,
            planId
          )
          .run();

        await env.DB.prepare('DELETE FROM pm_global_plan_items WHERE plan_id = ?').bind(planId).run();
      } else {
        await env.DB.prepare(
          'INSERT INTO pm_global_plans (id, month_id, month, zone, imported_at, filename, row_count, created_by_user_id, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
          .bind(
            planId,
            monthId,
            month,
            zone,
            now,
            filename,
            Number(zoneItems.length || 0),
            data?.user?.id ? String(data.user.id) : null,
            data?.user?.email ? String(data.user.email) : null
          )
          .run();
      }

      let inserted = 0;
      for (const it of zoneItems) {
        const id = newId();
        await env.DB.prepare(
          'INSERT INTO pm_global_plan_items (id, plan_id, month_id, month, number, site_code, site_name, region, zone, short_description, maintenance_type, scheduled_wo_date, assigned_to, state, epv2, epv3, pair_site_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
          .bind(
            id,
            planId,
            monthId,
            month,
            normStr(it?.number),
            normStr(it?.siteCode),
            normStr(it?.siteName),
            normStr(it?.region),
            normStr(zone),
            normStr(it?.shortDescription),
            normStr(it?.maintenanceType),
            normStr(it?.scheduledWoDate),
            normStr(it?.assignedTo),
            normStr(it?.state) || 'Planned',
            normStr(it?.epv2),
            normStr(it?.epv3),
            normStr(it?.pairSiteCode),
            now,
            now
          )
          .run();
        inserted += 1;
      }

      const importId = newId();
      await env.DB.prepare(
        'INSERT INTO pm_imports (id, month_id, kind, imported_at, filename, row_count, created_by_user_id, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          importId,
          monthId,
          'global',
          now,
          filename,
          inserted,
          data?.user?.id ? String(data.user.id) : null,
          data?.user?.email ? String(data.user.email) : null
        )
        .run();

      imported.push({ zone, planId, inserted });
      totalInserted += inserted;
    }

    await env.DB.prepare('UPDATE pm_months SET updated_at = ? WHERE id = ?').bind(now, monthId).run();
    await touchLastUpdatedAt(env);

    return json({ ok: true, imported, totalInserted }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
