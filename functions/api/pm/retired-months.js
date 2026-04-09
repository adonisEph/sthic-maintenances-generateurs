import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer' || role === 'manager';
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

    const role = String(data?.user?.role || '');
    const url = new URL(request.url);

    const siteCodesRaw = String(url.searchParams.get('siteCodes') || '').trim();
    const maxMonths = Math.min(36, Math.max(1, Number(url.searchParams.get('maxMonths') || 18)));

    const siteCodes = siteCodesRaw
      ? siteCodesRaw
          .split(',')
          .map((x) => normalizeSiteCode(x))
          .filter(Boolean)
      : [];

    if (siteCodes.length === 0) {
      return json({ items: [] }, { status: 200 });
    }

    const scopeZones = (() => {
      if (isSuperAdmin(data) || role === 'viewer') return null;
      const z = String(userZone(data) || 'BZV/POOL');
      return [normalizeZone(z)];
    })();

    const monthsRes = await env.DB.prepare('SELECT id, month FROM pm_months ORDER BY month DESC LIMIT ?')
      .bind(maxMonths)
      .all();
    const months = (Array.isArray(monthsRes?.results) ? monthsRes.results : [])
      .map((m) => ({ id: String(m.id), month: String(m.month || '') }))
      .filter((m) => /^\d{4}-\d{2}$/.test(m.month));

    const outMap = new Map();
    const pushMonth = (zone, siteCode, month) => {
      const z = normalizeZone(zone);
      const c = normalizeSiteCode(siteCode);
      if (!z || !c || !month) return;
      const key = `${z}|${c}`;
      const existing = outMap.get(key) || { zone: z, siteCode: c, retiredMonths: [] };
      if (!existing.retiredMonths.includes(month)) existing.retiredMonths.push(month);
      outMap.set(key, existing);
    };

    for (const m of months) {
      const monthId = m.id;
      const month = m.month;

      const globalWhere = ['month_id = ?'];
      const globalBind = [monthId];

      if (Array.isArray(scopeZones) && scopeZones.length > 0) {
        globalWhere.push(`zone IN (${scopeZones.map(() => '?').join(', ')})`);
        globalBind.push(...scopeZones);
      }

      globalWhere.push(`site_code IN (${siteCodes.map(() => '?').join(', ')})`);
      globalBind.push(...siteCodes);

      const globalSql = `SELECT zone, site_code FROM pm_global_plan_items WHERE ${globalWhere.join(' AND ')}`;
      const globalRes = await env.DB.prepare(globalSql).bind(...globalBind).all();
      const globalRows = Array.isArray(globalRes?.results) ? globalRes.results : [];

      if (globalRows.length === 0) continue;

      const clientWhere = ['month_id = ?'];
      const clientBind = [monthId];

      if (Array.isArray(scopeZones) && scopeZones.length > 0) {
        clientWhere.push(`TRIM(COALESCE(region, zone, '')) IN (${scopeZones.map(() => '?').join(', ')})`);
        clientBind.push(...scopeZones);
      }

      clientWhere.push(`site_code IN (${siteCodes.map(() => '?').join(', ')})`);
      clientBind.push(...siteCodes);

      const clientSql = `SELECT TRIM(COALESCE(region, zone, '')) AS zone, site_code, maintenance_type, short_description FROM pm_items WHERE ${clientWhere.join(' AND ')}`;
      const clientRes = await env.DB.prepare(clientSql).bind(...clientBind).all();
      const clientRows = Array.isArray(clientRes?.results) ? clientRes.results : [];

      const activeSet = new Set();
      for (const r of clientRows) {
        const z = normalizeZone(r?.zone || '');
        const c = normalizeSiteCode(r?.site_code || r?.siteCode || '');
        if (!z || !c) continue;
        if (!isFullPmwo(r?.maintenance_type, r?.short_description)) continue;
        activeSet.add(`${z}|${c}`);
      }

      for (const g of globalRows) {
        const z = normalizeZone(g?.zone || '');
        const c = normalizeSiteCode(g?.site_code || g?.siteCode || '');
        if (!z || !c) continue;
        const key = `${z}|${c}`;
        if (activeSet.has(key)) continue;
        pushMonth(z, c, month);
      }
    }

    return json(
      {
        items: Array.from(outMap.values()).map((it) => ({
          zone: it.zone,
          siteCode: it.siteCode,
          retiredMonths: it.retiredMonths.sort((a, b) => String(a).localeCompare(String(b)))
        }))
      },
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
