import React, { useState } from 'react';
import { Calendar, X, Users, MapPin, Clock, AlertCircle, Download, Sparkles, Activity } from 'lucide-react';
import * as XLSX from 'xlsx';
import { calculateEPVDates, calculateEstimatedNH } from '../utils/calculations';

const CalendarModal = (props) => {
  const {
    showCalendar,
    appVersion,
    isTechnician,
    setShowCalendar,
    currentMonth,
    setCurrentMonth,
    isAdmin,
    sites,
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
    setShowDayDetailsModal
  } = props;

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
    const nextDow = new Date(`${nextDay}T00:00:00Z`).getUTCDay();
    const weekendNext = nextDow === 0 || nextDow === 6;

    if (weekendNext) {
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

    const target = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const month = target.toISOString().slice(0, 7);
    const safeBase = `planning_intelligent_${month}`.replace(/[\\/:*?"<>|]+/g, '_');

    const rows = items.map((it) => ({
      Number: '',
      Site: String(it?.siteCode || ''),
      'Site Name': String(it?.siteName || ''),
      Region: String(it?.region || ''),
      Zone: String(it?.zone || ''),
      'Assigned to': String(it?.technician || ''),
      'Scheduled WO Date': String(it?.plannedDate || '').slice(0, 10),
      'Date of closing': '',
      State: String(it?.state || 'Planned'),
      Regime: String(it?.regime || ''),
      EPV: String(it?.maintenanceType || ''),
      'DG Service 2': String(it?.maintenanceType) === 'PM+Vidange' ? 'DG Service 2' : '',
      EPV2: String(it?.maintenanceType) === 'PM+Vidange' ? String(it?.epv2Date || '') : '',
      'DG Service 3': String(it?.maintenanceType) === 'PM+Vidange' ? 'DG Service 3' : '',
      EPV3: String(it?.maintenanceType) === 'PM+Vidange' ? String(it?.epv3Date || '') : '',
      Urgence: Number(it?.urgency || 0),
      Pair: String(it?.pairSiteCode || '')
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

    const candidates = [
      { type: 'EPV1', date: String(epv?.epv1 || '').slice(0, 10) },
      { type: 'EPV2', date: String(epv?.epv2 || '').slice(0, 10) },
      { type: 'EPV3', date: String(epv?.epv3 || '').slice(0, 10) }
    ].filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date));

    const shifted = candidates
      .map((c) => ({ ...c, date: ymdShiftForWorkdays(c.date) || c.date }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const inTarget = shifted.filter((c) => c.date.slice(0, 7) === targetMonthYyyyMm);
    const chosen = (inTarget[0] || null);
    const fallback = shifted[0] || null;

    const epv1Shifted = (shifted.find((c) => c.type === 'EPV1')?.date || '');
    const epv2Shifted = (shifted.find((c) => c.type === 'EPV2')?.date || '');
    const epv3Shifted = (shifted.find((c) => c.type === 'EPV3')?.date || '');
    const hasEpv1InTargetMonth = epv1Shifted ? epv1Shifted.slice(0, 7) === targetMonthYyyyMm : false;

    const maintenanceType = hasEpv1InTargetMonth ? 'PM+Vidange' : 'PM Simple';

    return {
      epv1: String(epv?.epv1 || '').slice(0, 10),
      epv2: String(epv?.epv2 || '').slice(0, 10),
      epv3: String(epv?.epv3 || '').slice(0, 10),
      epv1Shifted,
      epv2Shifted,
      epv3Shifted,
      epvType: chosen?.type || 'EPV1',
      targetDate: chosen?.date || '',
      orderDate: (chosen?.date || fallback?.date || ''),
      hasEpvInTargetMonth: inTarget.length > 0,
      hasEpv1InTargetMonth,
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
    
    try {
      const list = Array.isArray(sites) ? sites : [];
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

      const targetMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      const targetMonthYyyyMm = targetMonth.toISOString().slice(0, 7);
      const monthStartYmd = `${targetMonthYyyyMm}-01`;

      const monthEndYmd = (() => {
        const yy = Number(monthStartYmd.slice(0, 4));
        const mm = Number(monthStartYmd.slice(5, 7));
        if (!Number.isFinite(yy) || !Number.isFinite(mm)) return '';
        const d = new Date(Date.UTC(yy, mm, 0));
        return d.toISOString().slice(0, 10);
      })();
      
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
                
                groups.push({
                  type: 'pair',
                  sites: [site, pairedSite],
                  urgency: Math.max(Number(site._urgency || 0), Number(pairedSite._urgency || 0)),
                  targetDate: String(driver._epvOrderDate || ''),
                  driver
                });
                processed.add(siteId);
                processed.add(String(pairedSite.id));
              }
            } else {
              // Single site
              groups.push({
                type: 'single',
                sites: [site],
                urgency: Number(site._urgency || 0),
                targetDate: String(site._epvOrderDate || ''),
                driver: site
              });
              processed.add(siteId);
            }
          }
        });
        
        // Sort groups by EPV order date then urgency (the schedule date is assigned sequentially from month start)
        groups.sort((a, b) => {
          const aIn = a?.driver?._hasEpvInTargetMonth ? 1 : 0;
          const bIn = b?.driver?._hasEpvInTargetMonth ? 1 : 0;
          if (aIn !== bIn) return bIn - aIn;

          if (!aIn && !bIn) {
            const urg = Number(b?.urgency || 0) - Number(a?.urgency || 0);
            if (urg !== 0) return urg;
          }

          const ad = String(a?.targetDate || '').trim();
          const bd = String(b?.targetDate || '').trim();
          const aHas = /^\d{4}-\d{2}-\d{2}$/.test(ad) ? 1 : 0;
          const bHas = /^\d{4}-\d{2}-\d{2}$/.test(bd) ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          if (aHas && bHas) {
            const d1 = ad.localeCompare(bd);
            if (d1 !== 0) return d1;
          }

          return Number(b?.urgency || 0) - Number(a?.urgency || 0);
        });
        
        // Schedule groups (sequentially from month start)
        const usedCapacity = new Map(); // date -> used slots
        let cursorYmd = nextWorkdayForward(monthStartYmd);
        
        groups.forEach(group => {
          let plannedDate = '';
          let attempts = 0;
          const maxAttempts = 80;
          let currentYmd = cursorYmd;
          currentYmd = nextWorkdayForward(currentYmd) || currentYmd;
          
          while (!plannedDate && attempts < maxAttempts) {
            const dateStr = nextWorkdayForward(currentYmd);
            if (!dateStr) break;
            if (monthEndYmd && dateStr > monthEndYmd) break;
            const used = usedCapacity.get(dateStr) || 0;
            const needed = group.type === 'pair' ? 2 : 1;
            
            if (used + needed <= capacity) {
              plannedDate = dateStr;
              usedCapacity.set(dateStr, used + needed);
            } else {
              currentYmd = ymdAddDays(dateStr, 1);
              attempts++;
            }
          }

          if (!plannedDate && lastWorkdayOfMonthYmd) {
            const forcedUsed = usedCapacity.get(lastWorkdayOfMonthYmd) || 0;
            const forcedNeeded = group.type === 'pair' ? 2 : 1;
            plannedDate = lastWorkdayOfMonthYmd;
            usedCapacity.set(lastWorkdayOfMonthYmd, forcedUsed + forcedNeeded);
            localErrors.push(
              `Technicien ${techName}: capacité insuffisante sur ${targetMonthYyyyMm} ` +
                `(${capacity}/jour). Groupe forcé au ${lastWorkdayOfMonthYmd} (surbooking).`
            );
          }

          if (plannedDate) {
            cursorYmd = plannedDate;
            if ((usedCapacity.get(plannedDate) || 0) >= capacity) {
              cursorYmd = nextWorkdayForward(ymdAddDays(cursorYmd, 1));
            }
          }
          
          if (plannedDate) {
            group.sites.forEach(site => {
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
                plannedDate: plannedDate,
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
          }
        });

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

      const withNumbers = planning.map((it) => ({
        ...it,
        number: '',
        state: 'Planned'
      }));
      
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
            <div className="lg:w-[280px] w-full flex-shrink-0 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 text-white border-emerald-900/60 overflow-y-auto border-r-4 border-r-emerald-400/30">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-900/60">
                <Activity size={20} className="text-slate-100/90" />
                <div className="text-lg font-bold text-slate-100 leading-tight">Navigation</div>
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

                {isAdmin && (
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
                      (Array.isArray(users) ? users : []).filter((u) => u && u.role === 'technician').length === 0 && (
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

                {isAdmin && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
                    <div className="space-y-2">
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

              {showClustering && isAdmin && (
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

            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="bg-white border-b border-gray-200 shadow-sm px-4 py-3 sticky top-0 z-20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
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
                          const target = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
                          return `${planningData.length} sites planifiés • ${target.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
                        })()}
                      </div>
                      

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
                                  {item.maintenanceType === 'PM+Vidange' ? 'DG Service 2' : '—'}
                                </td>
                                <td className="p-2 border-b">
                                  {item.maintenanceType === 'PM+Vidange' ? (item.epv2Date || '—') : '—'}
                                </td>
                                <td className="p-2 border-b">
                                  {item.maintenanceType === 'PM+Vidange' ? 'DG Service 3' : '—'}
                                </td>
                                <td className="p-2 border-b">
                                  {item.maintenanceType === 'PM+Vidange' ? (item.epv3Date || '—') : '—'}
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
