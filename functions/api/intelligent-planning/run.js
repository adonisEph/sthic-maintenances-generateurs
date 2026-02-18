import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, ymdToday, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

const SEUIL = 250;

function pad2(n) {
  return String(n).padStart(2, '0');
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
    ? env.DB.prepare('SELECT * FROM sites WHERE zone = ? AND technician = ? AND retired = 0 ORDER BY id_site ASC').bind(zoneScope, technicianName)
    : env.DB.prepare('SELECT * FROM sites WHERE technician = ? AND retired = 0 ORDER BY id_site ASC').bind(technicianName);
  const res = await stmt.all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  return rows.map((r) => ({
    id: String(r.id),
    idSite: String(r.id_site || ''),
    nameSite: String(r.name_site || ''),
    zone: normalizeZone(r.zone || 'BZV/POOL'),
    regime: Number(r.regime || 0)
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

async function loadCurrentMonthNonDoneEpv1(env, siteId, currentMonth) {
  // currentMonth: YYYY-MM
  const m = String(currentMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const from = `${m}-01`;
  const to = `${m}-31`;
  const row = await env.DB.prepare(
    "SELECT planned_date, status FROM interventions WHERE site_id = ? AND epv_type = 'EPV1' AND planned_date >= ? AND planned_date <= ? ORDER BY planned_date ASC LIMIT 1"
  )
    .bind(String(siteId), from, to)
    .first();
  if (!row?.planned_date) return null;
  const st = String(row?.status || '');
  if (st === 'done') return null;
  return { plannedDate: String(row.planned_date).slice(0, 10), status: st };
}

async function loadCurrentMonthEpvDate(env, siteId, currentMonth, epvType) {
  const m = String(currentMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return '';
  const from = `${m}-01`;
  const to = `${m}-31`;
  const row = await env.DB.prepare(
    'SELECT planned_date FROM interventions WHERE site_id = ? AND epv_type = ? AND planned_date >= ? AND planned_date <= ? ORDER BY planned_date ASC LIMIT 1'
  )
    .bind(String(siteId), String(epvType || ''), from, to)
    .first();
  const d = String(row?.planned_date || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
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

    const capacityVisitsPerDay = sites.length >= 21 ? 2 : 1;
    const workdays = buildWorkdays(targetMonth, holidays);
    if (workdays.length === 0) {
      return json({ error: 'Aucun jour ouvré disponible (jours fériés/weekends).' }, { status: 400 });
    }

    const assignments = [];
    let dayIdx = 0;
    let daySlotsUsed = 0;

    for (const v of visits) {
      if (dayIdx >= workdays.length) {
        // overflow: keep last day
        dayIdx = workdays.length - 1;
      }

      if (daySlotsUsed >= capacityVisitsPerDay) {
        dayIdx += 1;
        daySlotsUsed = 0;
        if (dayIdx >= workdays.length) {
          dayIdx = workdays.length - 1;
        }
      }

      const visitDate = workdays[dayIdx];
      daySlotsUsed += 1;

      // Determine base EPV1 using rollover rule
      const urgentSite = siteById.get(String(v.urgentSiteId));
      const urgentRegime = Number(urgentSite?.regime || v.urgentRegime || 0);

      // If EPV1 exists in current month and not done -> EPV2 becomes EPV1 target, EPV3 becomes EPV2 target
      let baseEpv1 = '';
      let forcedEpv2 = '';
      const nonDoneEpv1 = await loadCurrentMonthNonDoneEpv1(env, v.urgentSiteId, currentMonth);
      if (nonDoneEpv1) {
        const cmEpv2 = await loadCurrentMonthEpvDate(env, v.urgentSiteId, currentMonth, 'EPV2');
        const cmEpv3 = await loadCurrentMonthEpvDate(env, v.urgentSiteId, currentMonth, 'EPV3');
        if (cmEpv2) {
          baseEpv1 = cmEpv2;
          forcedEpv2 = cmEpv3 || '';
        }
      }

      const computed = computeEpvDatesFromBase(baseEpv1 || visitDate, urgentRegime, holidays);
      const epv1 = computed.epv1;
      const epv2 = forcedEpv2 ? shiftForWorkdaysAndHolidays(forcedEpv2, holidays) : computed.epv2;
      const epv3 = computeEpvDatesFromBase(epv2, urgentRegime, holidays).epv3;

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
      const epv = computeEpvDatesFromBase(workdays[workdays.length - 1], Number(s.regime || 0), holidays);
      assignments.push({
        siteId: String(s.id),
        siteCode: s.idSite,
        siteName: s.nameSite,
        region: s.zone,
        zone: s.zone,
        assignedTo: tech.technicianName,
        technicianUserId,
        scheduledWoDate: epv.epv1,
        epv2: epv.epv2,
        epv3: epv.epv3,
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
          capacityVisitsPerDay,
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
