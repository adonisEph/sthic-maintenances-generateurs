import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, ymdToday, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import { calculateEstimatedNH, calculateEPVDates } from '../_utils/calc.js';

const SEUIL = 250;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function clampToMonthWorkday(ymd, workdays) {
  const src = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src)) return workdays?.[0] || '';
  if (!Array.isArray(workdays) || workdays.length === 0) return '';

  if (src <= workdays[0]) return workdays[0];
  if (src >= workdays[workdays.length - 1]) return workdays[workdays.length - 1];

  // Find first workday >= src
  for (let i = 0; i < workdays.length; i += 1) {
    if (workdays[i] >= src) return workdays[i];
  }
  return workdays[workdays.length - 1];
}

function dateIfInTargetMonth(ymd, targetMonthYyyyMm, holidaySet) {
  const shifted = shiftForWorkdaysAndHolidays(String(ymd || '').slice(0, 10), holidaySet);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shifted)) return '';
  if (!String(targetMonthYyyyMm || '').trim()) return '';
  return shifted.startsWith(`${targetMonthYyyyMm}-`) ? shifted : '';
}

function monthLabel(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function ymdAddDays(ymd, days) {
  const src = String(ymd || '').slice(0, 10);
  const m = src.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + Math.round(Number(days || 0)));
  return d.toISOString().slice(0, 10);
}

function ymdDow(ymd) {
  const src = String(ymd || '').slice(0, 10);
  const m = src.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCDay(); // 0=Sun
}

function isWeekend(ymd) {
  const dow = ymdDow(ymd);
  return dow === 0 || dow === 6;
}

function isHoliday(ymd, holidaySet) {
  return holidaySet && holidaySet.has(String(ymd || '').slice(0, 10));
}

function shiftForWorkdaysAndHolidays(ymd, holidaySet) {
  let cur = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) return '';

  // Hard stop to avoid infinite loops
  for (let guard = 0; guard < 60; guard += 1) {
    const dow = ymdDow(cur);
    if (dow === 6) {
      cur = ymdAddDays(cur, -1);
      continue;
    }
    if (dow === 0) {
      cur = ymdAddDays(cur, 1);
      continue;
    }

    if (isHoliday(cur, holidaySet)) {
      const next = ymdAddDays(cur, 1);
      if (isWeekend(next)) {
        cur = ymdAddDays(cur, -1);
      } else {
        cur = next;
      }
      continue;
    }

    return cur;
  }

  return cur;
}

function buildWorkdays(yyyyMm, holidaySet) {
  const m = String(yyyyMm || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const first = new Date(Date.UTC(yy, mm - 1, 1));
  const last = new Date(Date.UTC(yy, mm, 0));

  const out = [];
  for (let d = 1; d <= last.getUTCDate(); d += 1) {
    const ymd = `${yy}-${pad2(mm)}-${pad2(d)}`;
    if (isWeekend(ymd)) continue;
    if (isHoliday(ymd, holidaySet)) continue;
    out.push(ymd);
  }
  return out;
}

function normalizeZone(z) {
  return String(z || '')
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

async function hasNonDoneEpvInMonth(env, siteId, monthYyyyMm, epvType) {
  const m = String(monthYyyyMm || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return false;
  const from = `${m}-01`;
  const to = `${m}-31`;
  const row = await env.DB.prepare(
    'SELECT 1 as one FROM interventions WHERE site_id = ? AND epv_type = ? AND planned_date >= ? AND planned_date <= ? AND status != \'done\' LIMIT 1'
  )
    .bind(String(siteId), String(epvType || ''), from, to)
    .first();
  return Boolean(row?.one);
}

function normStr(v) {
  const s = String(v ?? '').trim();
  return s;
}

function is23rd(todayYmd) {
  const m = String(todayYmd || '').match(/^\d{4}-\d{2}-(\d{2})$/);
  if (!m) return false;
  return Number(m[1]) === 23;
}

async function loadHolidays(env, fromYmd, toYmd) {
  const from = String(fromYmd || '').slice(0, 10);
  const to = String(toYmd || '').slice(0, 10);

  let where = '1=1';
  const bind = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where += ' AND date_ymd >= ?';
    bind.push(from);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where += ' AND date_ymd <= ?';
    bind.push(to);
  }

  const res = await env.DB.prepare(`SELECT date_ymd FROM holidays WHERE ${where}`).bind(...bind).all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  return new Set(rows.map((r) => String(r?.date_ymd || '').slice(0, 10)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)));
}

async function loadTechnician(env, techUserId) {
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(String(techUserId)).first();
  if (!u) return null;
  return {
    id: String(u.id),
    role: String(u.role || ''),
    zone: String(u.zone || 'BZV/POOL'),
    technicianName: String(u.technician_name || '').trim(),
    email: String(u.email || '')
  };
}

async function loadSitesForTechnician(env, technicianName, zoneScope) {
  const stmt = zoneScope
    ? env.DB.prepare('SELECT * FROM sites WHERE zone = ? AND technician = ? AND (retired = 0 OR (retired = 1 AND updated_at >= ?)) ORDER BY id_site ASC')
        .bind(zoneScope, technicianName, `${String(ymdToday() || '').slice(0, 7)}-01`)
    : env.DB.prepare('SELECT * FROM sites WHERE technician = ? AND (retired = 0 OR (retired = 1 AND updated_at >= ?)) ORDER BY id_site ASC')
        .bind(technicianName, `${String(ymdToday() || '').slice(0, 7)}-01`);
  const res = await stmt.all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  return rows.map((r) => ({
    id: String(r.id),
    idSite: String(r.id_site || ''),
    nameSite: String(r.name_site || ''),
    zone: normalizeZone(r.zone || 'BZV/POOL'),
    regime: Number(r.regime || 0),
    nh1DV: Number(r.nh1_dv || 0),
    nh2A: Number(r.nh2_a || 0),
    dateA: String(r.date_a || '').slice(0, 10),
    retired: Boolean(r.retired),
    updatedAt: String(r.updated_at || '')
  }));
}

async function loadPairs(env, technicianUserId) {
  const res = await env.DB.prepare(
    'SELECT site_id_1, site_id_2 FROM clustering_pairs WHERE technician_user_id = ?'
  )
    .bind(String(technicianUserId))
    .all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  const map = new Map();
  for (const r of rows) {
    const a = String(r?.site_id_1 || '').trim();
    const b = String(r?.site_id_2 || '').trim();
    if (!a || !b || a === b) continue;
    map.set(a, b);
    map.set(b, a);
  }
  return map;
}

function findSlotInMonth(workdays, startIdx, requiredSlots, capacitySitesPerDay, occupancyByDate) {
  const idx0 = Math.max(0, Math.round(Number(startIdx || 0)));
  const req = Math.max(1, Math.round(Number(requiredSlots || 1)));

  for (let i = idx0; i < workdays.length; i += 1) {
    const d = workdays[i];
    const used = Number(occupancyByDate.get(d) || 0);
    if (used + req <= capacitySitesPerDay) {
      return { date: d, idx: i };
    }
  }

  // Exceptional case: force last workday even if it exceeds cadence.
  return { date: workdays[workdays.length - 1], idx: workdays.length - 1 };
}

function intervalDays(regime) {
  const r = Number(regime || 0);
  if (!r) return 0;
  return SEUIL / r;
}

function computeEpvDatesFromBase(epv1Ymd, regime, holidaySet) {
  const d1 = shiftForWorkdaysAndHolidays(epv1Ymd, holidaySet);
  const delta = intervalDays(regime);
  const d2 = shiftForWorkdaysAndHolidays(ymdAddDays(d1, delta), holidaySet);
  const d3 = shiftForWorkdaysAndHolidays(ymdAddDays(d2, delta), holidaySet);
  return { epv1: d1, epv2: d2, epv3: d3 };
}

function nextWorkdayWithSlot(startYmd, holidaySet, capacitySitesPerDay, requiredSlots, occupancyByDate) {
  let cur = shiftForWorkdaysAndHolidays(startYmd, holidaySet);
  if (!cur) return '';

  for (let guard = 0; guard < 80; guard += 1) {
    const used = Number(occupancyByDate.get(cur) || 0);
    const req = Math.max(1, Math.round(Number(requiredSlots || 1)));
    if (used + req <= capacitySitesPerDay) {
      return cur;
    }
    cur = shiftForWorkdaysAndHolidays(ymdAddDays(cur, 1), holidaySet);
    if (!cur) return '';
  }
  return cur;
}

async function upsertPlanSnapshot(env, { month, zone, items, createdBy }) {
  const now = isoNow();

  const existing = await env.DB.prepare('SELECT * FROM intelligent_plans WHERE month = ? AND zone = ?').bind(month, zone).first();
  const planId = existing?.id ? String(existing.id) : newId();

  const technicianIds = Array.from(
    new Set((Array.isArray(items) ? items : []).map((it) => String(it?.technicianUserId || '').trim()).filter(Boolean))
  );

  if (existing?.id) {
    await env.DB.prepare(
      'UPDATE intelligent_plans SET generated_at = ?, created_by_user_id = ?, created_by_email = ? WHERE id = ?'
    )
      .bind(now, createdBy?.userId || null, createdBy?.email || null, planId)
      .run();

    // Only replace items for the current technician(s) of this run.
    if (technicianIds.length > 0) {
      const ph = technicianIds.map(() => '?').join(',');
      await env.DB.prepare(
        `DELETE FROM intelligent_plan_items WHERE plan_id = ? AND technician_user_id IN (${ph})`
      )
        .bind(planId, ...technicianIds)
        .run();
    }
  } else {
    await env.DB.prepare(
      'INSERT INTO intelligent_plans (id, month, zone, generated_at, created_by_user_id, created_by_email) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(planId, month, zone, now, createdBy?.userId || null, createdBy?.email || null)
      .run();
  }

  let inserted = 0;
  for (const it of items) {
    const id = newId();
    await env.DB.prepare(
      'INSERT INTO intelligent_plan_items (id, plan_id, month, zone, site_id, site_code, site_name, region, short_description, number, assigned_to, technician_user_id, scheduled_wo_date, date_of_closing, state, epv2, epv3, pair_site_code, pair_site_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        id,
        planId,
        month,
        zone,
        it.siteId,
        it.siteCode || null,
        it.siteName || null,
        it.region || null,
        it.shortDescription || '',
        it.number || '',
        it.assignedTo || '',
        it.technicianUserId || null,
        it.scheduledWoDate || null,
        it.dateOfClosing || '',
        it.state || '',
        it.epv2 || null,
        it.epv3 || null,
        it.pairSiteCode || null,
        it.pairSiteId || null,
        now,
        now
      )
      .run();
    inserted += 1;
  }

  return { planId, inserted };
}

async function replacePlannedInterventions(env, { zone, technicianUserId, technicianName, items, month }) {
  const now = isoNow();

  // Delete existing non-done EPV interventions for the target month for the zone.
  const from = `${month}-01`;
  const to = `${month}-31`;

  await env.DB.prepare(
    "DELETE FROM interventions WHERE zone = ? AND technician_user_id = ? AND status != 'done' AND epv_type IN ('EPV1','EPV2','EPV3') AND planned_date >= ? AND planned_date <= ?"
  )
    .bind(zone, technicianUserId, from, to)
    .run();

  let inserted = 0;

  for (const it of items) {
    const siteId = String(it?.siteId || '').trim();
    if (!siteId) continue;
    const dates = [
      { epvType: 'EPV1', plannedDate: it?.scheduledWoDate },
      { epvType: 'EPV2', plannedDate: it?.epv2 },
      { epvType: 'EPV3', plannedDate: it?.epv3 }
    ];

    for (const d of dates) {
      const plannedDate = String(d?.plannedDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) continue;
      const id = newId();
      await env.DB.prepare(
        'INSERT OR IGNORE INTO interventions (id, site_id, zone, planned_date, epv_type, technician_user_id, technician_name, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(id, siteId, zone, plannedDate, d.epvType, technicianUserId, technicianName, 'planned', null, now, now)
        .run();

      await env.DB.prepare(
        "UPDATE interventions SET technician_user_id = ?, technician_name = ?, status = 'planned', updated_at = ? WHERE site_id = ? AND planned_date = ? AND epv_type = ? AND status != 'done'"
      )
        .bind(technicianUserId, technicianName, now, siteId, plannedDate, d.epvType)
        .run();

      inserted += 1;
    }
  }

  return { inserted };
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const today = ymdToday();

    const body = await readJson(request);
    const technicianUserId = String(body?.technicianUserId || '').trim();
    if (!technicianUserId) return json({ error: 'technicianUserId requis.' }, { status: 400 });

    const tech = await loadTechnician(env, technicianUserId);
    if (!tech || tech.role !== 'technician' || !tech.technicianName) {
      return json({ error: 'Technicien invalide.' }, { status: 400 });
    }

    const scopeZone = isSuperAdmin(data) ? null : userZone(data);
    if (scopeZone && normalizeZone(tech.zone) !== normalizeZone(scopeZone)) {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    // month target = month+1 based on Africa/Brazzaville ymdToday
    const t = String(today).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!t) return json({ error: 'Date système invalide.' }, { status: 500 });

    const curYear = Number(t[1]);
    const curMonth = Number(t[2]);
    const currentMonth = `${t[1]}-${t[2]}`;

    const next = new Date(Date.UTC(curYear, curMonth, 1)); // curMonth is 1-based; Date month is 0-based => this is next month
    const targetMonth = monthLabel(next);

    const zone = normalizeZone(scopeZone || tech.zone || 'BZV/POOL');

    // Load holidays for target month and a bit after (to cover EPV2/EPV3 shifts)
    const holidays = await loadHolidays(env, `${targetMonth}-01`, ymdAddDays(`${targetMonth}-01`, 120));

    const sites = await loadSitesForTechnician(env, tech.technicianName, scopeZone);
    if (sites.length === 0) {
      return json({ error: 'Aucun site affecté à ce technicien.' }, { status: 400 });
    }

    const pairsMap = await loadPairs(env, technicianUserId);

    // Build visits
    const siteById = new Map(sites.map((s) => [String(s.id), s]));
    const visited = new Set();
    const visits = [];

    for (const s of sites) {
      const sid = String(s.id);
      if (visited.has(sid)) continue;
      const pairedId = pairsMap.get(sid);
      if (pairedId && siteById.has(String(pairedId)) && !visited.has(String(pairedId))) {
        const s2 = siteById.get(String(pairedId));
        const urgentRegime = Math.max(Number(s.regime || 0), Number(s2?.regime || 0));
        const urgentSiteId = Number(s.regime || 0) >= Number(s2?.regime || 0) ? sid : String(pairedId);
        visits.push({ sites: [sid, String(pairedId)], urgentRegime, urgentSiteId });
        visited.add(sid);
        visited.add(String(pairedId));
      } else {
        visits.push({ sites: [sid], urgentRegime: Number(s.regime || 0), urgentSiteId: sid });
        visited.add(sid);
      }
    }

    visits.sort((a, b) => (b.urgentRegime - a.urgentRegime) || String(a.urgentSiteId).localeCompare(String(b.urgentSiteId)));

    // Terrain cadence is expressed in number of sites per day (not number of "visits").
    // A paired visit consumes 2 slots.
    const capacitySitesPerDay = sites.length >= 21 ? 2 : 1;
    const workdays = buildWorkdays(targetMonth, holidays);
    if (workdays.length === 0) {
      return json({ error: 'Aucun jour ouvré disponible (jours fériés/weekends).' }, { status: 400 });
    }

    const workdayIndex = new Map(workdays.map((d, idx) => [d, idx]));

    const occupancyByDate = new Map();
    const assignments = [];

    // Cursor to guarantee continuous placement: always keep filling earliest available workday.
    let workdayCursorIdx = 0;

    // Assign per visit with anti-conflict capacity enforcement strictly inside the target month.
    // Highest regime keeps earliest slots.
    for (const v of visits) {
      // Determine base EPV1 from the SiteCard-equivalent calculated EPV dates (source of truth).
      const urgentSite = siteById.get(String(v.urgentSiteId));
      const urgentRegime = Number(urgentSite?.regime || v.urgentRegime || 0);

      const nhEstimated = calculateEstimatedNH(Number(urgentSite?.nh2A || 0), String(urgentSite?.dateA || ''), urgentRegime);
      const calculated = calculateEPVDates(urgentRegime, Number(urgentSite?.nh1DV || 0), nhEstimated, SEUIL);

      // Règle B (sans dates interventions comme source):
      // On ne lit que l'existence d'EPV1/EPV2 non réalisées sur le mois courant pour déclencher les scénarios.
      const nonDoneEpv1 = await hasNonDoneEpvInMonth(env, v.urgentSiteId, currentMonth, 'EPV1');
      const nonDoneEpv2 = await hasNonDoneEpvInMonth(env, v.urgentSiteId, currentMonth, 'EPV2');

      // Case 1: EPV1 + EPV2 non réalisés => EPV3 calculé devient seed (EPV1 du mois cible), EPV2 sera recalculé après placement.
      // Case 2: EPV1 seul non réalisé => EPV2 calculé devient seed (EPV1 du mois cible) et EPV3 calculé devient EPV2 forcé.
      const preferredSeed = nonDoneEpv1 && nonDoneEpv2 ? calculated?.epv3 : nonDoneEpv1 ? calculated?.epv2 : calculated?.epv1;
      const forcedEpv2Seed = nonDoneEpv1 && !nonDoneEpv2 ? calculated?.epv3 : '';

      // Seed is EPV1 computed (SiteCard). If invalid/outside month => clamp inside month.
      const rawSeed = String(preferredSeed || '').slice(0, 10);
      const seeded = clampToMonthWorkday(rawSeed, workdays);
      const startIdx = Number(workdayIndex.get(seeded) ?? 0);

      const effectiveStartIdx = Math.min(startIdx, workdayCursorIdx);

      // Anti-conflict: cadence enforcement by number of sites planned that day.
      // A pair consumes 2 slots; a single-site visit consumes 1 slot.
      const requiredSlots = Array.isArray(v.sites) ? v.sites.length : 1;
      const slot = findSlotInMonth(workdays, effectiveStartIdx, requiredSlots, capacitySitesPerDay, occupancyByDate);
      const epv1 = slot.date;
      occupancyByDate.set(epv1, Number(occupancyByDate.get(epv1) || 0) + requiredSlots);

      // Advance cursor to next not-full day to prevent unexplained gaps.
      for (let i = workdayCursorIdx; i < workdays.length; i += 1) {
        const d = workdays[i];
        const used = Number(occupancyByDate.get(d) || 0);
        if (used < capacitySitesPerDay) {
          workdayCursorIdx = i;
          break;
        }
        workdayCursorIdx = Math.min(i + 1, workdays.length - 1);
      }

      // Compute EPV2/EPV3 from the placed EPV1.
      // IMPORTANT: if EPV2/EPV3 are outside the target month, we leave them empty.
      // If EPV2 is forced (case EPV1 seul non réalisé), we use the calculated EPV3 as EPV2 and recompute EPV3 from there.
      const computed = computeEpvDatesFromBase(epv1, urgentRegime, holidays);
      const forcedEpv2 = forcedEpv2Seed ? dateIfInTargetMonth(forcedEpv2Seed, targetMonth, holidays) : '';
      const epv2Base = forcedEpv2 || dateIfInTargetMonth(computed.epv2, targetMonth, holidays);
      const epv3 = epv2Base ? dateIfInTargetMonth(computeEpvDatesFromBase(epv2Base, urgentRegime, holidays).epv3, targetMonth, holidays) : '';
      const epv2 = epv2Base;

      for (const sid of v.sites) {
        const s = siteById.get(String(sid));
        if (!s) continue;
        assignments.push({
          siteId: String(s.id),
          siteCode: s.idSite,
          siteName: s.nameSite,
          region: s.zone,
          zone: s.zone,
          assignedTo: tech.technicianName,
          technicianUserId,
          scheduledWoDate: epv1,
          epv2,
          epv3,
          pairSiteId: v.sites.length === 2 ? String(v.sites.find((x) => String(x) !== String(sid)) || '') : '',
          pairSiteCode: v.sites.length === 2 ? (siteById.get(String(v.sites.find((x) => String(x) !== String(sid))))?.idSite || '') : ''
        });
      }
    }

    // Guarantee 100% coverage for this technician
    const covered = new Set(assignments.map((a) => String(a.siteId)));
    for (const s of sites) {
      if (covered.has(String(s.id))) continue;
      const last = workdays[workdays.length - 1];
      const epv = computeEpvDatesFromBase(last, Number(s.regime || 0), holidays);
      assignments.push({
        siteId: String(s.id),
        siteCode: s.idSite,
        siteName: s.nameSite,
        region: s.zone,
        zone: s.zone,
        assignedTo: tech.technicianName,
        technicianUserId,
        scheduledWoDate: clampToMonthWorkday(epv.epv1, workdays),
        epv2: '',
        epv3: '',
        pairSiteId: '',
        pairSiteCode: ''
      });
    }

    // Build snapshot items (with empty columns as requested)
    const snapshotItems = assignments.map((a) => ({
      siteId: a.siteId,
      siteCode: a.siteCode,
      siteName: a.siteName,
      region: a.region,
      shortDescription: '',
      number: '',
      assignedTo: a.assignedTo,
      technicianUserId: a.technicianUserId,
      scheduledWoDate: a.scheduledWoDate,
      dateOfClosing: '',
      state: '',
      epv2: a.epv2,
      epv3: a.epv3,
      pairSiteCode: a.pairSiteCode,
      pairSiteId: a.pairSiteId
    }));

    // Persist (snapshot for zone + interventions planned for this technician)
    const snapshotRes = await upsertPlanSnapshot(env, {
      month: targetMonth,
      zone,
      items: snapshotItems,
      createdBy: { userId: data?.user?.id ? String(data.user.id) : null, email: data?.user?.email ? String(data.user.email) : null }
    });

    const interventionsRes = await replacePlannedInterventions(env, {
      zone,
      technicianUserId,
      technicianName: tech.technicianName,
      items: snapshotItems,
      month: targetMonth
    });

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        today,
        targetMonth,
        zone,
        technicianUserId,
        technicianName: tech.technicianName,
        stats: {
          sites: sites.length,
          visits: visits.length,
          capacitySitesPerDay,
          workdays: workdays.length,
          snapshotInserted: snapshotRes.inserted,
          interventionsUpserted: interventionsRes.inserted
        }
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
