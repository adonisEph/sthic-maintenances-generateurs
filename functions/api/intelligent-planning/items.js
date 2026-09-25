import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    planId: r.plan_id,
    month: r.month,
    zone: r.zone,
    siteId: r.site_id,
    siteCode: r.site_code,
    siteName: r.site_name,
    region: r.region,
    shortDescription: r.short_description,
    number: r.number,
    assignedTo: r.assigned_to,
    technicianUserId: r.technician_user_id,
    scheduledWoDate: r.scheduled_wo_date,
    dateOfClosing: r.date_of_closing,
    state: r.state,
    epv2: r.epv2,
    epv3: r.epv3,
    pairSiteCode: r.pair_site_code,
    pairSiteId: r.pair_site_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool' && role !== 'viewer') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const month = String(url.searchParams.get('month') || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'month invalide (YYYY-MM).' }, { status: 400 });

    const requestedZone = String(url.searchParams.get('zone') || '').trim();
    const wantSummary = String(url.searchParams.get('summary') || '').trim() === '1';
    const scopeZone = (role === 'admin' || role === 'manager') && !isSuperAdmin(data) ? userZone(data) : null;

    const reqUp = requestedZone.toUpperCase();
    const allZones = !scopeZone && (reqUp === 'ALL' || reqUp === '');
    const zone = scopeZone ? String(scopeZone) : requestedZone;

    if (scopeZone && requestedZone && reqUp !== 'ALL' && requestedZone !== String(scopeZone)) {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }
    if (!zone && !allZones) return json({ error: 'zone requise.' }, { status: 400 });

    const plansRes = allZones
      ? await env.DB.prepare('SELECT * FROM intelligent_plans WHERE month = ? ORDER BY zone ASC').bind(month).all()
      : await env.DB.prepare('SELECT * FROM intelligent_plans WHERE month = ? AND zone = ?').bind(month, zone).all();
    const plans = Array.isArray(plansRes?.results) ? plansRes.results : [];

    // Mode résumé : progression lue depuis la DB (survit aux rechargements) —
    // pour chaque plan : techniciens déjà générés + nb d'items + date de génération.
    if (wantSummary) {
      const planIds = plans.map((p) => String(p.id)).filter(Boolean);
      const grouped = new Map();
      if (planIds.length > 0) {
        const ph = planIds.map(() => '?').join(',');
        const agg = await env.DB.prepare(
          `SELECT plan_id, technician_user_id AS tid, COUNT(*) AS n
           FROM intelligent_plan_items WHERE plan_id IN (${ph}) GROUP BY plan_id, technician_user_id`
        )
          .bind(...planIds)
          .all();
        for (const r of agg?.results || []) {
          const pid = String(r?.plan_id || '');
          const cur = grouped.get(pid) || { tids: new Set(), itemCount: 0 };
          if (r?.tid) cur.tids.add(String(r.tid));
          cur.itemCount += Number(r?.n || 0);
          grouped.set(pid, cur);
        }
      }
      return json(
        {
          month,
          zone: allZones ? 'all' : zone,
          plans: plans.map((p) => {
            const g = grouped.get(String(p.id)) || { tids: new Set(), itemCount: 0 };
            return {
              zone: String(p.zone || ''),
              planId: String(p.id),
              generatedAt: p.generated_at || null,
              itemCount: g.itemCount,
              doneTechnicianIds: Array.from(g.tids)
            };
          })
        },
        { status: 200 }
      );
    }

    if (!allZones && plans.length === 0) {
      return json({ month, zone, items: [] }, { status: 200 });
    }

    let rows;
    if (allZones) {
      if (plans.length === 0) rows = [];
      else {
        const ph = plans.map(() => '?').join(',');
        const res = await env.DB.prepare(
          `SELECT i.*, p.zone AS p_zone FROM intelligent_plan_items i
           JOIN intelligent_plans p ON p.id = i.plan_id
           WHERE i.plan_id IN (${ph})
           ORDER BY p.zone ASC, i.scheduled_wo_date ASC, COALESCE(i.site_code, '') ASC`
        )
          .bind(...plans.map((p) => String(p.id)))
          .all();
        rows = Array.isArray(res?.results) ? res.results : [];
      }
    } else {
      const res = await env.DB.prepare(
        'SELECT * FROM intelligent_plan_items WHERE plan_id = ? ORDER BY scheduled_wo_date ASC, COALESCE(site_code, \'\') ASC'
      )
        .bind(String(plans[0].id))
        .all();
      rows = Array.isArray(res?.results) ? res.results : [];
    }

    return json(
      {
        month,
        zone: allZones ? 'all' : zone,
        planId: allZones ? null : String(plans[0].id),
        generatedAt: allZones ? null : plans[0].generated_at,
        items: rows.map(mapRow).filter(Boolean)
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
