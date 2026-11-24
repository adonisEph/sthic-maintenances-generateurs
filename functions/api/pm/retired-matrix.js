import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '').trim();
  return role === 'admin' || role === 'viewer' || role === 'manager' || role === 'manager_bzv_pool' || role === 'technician';
}

function normalizeZone(z) {
  return String(z || '')
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

function normalizeSiteCode(v) {
  return String(v || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizeType(t) {
  return String(t || '').trim().toLowerCase().replace(/\s+/g, '');
}

function isFullPmwo(maintenanceType, shortDescription) {
  const v1 = normalizeType(maintenanceType);
  const v2 = normalizeType(shortDescription);
  const isFull = (v) => v === 'fullpmwo' || v.includes('fullpmwo') || v === 'epv1' || v.includes('epv1');
  return isFull(v1) || isFull(v2);
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const role = String(data?.user?.role || '').trim();
    const url = new URL(request.url);

    const campaignParam = String(url.searchParams.get('campaign') || '').trim();
    const windowN = Math.min(6, Math.max(3, Math.floor(Number(url.searchParams.get('window') || 3)) || 3));

    const scopeZones = (() => {
      if (isSuperAdmin(data) || role === 'viewer' || role === 'manager_bzv_pool') return null;
      const z = String(userZone(data) || 'BZV/POOL');
      return [normalizeZone(z)];
    })();

    let campaign = /^\d{4}-\d{2}$/.test(campaignParam) ? campaignParam : '';
    if (!campaign) {
      const r = await env.DB.prepare('SELECT month FROM pm_months ORDER BY month DESC LIMIT 1').all();
      campaign = String(r?.results?.[0]?.month || '');
    }
    if (!/^\d{4}-\d{2}$/.test(campaign)) return json({ error: 'Campagne invalide.' }, { status: 400 });

    const windowMonths = [];
    {
      let y = Number(campaign.slice(0, 4));
      let mo = Number(campaign.slice(5, 7));
      for (let i = 0; i < windowN; i++) {
        windowMonths.unshift(`${y}-${String(mo).padStart(2, '0')}`);
        mo -= 1;
        if (mo < 1) { mo = 12; y -= 1; }
      }
    }

    const mRes = await env.DB.prepare(
      `SELECT id, month FROM pm_months WHERE month IN (${windowMonths.map(() => '?').join(',')})`
    ).bind(...windowMonths).all();
    const monthIdByMonth = new Map();
    const monthById = new Map();
    for (const r of mRes?.results || []) {
      const month = String(r.month || '');
      const id = String(r.id || '');
      if (!month || !id) continue;
      monthIdByMonth.set(month, id);
      monthById.set(id, month);
    }
    const monthsExisting = windowMonths.filter((m) => monthIdByMonth.has(m));
    const monthsMissing = windowMonths.filter((m) => !monthIdByMonth.has(m));

    const roster = new Map();
    const upsertRoster = (zone, code, name, tech, siteRetired, nh) => {
      const z = normalizeZone(zone);
      const c = normalizeSiteCode(code);
      if (!z || !c) return null;
      const key = `${z}|${c}`;
      if (!roster.has(key)) {
        roster.set(key, {
          zone: z,
          siteCode: c,
          siteName: String(name || '').trim(),
          technician: String(tech || '').trim(),
          siteRetired: Number(siteRetired || 0) === 1,
          // Compteurs NH — état courant du site dans `sites` (vidange + relevé).
          nh1Dv: nh ? (nh.nh1Dv ?? null) : null,
          dateDv: nh ? String(nh.dateDv || '') : '',
          nh2A: nh ? (nh.nh2A ?? null) : null,
          dateA: nh ? String(nh.dateA || '') : '',
          seuil: nh ? (nh.seuil ?? null) : null
        });
      }
      return key;
    };

    const sitesWhere = [];
    const sitesBind = [];
    if (Array.isArray(scopeZones) && scopeZones.length > 0) {
      sitesWhere.push(`zone IN (${scopeZones.map(() => '?').join(', ')})`);
      sitesBind.push(...scopeZones);
    }
    const sitesRes = await env.DB.prepare(
      `SELECT id_site, name_site, technician, zone, retired, nh1_dv, date_dv, nh2_a, date_a, seuil FROM sites${sitesWhere.length ? ' WHERE ' + sitesWhere.join(' AND ') : ''}`
    ).bind(...sitesBind).all();
    for (const s of sitesRes?.results || []) {
      upsertRoster(s?.zone, s?.id_site, s?.name_site, s?.technician, s?.retired, {
        nh1Dv: s?.nh1_dv, dateDv: s?.date_dv, nh2A: s?.nh2_a, dateA: s?.date_a, seuil: s?.seuil
      });
    }

    const monthIds = [...monthIdByMonth.values()];
    const activeBy = new Map();
    const plannedBy = new Map();

    if (monthIds.length > 0) {
      const inClause = monthIds.map(() => '?').join(',');

      const gWhere = [`month_id IN (${inClause})`];
      const gBind = [...monthIds];
      if (Array.isArray(scopeZones) && scopeZones.length > 0) {
        gWhere.push(`zone IN (${scopeZones.map(() => '?').join(', ')})`);
        gBind.push(...scopeZones);
      }
      const gRes = await env.DB.prepare(
        `SELECT month_id, zone, site_code, site_name, assigned_to FROM pm_global_plan_items WHERE ${gWhere.join(' AND ')}`
      ).bind(...gBind).all();

      const cWhere = [`month_id IN (${inClause})`];
      const cBind = [...monthIds];
      if (Array.isArray(scopeZones) && scopeZones.length > 0) {
        cWhere.push(`TRIM(COALESCE(region, zone, '')) IN (${scopeZones.map(() => '?').join(', ')})`);
        cBind.push(...scopeZones);
      }
      const cRes = await env.DB.prepare(
        `SELECT month_id, TRIM(COALESCE(region, zone, '')) AS zone, site_code, site_name, number, assigned_to, maintenance_type, short_description FROM pm_items WHERE ${cWhere.join(' AND ')}`
      ).bind(...cBind).all();

      for (const r of cRes?.results || []) {
        if (!isFullPmwo(r?.maintenance_type, r?.short_description)) continue;
        const month = monthById.get(String(r?.month_id || ''));
        const key = upsertRoster(r?.zone, r?.site_code, r?.site_name, r?.assigned_to);
        if (!month || !key) continue;
        if (!activeBy.has(key)) activeBy.set(key, new Map());
        const mm = activeBy.get(key);
        if (!mm.has(month)) mm.set(month, { ticket: String(r?.number || '').trim() });
      }

      for (const g of gRes?.results || []) {
        const month = monthById.get(String(g?.month_id || ''));
        const key = upsertRoster(g?.zone, g?.site_code, g?.site_name, g?.assigned_to);
        if (!month || !key) continue;
        if (!plannedBy.has(key)) plannedBy.set(key, new Set());
        plannedBy.get(key).add(month);
      }
    }

    // Sites absents de `sites` (ex. zone UPCN/Nord) : le technicien ne peut venir
    // que de pm_items.assigned_to — on complète avec le dernier connu, toute
    // campagne confondue (le plan global n'a jamais assigned_to rempli).
    const noTechCodes = [...new Set(
      [...roster.values()].filter((it) => !it.technician || !it.siteName).map((it) => it.siteCode)
    )];
    if (noTechCodes.length > 0) {
      const techRes = await env.DB.prepare(
        `SELECT site_code, site_name, assigned_to FROM pm_items WHERE site_code IN (${noTechCodes.map(() => '?').join(', ')}) AND (TRIM(COALESCE(assigned_to, '')) != '' OR TRIM(COALESCE(site_name, '')) != '')`
      ).bind(...noTechCodes).all();
      const techByCode = new Map();
      for (const r of techRes?.results || []) {
        const c = normalizeSiteCode(r?.site_code);
        if (!c || techByCode.has(c)) continue;
        techByCode.set(c, {
          technician: String(r?.assigned_to || '').trim(),
          siteName: String(r?.site_name || '').trim()
        });
      }
      for (const it of roster.values()) {
        const t = techByCode.get(it.siteCode);
        if (!t) continue;
        if (!it.technician && t.technician) it.technician = t.technician;
        if (!it.siteName && t.siteName) it.siteName = t.siteName;
      }
    }

    const items = [...roster.entries()].map(([key, it]) => {
      const cells = {};
      for (const mo of monthsExisting) {
        if (activeBy.get(key)?.has(mo)) cells[mo] = { s: 'active', ticket: activeBy.get(key).get(mo).ticket };
        else if (plannedBy.get(key)?.has(mo)) cells[mo] = { s: 'retired' };
        else cells[mo] = { s: 'absent' };
      }
      const retiredCount = monthsExisting.filter((mo) => cells[mo]?.s === 'retired').length;
      const nh1 = Number(it.nh1Dv);
      const nh2 = Number(it.nh2A);
      const diffNhs = (Number.isFinite(nh1) && Number.isFinite(nh2)) ? nh2 - nh1 : null;
      return { ...it, cells, retiredCount, diffNhs };
    });
    items.sort((a, b) => {
      const z = String(a.zone).localeCompare(String(b.zone));
      return z !== 0 ? z : String(a.siteCode).localeCompare(String(b.siteCode));
    });

    return json(
      { campaign, window: windowN, months: windowMonths, monthsExisting, monthsMissing, items },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
