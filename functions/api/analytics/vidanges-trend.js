import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

const VALID_ZONES = ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
const YM = /^\d{4}-\d{2}$/;

/**
 * GET /api/analytics/vidanges-trend?months=12&zone=BZV/POOL
 *
 * Tendance des vidanges / campagnes — croisement PM × Vidanges.
 * Par mois de campagne :
 *  - planned : items pm_items maintenance_type='FullPMWO' AVEC numéro de ticket
 *    (pm_months.month = campagne)
 *  - done : fiches fiche_history status='Effectuée' dont la planned_date tombe
 *    dans le mois (clé de campagne choisie métier)
 *  - delta = done - planned ; depassement = done > planned
 *
 * Zone : SuperAdmin → ?zone=ALL|<zone> ; managers → zone forcée (userZone).
 * Comptage volume (fiches/items), doublons site exposés en xxxSites.
 */
export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const superAdmin = isSuperAdmin(data);
    let zone = '';
    if (superAdmin) {
      const q = String(url.searchParams.get('zone') || 'ALL').trim().toUpperCase();
      zone = VALID_ZONES.includes(q) ? q : '';
    } else {
      zone = String(userZone(data) || '').trim().toUpperCase();
    }

    const monthsLimit = Math.max(1, Math.min(24, Number(url.searchParams.get('months')) || 6));

    const plannedSql = `
      SELECT m.month AS month, COUNT(*) AS planned, COUNT(DISTINCT i.site_code) AS plannedSites
      FROM pm_items i JOIN pm_months m ON m.id = i.month_id
      WHERE i.maintenance_type = 'FullPMWO'
        AND i.number IS NOT NULL AND TRIM(i.number) <> ''
        ${zone ? 'AND UPPER(TRIM(i.zone)) = ?' : ''}
      GROUP BY m.month`;
    const plannedRes = zone
      ? await env.DB.prepare(plannedSql).bind(zone).all()
      : await env.DB.prepare(plannedSql).all();

    const doneSql = `
      SELECT substr(f.planned_date, 1, 7) AS month,
             COUNT(*) AS done,
             COUNT(DISTINCT f.site_id) AS doneSites
      FROM fiche_history f
      JOIN sites s ON s.id = f.site_id
      WHERE f.status = 'Effectuée'
        AND f.planned_date IS NOT NULL AND f.planned_date <> ''
        ${zone ? 'AND UPPER(TRIM(s.zone)) = ?' : ''}
      GROUP BY substr(f.planned_date, 1, 7)`;
    const doneRes = zone
      ? await env.DB.prepare(doneSql).bind(zone).all()
      : await env.DB.prepare(doneSql).all();

    const byMonth = new Map();
    const row = (m) => byMonth.get(m) || { month: m, planned: 0, plannedSites: 0, done: 0, doneSites: 0 };

    for (const r of plannedRes?.results || []) {
      const m = String(r?.month || '').slice(0, 7);
      if (!YM.test(m)) continue;
      const cur = row(m);
      cur.planned = Number(r.planned) || 0;
      cur.plannedSites = Number(r.plannedSites) || 0;
      byMonth.set(m, cur);
    }
    for (const r of doneRes?.results || []) {
      const m = String(r?.month || '').slice(0, 7);
      if (!YM.test(m)) continue;
      const cur = row(m);
      cur.done = Number(r.done) || 0;
      cur.doneSites = Number(r.doneSites) || 0;
      byMonth.set(m, cur);
    }

    const months = Array.from(byMonth.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, monthsLimit)
      .map((r) => ({
        ...r,
        delta: r.done - r.planned,
        coverage: r.planned > 0 ? Math.round((r.done / r.planned) * 1000) / 10 : null,
        depassement: r.planned > 0 ? r.done > r.planned : r.done > 0
      }));

    const totals = months.reduce(
      (acc, r) => ({
        planned: acc.planned + r.planned,
        plannedSites: acc.plannedSites + r.plannedSites,
        done: acc.done + r.done,
        doneSites: acc.doneSites + r.doneSites,
        depassementMonths: acc.depassementMonths + (r.depassement ? 1 : 0)
      }),
      { planned: 0, plannedSites: 0, done: 0, doneSites: 0, depassementMonths: 0 }
    );
    totals.delta = totals.done - totals.planned;
    totals.coverage = totals.planned > 0 ? Math.round((totals.done / totals.planned) * 1000) / 10 : null;

    return json({ ok: true, zone: zone || 'ALL', months, totals });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
