import { ensureAdminUser } from '../../../../../_utils/db.js';
import { json, requireAuth, ymdToday } from '../../../../../_utils/http.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer' || role === 'manager';
}

function mapItemRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    monthId: r.month_id,
    number: r.number,
    siteCode: r.site_code,
    siteName: r.site_name,
    region: r.region,
    zone: r.zone,
    shortDescription: r.short_description,
    maintenanceType: r.maintenance_type,
    scheduledWoDate: r.scheduled_wo_date,
    assignedTo: r.assigned_to,
    state: r.state,
    closedAt: r.closed_at,
    reprogrammationDate: r.reprogrammation_date,
    reprogrammationReason: r.reprogrammation_reason,
    reprogrammationStatus: r.reprogrammation_status,
    lastNocImportAt: r.last_noc_import_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function normState(s) {
  return String(s || '').trim().toLowerCase();
}

function isDoneState(state) {
  const v = normState(state);
  return v === 'closed' || v === 'closed complete';
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

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const yyyymm = String(params?.yyyymm || '').trim();
    if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
      return json({ error: 'Mois invalide (YYYY-MM).' }, { status: 400 });
    }

    const today = ymdToday();

    const monthRow = await env.DB.prepare('SELECT * FROM pm_months WHERE month = ?').bind(yyyymm).first();
    if (!monthRow?.id) return json({ error: 'Mois introuvable.' }, { status: 404 });
    const monthId = String(monthRow.id);

    // 1) planned = tous les pm_items du mois
    const itemsRes = await env.DB.prepare('SELECT * FROM pm_items WHERE month_id = ? ORDER BY scheduled_wo_date ASC, number ASC')
      .bind(monthId)
      .all();
    const itemRows = Array.isArray(itemsRes?.results) ? itemsRes.results : [];
    const planned = itemRows.map(mapItemRow).filter(Boolean);

    const doneToDate = planned.filter((it) => {
      const sched = String(it?.scheduledWoDate || '').slice(0, 10);
      return isDoneState(it?.state) && sched && sched <= today;
    });

    const remainingToDate = planned.filter((it) => {
      const sched = String(it?.scheduledWoDate || '').slice(0, 10);
      return !isDoneState(it?.state) && sched && sched <= today;
    });

    const reprogRejected = planned.filter((it) => String(it?.reprogrammationStatus || '').trim() === 'REJECTED');

    // 2) retiredSitesCampaign = diff global vs client (FullPMWO)
    const globalRes = await env.DB.prepare(
      'SELECT site_code, site_name, zone, region, maintenance_type FROM pm_global_plan_items WHERE month_id = ?'
    )
      .bind(monthId)
      .all();
    const globalRows = Array.isArray(globalRes?.results) ? globalRes.results : [];

    const globalSites = new Map();
    for (const r of globalRows) {
      const siteCode = normalizeSiteCode(r?.site_code);
      const zone = normalizeZone(r?.zone || r?.region || '');
      if (!siteCode || !zone) continue;
      const key = `${zone}|${siteCode}`;
      if (!globalSites.has(key)) {
        globalSites.set(key, {
          siteCode,
          siteName: String(r?.site_name || '').trim(),
          zone,
          maintenanceType: r?.maintenance_type || ''
        });
      }
    }

    const clientSites = new Set();
    for (const it of planned) {
      const siteCode = normalizeSiteCode(it?.siteCode);
      const zone = normalizeZone(it?.zone || it?.region || '');
      if (!siteCode || !zone) continue;
      if (!isFullPmwo(it?.maintenanceType, it?.shortDescription)) continue;
      clientSites.add(`${zone}|${siteCode}`);
    }

    const retiredItems = [];
    for (const [key, g] of globalSites.entries()) {
      if (clientSites.has(key)) continue;
      retiredItems.push(g);
    }

    retiredItems.sort(
      (a, b) => String(a.zone || '').localeCompare(String(b.zone || '')) || String(a.siteCode || '').localeCompare(String(b.siteCode || ''))
    );

    const byZone = {};
    for (const it of retiredItems) {
      const z = normalizeZone(it?.zone || '');
      if (!z) continue;
      byZone[z] = Number(byZone[z] || 0) + 1;
    }

    return json(
      {
        month: yyyymm,
        monthId,
        today,
        planned,
        doneToDate,
        remainingToDate,
        reprogRejected,
        retiredSitesCampaign: {
          total: retiredItems.length,
          byZone,
          items: retiredItems
        }
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}