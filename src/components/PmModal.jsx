import React from 'react';
import {
  TrendingUp,
  X,
  Upload,
  Download,
  Trash2,
  RotateCcw,
  Activity,
  Menu,
  ChevronLeft,
  ListChecks,
  BadgeCheck,
  Clock,
  UserCheck,
  Database,
  MapPin,
  CalendarDays,
  CalendarCheck2,
  CheckCircle2,
  Ban,
  Percent
} from 'lucide-react';
import TodayPlannedActivitiesModal from './TodayPlannedActivitiesModal';

const STHIC_LOGO_SRC = '/Logo_sthic.png';

const PmModal = (props) => {
  const {
    showPm,
    appVersion,
    canUsePm,
    isViewer,
    isAdmin,
    isManager,
    setShowPm,
    setPmError,
    setPmNotice,
    pmMonth,
    setPmMonth,
    refreshPmAll,
    pmBusy,
    handlePmExportExcel,
    pmReprogExportDate,
    setPmReprogExportDate,
    handlePmExportReprogExcel,
    exportBusy,
    users,
    pmSendTechUserId,
    setPmSendTechUserId,
    pmSendBusy,
    handleSendPmMonthPlanning,
    setPmRejectedDateFilter,
    setPmRejectedModalOpen,
    pmResetBusy,
    handlePmReset,
    handlePmNocImport,
    handlePmClientImport,
    handlePmGlobalImport,
    pmError,
    pmNotice,
    pmClientProgress,
    pmClientStep,
    pmClientCompare,
    pmGlobalProgress,
    pmGlobalStep,
    pmRetiredSites,
    pmItems,
    pmImports,
    pmTodayActivities,
    pmTodayActivitiesBusy,
    loadPmTodayActivities,
    pmSearch,
    setPmSearch,
    pmFilterFrom,
    setPmFilterFrom,
    pmFilterTo,
    setPmFilterTo,
    pmFilterState,
    setPmFilterState,
    pmFilterType,
    setPmFilterType,
    pmFilterZone,
    setPmFilterZone,
    pmFilterReprog,
    setPmFilterReprog,
    pmDetails,
    setPmDetails,
    pmRejectedModalOpen,
    pmRejectedDateFilter,
    pmReprogOpen,
    setPmReprogOpen,
    pmReprogItem,
    setPmReprogItem,
    pmReprogForm,
    setPmReprogForm,
    pmReprogError,
    setPmReprogError,
    pmReprogSaving,
    handlePmOpenReprog,
    handlePmSaveReprog,
    formatDate,
    authZone,
  } = props;

  const [pmRetiredSitesOpen, setPmRetiredSitesOpen] = React.useState(false);
  const [pmRetiredSitesZoneFilter, setPmRetiredSitesZoneFilter] = React.useState('ALL');
  const [pmPurgeOpen, setPmPurgeOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [pmPurgeBusy, setPmPurgeBusy] = React.useState(false);
  const [pmPurgeGlobal, setPmPurgeGlobal] = React.useState(false);
  const [pmPurgeClient, setPmPurgeClient] = React.useState(true);
  const [pmPurgeDryRun, setPmPurgeDryRun] = React.useState(true);
  const [pmPurgeZones, setPmPurgeZones] = React.useState([]);
  const [pmPurgeResult, setPmPurgeResult] = React.useState(null);
  const [pmTodayActivitiesOpen, setPmTodayActivitiesOpen] = React.useState(false);
  const [pmFilterPlannedDay, setPmFilterPlannedDay] = React.useState('');
  const [pmMonthlyRecapOpen, setPmMonthlyRecapOpen] = React.useState(false);
  const [pmRecapSitesOpen, setPmRecapSitesOpen] = React.useState(false);
  const [pmRecapSitesTitle, setPmRecapSitesTitle] = React.useState('');
  const [pmRecapSitesItems, setPmRecapSitesItems] = React.useState([]);

  const pmIsSuperAdmin = Boolean(props?.isSuperAdmin);

  React.useEffect(() => {
    if (!pmIsSuperAdmin) return;
    setPmPurgeZones((z) => {
      const cur = Array.isArray(z) ? z : [];
      if (cur.length > 0) return cur;
      return ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
    });
  }, [pmIsSuperAdmin]);

  const pmCallJson = async (url, options) => {
    if (typeof props?.apiFetchJson === 'function') {
      return await props.apiFetchJson(url, options);
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    };
    const res = await fetch(url, {
      method: options?.method || 'GET',
      credentials: 'same-origin',
      headers,
      body: options?.body
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error ? String(data.error) : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  };

  const pmEnsureMonthId = async (yyyymm) => {
    const m = String(yyyymm || '').trim();
    if (!m) throw new Error('Mois requis.');

    const list = await pmCallJson('/api/pm/months', { method: 'GET' });
    const months = Array.isArray(list?.months) ? list.months : [];
    const found = months.find((x) => String(x?.month || '').trim() === m) || null;
    const id = found?.id ? String(found.id) : '';
    if (!id) throw new Error(`Mois introuvable: ${m}`);
    return id;
  };

  const pmTogglePurgeZone = (zone) => {
    const z = String(zone || '').trim();
    if (!z) return;
    setPmPurgeZones((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(z)) return arr.filter((x) => x !== z);
      return [...arr, z];
    });
  };

  const pmRunPurge = async ({ dryRun }) => {
    if (!isAdmin) return;
    const purgeGlobal = Boolean(pmPurgeGlobal);
    const purgeClient = Boolean(pmPurgeClient);
    if (!purgeGlobal && !purgeClient) {
      setPmError('Veuillez sélectionner au moins une option de purge (client/global).');
      return;
    }

    setPmPurgeBusy(true);
    setPmError('');
    setPmNotice('');
    setPmPurgeResult(null);
    try {
      const monthId = await pmEnsureMonthId(pmMonth);
      const body = {
        purgeGlobal,
        purgeClient,
        dryRun: Boolean(dryRun)
      };
      if (pmIsSuperAdmin) {
        body.zones = Array.isArray(pmPurgeZones) ? pmPurgeZones : [];
      }

      const res = await pmCallJson(`/api/pm/months/${monthId}/purge-imports`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setPmPurgeResult(res || null);

      if (Boolean(res?.dryRun)) {
        setPmNotice(
          `🧪 Dry-run purge (${String(res?.month || pmMonth)}): Global plans ${Number(res?.preview?.pmGlobalPlans || 0)} • Global items ${Number(
            res?.preview?.pmGlobalPlanItems || 0
          )} • Client items ${Number(res?.preview?.pmClientItems || 0)} • NOC ${Number(res?.preview?.pmClientNocRows || 0)} • Assign. ${Number(
            res?.preview?.pmClientAssignments || 0
          )}`
        );
        return;
      }

      setPmNotice(
        `✅ Purge effectuée (${String(res?.month || pmMonth)}). Global plans ${Number(res?.deleted?.pmGlobalPlans || 0)} • Global items ${Number(
          res?.deleted?.pmGlobalPlanItems || 0
        )} • Client items ${Number(res?.deleted?.pmClientItems || 0)} • NOC ${Number(res?.deleted?.pmClientNocRows || 0)} • Assign. ${Number(
          res?.deleted?.pmClientAssignments || 0
        )}`
      );
      setPmPurgeOpen(false);
      await refreshPmAll(pmMonth);
    } catch (e) {
      setPmError(e?.message || 'Erreur lors de la purge.');
    } finally {
      setPmPurgeBusy(false);
    }
  };

  if (!showPm || !canUsePm) return null;

  const pmRetired = pmRetiredSites && typeof pmRetiredSites === 'object' ? pmRetiredSites : null;
  const pmRetiredScopeZones = Array.isArray(pmRetired?.scopeZones) ? pmRetired.scopeZones : [];
  const pmRetiredItemsAll = Array.isArray(pmRetired?.items) ? pmRetired.items : [];

  const allSites = Array.isArray(props?.sites) ? props.sites : [];

  const pmEffectiveRetiredZoneFilter = pmIsSuperAdmin ? String(pmRetiredSitesZoneFilter || 'ALL') : 'ALL';
  const pmRetiredItems =
    pmEffectiveRetiredZoneFilter && pmEffectiveRetiredZoneFilter !== 'ALL'
      ? pmRetiredItemsAll.filter((it) => String(it?.zone || '').trim() === pmEffectiveRetiredZoneFilter)
      : pmRetiredItemsAll;

  const normalizeYyyyMm = (v) => {
    const s = String(v || '').trim();
    if (!/^\d{4}-\d{2}$/.test(s)) return '';
    return s;
  };

  const yyyymmNow = (() => {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  })();

  const shiftYyyyMm = (yyyymm, deltaMonths) => {
    const s = normalizeYyyyMm(yyyymm);
    if (!s) return '';
    const [y, m] = s.split('-').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m)) return '';
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + Number(deltaMonths || 0));
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

  const recapMonth = normalizeYyyyMm(pmMonth);
  const recapMonthPrev = shiftYyyyMm(yyyymmNow, -1);
  const recapMonthNext = shiftYyyyMm(yyyymmNow, +1);
  const recapIsInAllowedWindow = Boolean(
    recapMonth && (recapMonth === recapMonthPrev || recapMonth === yyyymmNow || recapMonth === recapMonthNext)
  );

  const recapFullItemsAll = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
    const t = String(it?.maintenanceType || '').trim().toUpperCase();
    if (t !== 'FULLPMWO') return false;
    const m = String(it?.scheduledWoDate || '').slice(0, 7);
    if (recapMonth && m && m !== recapMonth) return false;
    if (isManager && !pmIsSuperAdmin && !isViewer) {
      const z = String(it?.zone || it?.region || '').trim();
      const az = String(authZone || '').trim();
      if (az) {
        if (!z) return false;
        if (z !== az) return false;
      }
    }
    return true;
  });

  const recapCountAssigned = recapFullItemsAll.filter((it) => {
    const st = String(it?.state || '').trim().toLowerCase();
    return st === 'assigned';
  }).length;

  const recapCanOpen = recapIsInAllowedWindow && recapCountAssigned === 0;

  const recapNormSiteCode = (v) => String(v || '').trim();
  const recapNormZone = (v) => String(v || '').trim();

  const recapIsItemInScope = (it) => {
    if (isManager && !pmIsSuperAdmin && !isViewer) {
      const z = recapNormZone(it?.zone || it?.region);
      const az = recapNormZone(authZone);
      if (az) {
        if (!z) return false;
        if (z !== az) return false;
      }
    }
    return true;
  };

  const recapSitesBaseInScope = (() => {
    const az = recapNormZone(authZone);
    const rows = (Array.isArray(allSites) ? allSites : []).filter(Boolean).map((s) => {
      const siteCode = recapNormSiteCode(s?.idSite || s?.siteId || s?.siteCode);
      const siteName = String(s?.nameSite || s?.siteName || '').trim();
      const zone = recapNormZone(s?.zone || s?.region);
      return { siteCode, siteName, zone };
    });
    const filtered =
      isManager && !pmIsSuperAdmin && !isViewer && az
        ? rows.filter((r) => r.zone && r.zone === az)
        : rows;
    const uniq = new Map();
    for (const r of filtered) {
      if (!r.siteCode) continue;
      if (!uniq.has(r.siteCode)) uniq.set(r.siteCode, r);
    }
    return Array.from(uniq.values()).sort((a, b) => String(a.siteCode).localeCompare(String(b.siteCode)));
  })();

  const recapSitesPlannedInScope = (() => {
    const uniq = new Map();
    for (const it of recapFullItemsAll) {
      const siteCode = recapNormSiteCode(it?.siteCode || it?.siteId);
      if (!siteCode) continue;
      if (uniq.has(siteCode)) continue;
      uniq.set(siteCode, {
        siteCode,
        siteName: String(it?.siteName || '').trim(),
        zone: recapNormZone(it?.zone || it?.region)
      });
    }
    return Array.from(uniq.values()).sort((a, b) => String(a.siteCode).localeCompare(String(b.siteCode)));
  })();

  const recapSitesRetiredInScope = (() => {
    if (recapSitesBaseInScope.length > 0) {
      const planned = new Set(recapSitesPlannedInScope.map((s) => recapNormSiteCode(s?.siteCode)).filter(Boolean));
      const out = [];
      for (const s of recapSitesBaseInScope) {
        const code = recapNormSiteCode(s?.siteCode);
        if (!code) continue;
        if (planned.has(code)) continue;
        out.push(s);
      }
      out.sort((a, b) => String(a.siteCode).localeCompare(String(b.siteCode)));
      return out;
    }

    const az = recapNormZone(authZone);
    const src = Array.isArray(pmRetiredItemsAll) ? pmRetiredItemsAll : [];
    const filtered = src.filter((r) => {
      const rr = { zone: r?.zone, region: r?.region };
      if (!recapIsItemInScope(rr)) return false;
      if (isManager && !pmIsSuperAdmin && !isViewer && az) {
        const z = recapNormZone(r?.zone || r?.region);
        if (!z) return false;
        if (z !== az) return false;
      }
      return true;
    });
    const uniq = new Map();
    for (const r of filtered) {
      const siteCode = recapNormSiteCode(r?.siteCode || r?.siteId);
      if (!siteCode) continue;
      if (uniq.has(siteCode)) continue;
      uniq.set(siteCode, {
        siteCode,
        siteName: String(r?.siteName || '').trim(),
        zone: recapNormZone(r?.zone || r?.region)
      });
    }
    return Array.from(uniq.values()).sort((a, b) => String(a.siteCode).localeCompare(String(b.siteCode)));
  })();

  const recapSitesRealizedInScope = (() => {
    const bySite = new Map();
    for (const it of recapFullItemsAll) {
      const siteCode = recapNormSiteCode(it?.siteCode || it?.siteId);
      if (!siteCode) continue;
      const cur = bySite.get(siteCode) || { any: false, anyAssigned: false, sample: it };
      cur.any = true;
      const st = String(it?.state || '').trim().toLowerCase();
      if (st === 'assigned') cur.anyAssigned = true;
      if (!cur.sample) cur.sample = it;
      bySite.set(siteCode, cur);
    }
    const out = [];
    for (const [siteCode, v] of bySite.entries()) {
      if (!v.any) continue;
      if (v.anyAssigned) continue;
      const it = v.sample || {};
      out.push({
        siteCode,
        siteName: String(it?.siteName || '').trim(),
        zone: recapNormZone(it?.zone || it?.region)
      });
    }
    out.sort((a, b) => String(a.siteCode).localeCompare(String(b.siteCode)));
    return out;
  })();

  const recapNormReprogStatus = (s) => {
    const v = String(s || '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'approved') return 'APPROVED';
    if (v === 'rejected') return 'REJECTED';
    if (v === 'pending') return 'PENDING';
    if (v === 'approved' || v === 'ok' || v === 'yes' || v === 'oui' || v === 'validee' || v === 'validée' || v === 'approuvee' || v === 'approuvée') return 'APPROVED';
    if (v === 'rejected' || v === 'ko' || v === 'no' || v === 'non' || v === 'rejete' || v === 'rejeté' || v === 'rejetee' || v === 'rejetée' || v === 'refusee' || v === 'refusée') return 'REJECTED';
    if (v === 'pending' || v === 'attente' || v === 'en attente' || v === 'waiting') return 'PENDING';
    return '';
  };

  const recapEffectiveReprogStatus = (it) => {
    const explicit = recapNormReprogStatus(it?.reprogrammationStatus);
    if (explicit) return explicit;
    const hasDate = !!String(it?.reprogrammationDate || '').trim();
    const hasReason = !!String(it?.reprogrammationReason || '').trim();
    if (hasDate) return 'APPROVED';
    if (hasReason) return 'PENDING';
    return '';
  };

  const recapSitesReprogRejectedInScope = (() => {
    const uniq = new Map();
    for (const it of recapFullItemsAll) {
      if (recapEffectiveReprogStatus(it) !== 'REJECTED') continue;
      const siteCode = recapNormSiteCode(it?.siteCode || it?.siteId);
      if (!siteCode) continue;
      if (uniq.has(siteCode)) continue;
      uniq.set(siteCode, {
        siteCode,
        siteName: String(it?.siteName || '').trim(),
        zone: recapNormZone(it?.zone || it?.region)
      });
    }
    return Array.from(uniq.values()).sort((a, b) => String(a.siteCode).localeCompare(String(b.siteCode)));
  })();

  const recapSitesReprogApprovedInScope = (() => {
    const uniq = new Map();
    for (const it of recapFullItemsAll) {
      if (recapEffectiveReprogStatus(it) !== 'APPROVED') continue;
      const siteCode = recapNormSiteCode(it?.siteCode || it?.siteId);
      if (!siteCode) continue;
      if (uniq.has(siteCode)) continue;
      uniq.set(siteCode, {
        siteCode,
        siteName: String(it?.siteName || '').trim(),
        zone: recapNormZone(it?.zone || it?.region)
      });
    }
    return Array.from(uniq.values()).sort((a, b) => String(a.siteCode).localeCompare(String(b.siteCode)));
  })();

  const recapOpenSites = (title, sites) => {
    setPmRecapSitesTitle(String(title || '').trim());
    setPmRecapSitesItems(Array.isArray(sites) ? sites : []);
    setPmRecapSitesOpen(true);
  };

  const recapRatio = (num, den) => {
    const n = Number(num || 0);
    const d = Number(den || 0);
    if (!d) return 0;
    return Math.round((n / d) * 1000) / 10;
  };

  const recapTrends = (() => {
    const month = recapMonth;
    if (!month) return { days: [], nonAssigned: [], approved: [], rejected: [] };
    const [y, m] = month.split('-').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m)) return { days: [], nonAssigned: [], approved: [], rejected: [] };
    const daysInMonth = new Date(y, m, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const nonAssigned = Array.from({ length: daysInMonth }, () => 0);
    const approved = Array.from({ length: daysInMonth }, () => 0);
    const rejected = Array.from({ length: daysInMonth }, () => 0);

    for (const it of recapFullItemsAll) {
      const sched = String(it?.scheduledWoDate || '').slice(0, 10);
      const day = Number(String(sched || '').slice(8, 10));
      if (!Number.isFinite(day) || day < 1 || day > daysInMonth) continue;
      const st = String(it?.state || '').trim().toLowerCase();
      if (st !== 'assigned') nonAssigned[day - 1] += 1;
      const rs = recapEffectiveReprogStatus(it);
      if (rs === 'APPROVED') approved[day - 1] += 1;
      if (rs === 'REJECTED') rejected[day - 1] += 1;
    }

    return { days, nonAssigned, approved, rejected };
  })();

  const RecapLineChart = ({ title, color, values }) => {
    const vals = Array.isArray(values) ? values : [];
    const w = 880;
    const h = 180;
    const pad = 18;
    const maxV = Math.max(1, ...vals.map((v) => Number(v || 0)));
    const points = vals
      .map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(1, vals.length - 1);
        const y = h - pad - (Number(v || 0) * (h - pad * 2)) / maxV;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <div className="border rounded-xl overflow-hidden bg-white">
        <div className="px-4 py-3 bg-slate-100 border-b text-sm font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp size={16} className="text-slate-700" />
          <div>{title}</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-600 mb-2">Max: {maxV}</div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[180px]">
            <rect x="0" y="0" width={w} height={h} fill="#ffffff" />
            <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  };

  const recapBucketForState = (state) => {
    const v = String(state || '').trim().toLowerCase();
    if (v === 'closed complete' || v === 'closed') return 'closed';
    if (v === 'awaiting closure' || v === 'awaiting') return 'awaiting';
    if (v === 'work in progress' || v === 'wip') return 'wip';
    if (v === 'assigned') return 'assigned';
    return 'other';
  };

  const recapNormReprogStatus = (s) => {
    const v = String(s || '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'approved') return 'APPROVED';
    if (v === 'rejected') return 'REJECTED';
    if (v === 'pending') return 'PENDING';
    if (v === 'approved' || v === 'ok' || v === 'yes' || v === 'oui' || v === 'validee' || v === 'validée' || v === 'approuvee' || v === 'approuvée') return 'APPROVED';
    if (v === 'rejected' || v === 'ko' || v === 'no' || v === 'non' || v === 'rejete' || v === 'rejeté' || v === 'rejetee' || v === 'rejetée' || v === 'refusee' || v === 'refusée') return 'REJECTED';
    if (v === 'pending' || v === 'attente' || v === 'en attente' || v === 'waiting') return 'PENDING';
    return '';
  };

  const recapEffectiveReprogStatus = (it) => {
    const explicit = recapNormReprogStatus(it?.reprogrammationStatus);
    if (explicit) return explicit;
    const hasDate = !!String(it?.reprogrammationDate || '').trim();
    const hasReason = !!String(it?.reprogrammationReason || '').trim();
    if (hasDate) return 'APPROVED';
    if (hasReason) return 'PENDING';
    return '';
  };

  const recapStats = (() => {
    const total = recapFullItemsAll.length;
    const byState = { closed: 0, awaiting: 0, wip: 0, assigned: 0, other: 0 };
    const byReprog = { APPROVED: 0, REJECTED: 0, PENDING: 0, NONE: 0 };
    const byZone = {};

    for (const it of recapFullItemsAll) {
      byState[recapBucketForState(it?.state)] = (byState[recapBucketForState(it?.state)] || 0) + 1;
      const r = recapEffectiveReprogStatus(it);
      if (!r) byReprog.NONE += 1;
      else byReprog[r] = (byReprog[r] || 0) + 1;

      const z = String(it?.zone || it?.region || '').trim() || '-';
      byZone[z] = (byZone[z] || 0) + 1;
    }

    const realized = byState.closed + byState.awaiting + byState.wip;
    const planned = total;
    const reprogAny = byReprog.APPROVED + byReprog.REJECTED + byReprog.PENDING;
    const penalised = byReprog.REJECTED;

    const zones = Object.entries(byZone)
      .sort((a, b) => b[1] - a[1])
      .map(([zone, count]) => ({ zone, count }));

    return {
      total,
      planned,
      realized,
      reprogAny,
      penalised,
      byState,
      byReprog,
      zones
    };
  })();

  return (
    <div className="fixed inset-0 bg-indigo-950/60 flex items-center justify-center z-50 p-0 sm:p-0">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-none sm:max-w-none sm:max-h-[100vh] sm:h-[100vh]">
        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row h-full min-h-0">
            {sidebarOpen && (
              <div className="lg:w-72 w-full flex-shrink-0 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 text-white border-indigo-900/60 border-b-4 border-b-sky-400/30 lg:border-b-0 lg:border-r-4 lg:border-r-sky-400/30 overflow-y-auto">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-900/60">
                  <Activity size={20} className="text-slate-100/90" />
                  <div className="text-lg font-bold text-slate-100 leading-tight">Navigation</div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="ml-auto p-2 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                    title="Masquer le menu"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Période</div>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-white/90 mb-1">Mois</label>
                      <input
                        type="month"
                        value={pmMonth}
                        onChange={async (e) => {
                          const next = String(e.target.value || '').trim();
                          setPmMonth(next);
                          await refreshPmAll(next);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                        disabled={pmBusy}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await refreshPmAll(pmMonth);
                      }}
                      className="w-full bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold"
                      disabled={pmBusy}
                    >
                      Rafraîchir
                    </button>

                    <button
                      type="button"
                      onClick={handlePmExportExcel}
                      className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                      disabled={pmBusy}
                    >
                      <Download size={16} />
                      Exporter Excel
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Exports</div>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-white/90 mb-1">Reprogrammations (jour)</label>
                      <input
                        type="date"
                        value={pmReprogExportDate}
                        onChange={(e) => setPmReprogExportDate(String(e.target.value || ''))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                        disabled={pmBusy}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePmExportReprogExcel}
                      className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                      disabled={pmBusy || exportBusy}
                    >
                      <Download size={16} />
                      Export reprogrammées
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Récapitulatif</div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setPmMonthlyRecapOpen(true)}
                      className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950 disabled:opacity-60 disabled:hover:bg-white/10"
                      disabled={pmBusy || !recapCanOpen}
                      title={
                        recapCanOpen
                          ? `Ouvrir le récap mensuel (${recapMonth || pmMonth})`
                          : `Disponible uniquement pour un mois terminé et sans tickets Assigned (reste: ${recapCountAssigned}).`
                      }
                    >
                      RECAP MENSUEL PM
                    </button>
                    {!recapCanOpen && (
                      <div className="text-[11px] text-white/70 leading-snug">
                        Condition: mois terminé + 0 Assigned (reste: {recapCountAssigned}).
                      </div>
                    )}
                  </div>
                </div>

                {(isAdmin || isManager) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Technicien</div>
                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-white/90 mb-1">Destinataire</label>
                        <select
                          value={pmSendTechUserId}
                          onChange={(e) => setPmSendTechUserId(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                          disabled={pmBusy || pmSendBusy}
                        >
                          <option value="">-- Technicien --</option>
                          {(Array.isArray(users) ? users : [])
                            .filter((u) => u && u.role === 'technician')
                            .filter((u) => (isManager ? String(u?.zone || '').trim() === String(authZone || '').trim() : true))
                            .slice()
                            .sort((a, b) => String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || '')))
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.technicianName || u.email}
                              </option>
                            ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendPmMonthPlanning}
                        className="w-full bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                        disabled={!pmSendTechUserId || pmBusy || pmSendBusy}
                      >
                        Envoyer planning PM
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPmRejectedDateFilter('');
                          setPmRejectedModalOpen(true);
                        }}
                        className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                        disabled={pmBusy}
                      >
                        Voir reprog rejetées
                      </button>

                      {(Array.isArray(users) ? users : [])
                        .filter((u) => u && u.role === 'technician')
                        .filter((u) => (isManager ? String(u?.zone || '').trim() === String(authZone || '').trim() : true)).length === 0 && (
                        <div className="text-xs text-white/70">
                          Aucun technicien trouvé.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(isAdmin || isManager) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
                    <div className="flex flex-col">
                      <label
                        className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                        }`}
                      >
                        <Upload size={16} />
                        Import NOC
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handlePmNocImport}
                          className="hidden"
                          disabled={pmBusy}
                        />
                      </label>

                      <label
                        className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                        }`}
                      >
                        <Upload size={16} />
                        Import retour client
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handlePmClientImport}
                          className="hidden"
                          disabled={pmBusy}
                        />
                      </label>

                      <label
                        className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                        }`}
                      >
                        <Upload size={16} />
                        Import planning PM global
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handlePmGlobalImport}
                          className="hidden"
                          disabled={pmBusy}
                        />
                      </label>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPmPurgeOpen((v) => !v)}
                            className="text-left px-3 py-2 rounded-lg hover:bg-white/10 font-semibold text-sm disabled:opacity-60 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                            disabled={pmBusy || pmPurgeBusy}
                          >
                            <Trash2 size={16} />
                            Purge imports (avancé)
                          </button>

                          {pmPurgeOpen && (
                            <div className="mx-3 my-2 p-3 rounded-lg border border-white/10 bg-white/5">
                              <div className="text-xs font-semibold text-white/90 mb-2">Options purge</div>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs text-white/90">
                                  <input
                                    type="checkbox"
                                    checked={pmPurgeClient}
                                    onChange={(e) => setPmPurgeClient(Boolean(e.target.checked))}
                                    disabled={pmBusy || pmPurgeBusy}
                                  />
                                  Purger retour client (pm_items + noc + assignments)
                                </label>
                                <label className="flex items-center gap-2 text-xs text-white/90">
                                  <input
                                    type="checkbox"
                                    checked={pmPurgeGlobal}
                                    onChange={(e) => setPmPurgeGlobal(Boolean(e.target.checked))}
                                    disabled={pmBusy || pmPurgeBusy}
                                  />
                                  Purger planning global (pm_global_plans + items)
                                </label>
                                <label className="flex items-center gap-2 text-xs text-white/90">
                                  <input
                                    type="checkbox"
                                    checked={pmPurgeDryRun}
                                    onChange={(e) => setPmPurgeDryRun(Boolean(e.target.checked))}
                                    disabled={pmBusy || pmPurgeBusy}
                                  />
                                  Mode dry-run (prévisualisation)
                                </label>

                                {pmIsSuperAdmin && (
                                  <div>
                                    <div className="text-[11px] font-semibold text-white/90 mb-1">Zones (super-admin)</div>
                                    <div className="flex flex-col gap-1">
                                      {['BZV/POOL', 'PNR/KOUILOU', 'UPCN'].map((z) => (
                                        <label key={z} className="flex items-center gap-2 text-xs text-white/90">
                                          <input
                                            type="checkbox"
                                            checked={(Array.isArray(pmPurgeZones) ? pmPurgeZones : []).includes(z)}
                                            onChange={() => pmTogglePurgeZone(z)}
                                            disabled={pmBusy || pmPurgeBusy}
                                          />
                                          {z}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {pmPurgeResult?.preview && (
                                  <div className="text-[11px] text-white/80">
                                    Aperçu: plans global {Number(pmPurgeResult?.preview?.pmGlobalPlans || 0)} • items global {Number(
                                      pmPurgeResult?.preview?.pmGlobalPlanItems || 0
                                    )} • items client {Number(pmPurgeResult?.preview?.pmClientItems || 0)} • noc {Number(
                                      pmPurgeResult?.preview?.pmClientNocRows || 0
                                    )} • assign. {Number(pmPurgeResult?.preview?.pmClientAssignments || 0)}
                                  </div>
                                )}

                                <div className="flex flex-col gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!pmPurgeDryRun) {
                                        const ok = window.confirm(
                                          `Confirmer la purge ?\n\nMois: ${pmMonth}\n\nCette action supprimera des données en base.`
                                        );
                                        if (!ok) return;
                                      }
                                      await pmRunPurge({ dryRun: pmPurgeDryRun });
                                    }}
                                    className="w-full bg-rose-600 text-white px-3 py-2 rounded-lg hover:bg-rose-700 text-sm font-semibold disabled:bg-white/10 disabled:text-white/60"
                                    disabled={pmBusy || pmPurgeBusy}
                                  >
                                    {pmPurgeDryRun ? 'Lancer dry-run' : 'Purger maintenant'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await pmRunPurge({ dryRun: true });
                                    }}
                                    className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                                    disabled={pmBusy || pmPurgeBusy}
                                  >
                                    Prévisualiser (dry-run)
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePmReset('imports')}
                            className="text-left px-3 py-2 rounded-lg hover:bg-white/10 font-semibold text-sm disabled:opacity-60 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                            disabled={pmBusy || pmResetBusy}
                          >
                            <Trash2 size={16} />
                            Suppr. imports
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePmReset('all')}
                            className="text-left px-3 py-2 rounded-lg hover:bg-white/10 font-semibold text-sm disabled:opacity-60 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                            disabled={pmBusy || pmResetBusy}
                          >
                            <RotateCcw size={16} />
                            Reset mois
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
                        className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        title="Afficher le menu"
                      >
                        <Menu size={20} className="text-gray-700" />
                      </button>
                    )}
                    <Activity className="text-blue-600" size={24} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-xl sm:text-2xl font-bold text-gray-800">Maintenances planifiées (PM)</div>
                        {isViewer && (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                            Lecture seule
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">Version {appVersion} - Suivi H24/7j avec Fiches</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowPm(false);
                      setPmError('');
                      setPmNotice('');
                    }}
                    className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <X size={20} className="text-gray-700" />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6">
              <div className="text-sm text-gray-700 mb-4">
                Tickets du mois: <span className="font-semibold">{Array.isArray(pmItems) ? pmItems.length : 0}</span>
              </div>

              <div className="mb-4 bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-semibold text-slate-900">Activités planifiées du jour</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPmTodayActivitiesOpen(true);
                        if (typeof loadPmTodayActivities === 'function') loadPmTodayActivities();
                      }}
                      className="text-xs font-semibold px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
                      disabled={pmBusy}
                      title="Ouvrir"
                    >
                      Ouvrir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof loadPmTodayActivities === 'function') loadPmTodayActivities();
                      }}
                      className="text-xs font-semibold px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                      disabled={pmBusy || pmTodayActivitiesBusy || typeof loadPmTodayActivities !== 'function'}
                      title={typeof loadPmTodayActivities === 'function' ? 'Rafraîchir' : 'Chargement non disponible'}
                    >
                      Rafraîchir
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-600">
                  {(() => {
                    const today = String(pmTodayActivities?.today || '').slice(0, 10);
                    const pmToday = Array.isArray(pmTodayActivities?.pmItems) ? pmTodayActivities.pmItems : [];
                    const intToday = Array.isArray(pmTodayActivities?.interventions) ? pmTodayActivities.interventions : [];
                    if (pmTodayActivitiesBusy) return 'Chargement…';
                    if (!pmTodayActivities) return 'Aucune activité chargée.';
                    return `Date: ${today || '-'} • PM: ${pmToday.length} • Vidanges: ${intToday.length}`;
                  })()}
                </div>
              </div>

              <TodayPlannedActivitiesModal
                open={pmTodayActivitiesOpen}
                onClose={() => setPmTodayActivitiesOpen(false)}
                busy={pmTodayActivitiesBusy}
                todayActivities={pmTodayActivities}
                onRefresh={(dateYmd) => {
                  if (typeof loadPmTodayActivities === 'function') loadPmTodayActivities(dateYmd);
                }}
              />

              {pmMonthlyRecapOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full h-[94vh] max-w-[98vw] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b bg-indigo-800 text-white">
                      <div className="font-bold">RECAP MENSUEL PM ({recapMonth || pmMonth})</div>
                      <button
                        type="button"
                        onClick={() => setPmMonthlyRecapOpen(false)}
                        className="hover:bg-indigo-900 p-2 rounded"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="p-4 overflow-auto">
                      <div className="mb-4">
                        <div className="text-xs text-slate-600">
                          Fenêtre: {recapMonthPrev} / {yyyymmNow} / {recapMonthNext} • Scope: {isManager && !pmIsSuperAdmin && !isViewer ? String(authZone || '').trim() || 'zone' : 'toutes zones'}
                        </div>
                      </div>

                      <div className="border rounded-xl overflow-hidden mb-5">
                        <div className="px-4 py-3 bg-slate-100 border-b text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <MapPin size={16} className="text-slate-700" />
                          <div>Section 1 — Sites (cartes cliquables)</div>
                        </div>

                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          <button
                            type="button"
                            className="border rounded-xl p-3 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-left"
                            onClick={() => recapOpenSites('Total sites en base', recapSitesBaseInScope)}
                            disabled={pmBusy || recapSitesBaseInScope.length === 0}
                            title={
                              recapSitesBaseInScope.length === 0
                                ? 'Liste des sites non disponible (props.sites manquant).'
                                : 'Clique pour voir la liste.'
                            }
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[11px] font-semibold text-indigo-900">Total sites de la zone en base</div>
                              <Database size={18} className="text-indigo-700 flex-shrink-0" />
                            </div>
                            <div className="text-2xl font-bold mt-1 text-indigo-900">{Number(recapSitesBaseInScope.length || 0)}</div>
                            <div className="text-[11px] mt-2 text-indigo-800">Clique pour voir les sites</div>
                          </button>

                          <button
                            type="button"
                            className="border rounded-xl p-3 bg-fuchsia-50 border-fuchsia-200 hover:bg-fuchsia-100 text-left"
                            onClick={() => recapOpenSites('Sites retirés pour la campagne', recapSitesRetiredInScope)}
                            disabled={pmBusy}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[11px] font-semibold text-fuchsia-900">Total sites retirés pour la campagne</div>
                              <Ban size={18} className="text-fuchsia-700 flex-shrink-0" />
                            </div>
                            <div className="text-2xl font-bold mt-1 text-fuchsia-900">{Number(recapSitesRetiredInScope.length || 0)}</div>
                            <div className="text-[11px] mt-2 text-fuchsia-800">Clique pour voir les sites</div>
                          </button>

                          <button
                            type="button"
                            className="border rounded-xl p-3 bg-sky-50 border-sky-200 hover:bg-sky-100 text-left"
                            onClick={() => recapOpenSites('Sites planifiés (FullPMWO)', recapSitesPlannedInScope)}
                            disabled={pmBusy}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[11px] font-semibold text-sky-900">Total sites planifiés pour le mois</div>
                              <CalendarDays size={18} className="text-sky-700 flex-shrink-0" />
                            </div>
                            <div className="text-2xl font-bold mt-1 text-sky-900">{Number(recapSitesPlannedInScope.length || 0)}</div>
                            <div className="text-[11px] mt-2 text-sky-800">Clique pour voir les sites</div>
                          </button>

                          <button
                            type="button"
                            className="border rounded-xl p-3 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-left"
                            onClick={() => recapOpenSites('Sites réalisés (0 Assigned)', recapSitesRealizedInScope)}
                            disabled={pmBusy}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[11px] font-semibold text-emerald-900">Total sites réalisés</div>
                              <CheckCircle2 size={18} className="text-emerald-700 flex-shrink-0" />
                            </div>
                            <div className="text-2xl font-bold mt-1 text-emerald-900">{Number(recapSitesRealizedInScope.length || 0)}</div>
                            <div className="text-[11px] mt-2 text-emerald-800">Clique pour voir les sites</div>
                          </button>

                          <button
                            type="button"
                            className="border rounded-xl p-3 bg-rose-50 border-rose-200 hover:bg-rose-100 text-left"
                            onClick={() => recapOpenSites('Sites reprogrammés (rejetés)', recapSitesReprogRejectedInScope)}
                            disabled={pmBusy}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[11px] font-semibold text-rose-900">Total sites reprogrammés (rejetés)</div>
                              <RotateCcw size={18} className="text-rose-700 flex-shrink-0" />
                            </div>
                            <div className="text-2xl font-bold mt-1 text-rose-900">{Number(recapSitesReprogRejectedInScope.length || 0)}</div>
                            <div className="text-[11px] mt-2 text-rose-800">Clique pour voir les sites</div>
                          </button>
                        </div>
                      </div>

                      <div className="border rounded-xl overflow-hidden mb-5">
                        <div className="px-4 py-3 bg-slate-100 border-b text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <Percent size={16} className="text-slate-700" />
                          <div>Section 2 — Taux de réalisation</div>
                        </div>

                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="border rounded-xl p-3 bg-emerald-50 border-emerald-200">
                            <div className="text-[11px] font-semibold text-emerald-900">Taux réalisation (sites)</div>
                            <div className="text-2xl font-bold mt-1 text-emerald-900">
                              {recapRatio(recapSitesRealizedInScope.length, recapSitesPlannedInScope.length)}%
                            </div>
                            <div className="text-[11px] mt-2 text-emerald-800">
                              {Number(recapSitesRealizedInScope.length || 0)} / {Number(recapSitesPlannedInScope.length || 0)}
                            </div>
                          </div>

                          <div className="border rounded-xl p-3 bg-sky-50 border-sky-200">
                            <div className="text-[11px] font-semibold text-sky-900">Reprog approuvées (sites)</div>
                            <div className="text-2xl font-bold mt-1 text-sky-900">
                              {recapRatio(recapSitesReprogApprovedInScope.length, recapSitesPlannedInScope.length)}%
                            </div>
                            <div className="text-[11px] mt-2 text-sky-800">
                              {Number(recapSitesReprogApprovedInScope.length || 0)} / {Number(recapSitesPlannedInScope.length || 0)}
                            </div>
                          </div>

                          <div className="border rounded-xl p-3 bg-rose-50 border-rose-200">
                            <div className="text-[11px] font-semibold text-rose-900">Reprog rejetées (sites)</div>
                            <div className="text-2xl font-bold mt-1 text-rose-900">
                              {recapRatio(recapSitesReprogRejectedInScope.length, recapSitesPlannedInScope.length)}%
                            </div>
                            <div className="text-[11px] mt-2 text-rose-800">
                              {Number(recapSitesReprogRejectedInScope.length || 0)} / {Number(recapSitesPlannedInScope.length || 0)}
                            </div>
                          </div>

                          <div className="border rounded-xl p-3 bg-violet-50 border-violet-200">
                            <div className="text-[11px] font-semibold text-violet-900">Assigned restant (tickets)</div>
                            <div className="text-2xl font-bold mt-1 text-violet-900">{Number(recapCountAssigned || 0)}</div>
                            <div className="text-[11px] mt-2 text-violet-800">Doit être 0 pour autoriser l’ouverture</div>
                          </div>
                        </div>
                      </div>

                      <div className="border rounded-xl overflow-hidden mb-5">
                        <div className="px-4 py-3 bg-slate-100 border-b text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <CalendarCheck2 size={16} className="text-slate-700" />
                          <div>Section 3 — Tendances (tickets)</div>
                        </div>
                        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <RecapLineChart title="Tickets non-Assigned (par jour planifié)" color="#059669" values={recapTrends.nonAssigned} />
                          <div className="grid grid-cols-1 gap-4">
                            <RecapLineChart title="Reprogrammations APPROVED (par jour planifié)" color="#0284c7" values={recapTrends.approved} />
                            <RecapLineChart title="Reprogrammations REJECTED (par jour planifié)" color="#e11d48" values={recapTrends.rejected} />
                          </div>
                        </div>
                      </div>

                      <div className="border rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-slate-100 border-b text-sm font-semibold text-slate-900">Répartition par zone (tickets FullPMWO)</div>
                        <div className="p-4">
                          {(Array.isArray(recapStats?.zones) ? recapStats.zones : []).length === 0 ? (
                            <div className="text-sm text-slate-600">Aucune donnée.</div>
                          ) : (
                            <div className="space-y-2">
                              {(Array.isArray(recapStats?.zones) ? recapStats.zones : []).map((z) => (
                                <div key={z.zone} className="flex items-center gap-3">
                                  <div className="w-44 text-sm font-semibold text-slate-900 truncate" title={String(z.zone || '')}>
                                    {z.zone}
                                  </div>
                                  <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden">
                                    <div
                                      className="h-2 bg-indigo-600"
                                      style={{ width: `${Math.round((Number(z.count || 0) / Math.max(1, Number(recapStats?.total || 0))) * 100)}%` }}
                                    />
                                  </div>
                                  <div className="w-16 text-right text-sm text-slate-700">{Number(z.count || 0)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {pmMonthlyRecapOpen && pmRecapSitesOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full h-[90vh] max-w-[95vw] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b bg-slate-900 text-white">
                      <div className="font-bold">Sites — {pmRecapSitesTitle || ''}</div>
                      <button
                        type="button"
                        onClick={() => setPmRecapSitesOpen(false)}
                        className="hover:bg-slate-800 p-2 rounded"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-4 overflow-auto">
                      <table className="min-w-[900px] w-full text-sm">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                          <tr className="text-left text-xs text-slate-800 border-b border-slate-300">
                            <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                            <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                            <th className="px-3 py-2 font-semibold whitespace-nowrap">Site Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(pmRecapSitesItems) ? pmRecapSitesItems : []).length === 0 ? (
                            <tr>
                              <td className="px-4 py-4 text-gray-600" colSpan={3}>
                                Aucun site.
                              </td>
                            </tr>
                          ) : (
                            (Array.isArray(pmRecapSitesItems) ? pmRecapSitesItems : []).map((it, idx) => (
                              <tr
                                key={`${it?.siteCode || 'site'}-${idx}`}
                                className={`border-b border-slate-200 hover:bg-slate-100/60 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}
                              >
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.zone || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap font-semibold">{it?.siteCode || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[520px] whitespace-pre-line leading-tight break-words">{it?.siteName || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {pmError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {pmError}
                </div>
              )}

              {pmNotice && !pmError && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-3 rounded-lg text-sm">
                  {pmNotice}
                </div>
              )}

              {pmClientProgress > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-700 mb-1">Import retour client: {pmClientStep || '…'}</div>
                  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2" style={{ width: `${pmClientProgress}%` }} />
                  </div>
                </div>
              )}

              {pmGlobalProgress > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-700 mb-1">Import planning PM global: {pmGlobalStep || '…'}</div>
                  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2" style={{ width: `${pmGlobalProgress}%` }} />
                  </div>

                </div>
              )}

              {pmRetired && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <TrendingUp size={16} className="text-fuchsia-700" />
                      Sites retirés pour la campagne ({pmRetired.month})
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!pmIsSuperAdmin) {
                          setPmRetiredSitesZoneFilter('ALL');
                        }
                        setPmRetiredSitesOpen(true);
                      }}
                      className="text-xs font-semibold px-2 py-1 rounded border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100 disabled:opacity-60"
                      disabled={pmBusy}
                      title={
                        isAdmin
                          ? 'Voir la liste des sites retirés.'
                          : isManager
                            ? `Voir la liste des sites retirés (${String(authZone || '').trim() || 'zone'}).`
                            : 'Voir la liste des sites retirés.'
                      }
                    >
                      Détails ({Number(pmRetired.total || 0)})
                    </button>
                  </div>
                </div>
              )}

              {pmRetired && pmRetiredSitesOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center p-4 border-b bg-fuchsia-800 text-white">
                      <div className="font-bold">Sites retirés pour la campagne ({pmRetired.month})</div>
                      <button
                        type="button"
                        onClick={() => setPmRetiredSitesOpen(false)}
                        className="hover:bg-fuchsia-900 p-2 rounded"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {pmIsSuperAdmin && pmRetiredScopeZones.length > 0 && (
                      <div className="p-3 border-b bg-fuchsia-50 flex flex-wrap gap-2 items-center">
                        <div className="text-xs font-semibold text-fuchsia-900 mr-1">Filtre zone:</div>
                        <button
                          type="button"
                          onClick={() => setPmRetiredSitesZoneFilter('ALL')}
                          className={`text-xs font-semibold px-2 py-1 rounded border ${
                            pmRetiredSitesZoneFilter === 'ALL'
                              ? 'border-fuchsia-300 bg-white text-fuchsia-900'
                              : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100'
                          }`}
                        >
                          Toutes ({Number(pmRetired.total || 0)})
                        </button>
                        {pmRetiredScopeZones.map((z) => (
                          <button
                            key={z}
                            type="button"
                            onClick={() => setPmRetiredSitesZoneFilter(z)}
                            className={`text-xs font-semibold px-2 py-1 rounded border ${
                              pmRetiredSitesZoneFilter === z
                                ? 'border-fuchsia-300 bg-white text-fuchsia-900'
                                : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100'
                            }`}
                          >
                            {z} ({Number(pmRetired?.byZone?.[z] || 0)})
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="p-4 overflow-auto">
                      <table className="min-w-[800px] w-full text-sm">
                        <thead className="bg-fuchsia-50 sticky top-0 z-10">
                          <tr className="text-left text-xs text-fuchsia-900 border-b border-fuchsia-200">
                            <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                            <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                            <th className="px-3 py-2 font-semibold whitespace-nowrap">Site Name</th>
                            <th className="px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pmRetiredItems.length === 0 ? (
                            <tr>
                              <td className="px-4 py-4 text-gray-600" colSpan={4}>
                                Aucun site.
                              </td>
                            </tr>
                          ) : (
                            pmRetiredItems.map((it, idx) => (
                              <tr
                                key={`${it?.siteCode || 'site'}-${idx}`}
                                className={`border-b border-fuchsia-100 hover:bg-fuchsia-50/60 ${idx % 2 === 1 ? 'bg-white' : 'bg-fuchsia-50/40'}`}
                              >
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.zone || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap font-semibold">{it?.siteCode || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[360px] whitespace-pre-line leading-tight break-words">{it?.siteName || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.maintenanceType || 'FullPMWO'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}



              {(() => {
            const items = Array.isArray(pmItems) ? pmItems : [];
            const imports = Array.isArray(pmImports) ? pmImports : [];

            const norm = (s) => String(s || '').trim().toLowerCase();
            const bucketForState = (state) => {
              const v = norm(state);
              if (v === 'closed complete' || v === 'closed') return 'closed';
              if (v === 'awaiting closure' || v === 'awaiting') return 'awaiting';
              if (v === 'work in progress' || v === 'wip') return 'wip';
              if (v === 'assigned') return 'assigned';
              return 'assigned';
            };

            const normalizeYmd = (ymd) => {
              if (!ymd) return '';
              return String(ymd).slice(0, 10);
            };

            const stateLabel = (state) => {
              const raw = String(state || '').trim();
              const v = norm(raw);
              if (v === 'closed complete' || v === 'closed') return 'Closed Complete';
              if (v === 'work in progress' || v === 'wip') return 'Work in progress';
              if (v === 'awaiting closure' || v === 'awaiting') return 'Awaiting Closure';
              if (v === 'assigned') return 'Assigned';
              return raw || 'Assigned';
            };

            const uniqueSorted = (vals) => {
              const set = new Set(vals.map((v) => String(v || '').trim()).filter(Boolean));
              return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
            };

            const typeOptions = uniqueSorted(items.map((it) => it?.maintenanceType));
            const zoneOptions = uniqueSorted(items.map((it) => it?.zone));

            const search = String(pmSearch || '').trim().toLowerCase();
            const dateFrom = normalizeYmd(pmFilterFrom);
            const dateTo = normalizeYmd(pmFilterTo);
            const plannedDay = normalizeYmd(pmFilterPlannedDay);
            const reprogFilter = String(pmFilterReprog || 'all');

            const normReprogStatus = (s) => {
              const v = String(s || '').trim().toLowerCase();
              if (!v) return '';
              if (v === 'approved') return 'APPROVED';
              if (v === 'rejected') return 'REJECTED';
              if (v === 'pending') return 'PENDING';
              if (v === 'approved' || v === 'ok' || v === 'yes' || v === 'oui' || v === 'validee' || v === 'validée' || v === 'approuvee' || v === 'approuvée') {
                return 'APPROVED';
              }
              if (v === 'rejected' || v === 'ko' || v === 'no' || v === 'non' || v === 'rejete' || v === 'rejeté' || v === 'rejetee' || v === 'rejetée' || v === 'refusee' || v === 'refusée') {
                return 'REJECTED';
              }
              if (v === 'pending' || v === 'attente' || v === 'en attente' || v === 'waiting') return 'PENDING';
              return '';
            };

            const effectiveReprogStatus = (it) => {
              const explicit = normReprogStatus(it?.reprogrammationStatus);
              if (explicit) return explicit;
              const hasDate = !!String(it?.reprogrammationDate || '').trim();
              const hasReason = !!String(it?.reprogrammationReason || '').trim();
              if (hasDate) return 'APPROVED';
              if (hasReason) return 'PENDING';
              return '';
            };

            const baseFiltered = items.filter((it) => {
              if (pmFilterType && pmFilterType !== 'all') {
                if (String(it?.maintenanceType || '').trim() !== String(pmFilterType)) return false;
              }
              if (pmFilterZone && pmFilterZone !== 'all') {
                if (String(it?.zone || '').trim() !== String(pmFilterZone)) return false;
              }
              if (plannedDay) {
                const sched = normalizeYmd(it?.scheduledWoDate);
                if (sched !== plannedDay) return false;
              } else {
                if (dateFrom) {
                  const sched = normalizeYmd(it?.scheduledWoDate);
                  if (sched && sched < dateFrom) return false;
                }
                if (dateTo) {
                  const sched = normalizeYmd(it?.scheduledWoDate);
                  if (sched && sched > dateTo) return false;
                }
              }
              if (reprogFilter && reprogFilter !== 'all') {
                const st = effectiveReprogStatus(it);
                if (reprogFilter === 'any' && !st) return false;
                if (reprogFilter === 'approved' && st !== 'APPROVED') return false;
                if (reprogFilter === 'rejected' && st !== 'REJECTED') return false;
                if (reprogFilter === 'pending' && st !== 'PENDING') return false;
              }
              if (search) {
                const hay = [
                  it?.number,
                  it?.siteName,
                  it?.siteCode,
                  it?.region,
                  it?.zone,
                  it?.maintenanceType,
                  it?.assignedTo,
                  it?.shortDescription,
                  it?.reprogrammationReason,
                  it?.reprogrammationStatus
                ]
                  .map((v) => String(v || '').toLowerCase())
                  .join(' ');
                if (!hay.includes(search)) return false;
              }
              return true;
            });

            const tableFiltered = baseFiltered.filter((it) => {
              if (pmFilterState && pmFilterState !== 'all') {
                if (bucketForState(it?.state) !== pmFilterState) return false;
              }
              return true;
            });

            const badgeForBucket = (bucket) => {
              if (bucket === 'closed') return { cls: 'bg-sky-50 text-sky-800 border-sky-200' };
              if (bucket === 'wip') return { cls: 'bg-blue-50 text-blue-800 border-blue-200' };
              if (bucket === 'awaiting') return { cls: 'bg-amber-50 text-amber-800 border-amber-200' };
              return { cls: 'bg-slate-50 text-slate-800 border-slate-200' };
            };

            const counts = {
              total: baseFiltered.length,
              closed: 0,
              wip: 0,
              awaiting: 0,
              assigned: 0,
              reprog: 0
            };
            for (const it of baseFiltered) {
              const b = bucketForState(it?.state);
              if (b === 'closed') counts.closed += 1;
              else if (b === 'wip') counts.wip += 1;
              else if (b === 'awaiting') counts.awaiting += 1;
              else counts.assigned += 1;

              if (effectiveReprogStatus(it)) counts.reprog += 1;
            }

            const cards = [
              {
                key: 'total',
                title: 'Total',
                value: Number(counts.total || 0),
                className: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
                titleClassName: 'text-indigo-900',
                valueClassName: 'text-indigo-900',
                hintClassName: 'text-indigo-800',
                Icon: ListChecks,
                iconClassName: 'text-indigo-700',
                onClick: () => {
                  setPmFilterState('all');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Total', items: baseFiltered.slice() });
                }
              },
              {
                key: 'closed',
                title: 'Closed Complete',
                value: Number(counts.closed || 0),
                className: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
                titleClassName: 'text-indigo-900',
                valueClassName: 'text-indigo-900',
                hintClassName: 'text-indigo-800',
                Icon: BadgeCheck,
                iconClassName: 'text-indigo-700',
                onClick: () => {
                  setPmFilterState('closed');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Closed Complete', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'closed') });
                }
              },
              {
                key: 'wip',
                title: 'Work in progress',
                value: Number(counts.wip || 0),
                className: 'bg-sky-50 border-sky-200 hover:bg-sky-100',
                titleClassName: 'text-sky-900',
                valueClassName: 'text-sky-900',
                hintClassName: 'text-sky-800',
                Icon: Activity,
                iconClassName: 'text-sky-700',
                onClick: () => {
                  setPmFilterState('wip');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Work in progress', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'wip') });
                }
              },
              {
                key: 'awaiting',
                title: 'Awaiting Closure',
                value: Number(counts.awaiting || 0),
                className: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
                titleClassName: 'text-amber-900',
                valueClassName: 'text-amber-900',
                hintClassName: 'text-amber-800',
                Icon: Clock,
                iconClassName: 'text-amber-700',
                onClick: () => {
                  setPmFilterState('awaiting');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Awaiting Closure', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'awaiting') });
                }
              },
              {
                key: 'assigned',
                title: 'Assigned',
                value: Number(counts.assigned || 0),
                className: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
                titleClassName: 'text-violet-900',
                valueClassName: 'text-violet-900',
                hintClassName: 'text-violet-800',
                Icon: UserCheck,
                iconClassName: 'text-violet-700',
                onClick: () => {
                  setPmFilterState('assigned');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Assigned', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'assigned') });
                }
              },
              {
                key: 'reprog',
                title: 'Reprogrammation',
                value: Number(counts.reprog || 0),
                className: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
                titleClassName: 'text-slate-900',
                valueClassName: 'text-slate-900',
                hintClassName: 'text-slate-700',
                Icon: RotateCcw,
                iconClassName: 'text-slate-700',
                onClick: () => {
                  setPmFilterState('all');
                  setPmFilterReprog('any');
                  setPmDetails({ open: true, title: 'Reprogrammation', items: baseFiltered.filter((it) => effectiveReprogStatus(it)) });
                }
              }
            ];

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                  {cards.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={c.onClick}
                      className={`${c.className} border rounded-xl p-3 text-left`}
                      disabled={pmBusy}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className={`text-[11px] font-semibold ${c.titleClassName || 'text-gray-700'}`}>{c.title}</div>
                        {c.Icon ? <c.Icon size={18} className={`${c.iconClassName || 'text-slate-600'} flex-shrink-0`} /> : null}
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${c.valueClassName || 'text-gray-900'}`}>{c.value}</div>
                      <div className={`text-[11px] mt-2 ${c.hintClassName || 'text-gray-600'}`}>Clique pour voir les sites</div>
                    </button>
                  ))}
                </div>

                {pmDetails?.open && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
                      <div className="flex justify-between items-center p-4 border-b bg-indigo-800 text-white">
                        <div className="font-bold">Détails PM — {pmDetails?.title || ''}</div>
                        <button
                          type="button"
                          onClick={() => setPmDetails({ open: false, title: '', items: [] })}
                          className="hover:bg-indigo-900 p-2 rounded"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="p-4 overflow-auto">
                        <table className="min-w-[1100px] w-full text-sm">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr className="text-left text-xs text-slate-800 border-b border-slate-300">
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Ticket</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">État</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Date planifiée</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Assigné à</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Statut reprog.</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Date reprog.</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Raison</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Array.isArray(pmDetails?.items) ? pmDetails.items : []).length === 0 ? (
                              <tr>
                                <td className="px-4 py-4 text-gray-600" colSpan={10}>
                                  Aucun élément.
                                </td>
                              </tr>
                            ) : (
                              (Array.isArray(pmDetails?.items) ? pmDetails.items : []).map((it, idx) => {
                                const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                                const reprogStatus = effectiveReprogStatus(it);
                                const reprog = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
                                const reason = String(it?.reprogrammationReason || '').trim();
                                const siteLabel = [it?.siteName, it?.siteCode].filter(Boolean).join('\n');
                                const st = stateLabel(it?.state);
                                return (
                                  <tr key={it?.id || it?.number || idx} className={`border-b border-slate-200 hover:bg-slate-100/60 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">{it?.number || '-'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{st || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{sched || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 max-w-[260px] whitespace-pre-line leading-tight break-words" title={siteLabel || ''}>{siteLabel || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.zone || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.maintenanceType || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 max-w-[200px] truncate" title={String(it?.assignedTo || '')}>{it?.assignedTo || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprogStatus || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprog || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 max-w-[260px] truncate" title={reason || ''}>{reason || '-'}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {pmRejectedModalOpen && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
                      <div className="flex justify-between items-center p-4 border-b bg-indigo-800 text-white">
                        <div className="font-bold">Reprogrammations rejetées</div>
                        <button
                          type="button"
                          onClick={() => {
                            setPmRejectedModalOpen(false);
                            setPmRejectedDateFilter('');
                          }}
                          className="hover:bg-indigo-900 p-2 rounded"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="p-4 overflow-auto">
                        <div className="mb-3 flex flex-col sm:flex-row sm:items-end gap-3">
                          <div className="flex flex-col">
                            <label className="text-xs font-semibold text-gray-700 mb-1">Filtrer par jour (date reprog.)</label>
                            <input
                              type="date"
                              value={pmRejectedDateFilter}
                              onChange={(e) => setPmRejectedDateFilter(String(e.target.value || ''))}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        {(() => {
                          const day = normalizeYmd(pmRejectedDateFilter);
                          const rejected = (Array.isArray(pmItems) ? pmItems : [])
                            .filter((it) => {
                              if (!it) return false;
                              if (effectiveReprogStatus(it) !== 'REJECTED') return false;
                              if (day) return normalizeYmd(it?.reprogrammationDate) === day;
                              return true;
                            })
                            .slice()
                            .sort((a, b) => {
                              const da = String(a?.reprogrammationDate || '').slice(0, 10);
                              const db = String(b?.reprogrammationDate || '').slice(0, 10);
                              const d = da.localeCompare(db);
                              if (d !== 0) return d;
                              return String(a?.number || '').localeCompare(String(b?.number || ''));
                            });
                          if (rejected.length === 0) {
                            return <div className="text-gray-600">Aucune reprogrammation rejetée.</div>;
                          }
                          return (
                            <table className="min-w-[1100px] w-full text-sm">
                              <thead className="bg-slate-100 sticky top-0 z-10">
                                <tr className="text-left text-xs text-slate-800 border-b border-slate-300">
                                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Ticket</th>
                                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Date planifiée</th>
                                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Date reprog.</th>
                                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Assigné à</th>
                                  <th className="px-3 py-2 font-semibold whitespace-nowrap">Raison</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rejected.map((it, idx) => {
                                  const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                                  const reprog = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
                                  const reason = String(it?.reprogrammationReason || '').trim();
                                  const siteLabel = [it?.siteName, it?.siteCode].filter(Boolean).join('\n');
                                  return (
                                    <tr key={it?.id || it?.number || idx} className={`border-b border-slate-200 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}>
                                      <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">{it?.number || '-'}</td>
                                      <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{sched || '-'}</td>
                                      <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprog || '-'}</td>
                                      <td className="px-3 py-2 text-slate-900 max-w-[320px] whitespace-pre-line leading-tight break-words" title={siteLabel || ''}>{siteLabel || '-'}</td>
                                      <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.maintenanceType || '-'}</td>
                                      <td className="px-3 py-2 text-slate-900 max-w-[200px] truncate" title={String(it?.assignedTo || '')}>{it?.assignedTo || '-'}</td>
                                      <td className="px-3 py-2 text-slate-900 max-w-[320px] truncate" title={reason || ''}>{reason || '-'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-5 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">État</label>
                      <select
                        value={pmFilterState}
                        onChange={(e) => setPmFilterState(String(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Tous</option>
                        <option value="closed">Closed Complete</option>
                        <option value="wip">Work in progress</option>
                        <option value="awaiting">Awaiting Closure</option>
                        <option value="assigned">Assigned</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                      <select
                        value={pmFilterType}
                        onChange={(e) => setPmFilterType(String(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Tous</option>
                        {typeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Zone</label>
                      <select
                        value={pmFilterZone}
                        onChange={(e) => setPmFilterZone(String(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Toutes</option>
                        {zoneOptions.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Recherche</label>
                      <input
                        value={pmSearch}
                        onChange={(e) => setPmSearch(e.target.value)}
                        placeholder="Ticket, site, zone, technicien…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Du</label>
                      <input
                        type="date"
                        value={pmFilterFrom}
                        onChange={(e) => setPmFilterFrom(String(e.target.value || ''))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Au</label>
                      <input
                        type="date"
                        value={pmFilterTo}
                        onChange={(e) => setPmFilterTo(String(e.target.value || ''))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Reprogrammation</label>
                      <select
                        value={pmFilterReprog}
                        onChange={(e) => setPmFilterReprog(String(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Toutes</option>
                        <option value="any">Toute reprogrammation</option>
                        <option value="pending">En attente</option>
                        <option value="approved">Approuvée</option>
                        <option value="rejected">Rejetée</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1 whitespace-nowrap">Date planifiée du jour</label>
                      <input
                        type="date"
                        value={pmFilterPlannedDay}
                        onChange={(e) => {
                          const d = String(e.target.value || '').slice(0, 10);
                          setPmFilterPlannedDay(d);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                        title="Choisir un jour (Scheduled WO Date)"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3">
                    <div className="text-xs text-gray-600">
                      {(() => {
                        const nocCount = (Array.isArray(items) ? items : []).filter((it) => String(it?.createdSource || '') === 'noc').length;
                        return (
                          <>
                            Affichés: <span className="font-semibold text-gray-900">{tableFiltered.length}</span> / {items.length}
                            {nocCount > 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                NOC: {nocCount}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPmFilterState('all');
                        setPmFilterType('all');
                        setPmFilterZone('all');
                        setPmSearch('');
                        setPmFilterPlannedDay('');
                        setPmFilterFrom('');
                        setPmFilterTo('');
                        setPmFilterReprog('all');
                      }}
                      className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                      disabled={pmBusy}
                    >
                      Réinitialiser filtres
                    </button>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-800">Tickets</div>
                    <div className="text-xs text-gray-600">Tri: date planifiée puis ticket</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-[1100px] w-full text-sm">
                      <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr className="text-left text-xs text-slate-800 border-b border-slate-300">
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Ticket</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">État</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Date planifiée</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Assigné à</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Clôture</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Statut reprog.</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Date reprog.</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Raison</th>
                          {(isAdmin || isManager) && <th className="px-3 py-2 font-semibold whitespace-nowrap">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {tableFiltered.length === 0 ? (
                          <tr>
                            <td className="px-4 py-4 text-gray-600" colSpan={isAdmin ? 12 : 11}>
                              Aucun ticket pour ces filtres.
                            </td>
                          </tr>
                        ) : (
                          tableFiltered.map((it, idx) => {
                            const bucket = bucketForState(it?.state);
                            const badge = badgeForBucket(bucket);
                            const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                            const closed = it?.closedAt ? String(it.closedAt).slice(0, 10) : '';
                            const reprogStatus = effectiveReprogStatus(it);
                            const reprog = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
                            const reason = String(it?.reprogrammationReason || '').trim();
                            const siteLabel = [it?.siteName, it?.siteCode].filter(Boolean).join('\n');
                            const st = stateLabel(it?.state);
                            return (
                              <tr key={it?.id || it?.number} className={`border-b border-slate-200 hover:bg-slate-100/60 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}>
                                <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">{it?.number || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`inline-flex items-center border px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                                    {st}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{sched || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[260px] whitespace-pre-line leading-tight break-words" title={siteLabel || ''}>{siteLabel || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.zone || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.maintenanceType || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[200px] truncate" title={String(it?.assignedTo || '')}>{it?.assignedTo || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{closed || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprogStatus || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprog || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[260px] truncate" title={reason || ''}>{reason || '-'}</td>
                                {(isAdmin || isManager) && (
                                  <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handlePmOpenReprog(it)}
                                      className="bg-indigo-700 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-800 text-xs font-semibold"
                                      disabled={pmBusy}
                                    >
                                      Reprogrammer
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {pmReprogOpen && pmReprogItem && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
                      <div className="flex justify-between items-center p-4 border-b bg-indigo-800 text-white">
                        <div className="font-bold">Reprogrammation (PM)</div>
                        <button
                          onClick={() => {
                            setPmReprogOpen(false);
                            setPmReprogItem(null);
                            setPmReprogForm({ date: '', status: '', reason: '' });
                            setPmReprogError('');
                          }}
                          className="hover:bg-indigo-900 p-2 rounded"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-gray-900">Ticket: {pmReprogItem?.number || '-'}</div>
                          <div className="text-xs text-gray-600">Site: {pmReprogItem?.siteName || '-'} {pmReprogItem?.siteCode ? `(${pmReprogItem.siteCode})` : ''}</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Date de reprogrammation</label>
                            <input
                              type="date"
                              value={pmReprogForm.date}
                              onChange={(e) => {
                                setPmReprogForm((prev) => ({ ...(prev || {}), date: e.target.value }));
                                setPmReprogError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Statut</label>
                            <select
                              value={pmReprogForm.status}
                              onChange={(e) => {
                                setPmReprogForm((prev) => ({ ...(prev || {}), status: e.target.value }));
                                setPmReprogError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                            >
                              <option value="">(auto)</option>
                              <option value="PENDING">En attente</option>
                              <option value="APPROVED">Approuvée</option>
                              <option value="REJECTED">Rejetée</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-xs text-gray-600 mb-1">Raison / commentaires</label>
                          <textarea
                            value={pmReprogForm.reason}
                            onChange={(e) => {
                              setPmReprogForm((prev) => ({ ...(prev || {}), reason: e.target.value }));
                              setPmReprogError('');
                            }}
                            rows={3}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Ex: demande client / indisponibilité site / pièces…"
                          />
                        </div>

                        {pmReprogError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                            {pmReprogError}
                          </div>
                        )}
                      </div>

                      <div className="p-4 border-t bg-white flex flex-col sm:flex-row sm:justify-end gap-2">
                        <button
                          onClick={() => {
                            setPmReprogOpen(false);
                            setPmReprogItem(null);
                            setPmReprogForm({ date: '', status: '', reason: '' });
                            setPmReprogError('');
                          }}
                          className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
                          disabled={pmReprogSaving}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handlePmSaveReprog}
                          className="bg-indigo-800 text-white px-4 py-2 rounded-lg hover:bg-indigo-900 font-semibold"
                          disabled={pmReprogSaving}
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-800">Historique des imports</div>
                    <div className="text-xs text-gray-600">{imports.length} import(s)</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-[820px] w-full text-sm">
                      <thead className="bg-white sticky top-0">
                        <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Fichier</th>
                          <th className="px-4 py-2">Lignes</th>
                          <th className="px-4 py-2">Par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imports.length === 0 ? (
                          <tr>
                            <td className="px-4 py-4 text-gray-600" colSpan={5}>
                              Aucun import enregistré pour ce mois.
                            </td>
                          </tr>
                        ) : (
                          imports.map((imp) => {
                            const kind = String(imp?.kind || '').toLowerCase();
                            const kindBadge =
                              kind === 'planning' || kind === 'client'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : kind === 'noc'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : 'bg-gray-50 text-gray-800 border-gray-200';
                            return (
                              <tr key={imp?.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-800">{imp?.importedAt ? String(imp.importedAt).replace('T', ' ').slice(0, 19) : '-'}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex items-center border px-2 py-0.5 rounded-full text-xs font-semibold ${kindBadge}`}>
                                    {kind || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-800">{imp?.filename || '-'}</td>
                                <td className="px-4 py-2 text-gray-800">{Number(imp?.rowCount || 0)}</td>
                                <td className="px-4 py-2 text-gray-800">{imp?.createdByEmail || '-'}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
            </div>
          </div>
        </div>
        </div>

      </div>
    </div>
  );
};

export default PmModal;
