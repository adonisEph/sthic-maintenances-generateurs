import React, { useState } from 'react';
import { Calendar, X, Users, MapPin, Clock, AlertCircle, Download, Sparkles, Activity, Trash2, Menu, ChevronLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { calculateEPVDates, calculateEstimatedNH } from '../utils/calculations';

const CalendarModal = (props) => {
  const {
    showCalendar,
    appVersion,
    authUser,
    isTechnician,
    setShowCalendar,
    currentMonth,
    setCurrentMonth,
    isAdmin,
    sites,
    calendarZone,
    setCalendarZone,
    showZoneFilter,
    calendarSendTechUserId,
    setCalendarSendTechUserId,
    users,
    usersBusy,
    usersError,
    refreshUsers,
    handleSendCalendarMonthPlanning,
    canExportExcel,
    handleExportCalendarMonthExcel,
    exportBusy,
    getEventsForDay,
    getDaysUntil,
    selectedDate,
    setSelectedDate,
    setSelectedDayEvents,
    setShowDayDetailsModal,
    isViewer,
    isSuperAdmin,
  } = props;

  const isManager = String(authUser?.role || '') === 'manager';
  const authZone = String(authUser?.zone || '').trim();
  const zones = ['ALL', 'BZV/POOL', 'PNR/KOUILOU', 'UPCN'];

  // State for clustering functionality
  const [showClustering, setShowClustering] = useState(false);
  const [clusteringTech, setClusteringTech] = useState('');
  const [clusteringData, setClusteringData] = useState([]);
  const [clusteringBusy, setClusteringBusy] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState(new Map());
  const [pairingFirstSiteId, setPairingFirstSiteId] = useState('');
  const [clusteringErrors, setClusteringErrors] = useState([]);

  // State for intelligent planning
  const [planningData, setPlanningData] = useState([]);
  const [planningBusy, setPlanningBusy] = useState(false);
  const [planningErrors, setPlanningErrors] = useState([]);
  const [showPlanning, setShowPlanning] = useState(false);
  const [planningStats, setPlanningStats] = useState(null);
  const localIsSuperAdmin = authUser?.role === 'admin' && authZone === 'BZV/POOL';
  const defaultZone = authZone || 'BZV/POOL';
  const [purgeBasePlans, setPurgeBasePlans] = useState(true);
  const [purgeIntelligent, setPurgeIntelligent] = useState(true);
  const [purgeZones, setPurgeZones] = useState([defaultZone]);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeError, setPurgeError] = useState('');
  const [purgePreview, setPurgePreview] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const allZones = ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
  const effectivePurgeZones = (() => {
    if (!localIsSuperAdmin) return [defaultZone];
    const z = (Array.isArray(purgeZones) ? purgeZones : []).map((v) => String(v || '').trim()).filter(Boolean);
    return z.length > 0 ? Array.from(new Set(z)) : [defaultZone];
  })();

  const togglePurgeZone = (zone) => {
    const z = String(zone || '').trim();
    if (!z) return;
    setPurgeZones((prev) => {
      const arr = Array.isArray(prev) ? prev.slice() : [];
      const has = arr.includes(z);
      if (has) return arr.filter((it) => it !== z);
      arr.push(z);
      return arr;
    });
  };

  const handlePurgePreview = async () => {
    setPurgeBusy(true);
    setPurgeError('');
    setPurgePreview(null);
    try {
      const res = await fetch('/api/admin/purge-plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: true,
          purgeBasePlans,
          purgeIntelligent,
          zones: effectivePurgeZones
        })
      });
      const txt = await res.text().catch(() => '');
      const data = (() => {
        try {
          return txt ? JSON.parse(txt) : {};
        } catch {
          return {};
        }
      })();
      if (!res.ok) throw new Error(String(data?.error || txt || 'Erreur serveur.'));
      setPurgePreview(data?.preview || null);
    } catch (e) {
      setPurgeError(e?.message || 'Erreur lors du nettoyage.');
    } finally {
      setPurgeBusy(false);
    }
  };

  const handlePurgeExecute = async () => {
    if (!purgeBasePlans && !purgeIntelligent) {
      setPurgeError('Sélectionne au moins une option (Base STHIC / Intelligent).');
      return;
    }
    const scopeLabel = effectivePurgeZones.join(', ');
    const ok = window.confirm(
      `Confirmer le nettoyage ?\n\nZones: ${scopeLabel}\n\nBase STHIC: ${purgeBasePlans ? 'Oui' : 'Non'}\nIntelligent: ${purgeIntelligent ? 'Oui' : 'Non'}`
    );
    if (!ok) return;

    setPurgeBusy(true);
    setPurgeError('');
    try {
      const res = await fetch('/api/admin/purge-plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: false,
          purgeBasePlans,
          purgeIntelligent,
          zones: effectivePurgeZones
        })
      });
      const txt = await res.text().catch(() => '');
      const data = (() => {
        try {
          return txt ? JSON.parse(txt) : {};
        } catch {
          return {};
        }
      })();
      if (!res.ok) throw new Error(String(data?.error || txt || 'Erreur serveur.'));
      setPurgePreview(null);
      alert('✅ Nettoyage terminé.');
    } catch (e) {
      setPurgeError(e?.message || 'Erreur lors du nettoyage.');
    } finally {
      setPurgeBusy(false);
    }
  };

  // Utility functions for intelligent planning
  const ymdShiftForWorkdays = (ymd, opts) => {
    const v = String(ymd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';

    const fixedHolidaysMmDd = new Set(['01-01', '05-01', '06-10', '08-15', '11-01', '11-28', '12-25']);

    const getEasterSunday = (year) => {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(Date.UTC(year, month - 1, day));
    };

    const ymdFromUtcDate = (d) => {
      return new Date(d.getTime()).toISOString().slice(0, 10);
    };

    const isHolidayYmd = (ymdStr) => {
      const mmdd = String(ymdStr).slice(5, 10);
      if (fixedHolidaysMmDd.has(mmdd)) return true;

      const year = Number(String(ymdStr).slice(0, 4));
      if (!Number.isFinite(year) || year < 1970) return false;
      const easterSunday = getEasterSunday(year);
      const easterMonday = new Date(easterSunday.getTime());
      easterMonday.setUTCDate(easterMonday.getUTCDate() + 1);
      const pentecostMonday = new Date(easterSunday.getTime());
      pentecostMonday.setUTCDate(pentecostMonday.getUTCDate() + 50);

      const s = String(ymdStr);
      return s === ymdFromUtcDate(easterMonday) || s === ymdFromUtcDate(pentecostMonday);
    };

    const ymdAddDaysUtc = (ymdStr, days) => {
      const src = String(ymdStr).slice(0, 10);
      const yy = Number(src.slice(0, 4));
      const mm = Number(src.slice(5, 7));
      const dd = Number(src.slice(8, 10));
      const d = new Date(Date.UTC(yy, mm - 1, dd));
      d.setUTCDate(d.getUTCDate() + Number(days || 0));
      return d.toISOString().slice(0, 10);
    };

    const isNonWorkingYmd = (ymdStr) => {
      const d = new Date(`${String(ymdStr).slice(0, 10)}T00:00:00Z`);
      const dow = d.getUTCDay();
      return dow === 0 || dow === 6 || isHolidayYmd(String(ymdStr).slice(0, 10));
    };

    if (!isNonWorkingYmd(v)) return v;

    const originDow = new Date(`${v}T00:00:00Z`).getUTCDay();

    const findPrevWorkday = (fromYmd) => {
      let cur = String(fromYmd).slice(0, 10);
      for (let i = 0; i < 15; i += 1) {
        cur = ymdAddDaysUtc(cur, -1);
        if (!isNonWorkingYmd(cur)) return cur;
      }
      return '';
    };

    const findNextWorkday = (fromYmd) => {
      let cur = String(fromYmd).slice(0, 10);
      for (let i = 0; i < 15; i += 1) {
        cur = ymdAddDaysUtc(cur, 1);
        if (!isNonWorkingYmd(cur)) return cur;
      }
      return '';
    };

    if (originDow === 6) {
      const prev = findPrevWorkday(v);
      return prev && prev !== v ? prev : '';
    }
    if (originDow === 0) {
      const next = findNextWorkday(v);
      return next && next !== v ? next : '';
    }

    const isHoliday = isHolidayYmd(v);
    if (!isHoliday) return '';

    const nextDay = ymdAddDaysUtc(v, 1);
    const next2Day = ymdAddDaysUtc(v, 2);
    const nextDow = new Date(`${nextDay}T00:00:00Z`).getUTCDay();
    const next2Dow = new Date(`${next2Day}T00:00:00Z`).getUTCDay();
    const weekendSoon = nextDow === 0 || nextDow === 6 || next2Dow === 0 || next2Dow === 6;

    if (weekendSoon) {
      const prev = findPrevWorkday(v);
      return prev && prev !== v ? prev : '';
    }

    const prefer = String(opts?.prefer || 'after').toLowerCase();
    if (prefer === 'before' || prefer === 'prev') {
      const prev = findPrevWorkday(v);
      return prev && prev !== v ? prev : '';
    }
    const next = findNextWorkday(v);
    return next && next !== v ? next : '';
  };

  const exportIntelligentPlanningExcel = () => {
    const items = Array.isArray(planningData) ? planningData : [];
    if (items.length === 0) {
      alert('Aucun planning intelligent à exporter.');
      return;
    }

    const yyyyMmLocal = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      return `${yy}-${mm}`;
    };

    const target = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const month = yyyyMmLocal(target);
    const safeBase = `planning_intelligent_${month}`.replace(/[\/:*?"<>|]+/g, '_');

    const rows = items.map((it) => ({
      Site: String(it?.siteCode || ''),
      'Site Name': String(it?.siteName || ''),
      Region: String(it?.region || it?.zone || ''),
      'Short description': String(it?.shortDescription || it?.maintenanceType || ''),
      Number: String(it?.number || ''),
      'Assigned to': String(it?.assignedTo || it?.technician || ''),
      'Scheduled WO Date': String(it?.scheduledWoDate || it?.plannedDate || '').slice(0, 10),
      'Date of closing': String(it?.dateOfClosing || ''),
      State: String(it?.state || 'Planned'),
      EPV2: String(it?.epv2 || it?.epv2Date || ''),
      EPV3: String(it?.epv3 || it?.epv3Date || ''),
      'Paire Site': String(it?.pairSiteCode || '')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Planning');
    XLSX.writeFile(wb, `${safeBase}.xlsx`);
  };

  const calculateUrgencyScore = (site) => {
    const rawRegime = site?.regime;
    const regimeLabel = (() => {
      if (rawRegime == null) return '';
      const s = String(rawRegime).trim();
      if (!s) return '';
      if (/^H\d+$/i.test(s)) return s.toUpperCase();
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) return `H${Math.round(n)}`;
      return s.toUpperCase();
    })();

    const regimePriority = {
      H24: 100,
      H20: 90,
      H18: 80,
      H16: 70,
      H15: 60,
      H14: 50,
      H12: 40,
      H9: 30
    };

    const regimeScore = regimePriority[regimeLabel] || 0;

    const lastVidangeRaw = site?.lastVidange || site?.dateDV || site?.date_dv || '';
    const lastVidange = new Date(String(lastVidangeRaw).slice(0, 10));
    const today = new Date();
    const daysSinceVidange = Number.isNaN(lastVidange.getTime())
      ? 0
      : Math.max(0, Math.floor((today - lastVidange) / (1000 * 60 * 60 * 24)));
    const vidangeScore = Math.min(daysSinceVidange * 2, 100);

    return regimeScore + vidangeScore;
  };

  const pickEpvForPlanning = (site, targetMonthYyyyMm) => {
    const rawRegime = site?.regime;
    const regimeNumber = (() => {
      if (rawRegime == null) return 0;
      const s = String(rawRegime).trim();
      if (!s) return 0;
      if (/^H\d+$/i.test(s)) return Number(s.slice(1));
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    })();

    const nh1 = Number(site?.nh1DV ?? site?.nh1_dv ?? 0);
    const nh2 = Number(site?.nh2A ?? site?.nh2_a ?? 0);
    const dateA = String(site?.dateA ?? site?.date_a ?? '').slice(0, 10);
    const nhEstimated = site?.nhEstimated != null ? Number(site.nhEstimated) : calculateEstimatedNH(nh2, dateA, regimeNumber);
    const epv = calculateEPVDates(regimeNumber, dateA, nh1, nhEstimated);

    const epv1Raw = String(epv?.epv1 || '').slice(0, 10);
    const epv2Raw = String(epv?.epv2 || '').slice(0, 10);
    const epv3Raw = String(epv?.epv3 || '').slice(0, 10);

    const norm = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d).slice(0, 10) : '');
    const epv1Shifted = (() => {
      const d = norm(epv1Raw);
      return d ? ymdShiftForWorkdays(d) || d : '';
    })();
    const epv2Shifted = (() => {
      const d = norm(epv2Raw);
      return d ? ymdShiftForWorkdays(d) || d : '';
    })();
    const epv3Shifted = (() => {
      const d = norm(epv3Raw);
      return d ? ymdShiftForWorkdays(d) || d : '';
    })();

    const inTargetEpv1 = epv1Shifted ? epv1Shifted.slice(0, 7) === targetMonthYyyyMm : false;
    const inTargetEpv2 = epv2Shifted ? epv2Shifted.slice(0, 7) === targetMonthYyyyMm : false;
    const inTargetEpv3 = epv3Shifted ? epv3Shifted.slice(0, 7) === targetMonthYyyyMm : false;

    const slot1 = inTargetEpv1 ? 'EPV1' : inTargetEpv2 ? 'EPV2' : inTargetEpv3 ? 'EPV3' : 'EPV1';
    const slot2 = slot1 === 'EPV1' ? 'EPV2' : slot1 === 'EPV2' ? 'EPV3' : '';
    const slot3 = slot1 === 'EPV1' ? 'EPV3' : '';

    const dateForSlot = (slot) => {
      if (slot === 'EPV1') return epv1Shifted;
      if (slot === 'EPV2') return epv2Shifted;
      if (slot === 'EPV3') return epv3Shifted;
      return '';
    };

    const date1 = dateForSlot(slot1);
    const date2 = dateForSlot(slot2);
    const date3 = dateForSlot(slot3);

    const maintenanceType = (() => {
      if (slot1 === 'EPV1') return 'PM+Vidange';
      if (slot1 === 'EPV2') return 'DG Service 2';
      if (slot1 === 'EPV3') return 'DG Service 3';
      return 'PM Simple';
    })();

    const orderDate = date1 || epv1Shifted || epv2Shifted || epv3Shifted || '';
    const hasEpvInTargetMonth = inTargetEpv1 || inTargetEpv2 || inTargetEpv3;

    return {
      epv1: epv1Raw,
      epv2: epv2Raw,
      epv3: epv3Raw,
      epv1Shifted,
      epv2Shifted,
      epv3Shifted,
      slot1,
      slot2,
      slot3,
      date1,
      date2,
      date3,
      targetDate: date1,
      orderDate,
      hasEpvInTargetMonth,
      hasEpv1InTargetMonth: inTargetEpv1,
      maintenanceType
    };
  };

  const getTechnicianCapacity = (technicianId, siteCount) => {
    // >20 sites = 2 sites/day, <=20 sites = 1 site/day
    return siteCount > 20 ? 2 : 1;
  };

  const generateIntelligentPlanning = async () => {
    setPlanningBusy(true);
    setPlanningErrors([]);
    setPlanningStats(null);
    
    try {
      const zoneActive = showZoneFilter && calendarZone && calendarZone !== 'ALL' ? String(calendarZone) : '';
      let list = Array.isArray(sites) ? sites : [];
      try {
        const res = await fetch('/api/sites/all-with-clustering', { credentials: 'include' });
        if (res.ok) {
          const raw = await res.text().catch(() => '');
          const parsed = (() => {
            try {
              return raw ? JSON.parse(raw) : null;
            } catch {
              return null;
            }
          })();
          const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.sites) ? parsed.sites : [];
          if (arr.length > 0) list = arr;
        }
      } catch {
        // ignore
      }

      if (zoneActive) {
        list = (Array.isArray(list) ? list : []).filter((s) => String(s?.zone || '').trim() === zoneActive);
      }

      const techUsers = (Array.isArray(users) ? users : []).filter((u) => u && u.role === 'technician');

      const resolveTechnicianUserId = (site) => {
        const techName = String(site?.technician || '').trim();
        if (!techName) return null;
        const match = techUsers.find((u) => String(u?.technicianName || '').trim() === techName);
        return match?.id || null;
      };

      const resolveTechnicianLabel = (techId, techName) => {
        const u = techUsers.find((it) => String(it?.id) === String(techId));
        return String(u?.technicianName || u?.email || techName || 'Unknown');
      };

      const allSites = list
        .filter((s) => s && !s.retired)
        .map((s) => {
          const techId = s?.technicianId != null ? s.technicianId : resolveTechnicianUserId(s);
          return {
            ...s,
            technicianId: techId,
            region: s?.region ?? s?.zone ?? ''
          };
        });
      
      // Group sites by technician
      const sitesByTech = new Map();
      allSites.forEach(site => {
        const techId = site?.technicianId != null ? String(site.technicianId) : '';
        const techName = String(site?.technician || '').trim();
        const key = techId || `name:${techName || 'Unknown'}`;
        if (!sitesByTech.has(key)) {
          sitesByTech.set(key, []);
        }
        sitesByTech.get(key).push(site);
      });
      
      const planning = [];
      const localErrors = [];

      const yyyyMmLocal = (d) => {
        const dt = d instanceof Date ? d : new Date(d);
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        return `${yy}-${mm}`;
      };

      const targetMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const targetMonthYyyyMm = yyyyMmLocal(targetMonth);
      const monthStartYmd = `${targetMonthYyyyMm}-01`;
      
      const ymdAddDays = (ymd, days) => {
        const src = String(ymd || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(src)) return '';
        const yy = Number(src.slice(0, 4));
        const mm = Number(src.slice(5, 7));
        const dd = Number(src.slice(8, 10));
        const d = new Date(Date.UTC(yy, mm - 1, dd));
        d.setUTCDate(d.getUTCDate() + Number(days || 0));
        return d.toISOString().slice(0, 10);
      };

      const asWorkday = (ymd) => {
        const shifted = ymdShiftForWorkdays(ymd);
        return shifted || String(ymd || '').slice(0, 10);
      };

      const nextWorkdayForward = (ymd) => {
        let cur = String(ymd || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) return '';
        for (let i = 0; i < 40; i += 1) {
          if (asWorkday(cur) === cur) return cur;
          cur = ymdAddDays(cur, 1);
        }
        return '';
      };

      const monthEndYmd = (() => {
        let cur = `${targetMonthYyyyMm}-27`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) return '';
        for (let i = 0; i < 40; i += 1) {
          if (asWorkday(cur) === cur) return cur;
          cur = ymdAddDays(cur, -1);
        }
        return '';
      })();

      const lastWorkdayOfMonthYmd = (() => {
        let cur = String(monthEndYmd || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) return '';
        for (let i = 0; i < 40; i += 1) {
          if (asWorkday(cur) === cur) return cur;
          cur = ymdAddDays(cur, -1);
        }
        return '';
      })();

      // Process each technician
      for (const [techKey, sites] of sitesByTech.entries()) {
        const techId = String(techKey).startsWith('name:') ? '' : String(techKey);
        const techName = resolveTechnicianLabel(techId, sites?.[0]?.technician);
        const capacity = getTechnicianCapacity(techId, sites.length);
        
        // Load clustering pairs for this technician
        let pairs = [];
        if (techId) {
          const pairsResponse = await fetch(`/api/clustering/by-technician/${techId}`);
          pairs = pairsResponse.ok ? await pairsResponse.json() : [];
        }
        const pairMap = new Map();
        pairs.forEach(pair => {
          pairMap.set(pair.siteId1, pair.siteId2);
          pairMap.set(pair.siteId2, pair.siteId1);
        });
        
        const enrichedSites = sites
          .map((s) => {
            const picked = pickEpvForPlanning(s, targetMonthYyyyMm);
            const orderDate = picked?.orderDate ? asWorkday(picked.orderDate) : '';

            const lastVidangeRaw = s?.lastVidange || s?.dateDV || s?.date_dv || '';
            const lastVidange = new Date(String(lastVidangeRaw).slice(0, 10));
            const lastVidangeTs = Number.isNaN(lastVidange.getTime()) ? Number.POSITIVE_INFINITY : lastVidange.getTime();

            return {
              ...s,
              _epvType: picked?.epvType || 'EPV1',
              _epvOrderDate: orderDate,
              _hasEpvInTargetMonth: !!picked?.hasEpvInTargetMonth,
              _hasEpv1InTargetMonth: !!picked?.hasEpv1InTargetMonth,
              _maintenanceType: picked?.maintenanceType || 'PM Simple',
              _epv1Shifted: String(picked?.epv1Shifted || ''),
              _epv2Shifted: String(picked?.epv2Shifted || ''),
              _epv3Shifted: String(picked?.epv3Shifted || ''),
              _lastVidangeTs: lastVidangeTs,
              _urgency: calculateUrgencyScore({ ...s, lastVidange: s?.lastVidange || s?.dateDV || s?.date_dv })
            };
          })
          .filter((s) => s);

        if (capacity === 2) {
          const pairedIds = new Set();
          for (const [k, v] of pairMap.entries()) {
            const a = String(k || '');
            const b = String(v || '');
            if (!a || !b) continue;
            pairedIds.add(a);
            pairedIds.add(b);
          }

          const activeIds = new Set(enrichedSites.map((s) => String(s.id)));
          let pairedActive = 0;
          activeIds.forEach((id) => {
            if (pairedIds.has(id)) pairedActive += 1;
          });

          const missing = Math.max(0, activeIds.size - pairedActive);
          if (missing > 1) {
            localErrors.push(
              `Technicien ${techName}: il manque des paires (au moins ${missing} site(s) non jumelé(s)). ` +
                `Veuillez configurer les paires avant de générer le planning.`
            );
          }
        }

        // Group sites into pairs (for capacity=2) or single (for capacity=1)
        const groups = [];
        const processed = new Set();
        
        enrichedSites.forEach(site => {
          const siteId = String(site.id);
          if (!processed.has(siteId)) {
            if (capacity === 2 && pairMap.has(siteId)) {
              // Create pair
              const pairedSiteId = String(pairMap.get(siteId) || '');
              const pairedSite = enrichedSites.find(s => String(s.id) === pairedSiteId);
              if (pairedSite && !processed.has(String(pairedSite.id))) {
                const driver = (() => {
                  const aDate = String(site._epvOrderDate || '');
                  const bDate = String(pairedSite._epvOrderDate || '');
                  const aUrg = Number(site._urgency || 0);
                  const bUrg = Number(pairedSite._urgency || 0);
                  if (aUrg !== bUrg) return aUrg > bUrg ? site : pairedSite;
                  if (aDate && bDate && aDate !== bDate) return aDate < bDate ? site : pairedSite;
                  return site;
                })();

                const pairHasEpvInTargetMonth = Boolean(site?._hasEpvInTargetMonth || pairedSite?._hasEpvInTargetMonth);
                const pairDeadlineDate = (() => {
                  if (!pairHasEpvInTargetMonth) return String(lastWorkdayOfMonthYmd || monthEndYmd || '').slice(0, 10);
                  const dates = [site, pairedSite]
                    .filter((s) => s && s._hasEpvInTargetMonth)
                    .map((s) => String(s?._epvOrderDate || '').slice(0, 10))
                    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d.slice(0, 7) === targetMonthYyyyMm)
                    .sort();
                  return dates[0] || String(lastWorkdayOfMonthYmd || monthEndYmd || '').slice(0, 10);
                })();
                
                groups.push({
                  type: 'pair',
                  sites: [site, pairedSite],
                  urgency: Math.max(Number(site._urgency || 0), Number(pairedSite._urgency || 0)),
                  lastVidangeTs: Math.min(Number(site._lastVidangeTs || Number.POSITIVE_INFINITY), Number(pairedSite._lastVidangeTs || Number.POSITIVE_INFINITY)),
                  targetDate: String(driver._epvOrderDate || ''),
                  driver,
                  hasEpvInTargetMonth: pairHasEpvInTargetMonth,
                  minDate: monthStartYmd,
                  maxDate: pairDeadlineDate
                });
                processed.add(siteId);
                processed.add(String(pairedSite.id));
              } else {
                groups.push({
                  type: 'single',
                  sites: [site],
                  urgency: Number(site._urgency || 0),
                  lastVidangeTs: Number(site._lastVidangeTs || Number.POSITIVE_INFINITY),
                  targetDate: String(site._epvOrderDate || ''),
                  driver: site,
                  hasEpvInTargetMonth: Boolean(site?._hasEpvInTargetMonth),
                  minDate: monthStartYmd,
                  maxDate: site?._hasEpvInTargetMonth
                    ? String(site?._epvOrderDate || '').slice(0, 10)
                    : String(lastWorkdayOfMonthYmd || monthEndYmd || '').slice(0, 10)
                });
                processed.add(siteId);
              }
            } else {
              // Single site
              groups.push({
                type: 'single',
                sites: [site],
                urgency: Number(site._urgency || 0),
                lastVidangeTs: Number(site._lastVidangeTs || Number.POSITIVE_INFINITY),
                targetDate: String(site._epvOrderDate || ''),
                driver: site,
                hasEpvInTargetMonth: Boolean(site?._hasEpvInTargetMonth),
                minDate: monthStartYmd,
                maxDate: site?._hasEpvInTargetMonth
                  ? String(site?._epvOrderDate || '').slice(0, 10)
                  : String(lastWorkdayOfMonthYmd || monthEndYmd || '').slice(0, 10)
              });
              processed.add(siteId);
            }
          }
        });
        
        const groupMaxDate = (g) => {
          const td = String(g?.maxDate || '').slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(td) && td.slice(0, 7) === targetMonthYyyyMm) return td;
          return String(lastWorkdayOfMonthYmd || monthEndYmd || '').slice(0, 10);
        };

        // Sort groups: prioritize those with EPV deadline in target month, then earliest deadline (EDF), then urgency
        groups.sort((a, b) => {
          const aIn = a?.hasEpvInTargetMonth ? 1 : 0;
          const bIn = b?.hasEpvInTargetMonth ? 1 : 0;
          if (aIn !== bIn) return bIn - aIn;

          const ad = groupMaxDate(a);
          const bd = groupMaxDate(b);
          if (ad && bd && ad !== bd) return ad.localeCompare(bd);

          const urg = Number(b?.urgency || 0) - Number(a?.urgency || 0);
          if (urg !== 0) return urg;

          const lvd = Number(a?.lastVidangeTs || Number.POSITIVE_INFINITY) - Number(b?.lastVidangeTs || Number.POSITIVE_INFINITY);
          if (lvd !== 0) return lvd;

          return 0;
        });
        
        const remainingGroups = Array.isArray(groups) ? [...groups] : [];

        const compareGroups = (a, b) => {
          const aIn = a?.hasEpvInTargetMonth ? 1 : 0;
          const bIn = b?.hasEpvInTargetMonth ? 1 : 0;
          if (aIn !== bIn) return bIn - aIn;

          const ad = groupMaxDate(a);
          const bd = groupMaxDate(b);
          if (ad && bd && ad !== bd) return ad.localeCompare(bd);

          const urg = Number(b?.urgency || 0) - Number(a?.urgency || 0);
          if (urg !== 0) return urg;

          const lvd = Number(a?.lastVidangeTs || Number.POSITIVE_INFINITY) - Number(b?.lastVidangeTs || Number.POSITIVE_INFINITY);
          if (lvd !== 0) return lvd;

          return 0;
        };

        const usedCapacity = new Map(); // date -> used slots
        let dayYmd = nextWorkdayForward(monthStartYmd);

        while (remainingGroups.length > 0 && dayYmd && (!monthEndYmd || dayYmd <= monthEndYmd)) {
          let used = usedCapacity.get(dayYmd) || 0;
          let guard = 0;

          while (used < capacity && remainingGroups.length > 0 && guard < 500) {
            guard += 1;

            const eligibleOnTime = remainingGroups
              .filter((g) => groupMaxDate(g) >= dayYmd)
              .filter((g) => {
                const needed = g?.type === 'pair' ? 2 : 1;
                return used + needed <= capacity;
              })
              .sort(compareGroups);

            const eligibleLate = remainingGroups
              .filter((g) => {
                const needed = g?.type === 'pair' ? 2 : 1;
                return used + needed <= capacity;
              })
              .sort(compareGroups);

            const selected = eligibleOnTime.length > 0 ? eligibleOnTime[0] : eligibleLate.length > 0 ? eligibleLate[0] : null;
            if (!selected) break;
            const idx = remainingGroups.indexOf(selected);
            if (idx >= 0) remainingGroups.splice(idx, 1);

            const needed = selected?.type === 'pair' ? 2 : 1;
            used += needed;
            usedCapacity.set(dayYmd, used);

            const deadlineDate = groupMaxDate(selected);
            const isLate = deadlineDate ? dayYmd > deadlineDate : false;

            selected.sites.forEach((site) => {
              const siteId = String(site.id);
              const pairSite = selected.type === 'pair'
                ? selected.sites.find((s) => String(s?.id) !== siteId) || null
                : null;

              planning.push({
                siteId: siteId,
                siteCode: site.idSite,
                siteName: site.nameSite,
                region: site.region,
                zone: site.zone,
                technician: techName,
                technicianId: techId,
                plannedDate: dayYmd,
                deadlineDate,
                isLate,
                epvType: String(site._epvType || ''),
                maintenanceType: String(site._maintenanceType || ''),
                regime: site.regime,
                lastVidange: site.lastVidange || site.dateDV || site.date_dv,
                epv1Date: String(site._epv1Shifted || ''),
                epv2Date: String(site._epv2Shifted || ''),
                epv3Date: String(site._epv3Shifted || ''),
                urgency: Number(site._urgency || 0),
                pairId: selected.type === 'pair' ? `${siteId}-${String(pairMap.get(siteId) || '')}` : null,
                pairSiteCode: pairSite?.idSite || ''
              });
            });
          }

          dayYmd = nextWorkdayForward(ymdAddDays(dayYmd, 1));
        }

        if (remainingGroups.length > 0 && lastWorkdayOfMonthYmd) {
          const neededSlots = remainingGroups.reduce((sum, g) => sum + (g?.type === 'pair' ? 2 : 1), 0);
          const forcedUsed = usedCapacity.get(lastWorkdayOfMonthYmd) || 0;
          usedCapacity.set(lastWorkdayOfMonthYmd, forcedUsed + neededSlots);

          localErrors.push(
            `Technicien ${techName}: capacité insuffisante sur ${targetMonthYyyyMm} ` +
              `(${capacity}/jour). ${remainingGroups.length} groupe(s) forcé(s) au ${lastWorkdayOfMonthYmd} (surbooking).`
          );

          remainingGroups.forEach((group) => {
            const deadlineDate = groupMaxDate(group);
            const isLate = deadlineDate ? lastWorkdayOfMonthYmd > deadlineDate : false;
            group.sites.forEach((site) => {
              const siteId = String(site.id);
              const pairSite = group.type === 'pair'
                ? group.sites.find((s) => String(s?.id) !== siteId) || null
                : null;
              planning.push({
                siteId: siteId,
                siteCode: site.idSite,
                siteName: site.nameSite,
                region: site.region,
                zone: site.zone,
                technician: techName,
                technicianId: techId,
                plannedDate: lastWorkdayOfMonthYmd,
                deadlineDate,
                isLate,
                epvType: String(site._epvType || ''),
                maintenanceType: String(site._maintenanceType || ''),
                regime: site.regime,
                lastVidange: site.lastVidange || site.dateDV || site.date_dv,
                epv1Date: String(site._epv1Shifted || ''),
                epv2Date: String(site._epv2Shifted || ''),
                epv3Date: String(site._epv3Shifted || ''),
                urgency: Number(site._urgency || 0),
                pairId: group.type === 'pair' ? `${siteId}-${String(pairMap.get(siteId) || '')}` : null,
                pairSiteCode: pairSite?.idSite || ''
              });
            });
          });
        }

        if (sites.length > 20) {
          const techLast = planning
            .filter((p) => String(p.technicianId || '') === String(techId || ''))
            .map((p) => String(p.plannedDate || '').slice(0, 10))
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort()
            .slice(-1)[0];

          if (techLast) {
            const day = Number(techLast.slice(8, 10));
            if (Number.isFinite(day) && day > 27) {
              localErrors.push(`Technicien ${techName}: planning finit le ${techLast} (après le 27).`);
            }
          }
        }
      }
      
      // Sort final planning by date, technician, urgency
      planning.sort((a, b) => {
        const dateCompare = a.plannedDate.localeCompare(b.plannedDate);
        if (dateCompare !== 0) return dateCompare;
        const techCompare = a.technician.localeCompare(b.technician);
        if (techCompare !== 0) return techCompare;
        return b.urgency - a.urgency;
      });

      let allocatedStart = 0;
      try {
        const allocRes = await fetch('/api/meta/ticket-number/allocate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: planning.length })
        });
        const allocText = await allocRes.text().catch(() => '');
        const allocData = (() => {
          try {
            return allocText ? JSON.parse(allocText) : {};
          } catch {
            return {};
          }
        })();
        if (!allocRes.ok) throw new Error(String(allocData?.error || allocText || 'Erreur allocation tickets.'));
        allocatedStart = Number(allocData?.start || 0);
      } catch (e) {
        localErrors.push(String(e?.message || 'Erreur allocation tickets.'));
        allocatedStart = 0;
      }

      const withNumbers = planning.map((it, idx) => {
        const n = allocatedStart > 0 ? allocatedStart + idx : 0;
        const ticket = n > 0 ? `T${String(n).padStart(5, '0')}` : '';
        return {
          ...it,
          shortDescription: String(it?.maintenanceType || ''),
          assignedTo: String(it?.technician || ''),
          scheduledWoDate: String(it?.plannedDate || '').slice(0, 10),
          dateOfClosing: '',
          state: 'Planned',
          number: ticket,
          epv2: String(it?.epv2Date || ''),
          epv3: String(it?.epv3Date || '')
        };
      });

      const lateItems = withNumbers.filter((it) => Boolean(it?.isLate));
      const lateCount = lateItems.length;
      const lateSites = lateItems
        .map((it) => String(it?.siteCode || it?.siteName || it?.siteId || ''))
        .filter((x) => x)
        .slice(0, 25);

      if (lateCount > 0) {
        localErrors.push(
          `${lateCount} site(s) planifié(s) après la date EPV (retard). ` +
            `Exemples: ${lateSites.join(', ')}`
        );
      }
      
      const plannedSiteIds = new Set(withNumbers.map((it) => String(it?.siteId || '')).filter((x) => x));
      const sourceSiteIds = new Set(allSites.map((s) => String(s?.id || '')).filter((x) => x));
      const missingSiteIds = [];
      sourceSiteIds.forEach((id) => {
        if (!plannedSiteIds.has(id)) missingSiteIds.push(id);
      });
      const missingSites = allSites
        .filter((s) => missingSiteIds.includes(String(s?.id || '')))
        .map((s) => String(s?.idSite || s?.nameSite || s?.id || ''))
        .slice(0, 25);

      const zoneCounts = {};
      allSites.forEach((s) => {
        const z = String(s?.zone || '').trim() || '—';
        zoneCounts[z] = Number(zoneCounts[z] || 0) + 1;
      });

      setPlanningStats({
        sourceCount: allSites.length,
        plannedCount: plannedSiteIds.size,
        missingCount: missingSiteIds.length,
        missingSites,
        lateCount,
        lateSites,
        zoneCounts
      });

      setPlanningData(withNumbers);
      setShowPlanning(true);

      if (localErrors.length > 0) {
        setPlanningErrors(localErrors);
      }
      
    } catch (error) {
      setPlanningErrors([error.message || 'Erreur lors de la génération du planning']);
    } finally {
      setPlanningBusy(false);
    }
  };

  // Clustering functions
  const loadTechnicianSites = async (techUserId) => {
    setClusteringBusy(true);
    setClusteringErrors([]);
    try {
      // Load sites assigned to this technician
      const response = await fetch(`/api/sites/by-technician/${techUserId}`);
      if (!response.ok) throw new Error('Erreur chargement sites');
      const raw = await response.text();
      let parsed;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        const head = String(raw || '').slice(0, 120);
        throw new Error(
          `Réponse non-JSON depuis /api/sites/by-technician (status ${response.status}). ` +
            `Tu es probablement en mode Vite/Netlify (redirect vers index.html) au lieu des Pages Functions. ` +
            `Début réponse: ${head}`
        );
      }

      const sites = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.sites) ? parsed.sites : [];
      
      // Load existing pairs for this technician
      const pairsResponse = await fetch(`/api/clustering/by-technician/${techUserId}`);
      const existingPairs = pairsResponse.ok ? await pairsResponse.json() : [];
      
      // Format sites for display
      const formattedSites = sites.map(site => ({
        id: site.id,
        code: site.idSite || '',
        name: site.nameSite || '',
        region: site.region || '',
        zone: site.zone || '',
        regime: site.regime || '',
        lastVidange: site.dateDV || '',
        nh1: site.nh1DV || 0,
        nh2: site.nh2A || 0,
        dateA: site.dateA || '',
        technician: site.technician || ''
      }));

      setClusteringData(formattedSites);
      
      // Set existing pairs
      const pairsMap = new Map();
      existingPairs.forEach(pair => {
        if (pair.siteId1 && pair.siteId2) {
          pairsMap.set(pair.siteId1, pair.siteId2);
          pairsMap.set(pair.siteId2, pair.siteId1);
        }
      });
      setSelectedPairs(pairsMap);
      
    } catch (error) {
      setClusteringErrors([error.message || 'Erreur lors du chargement']);
    } finally {
      setClusteringBusy(false);
    }
  };

  const togglePair = (siteId) => {
    const newPairs = new Map(selectedPairs);
    const sid = String(siteId);
    if (newPairs.has(sid)) {
      // Remove pair
      const pairedId = String(newPairs.get(sid) || '');
      newPairs.delete(sid);
      if (pairedId) newPairs.delete(pairedId);
      if (pairingFirstSiteId === sid || pairingFirstSiteId === pairedId) setPairingFirstSiteId('');
    } else {
      if (!pairingFirstSiteId) {
        setPairingFirstSiteId(sid);
      } else if (pairingFirstSiteId === sid) {
        setPairingFirstSiteId('');
      } else {
        if (newPairs.has(pairingFirstSiteId) || newPairs.has(sid)) {
          setClusteringErrors(['Un des sites sélectionnés est déjà jumelé']);
          setPairingFirstSiteId('');
        } else {
          newPairs.set(pairingFirstSiteId, sid);
          newPairs.set(sid, pairingFirstSiteId);
          setPairingFirstSiteId('');
        }
      }
    }
    setSelectedPairs(newPairs);
    setClusteringErrors([]);
  };

  const saveClustering = async () => {
    setClusteringBusy(true);
    setClusteringErrors([]);
    
    try {
      // Validate pairs
      const pairs = [];
      const processed = new Set();
      
      clusteringData.forEach(site => {
        if (!processed.has(site.id) && selectedPairs.has(site.id)) {
          const pairedId = selectedPairs.get(site.id);
          pairs.push({
            technicianId: clusteringTech,
            siteId1: site.id,
            siteId2: pairedId
          });
          processed.add(site.id);
          processed.add(pairedId);
        }
      });

      // Save to database
      const response = await fetch('/api/clustering/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: clusteringTech,
          pairs
        })
      });

      if (!response.ok) throw new Error('Erreur sauvegarde clustering');
      
      alert('✅ Clustering sauvegardé avec succès');
      
    } catch (error) {
      setClusteringErrors([error.message || 'Erreur lors de la sauvegarde']);
    } finally {
      setClusteringBusy(false);
    }
  };

  if (!showCalendar || isTechnician) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-0">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-none sm:max-w-none sm:max-h-[100vh] sm:h-[100vh]">
        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row h-full min-h-0">
            {sidebarOpen && (
              <div className="lg:w-[280px] w-full flex-shrink-0 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 text-white border-emerald-900/60 overflow-y-auto border-r-4 border-r-emerald-400/30">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-900/60">
                  <Activity size={20} className="text-slate-100/90" />
                  <div className="text-lg font-bold text-slate-100 leading-tight">Navigation</div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="ml-auto p-2 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                    title="Masquer le menu"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
                <div className="p-3 space-y-5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Mois</div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="bg-white/10 hover:bg-white/15 text-white border border-white/10 px-2 py-2 rounded-lg w-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                    >
                      ←
                    </button>

                    <div className="text-sm font-bold text-white text-center capitalize">
                      {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="bg-white/10 hover:bg-white/15 text-white border border-white/10 px-2 py-2 rounded-lg w-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                    >
                      →
                    </button>
                  </div>

                  {showZoneFilter && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-white/90 mb-1">Zone</div>
                      <select
                        value={calendarZone}
                        onChange={(e) => setCalendarZone(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                      >
                        {zones.map((z) => (
                          <option key={z} value={z}>
                            {z === 'ALL' ? 'Toutes' : z}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {canExportExcel && (
                    <button
                      type="button"
                      onClick={handleExportCalendarMonthExcel}
                      className="mt-3 w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                      disabled={exportBusy}
                    >
                      <Download size={16} />
                      Exporter Excel
                    </button>
                  )}
                </div>

                {(isAdmin || isManager) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Technicien</div>
                    <div className="text-xs font-semibold text-white/90 mb-1">Destinataire</div>
                    <select
                      value={calendarSendTechUserId}
                      onChange={(e) => setCalendarSendTechUserId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 w-full"
                      disabled={usersBusy}
                    >
                      <option value="">-- Technicien --</option>
                      {(Array.isArray(users) ? users : [])
                        .filter((u) => u && u.role === 'technician')
                        .filter((u) => (isManager ? String(u?.zone || '').trim() === authZone : true))
                        .slice()
                        .sort((a, b) => String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || '')))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.technicianName || u.email}
                          </option>
                        ))}
                    </select>

                    {usersBusy && <div className="mt-1 text-xs text-white/70">Chargement des techniciens…</div>}
                    {!usersBusy && usersError && <div className="mt-1 text-xs text-rose-300">{usersError}</div>}
                    {!usersBusy &&
                      !usersError &&
                      (Array.isArray(users) ? users : [])
                        .filter((u) => u && u.role === 'technician')
                        .filter((u) => (isManager ? String(u?.zone || '').trim() === authZone : true)).length === 0 && (
                        <div className="mt-1 text-xs text-white/70">Aucun technicien chargé.</div>
                      )}

                    <div className="mt-2 space-y-2">
                      {!usersBusy && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await refreshUsers();
                            } catch {
                              // ignore
                            }
                          }}
                          className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                        >
                          Recharger les techniciens
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSendCalendarMonthPlanning}
                        className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                        disabled={!calendarSendTechUserId || usersBusy}
                      >
                        Envoyer planning du mois
                      </button>
                    </div>
                  </div>
                )}

                {(isAdmin || isManager) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
                    <div className="space-y-2">
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2 flex items-center gap-2">
                          <Trash2 size={14} />
                          Nettoyage
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs text-white/90">
                            <input
                              type="checkbox"
                              checked={purgeBasePlans}
                              onChange={(e) => setPurgeBasePlans(Boolean(e.target.checked))}
                              disabled={purgeBusy}
                            />
                            Base STHIC (planning base)
                          </label>

                          <label className="flex items-center gap-2 text-xs text-white/90">
                            <input
                              type="checkbox"
                              checked={purgeIntelligent}
                              onChange={(e) => setPurgeIntelligent(Boolean(e.target.checked))}
                              disabled={purgeBusy}
                            />
                            Intelligent (PM months/items/imports/NOC/assignments)
                          </label>

                          {isSuperAdmin && (
                            <div className="mt-2">
                              <div className="text-xs font-semibold text-white/90 mb-1">Zones</div>
                              <div className="grid grid-cols-1 gap-1">
                                {allZones.map((z) => (
                                  <label key={z} className="flex items-center gap-2 text-xs text-white/80">
                                    <input
                                      type="checkbox"
                                      checked={effectivePurgeZones.includes(z)}
                                      onChange={() => togglePurgeZone(z)}
                                      disabled={purgeBusy}
                                    />
                                    {z}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {!isSuperAdmin && (
                            <div className="text-xs text-white/70">Zone: {defaultZone}</div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handlePurgePreview}
                              className="flex-1 bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60 transition-colors"
                              disabled={purgeBusy || (!purgeBasePlans && !purgeIntelligent)}
                            >
                              {purgeBusy ? 'Recherche…' : 'Rechercher'}
                            </button>
                            <button
                              type="button"
                              onClick={handlePurgeExecute}
                              className="flex-1 bg-rose-700 hover:bg-rose-800 text-white px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60 transition-colors"
                              disabled={purgeBusy || (!purgeBasePlans && !purgeIntelligent)}
                            >
                              Nettoyer
                            </button>
                          </div>

                          {purgeError && <div className="text-xs text-rose-300">{purgeError}</div>}

                          {purgePreview && (
                            <div className="mt-2 text-[11px] text-white/80 bg-black/20 border border-white/10 rounded p-2 space-y-1">
                              <div>Base items: {purgePreview.pmBasePlanItems || 0}</div>
                              <div>Base plans à supprimer: {purgePreview.pmBasePlansToDelete || 0}</div>
                              <div>PM items: {purgePreview.pmItems || 0}</div>
                              <div>NOC rows: {purgePreview.pmNocRows || 0}</div>
                              <div>Assignments: {purgePreview.pmAssignments || 0}</div>
                              <div>Mois PM à supprimer: {purgePreview.pmMonthsToDelete || 0}</div>
                              <div>Imports à supprimer: {purgePreview.pmImportsToDelete || 0}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowClustering(!showClustering)}
                        className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                      >
                        <Users size={16} />
                        {showClustering ? 'Masquer le clustering' : 'Clustering sites'}
                      </button>

                      <button
                        type="button"
                        onClick={generateIntelligentPlanning}
                        className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                        disabled={planningBusy}
                      >
                        <Sparkles size={16} />
                        {planningBusy ? 'Génération...' : 'Générer planning intelligent'}
                      </button>

                    </div>
                  </div>
                )}

              </div>

              {showClustering && (isAdmin || isManager) && (
                <div className="bg-white/5 border-t border-white/10 p-3">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-white/90">Technicien cible</div>
                    <select
                      value={clusteringTech}
                      onChange={(e) => setClusteringTech(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                      disabled={clusteringBusy}
                    >
                      <option value="">-- Sélectionner un technicien --</option>
                      {(Array.isArray(users) ? users : [])
                        .filter((u) => u && u.role === 'technician')
                        .slice()
                        .sort((a, b) => String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || '')))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.technicianName || u.email}
                          </option>
                        ))}
                    </select>

                    {clusteringTech && (
                      <button
                        type="button"
                        onClick={() => loadTechnicianSites(clusteringTech)}
                        className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60"
                        disabled={clusteringBusy}
                      >
                        {clusteringBusy ? 'Chargement...' : 'Charger les sites'}
                      </button>
                    )}

                    {clusteringErrors.length > 0 && (
                      <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
                        {clusteringErrors.map((err, idx) => (
                          <div key={idx} className="flex items-start gap-1">
                            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {clusteringData.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-white/90 flex items-center gap-2">
                          <MapPin size={12} />
                          Sites à regrouper ({clusteringData.length} sites)
                        </div>
                        <div className="text-xs text-white/60 mb-2">Cliquez sur les sites pour les regrouper en paires</div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {clusteringData.map((site) => {
                            const isPaired = selectedPairs.has(site.id);
                            const pairedWith = isPaired ? clusteringData.find(s => s.id === selectedPairs.get(site.id)) : null;
                            const isFirst = pairingFirstSiteId && String(pairingFirstSiteId) === String(site.id);

                            return (
                              <div
                                key={site.id}
                                onClick={() => togglePair(site.id)}
                                className={`bg-white/10 rounded p-2 text-xs cursor-pointer transition-colors border border-transparent ${
                                  isPaired ? 'bg-emerald-800/60 border-emerald-400/60' : isFirst ? 'bg-amber-900/40 border-amber-500' : 'hover:bg-white/15 border-white/10'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-2 h-2 rounded-full ${
                                        isPaired ? 'bg-emerald-200' : isFirst ? 'bg-amber-400' : 'bg-white/40'
                                      }`}
                                    />
                                    <span className="font-semibold">{site.code}</span> - {site.name}
                                  </div>
                                  <div className="flex items-center gap-2 text-white/60">
                                    <Clock size={10} />
                                    <span>{site.regime}</span>
                                  </div>
                                </div>
                                <div className="text-white/60 mt-1">{site.region || site.zone} • Dernière vidange: {site.lastVidange}</div>
                                {pairedWith && (
                                  <div className="text-emerald-200 mt-1 text-xs">⚭ Jumelé avec: {pairedWith.code} - {pairedWith.name}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-60"
                            onClick={saveClustering}
                            disabled={clusteringBusy || selectedPairs.size === 0}
                          >
                            {clusteringBusy ? 'Sauvegarde...' : 'Enregistrer les paires'}
                          </button>
                          <button
                            type="button"
                            className="flex-1 bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                            onClick={() => setSelectedPairs(new Map())}
                          >
                            Réinitialiser
                          </button>
                        </div>
                        {selectedPairs.size > 0 && (
                          <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded p-2">
                            {selectedPairs.size / 2} paire(s) configurée(s)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
            )}

            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="bg-white border-b border-gray-200 shadow-sm px-4 py-3 sticky top-0 z-20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {!sidebarOpen && (
                      <button
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        title="Afficher le menu"
                      >
                        <Menu size={20} className="text-gray-700" />
                      </button>
                    )}
                    <Activity className="text-blue-600" size={24} />
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">Calendrier des Vidanges</div>
                      <div className="text-xs text-gray-600">Version {appVersion} - Suivi H24/7j avec Fiches</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCalendar(false)}
                    className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <X size={20} className="text-gray-700" />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6 space-y-3">
              {/* Planning Results */}
              {showPlanning && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Planning Intelligent Généré</h3>
                    <button
                      onClick={() => setShowPlanning(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {planningErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {planningErrors.map((err, idx) => (
                        <div key={idx}>{err}</div>
                      ))}
                    </div>
                  )}

                  {planningData.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const target = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                          return `${planningData.length} sites planifiés • ${target.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
                        })()}
                      </div>

                      {planningStats && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700">
                          <div>
                            Source: <span className="font-semibold">{planningStats.sourceCount}</span>
                            {' • '}Planifiés: <span className="font-semibold">{planningStats.plannedCount}</span>
                            {' • '}Manquants: <span className={`font-semibold ${planningStats.missingCount > 0 ? 'text-red-700' : ''}`}>{planningStats.missingCount}</span>
                          </div>

                          {planningStats.zoneCounts && (
                            <div className="mt-1 text-xs text-slate-600">
                              {Object.entries(planningStats.zoneCounts)
                                .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
                                .map(([z, c]) => `${z}: ${c}`)
                                .join(' • ')}
                            </div>
                          )}

                          {planningStats.missingCount > 0 && Array.isArray(planningStats.missingSites) && planningStats.missingSites.length > 0 && (
                            <div className="mt-2 text-xs text-red-700">
                              Exemples manquants: {planningStats.missingSites.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                      

                      <div className="border rounded-lg overflow-auto max-h-96">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="text-left">
                              <th className="p-2 border-b">Scheduled WO Date</th>
                              <th className="p-2 border-b">Assigned to</th>
                              <th className="p-2 border-b">Site</th>
                              <th className="p-2 border-b">Nom</th>
                              <th className="p-2 border-b">Région</th>
                              <th className="p-2 border-b">Zone</th>
                              <th className="p-2 border-b">Régime</th>
                              <th className="p-2 border-b">Type</th>
                              <th className="p-2 border-b">DG Service 2</th>
                              <th className="p-2 border-b">EPV2</th>
                              <th className="p-2 border-b">DG Service 3</th>
                              <th className="p-2 border-b">EPV3</th>
                              <th className="p-2 border-b">Urgence</th>
                              <th className="p-2 border-b">Paire</th>
                            </tr>
                          </thead>
                          <tbody>
                            {planningData.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-2 border-b">{new Date(item.plannedDate).toLocaleDateString('fr-FR')}</td>
                                <td className="p-2 border-b">{item.technician}</td>
                                <td className="p-2 border-b font-mono">{item.siteCode}</td>
                                <td className="p-2 border-b">{item.siteName}</td>
                                <td className="p-2 border-b">{item.region}</td>
                                <td className="p-2 border-b">{item.zone || '—'}</td>
                                <td className="p-2 border-b">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                    {item.regime}
                                  </span>
                                </td>
                                <td className="p-2 border-b">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    item.maintenanceType === 'PM+Vidange' ? 'bg-green-100 text-green-800' :
                                    'bg-slate-100 text-slate-800'
                                  }`}>
                                    {item.maintenanceType}
                                  </span>
                                </td>
                                <td className="p-2 border-b">
                                  {item.epvType === 'EPV2' ? 'DG Service 2' : '—'}
                                </td>
                                <td className="p-2 border-b">
                                  {item.epvType === 'EPV2' ? (item.epv2Date || '—') : '—'}
                                </td>
                                <td className="p-2 border-b">
                                  {item.epvType === 'EPV3' ? 'DG Service 3' : '—'}
                                </td>
                                <td className="p-2 border-b">
                                  {item.epvType === 'EPV3' ? (item.epv3Date || '—') : '—'}
                                </td>
                                <td className="p-2 border-b">
                                  <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${
                                      item.urgency > 150 ? 'bg-red-500' :
                                      item.urgency > 100 ? 'bg-orange-500' :
                                      item.urgency > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`} />
                                    <span className="text-xs">{item.urgency}</span>
                                  </div>
                                </td>
                                <td className="p-2 border-b">
                                  {item.pairId ? (
                                    <span className="text-xs text-purple-600">⚭ {item.pairSiteCode || '—'}</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold"
                          onClick={() => {
                            // TODO: Save planning to database
                            alert('Planning sauvegardé (TODO)');
                          }}
                        >
                          Enregistrer le planning
                        </button>
                        <button
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
                          onClick={exportIntelligentPlanningExcel}
                        >
                          Exporter Excel
                        </button>
                      </div>
                    </div>
                  )}

                  {planningData.length === 0 && planningErrors.length === 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                      Aucun site planifié.
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                    <div key={day} className="text-center font-bold text-gray-700 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
                    const days = [];

                    for (let i = 0; i < startDay; i++) {
                      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 rounded"></div>);
                    }

                    for (let day = 1; day <= lastDay.getDate(); day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const eventsForDay = getEventsForDay(dateStr);

                      const isToday = new Date().toISOString().split('T')[0] === dateStr;
                      const isSelected = selectedDate === dateStr;
                      const dow = new Date(`${dateStr}T00:00:00`).getDay();
                      const isWeekend = dow === 0 || dow === 6;

                      if (isWeekend) {
                        days.push(
                          <div
                            key={day}
                            className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full bg-slate-200/70 border-gray-300`}
                          />
                        );
                        continue;
                      }

                      days.push(
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const events = getEventsForDay(dateStr);
                            setSelectedDate(dateStr);
                            setSelectedDayEvents(events);
                            setShowDayDetailsModal(true);
                          }}
                          className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full hover:bg-gray-50 ${
                            isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                          } ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
                        >
                          <div className="text-sm font-semibold text-gray-700">{day}</div>
                          {eventsForDay.length > 0 && (
                            <div className="text-xs space-y-1 mt-1">
                              {eventsForDay.slice(0, 2).map((ev) => {
                                const daysUntil = getDaysUntil(dateStr);
                                const color = daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                                const st = String(ev?.intervention?.status || '');
                                const dot =
                                  st === 'done'
                                    ? 'bg-green-200'
                                    : st === 'sent'
                                      ? 'bg-blue-200'
                                      : st === 'planned'
                                        ? 'bg-amber-200'
                                        : 'bg-gray-200';
                                const moved = ev?.originalDate && String(ev.originalDate) !== String(ev.date);
                                return (
                                  <div key={`${ev.site.id}-${ev.type}`} className={`${color} text-white px-1 rounded flex items-start gap-1`}>
                                    <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                                    <span className="min-w-0 flex-1 whitespace-pre-line leading-tight break-words">{ev.site.nameSite}</span>
                                    {moved && <span className="ml-auto text-[10px] font-bold opacity-90">↔</span>}
                                  </div>
                                );
                              })}
                              {eventsForDay.length > 2 && <div className="text-gray-600 text-center">+{eventsForDay.length - 2}</div>}
                            </div>
                          )}
                        </button>
                      );
                    }

                    return days;
                  })()}
                </div>
              </div>

              <div className="mt-6 flex gap-4 justify-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Urgent (≤3j)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span>Bientôt (≤7j)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>OK (&gt;7j)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-white" />
      </div>
    </div>
    </div>
  );
};

export default CalendarModal;
