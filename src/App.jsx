import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Plus, Upload, Download, Calendar, Activity, CheckCircle, X, Edit, Filter, TrendingUp, Users, Menu } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useStorage } from './hooks/useStorage';
import {
  calculateRegime,
  calculateDiffNHs,
  calculateEstimatedNH,
  calculateEPVDates,
  formatDate,
  getDaysUntil,
  getUrgencyClass
} from './utils/calculations';

const APP_VERSION = '2.0.5';
const APP_VERSION_STORAGE_KEY = 'gma_app_version_seen';
const STHIC_LOGO_SRC = '/Logo_sthic.png';
const SPLASH_MIN_MS = 4300;

const GeneratorMaintenanceApp = () => {
  const storage = useStorage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sites, setSites] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFicheModal, setShowFicheModal] = useState(false);
  const [showBannerUpload, setShowBannerUpload] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTechCalendar, setShowTechCalendar] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showInterventions, setShowInterventions] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [showPm, setShowPm] = useState(false);
  const [scoringMonth, setScoringMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [scoringDetails, setScoringDetails] = useState({ open: false, title: '', kind: '', items: [] });
  const [interventions, setInterventions] = useState([]);
  const [interventionsMonth, setInterventionsMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [interventionsStatus, setInterventionsStatus] = useState('all');
  const [interventionsTechnicianUserId, setInterventionsTechnicianUserId] = useState('all');
  const [interventionsBusy, setInterventionsBusy] = useState(false);
  const [interventionsError, setInterventionsError] = useState('');
  const [technicianInterventionsTab, setTechnicianInterventionsTab] = useState('tomorrow');
  const [showTechnicianInterventionsFilters, setShowTechnicianInterventionsFilters] = useState(false);
  const [technicianSeenSentAt, setTechnicianSeenSentAt] = useState('');
  const [planningAssignments, setPlanningAssignments] = useState({});
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeModalIntervention, setCompleteModalIntervention] = useState(null);
  const [completeModalSite, setCompleteModalSite] = useState(null);
  const [completeForm, setCompleteForm] = useState({ nhNow: '', doneDate: '' });
  const [completeFormError, setCompleteFormError] = useState('');
  const [nhModalOpen, setNhModalOpen] = useState(false);
  const [nhModalIntervention, setNhModalIntervention] = useState(null);
  const [nhModalSite, setNhModalSite] = useState(null);
  const [nhForm, setNhForm] = useState({ nhValue: '', readingDate: '' });
  const [nhFormError, setNhFormError] = useState('');
  const [siteToDelete, setSiteToDelete] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [filterTechnician, setFilterTechnician] = useState('all');
  const [ticketNumber, setTicketNumber] = useState(1201);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStep, setImportStep] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep, setExportStep] = useState('');
  const [pwaUpdate, setPwaUpdate] = useState({ available: false, registration: null, requested: false, forced: false });
  const [bannerImage, setBannerImage] = useState('');
  const [siteForFiche, setSiteForFiche] = useState(null);
  const [ficheContext, setFicheContext] = useState(null);
  const [ficheHistory, setFicheHistory] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [users, setUsers] = useState([]);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [presenceSessions, setPresenceSessions] = useState([]);
  const [presenceTab, setPresenceTab] = useState('sessions');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditUserId, setAuditUserId] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditQuery, setAuditQuery] = useState('');
  const [accountForm, setAccountForm] = useState({ password: '', confirm: '' });
  const [accountError, setAccountError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [userFormId, setUserFormId] = useState(null);
  const [userForm, setUserForm] = useState({ email: '', role: 'viewer', technicianName: '', password: '' });
  const [userFormError, setUserFormError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tabId] = useState(() => {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  });
  const [dashboardMonth, setDashboardMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dashboardDetails, setDashboardDetails] = useState({ open: false, title: '', kind: '', items: [] });
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historySort, setHistorySort] = useState('newest');
  const [pmMonth, setPmMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [pmMonthId, setPmMonthId] = useState('');
  const [pmMonths, setPmMonths] = useState([]);
  const [pmItems, setPmItems] = useState([]);
  const [pmImports, setPmImports] = useState([]);
  const [pmDashboard, setPmDashboard] = useState(null);
  const [pmBusy, setPmBusy] = useState(false);
  const [pmError, setPmError] = useState('');
  const [pmNotice, setPmNotice] = useState('');
  const [pmNocProgress, setPmNocProgress] = useState(0);
  const [pmNocStep, setPmNocStep] = useState('');
  const [pmClientProgress, setPmClientProgress] = useState(0);
  const [pmClientStep, setPmClientStep] = useState('');
  const [pmClientCompare, setPmClientCompare] = useState(null);
  const [pmResetBusy, setPmResetBusy] = useState(false);
  const [pmFilterState, setPmFilterState] = useState('all');
  const [pmFilterType, setPmFilterType] = useState('all');
  const [pmFilterZone, setPmFilterZone] = useState('all');
  const [pmFilterDate, setPmFilterDate] = useState('');
  const [pmFilterReprog, setPmFilterReprog] = useState('all');
  const [pmSearch, setPmSearch] = useState('');
  const [pmReprogOpen, setPmReprogOpen] = useState(false);
  const [pmReprogItem, setPmReprogItem] = useState(null);
  const [pmReprogForm, setPmReprogForm] = useState({ date: '', status: '', reason: '' });
  const [pmReprogError, setPmReprogError] = useState('');
  const [pmReprogSaving, setPmReprogSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarSendTechUserId, setCalendarSendTechUserId] = useState('');
  const [pmSendTechUserId, setPmSendTechUserId] = useState('');
  const [pmSendBusy, setPmSendBusy] = useState(false);
  const [pmAssignments, setPmAssignments] = useState([]);
  const [pmAssignmentsBusy, setPmAssignmentsBusy] = useState(false);
  const [pmAssignmentsError, setPmAssignmentsError] = useState('');
  const [basePlanBaseRows, setBasePlanBaseRows] = useState([]);
  const [basePlanPreview, setBasePlanPreview] = useState([]);
  const [basePlanTargetMonth, setBasePlanTargetMonth] = useState('');
  const [basePlanErrors, setBasePlanErrors] = useState([]);
  const [basePlanBusy, setBasePlanBusy] = useState(false);
  const [basePlanProgress, setBasePlanProgress] = useState(0);
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [techCalendarMonth, setTechCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [techSelectedDate, setTechSelectedDate] = useState(null);
  const [techSelectedDayEvents, setTechSelectedDayEvents] = useState([]);
  const [showTechDayDetailsModal, setShowTechDayDetailsModal] = useState(false);
  const [isBatchFiche, setIsBatchFiche] = useState(false);
  const [batchFicheSites, setBatchFicheSites] = useState([]);
  const [batchFicheIndex, setBatchFicheIndex] = useState(0);
  const [formData, setFormData] = useState({
    nameSite: '',
    idSite: '',
    technician: '',
    generateur: '',
    capacite: '',
    kitVidange: '',
    nh1DV: '',
    dateDV: '',
    nh2A: '',
    dateA: '',
    retired: false
  });

  const currentRole = authUser?.role || 'viewer';
  const isAdmin = currentRole === 'admin';
  const isViewer = currentRole === 'viewer';
  const isTechnician = currentRole === 'technician';
  const canWriteSites = isAdmin;
  const canImportExport = isAdmin;
  const canExportExcel = isAdmin || isViewer;
  const canReset = isAdmin;
  const canGenerateFiche = isAdmin;
  const canMarkCompleted = isAdmin || isTechnician;
  const canManageUsers = isAdmin;
  const canUseInterventions = isAdmin || isTechnician || isViewer;
  const canUsePm = isAdmin || isViewer;

  const apiFetchJson = async (path, init = {}) => {
    const res = await fetch(path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      },
      ...init
    });

    const rawText = await res.text().catch(() => '');
    const data = (() => {
      try {
        return rawText ? JSON.parse(rawText) : {};
      } catch {
        return {};
      }
    })();
    if (!res.ok) {
      const fallbackMsg = String((data && (data.error || data.message)) || rawText || res.statusText || 'Erreur serveur.').trim();
      const msg =
        res.status === 429
          ? 'Trop de requêtes (429). Merci de patienter quelques secondes puis de réessayer.'
          : fallbackMsg;
      throw new Error(msg);
    }
    return data;
  };

  const handleSendCalendarMonthPlanning = async () => {
    try {
      if (!isAdmin) return;
      const techId = String(calendarSendTechUserId || '').trim();
      if (!techId) {
        alert('Veuillez sélectionner un technicien.');
        return;
      }

      const tech = (Array.isArray(users) ? users : []).find((u) => u && String(u.id) === techId) || null;
      const technicianName = String(tech?.technicianName || '').trim();
      if (!technicianName) {
        alert("Le technicien sélectionné n'a pas de nom de technicien configuré.");
        return;
      }

      const month = yyyyMmFromDate(currentMonth);
      const sitesInScope = (Array.isArray(sites) ? sites : [])
        .map(getUpdatedSite)
        .filter((s) => s && !s.retired && String(s.technician || '').trim() === technicianName);

      const interventionsToSend = [];
      for (const s of sitesInScope) {
        const add = (epvType, plannedDate) => {
          if (!plannedDate || plannedDate === 'N/A') return;
          if (String(plannedDate).slice(0, 7) !== month) return;
          const shifted = ymdShiftForWorkdays(String(plannedDate).slice(0, 10));
          const finalPlannedDate = shifted || String(plannedDate).slice(0, 10);
          interventionsToSend.push({
            siteId: s.id,
            plannedDate: finalPlannedDate,
            epvType,
            technicianUserId: techId,
            technicianName
          });
        };
        add('EPV1', s.epv1);
        add('EPV2', s.epv2);
        add('EPV3', s.epv3);
      }

      if (interventionsToSend.length === 0) {
        alert('Aucune vidange à envoyer pour ce technicien sur ce mois.');
        return;
      }

      const ok = window.confirm(
        `Confirmer l'envoi du planning mensuel ?\n\nMois: ${month}\nTechnicien: ${technicianName}\nVidanges: ${interventionsToSend.length}`
      );
      if (!ok) return;

      const data = await apiFetchJson('/api/interventions/send-month', {
        method: 'POST',
        body: JSON.stringify({ interventions: interventionsToSend })
      });

      alert(
        `✅ Planning envoyé.\n\nCréées: ${Number(data?.created || 0)}\nMises à jour: ${Number(data?.updated || 0)}\nEn statut envoyée: ${Number(data?.sent || 0)}`
      );

      await loadInterventions(month, 'all', 'all');
    } catch (e) {
      alert(e?.message || 'Erreur lors de l\'envoi du planning mensuel.');
    }
  };

  const handleSendPmMonthPlanning = async () => {
    try {
      if (!isAdmin) return;

      const techId = String(pmSendTechUserId || '').trim();
      if (!techId) {
        alert('Veuillez sélectionner un technicien.');
        return;
      }

      const tech = (Array.isArray(users) ? users : []).find((u) => u && String(u.id) === techId) || null;
      const technicianName = String(tech?.technicianName || '').trim();
      if (!technicianName) {
        alert("Le technicien sélectionné n'a pas de nom de technicien configuré.");
        return;
      }

      const month = String(pmMonth || '').trim();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        alert('Mois PM invalide.');
        return;
      }

      const normalizeYmd = (v) => {
        const s = v ? String(v).slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
        return s;
      };

      const sitesByIdSite = new Map(
        (Array.isArray(sites) ? sites : [])
          .map(getUpdatedSite)
          .filter(Boolean)
          .map((s) => [String(s.idSite || '').trim(), s])
          .filter(([k]) => Boolean(k))
      );

      const items = Array.isArray(pmItems) ? pmItems : [];
      const assignments = [];
      for (const it of items) {
        const pmNumber = String(it?.number || '').trim();
        if (!pmNumber) continue;

        const siteCode = String(it?.siteCode || '').trim();
        if (!siteCode) continue;

        const site = sitesByIdSite.get(siteCode) || null;
        if (!site) continue;

        if (String(site?.technician || '').trim() !== technicianName) continue;

        const rawDate = normalizeYmd(it?.reprogrammationDate) || normalizeYmd(it?.scheduledWoDate);
        if (!rawDate) continue;

        const shifted = ymdShiftForWorkdays(rawDate);
        const plannedDate = shifted || rawDate;
        if (String(plannedDate).slice(0, 7) !== month) continue;

        assignments.push({
          month,
          pmNumber,
          siteId: String(site.id),
          siteCode,
          plannedDate,
          maintenanceType: it?.maintenanceType ? String(it.maintenanceType) : null,
          technicianUserId: techId,
          technicianName
        });
      }

      if (assignments.length === 0) {
        alert('Aucune maintenance PM à envoyer pour ce technicien sur ce mois.');
        return;
      }

      const ok = window.confirm(
        `Confirmer l'envoi du planning PM mensuel ?\n\nMois: ${month}\nTechnicien: ${technicianName}\nTickets: ${assignments.length}`
      );
      if (!ok) return;

      setPmSendBusy(true);
      const data = await apiFetchJson('/api/pm-assignments/send-month', {
        method: 'POST',
        body: JSON.stringify({ assignments })
      });

      alert(
        `✅ Planning PM envoyé.\n\nCréées: ${Number(data?.created || 0)}\nMises à jour: ${Number(data?.updated || 0)}\nEn statut envoyée: ${Number(data?.sent || 0)}`
      );
    } catch (e) {
      alert(e?.message || "Erreur lors de l'envoi du planning PM.");
    } finally {
      setPmSendBusy(false);
    }
  };

  const exportBusyRef = useRef(false);
  useEffect(() => {
    exportBusyRef.current = Boolean(exportBusy);
  }, [exportBusy]);

  const renderPwaUpdateBanner = () => {
    if (!pwaUpdate?.available) return null;
    return (
      <div className="fixed bottom-4 left-0 right-0 z-[70] px-4">
        <div className="max-w-3xl mx-auto bg-white border border-emerald-200 shadow-lg rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-gray-900">Nouvelle version disponible</div>
            <div className="text-sm text-gray-600">Clique sur “Mettre à jour” pour appliquer la mise à jour.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                const reg = pwaUpdate?.registration;
                const waiting = reg?.waiting;
                if (!waiting) {
                  try {
                    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
                  } catch (e) {
                  }
                  window.location.reload();
                  return;
                }
                try {
                  try {
                    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
                  } catch (e) {
                  }
                  waiting.postMessage({ type: 'SKIP_WAITING' });
                } catch {
                  window.location.reload();
                  return;
                }
                setPwaUpdate((prev) => ({ ...(prev || {}), requested: true, forced: false }));
              }}
              className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 font-semibold w-full sm:w-auto"
            >
              Mettre à jour
            </button>
            <button
              type="button"
              onClick={() => {
                setPwaUpdate({ available: false, registration: null, requested: false, forced: false });
              }}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold w-full sm:w-auto"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const onUpdate = (e) => {
      const reg = e?.detail?.registration || null;
      if (!reg) return;
      setPwaUpdate((prev) => ({ ...(prev || {}), available: true, registration: reg, forced: false }));
    };
    window.addEventListener('pwa:update', onUpdate);
    return () => window.removeEventListener('pwa:update', onUpdate);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let reg = null;
    let onUpdateFound = null;
    let onFocus = null;
    let onVisibility = null;

    (async () => {
      try {
        reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        if (reg.waiting) {
          setPwaUpdate((prev) => ({ ...(prev || {}), available: true, registration: reg, forced: false }));
        }

        onUpdateFound = () => {
          try {
            const installing = reg?.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                setPwaUpdate((prev) => ({ ...(prev || {}), available: true, registration: reg, forced: false }));
              }
            });
          } catch {
            // ignore
          }
        };

        reg.addEventListener('updatefound', onUpdateFound);

        onFocus = () => {
          try {
            reg?.update?.();
          } catch {
            // ignore
          }
        };
        onVisibility = () => {
          try {
            if (document.visibilityState === 'visible') reg?.update?.();
          } catch {
            // ignore
          }
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
      } catch {
        // ignore
      }
    })();

    return () => {
      try {
        if (reg && onUpdateFound) reg.removeEventListener('updatefound', onUpdateFound);
        if (onFocus) window.removeEventListener('focus', onFocus);
        if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(APP_VERSION_STORAGE_KEY);
      if (seen !== APP_VERSION) {
        setPwaUpdate((prev) => ({ ...(prev || {}), available: true, forced: true }));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!pwaUpdate?.requested) return;
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [pwaUpdate?.requested]);

  const runExport = async ({ label, fn }) => {
    if (exportBusyRef.current) return false;
    setExportBusy(true);
    setExportProgress(10);
    setExportStep(String(label || 'Export…'));
    await new Promise((r) => setTimeout(r, 20));
    try {
      setExportProgress(35);
      await fn();
      setExportProgress(100);
      return true;
    } catch (e) {
      alert(e?.message || "Erreur lors de l'export.");
      return false;
    } finally {
      setTimeout(() => {
        setExportBusy(false);
        setExportProgress(0);
        setExportStep('');
      }, 600);
    }
  };

  const refreshUsers = async () => {
    const data = await apiFetchJson('/api/users', { method: 'GET' });
    setUsers(Array.isArray(data?.users) ? data.users : []);
  };

  useEffect(() => {
    (async () => {
      const startedAt = Date.now();
      try {
        const data = await apiFetchJson('/api/auth/me', { method: 'GET' });
        if (data?.user?.email) {
          setAuthUser(data.user);
          await loadData();
          await loadFicheHistory();
          if (data?.user?.role === 'admin') {
            await loadTicketNumber();
          }
          if (data?.user?.role === 'technician') {
            setInterventionsStatus('all');
            setInterventionsTechnicianUserId('all');
            setTechnicianInterventionsTab('tomorrow');
            setShowTechnicianInterventionsFilters(false);
            setShowInterventions(true);
            await loadInterventions(interventionsMonth, 'all', 'all');
          }
        }
      } catch (e) {
        // ignore
      } finally {
        const remaining = SPLASH_MIN_MS - (Date.now() - startedAt);
        setTimeout(() => setAuthChecking(false), Math.max(0, remaining));
      }
    })();
  }, []);

  useEffect(() => {
    if (!showUsersModal) return;
    if (authUser?.role !== 'admin') return;

    (async () => {
      try {
        await refreshUsers();
      } catch (e) {
        setUserFormError(e?.message || 'Erreur serveur.');
      }
    })();
  }, [showUsersModal, authUser?.role]);

  const loadData = async () => {
    try {
      const data = await apiFetchJson('/api/sites', { method: 'GET' });
      setSites(Array.isArray(data?.sites) ? data.sites : []);
    } catch (error) {
      setSites([]);
    }
  };

  const yyyyMmFromDate = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };

  const monthRange = (yyyyMm) => {
    const base = String(yyyyMm || '').trim();
    if (!/^\d{4}-\d{2}$/.test(base)) {
      const today = new Date().toISOString().slice(0, 7);
      return monthRange(today);
    }
    const from = `${base}-01`;
    const d = new Date(from);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
    return { from, to };
  };

  const loadPmAssignments = async (yyyyMm = interventionsMonth) => {
    setPmAssignmentsError('');
    setPmAssignmentsBusy(true);
    try {
      const { from, to } = monthRange(yyyyMm);
      const qs = new URLSearchParams({ from, to });
      const data = await apiFetchJson(`/api/pm-assignments?${qs.toString()}`, { method: 'GET' });
      setPmAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
    } catch (e) {
      setPmAssignments([]);
      setPmAssignmentsError(e?.message || 'Erreur serveur.');
    } finally {
      setPmAssignmentsBusy(false);
    }
  };

  const loadInterventions = async (
    yyyyMm = interventionsMonth,
    status = interventionsStatus,
    technicianUserId = interventionsTechnicianUserId
  ) => {
    setInterventionsError('');
    setInterventionsBusy(true);
    try {
      const { from, to } = monthRange(yyyyMm);
      const qs = new URLSearchParams({ from, to });
      if (status && status !== 'all') qs.set('status', status);
      if (isAdmin && technicianUserId && technicianUserId !== 'all') qs.set('technicianUserId', String(technicianUserId));
      const data = await apiFetchJson(`/api/interventions?${qs.toString()}`, { method: 'GET' });
      setInterventions(Array.isArray(data?.interventions) ? data.interventions : []);
    } catch (e) {
      setInterventions([]);
      setInterventionsError(e?.message || 'Erreur serveur.');
    } finally {
      setInterventionsBusy(false);
    }
  };

  const getInterventionKey = (siteId, plannedDate, epvType) => {
    return `${String(siteId || '')}|${String(plannedDate || '')}|${String(epvType || '')}`;
  };

  const handlePlanIntervention = async ({ siteId, plannedDate, epvType, technicianName, technicianUserId }) => {
    try {
      const site = (Array.isArray(sites) ? sites : []).find((s) => String(s?.id) === String(siteId)) || null;
      const techUsers = Array.isArray(users) ? users.filter((u) => u && u.role === 'technician') : [];
      const matched = technicianUserId
        ? techUsers.find((u) => String(u.id) === String(technicianUserId))
        : techUsers.find((u) => String(u.technicianName || '').trim() === String(technicianName || '').trim());

      if (!matched?.id) {
        setInterventionsError('Veuillez sélectionner un technicien avant de planifier.' );
        return;
      }

      const finalTechnicianName = String(matched.technicianName || '').trim();
      if (!finalTechnicianName) {
        setInterventionsError("Le technicien sélectionné n'a pas de nom de technicien configuré.");
        return;
      }

      const ok = window.confirm(
        `Confirmer la planification ?\n\nSite: ${site?.nameSite || siteId}${site?.idSite ? ` (ID: ${site.idSite})` : ''}\nDate: ${String(plannedDate || '')}\nType: ${String(epvType || '')}\nTechnicien: ${finalTechnicianName}`
      );
      if (!ok) return;

      await apiFetchJson('/api/interventions', {
        method: 'POST',
        body: JSON.stringify({
          siteId,
          plannedDate,
          epvType,
          technicianName: finalTechnicianName,
          technicianUserId: matched.id
        })
      });
      await loadInterventions();
      alert('✅ Intervention planifiée.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleSendJ1 = async () => {
    try {
      const pad2 = (n) => String(n).padStart(2, '0');
      const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      const tomorrowD = new Date();
      tomorrowD.setDate(tomorrowD.getDate() + 1);
      const tomorrow = ymdLocal(tomorrowD);
      const ok = window.confirm(`Confirmer l'action "Envoyer J-1" ?\n\nCela marquera comme "envoyées" toutes les interventions planifiées pour ${tomorrow}.`);
      if (!ok) return;
      const data = await apiFetchJson('/api/interventions/send-j1', {
        method: 'POST',
        body: JSON.stringify({ plannedDate: tomorrow })
      });
      const updated = Number(data?.updated || 0);
      if (updated > 0) {
        alert(`✅ Envoi J-1: ${updated} intervention(s) marquée(s) envoyée(s) pour ${data?.plannedDate || tomorrow}`);
      } else {
        alert(
          `ℹ️ Envoi J-1: 0 intervention mise à jour pour ${data?.plannedDate || tomorrow}.\n\n` +
          `Cette action ne concerne que les interventions dont la date planifiée est exactement "${tomorrow}" et dont le statut est "planned".\n` +
          `Si tu avais déjà des interventions en "sent" ou "done", ou si la date ne correspond pas, il n'y aura aucun changement.`
        );
      }
      await loadInterventions();
    } catch (e) {
      alert('❌ Erreur lors de l\'envoi J-1. Vérifiez la console.');
    }
  };

  const handleCompleteIntervention = async (interventionId, payload = {}) => {
    try {
      const it = (Array.isArray(interventions) ? interventions : []).find((x) => String(x?.id) === String(interventionId)) || null;
      const site = (Array.isArray(sites) ? sites : []).find((s) => String(s?.id) === String(it?.siteId)) || null;
      const msgLines = [
        `Confirmer "Marquer effectuée" ?`,
        '',
        `Site: ${site?.nameSite || it?.siteId || ''}${site?.idSite ? ` (ID: ${site.idSite})` : ''}`,
        `Date planifiée: ${formatDate(it?.plannedDate)}`,
        `Type: ${String(it?.epvType || '')}`
      ];
      if (payload && (payload.doneDate || payload.nhNow)) {
        msgLines.push('');
      }
      if (payload?.doneDate) msgLines.push(`Date de vidange: ${String(payload.doneDate)}`);
      if (payload?.nhNow) msgLines.push(`Compteur actuel (NH): ${String(payload.nhNow)}`);

      const ok = window.confirm(msgLines.join('\n'));
      if (!ok) return;

      await apiFetchJson(`/api/interventions/${interventionId}/complete`, {
        method: 'POST',
        body: JSON.stringify(payload || {})
      });
      await loadData();
      await loadInterventions();
      await loadFicheHistory();
      alert('✅ Intervention marquée comme effectuée.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const loadTicketNumber = async () => {
    try {
      const data = await apiFetchJson('/api/meta/ticket-number', { method: 'GET' });
      if (Number.isFinite(Number(data?.next))) {
        setTicketNumber(Number(data.next));
      }
    } catch (error) {
      console.log('Numéro de ticket par défaut: T01201');
    }
  };

  const handleSetNextTicketNumber = async () => {
    try {
      if (!isAdmin) return;
      const raw = window.prompt('Définir le prochain ticket (ex: 1250 pour T01250)', String(ticketNumber || 1250));
      if (raw == null) return;
      const next = Number(String(raw).replace(/[^0-9]+/g, ''));
      if (!Number.isFinite(next) || Math.floor(next) !== next || next < 1) {
        alert('Valeur invalide.');
        return;
      }

      const ok = window.confirm(`Confirmer: prochain ticket = T${String(next).padStart(5, '0')} ?`);
      if (!ok) return;

      const res = await apiFetchJson('/api/meta/ticket-number/set', {
        method: 'POST',
        body: JSON.stringify({ next })
      });

      await loadTicketNumber();
      alert(`✅ Prochain ticket défini sur ${String(res?.nextTicket || `T${String(next).padStart(5, '0')}`)}`);
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const loadFicheHistory = async () => {
    try {
      const data = await apiFetchJson('/api/fiche-history', { method: 'GET' });
      setFicheHistory(Array.isArray(data?.fiches) ? data.fiches : []);
    } catch (error) {
      setFicheHistory([]);
    }
  };

  const saveFicheHistory = async (history) => {
    try {
      await storage.set('fiche-history', JSON.stringify(history));
    } catch (error) {
      console.error('Erreur sauvegarde historique:', error);
    }
  };

  const saveTicketNumber = async (num) => {
    try {
      // ticket number is server-side (D1). no-op.
    } catch (error) {
      console.error('Erreur sauvegarde numéro:', error);
    }
  };

  const PRESENCE_TTL_MS = 20000;

  const getCurrentActivityLabel = () => {
    if (showUsersModal) return 'Gestion des utilisateurs';
    if (showAccountModal) return 'Mon compte';
    if (showPresenceModal) return 'Consultation présence';
    if (showCalendar) return 'Calendrier';
    if (showHistory) return 'Historique';
    if (showScoring) return 'Scoring';
    if (showPm) return 'Maintenances (PM)';
    if (showFicheModal) return 'Fiche d\'intervention';
    if (showBannerUpload) return 'Upload bannière';
    if (showDayDetailsModal) return 'Détails du jour';
    if (showAddForm) return 'Création site';
    if (showEditForm) return 'Édition site';
    if (showUpdateForm) return 'Mise à jour site';
    if (dashboardDetails.open) return 'Détails dashboard';
    if (showResetConfirm) return 'Confirmation réinitialisation';
    if (showInterventions) return 'Interventions';
    return 'Dashboard / liste sites';
  };

  const pmNormKey = (k) =>
    String(k || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s*\-\s*/g, '-')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ');

  const pmGet = (row, ...candidates) => {
    if (!row || typeof row !== 'object') return undefined;
    const map = new Map(Object.keys(row).map((k) => [pmNormKey(k), row[k]]));
    for (const c of candidates) {
      const v = map.get(pmNormKey(c));
      if (v != null && String(v).trim() !== '') return v;
    }
    return undefined;
  };

  const pmNormalizeDate = (value) => {
    if (!value && value !== 0) return '';
    if (typeof value === 'number') {
      try {
        const d = XLSX.SSF.parse_date_code(value);
        if (!d || !d.y || !d.m || !d.d) return '';
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } catch {
        return '';
      }
    }

    const raw = String(value).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    const m1 = raw.match(/^(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/);
    if (m1) {
      const dd = m1[1];
      const mm = m1[2];
      const yyyy = m1[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    return raw.slice(0, 10);
  };

  const pmInferType = (row) => {
    const s = String(row?.['Short description'] || row?.['Short Description'] || row?.short_description || row?.description || '').toLowerCase();
    if (s.includes('dg') || s.includes('generator')) return 'DG Service';
    if (s.includes('air') || s.includes('conditioning') || s.includes('clim')) return 'Air Conditioning Service';
    if (s.includes('fullpm') || s.includes('full pm') || s.includes('full pmwo') || s.includes('pmwo')) return 'FullPMWO';
    return '';
  };

  const loadPmMonths = async () => {
    const data = await apiFetchJson('/api/pm/months', { method: 'GET' });
    setPmMonths(Array.isArray(data?.months) ? data.months : []);
    return Array.isArray(data?.months) ? data.months : [];
  };

  const ensurePmMonth = async (yyyymm) => {
    const month = String(yyyymm || '').trim();
    if (!month) return '';

    if (isAdmin) {
      const data = await apiFetchJson('/api/pm/months', {
        method: 'POST',
        body: JSON.stringify({ month })
      });
      return data?.month?.id ? String(data.month.id) : '';
    }

    const months = await loadPmMonths();
    const found = (Array.isArray(months) ? months : []).find((m) => String(m?.month || '').trim() === month) || null;
    return found?.id ? String(found.id) : '';
  };

  const loadPmItems = async (monthId) => {
    const data = await apiFetchJson(`/api/pm/months/${monthId}/items`, { method: 'GET' });
    setPmItems(Array.isArray(data?.items) ? data.items : []);
  };

  const handlePmOpenReprog = (it) => {
    if (!isAdmin) return;
    const date = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
    const status = it?.reprogrammationStatus ? String(it.reprogrammationStatus).trim() : '';
    const reason = it?.reprogrammationReason ? String(it.reprogrammationReason) : '';
    setPmReprogItem(it || null);
    setPmReprogForm({ date, status, reason });
    setPmReprogError('');
    setPmReprogOpen(true);
  };

  const handlePmSaveReprog = async () => {
    if (!isAdmin) return;
    if (!pmMonthId) {
      setPmReprogError('Mois introuvable.');
      return;
    }
    const it = pmReprogItem;
    const itemId = String(it?.id || '').trim();
    if (!itemId) {
      setPmReprogError('Ticket introuvable.');
      return;
    }

    const reprogrammationDate = String(pmReprogForm?.date || '').trim();
    const reprogrammationStatus = String(pmReprogForm?.status || '').trim();
    const reprogrammationReason = String(pmReprogForm?.reason || '').trim();

    if (reprogrammationDate && !/^\d{4}-\d{2}-\d{2}$/.test(reprogrammationDate)) {
      setPmReprogError('Date invalide.');
      return;
    }
    if (reprogrammationStatus && !['APPROVED', 'REJECTED', 'PENDING'].includes(reprogrammationStatus)) {
      setPmReprogError('Statut invalide.');
      return;
    }

    try {
      setPmReprogSaving(true);
      setPmReprogError('');
      await apiFetchJson(`/api/pm/months/${pmMonthId}/items`, {
        method: 'PATCH',
        body: JSON.stringify({
          id: itemId,
          reprogrammationDate: reprogrammationDate || null,
          reprogrammationStatus: reprogrammationStatus || null,
          reprogrammationReason: reprogrammationReason || null
        })
      });

      await loadPmItems(pmMonthId);
      await loadPmDashboard(pmMonthId);
      setPmReprogOpen(false);
      setPmReprogItem(null);
      setPmReprogForm({ date: '', status: '', reason: '' });
    } catch (e) {
      setPmReprogError(e?.message || 'Erreur serveur.');
    } finally {
      setPmReprogSaving(false);
    }
  };

  const loadPmImports = async (monthId) => {
    const data = await apiFetchJson(`/api/pm/months/${monthId}/imports`, { method: 'GET' });
    setPmImports(Array.isArray(data?.imports) ? data.imports : []);
  };

  const loadPmDashboard = async (monthId) => {
    const data = await apiFetchJson(`/api/pm/months/${monthId}/dashboard`, { method: 'GET' });
    setPmDashboard(data || null);
  };

  const refreshPmAll = async (yyyymm) => {
    try {
      setPmBusy(true);
      setPmError('');
      setPmNotice('');
      setPmNocProgress(0);
      setPmNocStep('');
      setPmClientProgress(0);
      setPmClientStep('');
      const m = String(yyyymm || '').trim();
      const id = await ensurePmMonth(m);
      setPmMonth(m);
      setPmMonthId(id);
      if (isAdmin) {
        await loadPmMonths();
      }
      if (id) {
        await loadPmItems(id);
        await loadPmImports(id);
        await loadPmDashboard(id);
      } else {
        setPmItems([]);
        setPmImports([]);
        setPmDashboard(null);
      }
    } catch (e) {
      setPmError(e?.message || 'Erreur serveur.');
    } finally {
      setPmBusy(false);
    }
  };

  const handlePmExportExcel = async () => {
    if (!canUsePm) return;
    const ok = window.confirm(`Exporter le suivi PM (${pmMonth}) en Excel ?`);
    if (!ok) return;

    const norm = (s) => String(s || '').trim().toLowerCase();
    const bucketForState = (state) => {
      const v = norm(state);
      if (v === 'closed complete' || v === 'closed') return 'closed';
      if (v === 'awaiting closure' || v === 'awaiting') return 'awaiting';
      if (v === 'work in progress' || v === 'wip') return 'wip';
      return 'assigned';
    };

    const dateEq = (isoOrYmd, ymd) => {
      if (!ymd) return true;
      const d = isoOrYmd ? String(isoOrYmd).slice(0, 10) : '';
      return d === String(ymd).slice(0, 10);
    };

    const normStatus = (s) => {
      const v = String(s || '').trim().toLowerCase();
      if (!v) return '';
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
      const explicit = normStatus(it?.reprogrammationStatus);
      if (explicit) return explicit;
      const hasDate = !!String(it?.reprogrammationDate || '').trim();
      const hasReason = !!String(it?.reprogrammationReason || '').trim();
      if (hasDate) return 'APPROVED';
      if (hasReason) return 'PENDING';
      return '';
    };

    const search = String(pmSearch || '').trim().toLowerCase();
    const exportItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
      if (pmFilterType && pmFilterType !== 'all') {
        if (String(it?.maintenanceType || '').trim() !== String(pmFilterType)) return false;
      }
      if (pmFilterZone && pmFilterZone !== 'all') {
        if (String(it?.zone || '').trim() !== String(pmFilterZone)) return false;
      }
      if (pmFilterDate) {
        if (!dateEq(it?.scheduledWoDate, pmFilterDate)) return false;
      }
      if (pmFilterReprog && pmFilterReprog !== 'all') {
        const st = effectiveReprogStatus(it);
        if (pmFilterReprog === 'approved' && st !== 'APPROVED') return false;
        if (pmFilterReprog === 'rejected' && st !== 'REJECTED') return false;
        if (pmFilterReprog === 'pending' && st !== 'PENDING') return false;
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
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (pmFilterState && pmFilterState !== 'all') {
        if (bucketForState(it?.state) !== pmFilterState) return false;
      }
      return true;
    });

    const rows = exportItems.map((it) => ({
      'Zone': it.zone || '',
      'Region': it.region || '',
      'Site': it.siteCode || '',
      'Site Name': it.siteName || '',
      'Short description': it.shortDescription || '',
      'Maintenance Type': it.maintenanceType || '',
      'Number': it.number || '',
      'Assigned to': it.assignedTo || '',
      'Scheduled WO Date': it.scheduledWoDate || '',
      'Date of closing': it.closedAt || '',
      'Statut reprogrammation': effectiveReprogStatus(it) || '',
      'Reprogrammation': it.reprogrammationDate || '',
      'Raisons': it.reprogrammationReason || '',
      'State': it.state || ''
    }));

    const done = await runExport({
      label: 'Export Excel (PM)…',
      fn: async () => {
        exportXlsx({
          fileBaseName: `PM_${pmMonth}_${new Date().toISOString().split('T')[0]}`,
          sheets: [{ name: `PM-${pmMonth}`, rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const deleteBasePlanFromDb = async () => {
    if (!isAdmin) return;

    const defaultMonth = (() => {
      const t = String(basePlanTargetMonth || '').trim();
      if (/^\d{4}-\d{2}$/.test(t)) return t;
      return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    })();
    const month = String(window.prompt('Mois à supprimer (YYYY-MM)', defaultMonth) || '').trim();
    if (!month) return;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      alert('Mois invalide (YYYY-MM).');
      return;
    }

    const ok = window.confirm(
      `Supprimer définitivement le planning de base en DB pour ${month} ?\n\nCette action supprime aussi toutes les lignes (items).`
    );
    if (!ok) return;

    setBasePlanBusy(true);
    setBasePlanProgress(20);
    try {
      const plansRes = await apiFetchJson('/api/pm/base-plans', { method: 'GET' });
      const plans = Array.isArray(plansRes?.plans) ? plansRes.plans : [];
      const plan = plans.find((p) => String(p?.month || '').trim() === month) || null;
      if (!plan?.id) {
        const available = plans
          .map((p) => String(p?.month || '').trim())
          .filter(Boolean)
          .join(', ');
        throw new Error(`Planning de base introuvable pour ${month}.${available ? `\n\nMois disponibles: ${available}` : ''}`);
      }

      setBasePlanProgress(60);
      await apiFetchJson(`/api/pm/base-plans/${String(plan.id)}`, { method: 'DELETE' });
      setBasePlanProgress(100);

      // Après suppression DB, on réinitialise l'UI du planning de base pour éviter les confusions
      setBasePlanPreview([]);
      setBasePlanErrors([]);
      setBasePlanBaseRows([]);

      alert(`✅ Planning de base supprimé (${month}).`);
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    } finally {
      setTimeout(() => {
        setBasePlanBusy(false);
        setBasePlanProgress(0);
      }, 300);
    }
  };

  const basePlanNormalizeYmd = (value) => {
    if (!value && value !== 0) return '';
    if (typeof value === 'number') {
      try {
        const d = XLSX.SSF.parse_date_code(value);
        if (!d || !d.y || !d.m || !d.d) return '';
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } catch {
        return '';
      }
    }
    const s = String(value || '').trim();
    if (!s) return '';
    const m = s.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const fr = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
    return '';
  };

  const getNextMonthYyyyMm = (d) => {
    const dt = d instanceof Date ? d : new Date();
    const year = dt.getFullYear();
    const month = dt.getMonth();
    const next = new Date(year, month + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  };

  const basePlanSplitCell = (value) => {
    const s = String(value ?? '').trim();
    if (!s) return [];
    const parts = s
      .split(/\s*(?:\r?\n|\+|;|,|\/|\\|\||\bet\b|&|\s-\s)\s*/i)
      .map((p) => String(p || '').trim())
      .filter(Boolean);
    if (parts.length <= 1) return [s];
    return parts;
  };

  const isBzvPoolZone = (zoneOrRegion) => {
    const z = String(zoneOrRegion || '').toLowerCase();
    return z.includes('bzv') || z.includes('pool');
  };

  const handleImportBasePlanExcel = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setBasePlanBusy(true);
        setBasePlanProgress(10);
        setBasePlanErrors([]);

        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        setBasePlanProgress(35);

        const rows = [];
        const errors = [];
        const arr = Array.isArray(jsonData) ? jsonData : [];
        const importPairGroupStats = {
          headerUsed: '',
          nonEmptyCount: 0,
          possibleHeaders: [],
          hasAnyPairGroupHeader: false
        };
        try {
          const firstRow = arr?.[0];
          if (firstRow && typeof firstRow === 'object') {
            const keys = Object.keys(firstRow);
            importPairGroupStats.possibleHeaders = keys.filter((k) => {
              const nk = pmNormKey(k).replace(/\s+/g, '');
              return nk.includes('pair') || nk.includes('grp') || nk.includes('binome') || nk.includes('groupe');
            });
            importPairGroupStats.hasAnyPairGroupHeader = keys.some((k) => {
              const nk = pmNormKey(k).replace(/\s+/g, '');
              return nk.includes('pairgroup') || nk.includes('pairgrp') || nk.includes('pairgr') || nk.includes('binome') || nk.includes('paire');
            });
          }
        } catch {
          // ignore
        }
        for (let idx = 0; idx < arr.length; idx += 1) {
          const row = arr[idx];
          const rawSiteCode = String(pmGet(row, 'Site (id)', 'Site', 'Site id', 'Site Code') || '').trim();
          const rawSiteName = String(pmGet(row, 'Site Name', 'Site name', 'Name Site') || '').trim();
          const region = String(pmGet(row, 'Region', 'REGION', 'Région') || '').trim();
          const zone = String(pmGet(row, 'Zone', 'ZONE') || '').trim();
          const shortDescription = String(pmGet(row, 'Short description', 'Short Description') || '').trim();
          const assignedTo = String(pmGet(row, 'Assigned to', 'Assigned To') || '').trim();
          let pairGroupRaw = String(pmGet(row, 'PairGroup', 'Pair Group', 'Pair group') || '').trim();
          if (!pairGroupRaw) {
            try {
              const keys = Object.keys(row || {});
              for (const k of keys) {
                const nk = pmNormKey(k).replace(/\s+/g, '');
                const looksLikePairGroup =
                  nk.includes('pairgroup') ||
                  nk.includes('pairgrp') ||
                  nk.includes('pairgr') ||
                  (nk.includes('pair') && (nk.includes('group') || nk.includes('grp'))) ||
                  nk.includes('binome') ||
                  nk.includes('paire') ||
                  nk.includes('groupe');
                if (!looksLikePairGroup) continue;
                const v = row?.[k];
                if (v != null && String(v).trim() !== '') {
                  pairGroupRaw = String(v).trim();
                  if (!importPairGroupStats.headerUsed) importPairGroupStats.headerUsed = String(k);
                  break;
                }
              }
            } catch {
              // ignore
            }
          }

          if (pairGroupRaw) importPairGroupStats.nonEmptyCount += 1;
          const scheduledWoDate = basePlanNormalizeYmd(
            pmGet(row, 'Scheduled WO Date', 'Scheduled Wo Date', 'Scheduled date', 'Scheduled Date')
          );
          const maintenanceType = String(pmGet(row, 'Maintenance Type') || '').trim() || pmInferType(row);

          const epv1 = basePlanNormalizeYmd(pmGet(row, 'EPV1', 'EPV 1', 'Date EPV 1', 'Date EPV1'));
          const epv2 = basePlanNormalizeYmd(pmGet(row, 'EPV2', 'EPV 2', 'Date EPV 2', 'Date EPV2'));
          const epv3 = basePlanNormalizeYmd(pmGet(row, 'EPV3', 'EPV 3', 'Date EPV 3', 'Date EPV3'));

          if (!rawSiteCode && !rawSiteName) continue;

          const codes = basePlanSplitCell(rawSiteCode);
          const names = basePlanSplitCell(rawSiteName);
          const n = Math.max(codes.length, names.length, 1);
          if (n > 2) errors.push(`Ligne ${idx + 2}: plus de 2 sites détectés dans la cellule.`);

          const autoPairGroup = n >= 2 && !pairGroupRaw ? `AUTO-${String(assignedTo || 'NA').replace(/\s+/g, '-')}-${idx + 1}` : '';

          for (let i = 0; i < Math.min(n, 2); i += 1) {
            const siteCode = String(codes[i] || codes[0] || '').trim();
            const siteName = String(names[i] || names[0] || '').trim();
            if (!siteCode && !siteName) continue;
            rows.push({
              importOrder: idx * 10 + i,
              siteCode,
              siteName,
              region,
              zone: zone || region,
              shortDescription,
              assignedTo,
              pairGroup: pairGroupRaw || autoPairGroup,
              scheduledWoDate,
              maintenanceType,
              epv1,
              epv2,
              epv3
            });
          }
        }

        if (importPairGroupStats.nonEmptyCount === 0 && importPairGroupStats.possibleHeaders.length > 0) {
          errors.push(
            `⚠️ PairGroup: 0 valeur détectée dans ce fichier. Colonnes proches détectées: ${importPairGroupStats.possibleHeaders
              .slice(0, 8)
              .join(', ')}${importPairGroupStats.possibleHeaders.length > 8 ? '…' : ''}.`
          );
        }

        if (!importPairGroupStats.hasAnyPairGroupHeader) {
          errors.push(
            `⚠️ PairGroup: colonne absente dans ce fichier (sur la première ligne). Si tu veux imposer les vraies paires géographiques, ajoute une colonne "PairGroup" (ou "Binôme"/"Paire") avec la même valeur sur 2 lignes.`
          );
        }

        // Cas Excel courant: PairGroup saisi sur une seule ligne (cellules fusionnées / non répétées).
        // On propage au voisin direct si ce PairGroup n'apparaît qu'une seule fois.
        const normTech2 = (s) => String(s || '').trim().replace(/\s+/g, ' ');
        const byTech2 = new Map();
        for (const r of rows) {
          const tech = normTech2(r?.assignedTo) || 'Non assigné';
          if (!byTech2.has(tech)) byTech2.set(tech, []);
          byTech2.get(tech).push(r);
        }
        for (const techRows of byTech2.values()) {
          techRows.sort((a, b) => Number(a?.importOrder ?? 0) - Number(b?.importOrder ?? 0));

          const normName = (s) =>
            String(s || '')
              .replace(/[\u200B-\u200D\uFEFF]/g, '')
              .replace(/\u00A0/g, ' ')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[“”«»"'’`]/g, ' ')
              .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\-]/g, ' ')
              .replace(/[\\/|_]/g, ' ')
              .replace(/[^a-z0-9 ]+/g, ' ')
              .trim()
              .replace(/\s+/g, ' ');

          const rawCounts = new Map();
          for (const r of techRows) {
            const g = String(r?.pairGroup || '').trim();
            if (!g) continue;
            rawCounts.set(g, Number(rawCounts.get(g) || 0) + 1);
          }

          for (const r of techRows) {
            const g = String(r?.pairGroup || '').trim();
            if (!g) continue;
            const n = Number(rawCounts.get(g) || 0);
            if (n !== 1) continue;
            const gNorm = normName(g);
            const myNorm = normName(r?.siteName);
            if (gNorm && myNorm && gNorm === myNorm) r.pairGroup = '';
          }

          const nameToRows = new Map();
          for (const r of techRows) {
            const nm = normName(r?.siteName);
            if (!nm) continue;
            if (!nameToRows.has(nm)) nameToRows.set(nm, []);
            nameToRows.get(nm).push(r);
          }

          const counts = new Map();
          for (const r of techRows) {
            const g = String(r?.pairGroup || '').trim();
            if (!g) continue;
            counts.set(g, Number(counts.get(g) || 0) + 1);
          }

          let crossK = 1;
          const usedCross = new Set();
          const isExplicitGroup = (r) => {
            const g = String(r?.pairGroup || '').trim();
            if (!g) return false;
            return Number(counts.get(g) || 0) >= 2;
          };

          const isAlreadyCrossPaired = (r) => {
            const nm = normName(r?.siteName);
            const key = `${Number(r?.importOrder ?? 0)}|${nm}`;
            return usedCross.has(key);
          };

          const applyCrossPair = (a, b) => {
            const aName = normName(a?.siteName);
            const bName = normName(b?.siteName);
            if (!aName || !bName) return false;
            const keyA = `${Number(a?.importOrder ?? 0)}|${aName}`;
            const keyB = `${Number(b?.importOrder ?? 0)}|${bName}`;
            if (usedCross.has(keyA) || usedCross.has(keyB)) return false;
            const canonical = `XPAIR-${String(techRows?.[0]?.assignedTo || 'TECH').replace(/\s+/g, '-')}-${crossK}`;
            crossK += 1;
            a.pairGroup = canonical;
            b.pairGroup = canonical;
            usedCross.add(keyA);
            usedCross.add(keyB);
            counts.set(canonical, 2);
            return true;
          };

          // 1) Mutual reference: A.PairGroup == B.SiteName AND B.PairGroup == A.SiteName
          for (const r of techRows) {
            const gRaw = String(r?.pairGroup || '').trim();
            if (!gRaw) continue;
            if (isExplicitGroup(r)) continue;
            if (isAlreadyCrossPaired(r)) continue;

            const myName = normName(r?.siteName);
            const targetName = normName(gRaw);
            if (!myName || !targetName) continue;
            if (myName === targetName) continue;

            const candidates = nameToRows.get(targetName) || [];
            const partner =
              candidates.find((x) => x !== r && normName(x?.pairGroup) === myName && !isExplicitGroup(x) && !isAlreadyCrossPaired(x)) || null;
            if (!partner) continue;
            applyCrossPair(r, partner);
          }

          // 2) One-way reference: A.PairGroup == B.SiteName (B can be empty/self)
          for (const r of techRows) {
            const gRaw = String(r?.pairGroup || '').trim();
            if (!gRaw) continue;
            if (isExplicitGroup(r)) continue;
            if (isAlreadyCrossPaired(r)) continue;

            const myName = normName(r?.siteName);
            const targetName = normName(gRaw);
            if (!myName || !targetName) continue;
            if (myName === targetName) continue;

            const candidates = nameToRows.get(targetName) || [];
            let partner = null;
            for (const cand of candidates) {
              if (cand === r) continue;
              if (isExplicitGroup(cand)) continue;
              if (isAlreadyCrossPaired(cand)) continue;
              partner = cand;
              break;
            }
            if (!partner) continue;

            applyCrossPair(r, partner);
          }

          for (let i = 0; i + 1 < techRows.length; i += 1) {
            const cur = techRows[i];
            const next = techRows[i + 1];
            const g = String(cur?.pairGroup || '').trim();
            if (!g) continue;
            if (String(next?.pairGroup || '').trim()) continue;
            const n = Number(counts.get(g) || 0);
            if (n !== 1) continue;

            const looksLikeSiteName = !!(nameToRows.get(normName(g)) || []).length;
            if (looksLikeSiteName) continue;

            next.pairGroup = g;
            counts.set(g, 2);
          }

          const counts2 = new Map();
          for (const r of techRows) {
            const g = String(r?.pairGroup || '').trim();
            if (!g) continue;
            counts2.set(g, Number(counts2.get(g) || 0) + 1);
          }

          for (const [g, n] of counts2.entries()) {
            if (n !== 2) {
              const gNorm = normName(g);
              const targets = nameToRows.get(gNorm) || [];
              const looksLikeSiteName = targets.length > 0;
              const refs = techRows.filter((r) => normName(r?.pairGroup) === gNorm);
              const refSite = String(refs?.[0]?.siteName || '').trim();
              const techName = techRows?.[0]?.assignedTo || 'technicien';

              const isSelfRef = refs.some((r) => {
                const rn = normName(r?.siteName);
                return rn && rn === gNorm;
              });

              if (looksLikeSiteName) {
                if (isSelfRef && targets.length === refs.length) {
                  errors.push(
                    `⚠️ PairGroup '${g}' pour '${techName}': auto-référence détectée (PairGroup = Site Name), donc aucun binôme possible (trouvé ${n}). Mets le nom du site binôme dans PairGroup, ou mets une même valeur de groupe sur exactement 2 lignes.`
                  );
                } else if (targets.length > 1) {
                  errors.push(
                    `⚠️ PairGroup '${g}' pour '${techName}': binôme ambigu (plusieurs lignes ont Site Name='${g}', trouvé ${targets.length}). Renomme/qualifie ces sites ou utilise un PairGroup identique sur 2 lignes.`
                  );
                } else {
                  const t = targets[0];
                  const targetSite = String(t?.siteName || '').trim();
                  const targetPg = String(t?.pairGroup || '').trim();
                  const targetPgHint = targetPg ? ` (PairGroup cible='${targetPg}')` : '';
                  const refHint = refSite ? ` Référence='${refSite}'.` : '';
                  errors.push(
                    `⚠️ PairGroup '${g}' pour '${techName}': binôme introuvable ou non apparié (trouvé ${n}). Cible trouvée: '${targetSite}'${targetPgHint}.${refHint} Vérifie que la cible est dans le même technicien et qu'elle n'est pas déjà appariée ailleurs.`
                  );
                }
              } else {
                errors.push(`⚠️ PairGroup '${g}' pour '${techName}' doit regrouper exactement 2 lignes (trouvé ${n}).`);
              }
            }
          }
        }

        // Si un technicien est en capacité 2 sites/jour et que PairGroup est vide,
        // on applique la parité "à la STHIC" en groupant 2 lignes consécutives du même technicien.
        // (on respecte l'ordre du fichier Excel)
        const normTech = (s) => String(s || '').trim().replace(/\s+/g, ' ');
        const techToRows = new Map();
        for (const r of rows) {
          const tech = normTech(r?.assignedTo) || 'Non assigné';
          if (!techToRows.has(tech)) techToRows.set(tech, []);
          techToRows.get(tech).push(r);
        }
        for (const [tech, techRows] of techToRows.entries()) {
          const uniqueSites = new Set(techRows.map((r) => String(r?.siteCode || r?.siteName || '').trim()).filter(Boolean));
          const capacityPerDay = uniqueSites.size > 20 ? 2 : 1;
          if (capacityPerDay !== 2) continue;

          const free = techRows.filter((r) => !String(r?.pairGroup || '').trim());
          let k = 1;
          for (let i = 0; i + 1 < free.length; i += 2) {
            const g = `AUTO2-${String(tech).replace(/\s+/g, '-')}-${k}`;
            free[i].pairGroup = g;
            free[i + 1].pairGroup = g;
            k += 1;
          }
        }

        setBasePlanBaseRows(rows);
        setBasePlanPreview([]);
        setBasePlanTargetMonth(getNextMonthYyyyMm(currentMonth));
        setBasePlanErrors(errors);
        setBasePlanProgress(100);
        alert(`✅ Base importée: ${rows.length} lignes.`);
      } catch (err) {
        alert(err?.message || 'Erreur lors de la lecture du fichier.');
      } finally {
        setTimeout(() => {
          setBasePlanBusy(false);
          setBasePlanProgress(0);
        }, 200);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handlePmClientImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ok = window.confirm(
      `Confirmer l'import du retour client ?\n\nCe fichier va remplacer le planning du mois PM ${pmMonth} et permettra le suivi via NOC.\n\nFichier: ${file?.name || ''}`
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    const normalizeType = (t) => {
      const s = String(t || '').trim().toLowerCase();
      if (!s) return '';
      if (s.includes('fullpm') || s.includes('pmwo')) return 'fullpmwo';
      if (s.includes('dg')) return 'dg';
      if (s.includes('air') || s.includes('conditioning') || s.includes('clim')) return 'air';
      return s;
    };

    const normalizeYmd = (v) => String(v || '').slice(0, 10);

    const normSiteName = (s) =>
      String(s || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    const reader = new FileReader();
    setPmBusy(true);
    setPmError('');
    setPmNotice('');
    setPmClientCompare(null);
    setPmClientProgress(5);
    setPmClientStep('Lecture du fichier…');

    reader.onload = async (event) => {
      try {
        setPmClientProgress(20);
        setPmClientStep('Analyse Excel…');

        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        setPmClientProgress(40);
        setPmClientStep('Chargement planning de base…');

        const plansRes = await apiFetchJson('/api/pm/base-plans', { method: 'GET' });
        const plans = Array.isArray(plansRes?.plans) ? plansRes.plans : [];
        const basePlan = plans.find((p) => String(p?.month || '').trim() === String(pmMonth || '').trim()) || null;
        if (!basePlan?.id) {
          const available = plans
            .map((p) => String(p?.month || '').trim())
            .filter(Boolean)
            .join(', ');
          throw new Error(`Planning de base introuvable pour ${pmMonth}.${available ? `\n\nMois disponibles: ${available}` : ''}`);
        }
        const itemsRes = await apiFetchJson(`/api/pm/base-plans/${String(basePlan.id)}/items`, { method: 'GET' });
        const baseItems = Array.isArray(itemsRes?.items) ? itemsRes.items : [];

        const siteByIdSite = new Map(
          (Array.isArray(sites) ? sites : [])
            .filter(Boolean)
            .map((s) => [String(s?.idSite || '').trim(), s])
            .filter(([k]) => Boolean(k))
        );
        const siteByName = new Map(
          (Array.isArray(sites) ? sites : [])
            .filter(Boolean)
            .map((s) => [normSiteName(s?.nameSite), s])
            .filter(([k]) => Boolean(k))
        );

        const findSite = (siteCode, siteName) => {
          const code = String(siteCode || '').trim();
          if (code) {
            const byCode = siteByIdSite.get(code);
            if (byCode) return byCode;
          }
          const nm = normSiteName(siteName);
          if (nm) {
            const byName = siteByName.get(nm);
            if (byName) return byName;
          }
          return null;
        };

        setPmClientProgress(60);
        setPmClientStep('Préparation comparaison…');

        const parseClientRows = () => {
          const out = [];
          const arr = Array.isArray(jsonData) ? jsonData : [];
          for (let idx = 0; idx < arr.length; idx += 1) {
            const row = arr[idx];

            const rawSiteCode = pmGet(row, 'Site (id)', 'Site', 'Site id', 'Site Code', 'Site (Id)');
            const rawSiteName = pmGet(row, 'Site Name', 'Site name', 'Name Site');
            const rawNumber = pmGet(row, 'Number', 'Ticket', 'Ticket Number');
            const rawType = pmGet(row, 'Maintenance Type') || pmInferType(row);
            const rawDate = pmNormalizeDate(pmGet(row, 'Scheduled WO Date', 'Scheduled Wo Date', 'Scheduled date', 'Scheduled Date', 'Date'));
            const shortDescription = String(pmGet(row, 'Short description', 'Short Description') || '').trim();
            const assignedTo = String(pmGet(row, 'Assigned to', 'Assigned To') || '').trim();

            const codes = basePlanSplitCell(rawSiteCode);
            const names = basePlanSplitCell(rawSiteName);
            const nums = basePlanSplitCell(rawNumber);
            const n = Math.max(codes.length, names.length, nums.length, 1);
            for (let i = 0; i < Math.min(n, 2); i += 1) {
              const siteCode = String(codes[i] || codes[0] || '').trim();
              const siteName = String(names[i] || names[0] || '').trim();
              const number = String(nums[i] || nums[0] || '').trim();
              if (!siteCode && !siteName) continue;
              out.push({
                number,
                siteCode,
                siteName,
                maintenanceType: String(rawType || '').trim(),
                scheduledWoDate: rawDate,
                shortDescription,
                assignedTo,
                _row: idx + 2
              });
            }
          }
          return out;
        };

        const clientRows = parseClientRows();

        const numberSeen = new Set();
        for (const r of clientRows) {
          const n = String(r?.number || '').trim();
          if (!n) {
            throw new Error(`Ticket manquant (Number) dans le fichier retour client (ligne Excel ${r?._row || '?'}).`);
          }
          if (numberSeen.has(n)) {
            throw new Error(
              `Doublon de ticket (Number) dans le fichier retour client: '${n}'.\n\nChaque ligne (site) doit avoir un ticket unique, y compris en cas de paire.`
            );
          }
          numberSeen.add(n);
        }

        const baseMap = new Map();
        for (const it of baseItems) {
          const siteCode = String(it?.siteCode || '').trim();
          const date = normalizeYmd(it?.plannedDate);
          const t = normalizeType(it?.recommendedMaintenanceType);
          if (!siteCode || !date || !t) continue;
          const key = `${siteCode}|${date}|${t}`;
          baseMap.set(key, it);
        }

        const clientMap = new Map();
        for (const it of clientRows) {
          const siteCode = String(it?.siteCode || '').trim();
          const date = normalizeYmd(it?.scheduledWoDate);
          const t = normalizeType(it?.maintenanceType);
          if (!siteCode || !date || !t) continue;
          const key = `${siteCode}|${date}|${t}`;
          clientMap.set(key, it);
        }

        const retained = [];
        const removed = [];
        const added = [];

        for (const [key, b] of baseMap.entries()) {
          const c = clientMap.get(key);
          if (c) {
            retained.push({
              siteCode: b.siteCode,
              siteName: b.siteName,
              plannedDate: normalizeYmd(b.plannedDate),
              maintenanceType: b.recommendedMaintenanceType,
              assignedTo: b.assignedTo,
              number: c.number || ''
            });
          } else {
            removed.push({
              siteCode: b.siteCode,
              siteName: b.siteName,
              plannedDate: normalizeYmd(b.plannedDate),
              maintenanceType: b.recommendedMaintenanceType,
              assignedTo: b.assignedTo
            });
          }
        }

        for (const [key, c] of clientMap.entries()) {
          if (baseMap.has(key)) continue;
          const s = findSite(c.siteCode, c.siteName);
          added.push({
            siteCode: c.siteCode,
            siteName: String(c.siteName || s?.nameSite || '').trim(),
            plannedDate: normalizeYmd(c.scheduledWoDate),
            maintenanceType: c.maintenanceType,
            assignedTo: String(c.assignedTo || s?.technician || '').trim(),
            number: c.number || ''
          });
        }

        retained.sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)) || String(a.siteCode).localeCompare(String(b.siteCode)));
        removed.sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)) || String(a.siteCode).localeCompare(String(b.siteCode)));
        added.sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)) || String(a.siteCode).localeCompare(String(b.siteCode)));

        setPmClientCompare({
          month: pmMonth,
          basePlanId: String(basePlan.id),
          baseCount: baseMap.size,
          clientCount: clientMap.size,
          retained,
          removed,
          added
        });

        setPmClientProgress(75);
        setPmClientStep('Construction planning mensuel…');

        const items = [];
        for (const r of clientRows) {
          const number = String(r?.number || '').trim();
          if (!number) continue;
          const siteCode = String(r?.siteCode || '').trim();
          const date = normalizeYmd(r?.scheduledWoDate);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`Date invalide dans le fichier retour client (ligne Excel ${r?._row || '?'}): '${String(r?.scheduledWoDate || '')}'.`);
          }
          const t = normalizeType(r?.maintenanceType);
          const key = `${siteCode}|${date}|${t}`;
          const b = baseMap.get(key) || null;
          const s = b ? null : findSite(siteCode, r?.siteName);
          items.push({
            number,
            siteCode: siteCode || String(b?.siteCode || s?.idSite || '').trim(),
            siteName: String(b?.siteName || r?.siteName || s?.nameSite || '').trim(),
            region: String(b?.region || '').trim(),
            zone: String(b?.zone || b?.region || '').trim(),
            shortDescription: String(b?.shortDescription || r?.shortDescription || '').trim(),
            maintenanceType: String(b?.recommendedMaintenanceType || r?.maintenanceType || '').trim(),
            scheduledWoDate: date,
            assignedTo: String(b?.assignedTo || r?.assignedTo || s?.technician || '').trim(),
            state: 'Assigned',
            closedAt: '',
            reprogrammationDate: '',
            reprogrammationReason: '',
            reprogrammationStatus: ''
          });
        }

        if (items.length === 0) {
          throw new Error('Aucune ligne exploitable trouvée dans le fichier retour client (tickets manquants ?).');
        }

        setPmClientProgress(85);
        setPmClientStep('Enregistrement planning mensuel…');

        const monthId = pmMonthId || (await ensurePmMonth(pmMonth));
        setPmMonthId(monthId);
        await apiFetchJson(`/api/pm/months/${monthId}/client-import`, {
          method: 'POST',
          body: JSON.stringify({ filename: file?.name || null, items })
        });

        setPmClientProgress(95);
        setPmClientStep('Rafraîchissement…');

        await loadPmMonths();
        await loadPmItems(monthId);
        await loadPmImports(monthId);
        await loadPmDashboard(monthId);

        setPmClientProgress(100);
        setPmClientStep('Terminé');
        setPmNotice(
          `✅ Retour client importé. Planning mensuel mis à jour (${items.length} tickets). Retenus: ${retained.length} • Retirés: ${removed.length} • Ajouts: ${added.length}`
        );
      } catch (err) {
        setPmClientProgress(0);
        setPmClientStep('');
        setPmError(err?.message || 'Erreur lors de l\'import retour client.');
      } finally {
        setPmBusy(false);
      }
    };

    setPmClientProgress(10);
    setPmClientStep('Lecture du fichier…');
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const generateBasePlanPreview = async () => {
    if (!isAdmin) return;
    const month = getNextMonthYyyyMm(currentMonth);
    setBasePlanTargetMonth(month);

    const baseRows = Array.isArray(basePlanBaseRows) ? basePlanBaseRows : [];
    if (baseRows.length === 0) {
      alert('Veuillez d\'abord importer le fichier base.');
      return;
    }

    const siteByCode = new Map(
      (Array.isArray(sites) ? sites : [])
        .filter(Boolean)
        .map((s) => [String(s?.idSite || '').trim(), s])
        .filter(([k]) => k)
    );

    const findSiteForRow = (r) => {
      const code = String(r?.siteCode || '').trim();
      if (code) {
        const s = siteByCode.get(code);
        if (s) return s;
      }
      const name = String(r?.siteName || '').trim();
      if (!name) return null;
      return (Array.isArray(sites) ? sites : []).find((s) => String(s?.nameSite || '').trim() === name) || null;
    };

    const byTech = new Map();
    for (const r of baseRows) {
      const tech = String(r?.assignedTo || '').trim() || 'Non assigné';
      if (!byTech.has(tech)) byTech.set(tech, []);
      byTech.get(tech).push(r);
    }

    const errors = [];
    const candidatesByTech = new Map();

    for (const [tech, rows] of byTech.entries()) {
      const uniqueSites = new Set(rows.map((r) => String(r?.siteCode || r?.siteName || '').trim()).filter(Boolean));
      const hasPairGroup = rows.some((r) => String(r?.pairGroup || '').trim());
      const capacityPerDay = hasPairGroup || uniqueSites.size > 20 ? 2 : 1;

      const items = [];
      for (const r of rows) {
        const s0 = findSiteForRow(r);
        const computed = s0 ? getUpdatedSite(s0) : null;
        const zone = String(r?.zone || r?.region || '').trim();

        const picks = (() => {
          const srcEpv1 = isBzvPoolZone(zone) ? computed?.epv1 : r?.epv1 || computed?.epv1;
          const srcEpv2 = isBzvPoolZone(zone) ? computed?.epv2 : r?.epv2 || computed?.epv2;
          const srcEpv3 = isBzvPoolZone(zone) ? computed?.epv3 : r?.epv3 || computed?.epv3;
          const epv1 = String(srcEpv1 || '').slice(0, 10);
          const epv2 = String(srcEpv2 || '').slice(0, 10);
          const epv3 = String(srcEpv3 || '').slice(0, 10);
          const inMonth = (d) => d && String(d).slice(0, 7) === month;
          const monthStart = `${month}-01`;

          const manualPlanned = String(r?.scheduledWoDate || '').slice(0, 10);
          if (inMonth(manualPlanned)) {
            const t = String(r?.maintenanceType || '').trim() || pmInferType(r) || 'FullPMWO';
            return [{ slot: 'Manual', date: manualPlanned, type: t, epv1, epv2, epv3, keepPairGroup: true }];
          }

          // CAS 2 : EPV1 dans le mois cible => on conserve la logique normale
          if (inMonth(epv1)) {
            return [{ slot: 'EPV1', date: epv1, type: 'FullPMWO', epv1, epv2, epv3, keepPairGroup: true }];
          }

          // CAS 1 : EPV1 est dans un mois précédent ET EPV2 dans le mois cible => transition
          // EPV2 devient EPV1 (FullPMWO) et EPV3 devient EPV2 (DG Service) si EPV3 est aussi dans le mois
          const epv1IsBeforeMonth = epv1 && /^\d{4}-\d{2}-\d{2}$/.test(epv1) && epv1 < monthStart;
          if (epv1IsBeforeMonth && inMonth(epv2)) {
            const out = [];
            out.push({ slot: 'EPV1', date: epv2, type: 'FullPMWO', epv1, epv2, epv3, keepPairGroup: true });
            if (inMonth(epv3)) {
              out.push({ slot: 'EPV2', date: epv3, type: 'DG Service', epv1, epv2, epv3, keepPairGroup: true });
            }
            return out;
          }

          // Sinon: logique fallback (DG sur EPV2/EPV3 dans le mois)
          const c2 = inMonth(epv2) ? { slot: 'EPV2', date: epv2, type: 'DG Service', epv1, epv2, epv3, keepPairGroup: true } : null;
          const c3 = inMonth(epv3) ? { slot: 'EPV3', date: epv3, type: 'DG Service', epv1, epv2, epv3, keepPairGroup: true } : null;
          if (c2 && c3) return [c2.date <= c3.date ? c2 : c3];

          const fallbackType = String(r?.maintenanceType || '').trim() || pmInferType(r) || '';
          const best = c2 || c3;
          if (best) return [best];
          if (fallbackType && (inMonth(epv1) || epv1)) return [{ slot: 'EPV1', date: epv1, type: fallbackType, epv1, epv2, epv3, keepPairGroup: true }];

          // Option A : aucune EPV dans le mois cible => PM Simple (PM sans vidange)
          if (!inMonth(epv1) && !inMonth(epv2) && !inMonth(epv3)) {
            return [{ slot: 'PM', date: monthStart, type: 'PM Simple', epv1, epv2, epv3, keepPairGroup: true }];
          }

          return [];
        })();

        if (!Array.isArray(picks) || picks.length === 0) {
          if (!s0 && (r?.siteCode || r?.siteName)) {
            errors.push(`Site introuvable (base): ${String(r?.siteCode || r?.siteName || '').trim()}`);
          }
          continue;
        }

        const resolvedSiteId = s0 ? String(s0?.id || '') : '';
        const resolvedSiteCode = s0 ? String(s0?.idSite || r?.siteCode || '').trim() : String(r?.siteCode || '').trim();
        const resolvedSiteName = s0 ? String(s0?.nameSite || r?.siteName || '').trim() : String(r?.siteName || '').trim();

        for (const pick of picks) {
          const shifted = ymdShiftForWorkdays(pick.date);
          const targetDate = shifted || pick.date;
          const baseShort = String(r?.shortDescription || '').trim();
          const isManual = String(pick?.slot || '').toLowerCase() === 'manual';

          items.push({
            technician: tech,
            capacityPerDay,
            importOrder: Number(r?.importOrder ?? 0),
            siteId: resolvedSiteId,
            siteCode: resolvedSiteCode,
            siteName: resolvedSiteName,
            region: String(r?.region || '').trim(),
            zone,
            assignedTo: tech === 'Non assigné' ? '' : tech,
            pairGroup: pick?.keepPairGroup ? String(r?.pairGroup || '').trim() : '',
            epvSlot: pick.slot,
            recommendedMaintenanceType: pick.type,
            shortDescription: isManual ? (baseShort || pick.type) : pick.type,
            epv1: String(pick?.epv1 || (computed?.epv1 || r?.epv1) || '').slice(0, 10),
            epv2: String(pick?.epv2 || (computed?.epv2 || r?.epv2) || '').slice(0, 10),
            epv3: String(pick?.epv3 || (computed?.epv3 || r?.epv3) || '').slice(0, 10),
            targetDate,
            plannedDate: ''
          });
        }
      }

      candidatesByTech.set(tech, items);

      if (capacityPerDay === 2) {
        const byGroup = new Map();
        for (const it of items) {
          const g = String(it?.pairGroup || '').trim();
          if (!g) continue;
          if (!byGroup.has(g)) byGroup.set(g, 0);
          byGroup.set(g, byGroup.get(g) + 1);
        }
        for (const [g, n] of byGroup.entries()) {
          if (n !== 2) errors.push(`PairGroup '${g}' pour '${tech}' doit contenir 2 sites (trouvé ${n}).`);
        }
      }
    }

    const monthStart = `${month}-01`;
    const monthEndD = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
    monthEndD.setUTCMonth(monthEndD.getUTCMonth() + 1);
    monthEndD.setUTCDate(monthEndD.getUTCDate() - 1);
    const monthEnd = monthEndD.toISOString().slice(0, 10);

    const addDaysYmd = (ymd, days) => {
      const src = String(ymd).slice(0, 10);
      const yy = Number(src.slice(0, 4));
      const mm = Number(src.slice(5, 7));
      const dd = Number(src.slice(8, 10));
      const d = new Date(Date.UTC(yy, mm - 1, dd));
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };

    const isInMonth = (d) => String(d).slice(0, 7) === month;

    const scheduledAll = [];
    for (const [tech, items] of candidatesByTech.entries()) {
      const capacityPerDay = Number(items?.[0]?.capacityPerDay || 1);
      const used = new Map();

      const fixed = [];
      const floating = [];
      for (const it of items) {
        if (String(it?.epvSlot || '').toLowerCase() === 'manual') {
          fixed.push(it);
        } else {
          floating.push(it);
        }
      }

      for (const it of fixed) {
        const d0 = String(it?.targetDate || '').slice(0, 10);
        if (!isInMonth(d0)) {
          errors.push(`Date invalide (hors mois) pour '${it.siteCode || it.siteName}' (${tech}): ${d0}`);
          continue;
        }
        const curUsed = Number(used.get(d0) || 0);
        const need = String(it?.pairGroup || '').trim() ? 1 : 1;
        if (curUsed + need > capacityPerDay) {
          errors.push(`Capacité dépassée le ${d0} pour '${tech}' (sites manuels).`);
          continue;
        }
        used.set(d0, curUsed + need);
        scheduledAll.push({ ...it, plannedDate: d0 });
      }

      const units = [];
      if (capacityPerDay === 2) {
        const grouped = new Map();
        const singles = [];
        for (const it of floating) {
          const g = String(it?.pairGroup || '').trim();
          if (g) {
            if (!grouped.has(g)) grouped.set(g, []);
            grouped.get(g).push(it);
          } else {
            singles.push(it);
          }
        }
        for (const [g, arr] of grouped.entries()) {
          if (arr.length !== 2) {
            errors.push(`PairGroup '${g}' pour '${tech}' doit contenir 2 sites (trouvé ${arr.length}).`);
            for (const it of arr) {
              units.push({ kind: 'single', size: 1, group: '', items: [{ ...it, pairGroup: '' }] });
            }
            continue;
          }
          const sortedArr = arr
            .slice()
            .sort((a, b) => {
              const aIsPmSimple = String(a?.recommendedMaintenanceType || '').trim() === 'PM Simple' || String(a?.epvSlot || '').trim() === 'PM';
              const bIsPmSimple = String(b?.recommendedMaintenanceType || '').trim() === 'PM Simple' || String(b?.epvSlot || '').trim() === 'PM';
              // Mettre PM Simple en second si l'autre item n'est pas PM Simple
              if (aIsPmSimple !== bIsPmSimple) return aIsPmSimple ? 1 : -1;
              // Sinon, garder l'ordre du fichier Excel autant que possible
              const oa = Number(a?.importOrder ?? 0);
              const ob = Number(b?.importOrder ?? 0);
              if (oa !== ob) return oa - ob;
              return String(a?.targetDate || '').localeCompare(String(b?.targetDate || ''));
            });
          units.push({ kind: 'pair', size: sortedArr.length, group: g, items: sortedArr });
        }
        for (const it of singles) {
          units.push({ kind: 'single', size: 1, group: '', items: [it] });
        }
      } else {
        for (const it of floating) units.push({ kind: 'single', size: 1, group: '', items: [it] });
      }

      units.sort((a, b) => {
        const da = String(a?.items?.[0]?.targetDate || '');
        const db = String(b?.items?.[0]?.targetDate || '');
        const c = da.localeCompare(db);
        if (c !== 0) return c;
        return String(a?.group || '').localeCompare(String(b?.group || ''));
      });

      for (const u of units) {
        const need = u.kind === 'pair' ? 2 : 1;
        const target = String(u?.items?.[0]?.targetDate || '').slice(0, 10);
        let d = target;
        if (!/^(\d{4}-\d{2}-\d{2})$/.test(d)) d = monthStart;
        if (!isInMonth(d)) d = monthStart;

        let scheduledDate = '';
        const tryScheduleFrom = (startYmd) => {
          let dd = startYmd;
          let best = '';
          let bestCurUsed = 0;
          for (let step = 0; step < 80; step += 1) {
            const shifted = ymdShiftForWorkdays(dd);
            const cur = shifted || dd;
            if (!isInMonth(cur) || cur < monthStart || cur > monthEnd) {
              dd = addDaysYmd(dd, 1);
              continue;
            }
            const curUsed = Number(used.get(cur) || 0);
            if (curUsed + need <= capacityPerDay) {
              if (need === 1 && capacityPerDay === 2) {
                // Préférer compléter une journée déjà entamée (1/2) plutôt que d'ouvrir une nouvelle journée.
                if (curUsed === 1) {
                  best = cur;
                  bestCurUsed = curUsed;
                  break;
                }
                if (!best) {
                  best = cur;
                  bestCurUsed = curUsed;
                }
              } else {
                best = cur;
                bestCurUsed = curUsed;
                break;
              }
            }
            dd = addDaysYmd(dd, 1);
          }

          if (best) {
            scheduledDate = best;
            used.set(best, bestCurUsed + need);
          }
        };

        // 1) Essai "naturel": depuis la date cible (EPV / targetDate) vers l'avant
        tryScheduleFrom(d);
        // 2) Fallback: si fin de mois saturée, on réessaie depuis le début du mois
        if (!scheduledDate && d !== monthStart) {
          tryScheduleFrom(monthStart);
        }

        if (!scheduledDate) {
          const sitesLabel = u.items
            .map((it) => String(it?.siteCode || it?.siteName || '').trim())
            .filter(Boolean)
            .join(' / ');
          errors.push(`Impossible de planifier '${sitesLabel || 'site(s)'}' pour '${tech}' dans ${month}.`);
          continue;
        }

        for (const it of u.items) {
          scheduledAll.push({ ...it, plannedDate: scheduledDate });
        }
      }
    }

    setBasePlanErrors(errors);
    setBasePlanPreview(
      scheduledAll
        .slice()
        .sort((a, b) => {
          const d = String(a.plannedDate || '').localeCompare(String(b.plannedDate || ''));
          if (d !== 0) return d;
          const t = String(a.technician || '').localeCompare(String(b.technician || ''));
          if (t !== 0) return t;
          const oa = Number(a?.importOrder ?? 0);
          const ob = Number(b?.importOrder ?? 0);
          if (oa !== ob) return oa - ob;
          return String(a.siteCode || '').localeCompare(String(b.siteCode || ''));
        })
    );

    alert(`✅ Planning généré: ${scheduledAll.length} sites planifiés pour ${month}.`);
  };

  const saveBasePlanToDb = async () => {
    if (!isAdmin) return;
    const month = String(basePlanTargetMonth || '').trim();
    const items = Array.isArray(basePlanPreview) ? basePlanPreview : [];
    if (!/^\d{4}-\d{2}$/.test(month) || items.length === 0) {
      alert('Aucun planning à enregistrer.');
      return;
    }
    const ok = window.confirm(`Enregistrer le planning de base (mois ${month}) en base de données ?`);
    if (!ok) return;

    setBasePlanBusy(true);
    setBasePlanProgress(15);
    try {
      const planRes = await apiFetchJson('/api/pm/base-plans', { method: 'POST', body: JSON.stringify({ month }) });
      const finalPlanId = String(planRes?.plan?.id || '').trim();
      if (!finalPlanId) throw new Error('Plan ID introuvable.');
      setBasePlanProgress(45);

      const payloadItems = items.map((it) => ({
        siteId: it.siteId,
        siteCode: it.siteCode,
        siteName: it.siteName,
        region: it.region,
        zone: it.zone,
        assignedTo: it.assignedTo,
        pairGroup: it.pairGroup,
        epvSlot: it.epvSlot,
        shortDescription: it.shortDescription,
        recommendedMaintenanceType: it.recommendedMaintenanceType,
        plannedDate: it.plannedDate,
        state: 'Planned'
      }));
      await apiFetchJson(`/api/pm/base-plans/${finalPlanId}/items`, { method: 'POST', body: JSON.stringify({ items: payloadItems }) });
      setBasePlanProgress(100);
      alert('✅ Planning de base enregistré.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    } finally {
      setTimeout(() => {
        setBasePlanBusy(false);
        setBasePlanProgress(0);
      }, 300);
    }
  };

  const exportBasePlanPreviewExcel = async () => {
    const month = String(basePlanTargetMonth || '').trim();
    const items = Array.isArray(basePlanPreview) ? basePlanPreview : [];
    if (!/^\d{4}-\d{2}$/.test(month) || items.length === 0) {
      alert('Aucun planning à exporter.');
      return;
    }
    const done = await runExport({
      label: 'Export Excel (planning base)…',
      fn: async () => {
        const groups = new Map();
        for (const it of items) {
          const g = String(it?.pairGroup || '').trim();
          const key = `${it.plannedDate}||${it.assignedTo || ''}||${g || it.siteCode || it.siteName || ''}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(it);
        }
        const rows = [];
        for (const arr of groups.values()) {
          const sorted = arr
            .slice()
            .sort((a, b) => {
              const oa = Number(a?.importOrder ?? 0);
              const ob = Number(b?.importOrder ?? 0);
              if (oa !== ob) return oa - ob;
              return String(a.siteCode || '').localeCompare(String(b.siteCode || ''));
            });
          const first = sorted[0] || {};
          const second = sorted[1] || null;
          const hasTwo = sorted.length === 2;

          const siteCode = hasTwo ? `${first.siteCode || ''}\r\n${second?.siteCode || ''}`.trim() : first.siteCode || '';
          const siteName = hasTwo ? `${first.siteName || ''}\r\n${second?.siteName || ''}`.trim() : first.siteName || '';
          const mt = hasTwo && first.recommendedMaintenanceType !== second?.recommendedMaintenanceType
            ? `${first.recommendedMaintenanceType || ''} + ${second?.recommendedMaintenanceType || ''}`.trim()
            : first.recommendedMaintenanceType || '';

          rows.push({
            Zone: first.zone || '',
            Region: first.region || '',
            'Site (id)': siteCode,
            'Site Name': siteName,
            'Short description': first.shortDescription || '',
            'Assigned to': first.assignedTo || '',
            'Scheduled WO Date': first.plannedDate || '',
            PairGroup: first.pairGroup || '',
            'Date EPV 1': first.epv1 || '',
            'Date EPV 2': first.epv2 || '',
            'Date EPV 3': first.epv3 || ''
          });
        }
        exportXlsx({
          fileBaseName: `Planning_Base_${month}_${new Date().toISOString().slice(0, 10)}`,
          sheets: [{ name: `BASE-${month}`, rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const handlePmExportReprogExcel = async () => {
    if (!canUsePm) return;
    const ok = window.confirm(`Exporter les maintenances reprogrammées (${pmMonth}) en Excel ?`);
    if (!ok) return;

    const norm = (s) => String(s || '').trim().toLowerCase();
    const normStatus = (s) => {
      const v = String(s || '').trim().toLowerCase();
      if (!v) return '';
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
      const explicit = normStatus(it?.reprogrammationStatus);
      if (explicit) return explicit;
      const hasDate = !!String(it?.reprogrammationDate || '').trim();
      const hasReason = !!String(it?.reprogrammationReason || '').trim();
      if (hasDate) return 'APPROVED';
      if (hasReason) return 'PENDING';
      return '';
    };

    const reprogItems = (Array.isArray(pmItems) ? pmItems : [])
      .filter((it) => it && effectiveReprogStatus(it))
      .slice()
      .sort((a, b) => {
        const da = String(a?.scheduledWoDate || '').slice(0, 10);
        const db = String(b?.scheduledWoDate || '').slice(0, 10);
        const d = da.localeCompare(db);
        if (d !== 0) return d;
        return String(a?.number || '').localeCompare(String(b?.number || ''));
      });

    const rows = reprogItems.map((it) => ({
      'Zone': it.zone || '',
      'Region': it.region || '',
      'Site': it.siteCode || '',
      'Site Name': it.siteName || '',
      'Maintenance Type': it.maintenanceType || '',
      'Number': it.number || '',
      'Assigned to': it.assignedTo || '',
      'Scheduled WO Date': it.scheduledWoDate || '',
      'Statut reprogrammation': effectiveReprogStatus(it) || '',
      'Reprogrammation': it.reprogrammationDate || '',
      'Raisons': it.reprogrammationReason || '',
      'State': it.state || ''
    }));

    const done = await runExport({
      label: 'Export Excel (reprogrammées)…',
      fn: async () => {
        exportXlsx({
          fileBaseName: `PM_REPROG_${pmMonth}_${new Date().toISOString().split('T')[0]}`,
          sheets: [{ name: `REPROG-${pmMonth}`, rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const handlePmNocImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ok = window.confirm(
      `Confirmer l'import de l'extraction NOC ?\n\nLe système va mettre à jour les states du mois ${pmMonth}.\nFichier: ${file?.name || ''}`
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    setPmBusy(true);
    setPmError('');

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const monthId = pmMonthId || (await ensurePmMonth(pmMonth));
        setPmMonthId(monthId);

        const rows = [];
        for (const row of Array.isArray(jsonData) ? jsonData : []) {
          const number = String(pmGet(row, 'Number') || '').trim();
          if (!number) continue;
          const state = String(pmGet(row, 'State') || '').trim();
          const closedAt = pmNormalizeDate(pmGet(row, 'Closed', 'Date of closing'));
          rows.push({ number, state, closedAt });
        }

        const res = await apiFetchJson(`/api/pm/months/${monthId}/noc-import`, {
          method: 'POST',
          body: JSON.stringify({ filename: file?.name || null, rows })
        });

        setPmNocProgress(80);
        setPmNocStep('Rafraîchissement…');

        await loadPmItems(monthId);
        await loadPmImports(monthId);
        await loadPmDashboard(monthId);

        setPmNocProgress(100);
        setPmNocStep('Terminé');

        const msg =
          Number(res?.missing || 0) > 0
            ? `✅ Import NOC terminé. Mis à jour: ${res?.updated || 0} • Introuvables dans le planning: ${res?.missing || 0}`
            : `✅ Import NOC terminé. Mis à jour: ${res?.updated || 0}`;
        setPmNotice(msg);

        if (Number(res?.missing || 0) > 0) {
          alert(
            `✅ Import NOC terminé.\n\nMis à jour: ${res?.updated || 0}\nIntrouvables dans le planning: ${res?.missing || 0}`
          );
        } else {
          alert(`✅ Import NOC terminé. Mis à jour: ${res?.updated || 0}`);
        }
      } catch (err) {
        setPmNocProgress(0);
        setPmNocStep('');
        setPmError(err?.message || 'Erreur lors de l\'import NOC.');
      } finally {
        setPmBusy(false);
      }
    };

    setPmNocProgress(10);
    setPmNocStep('Lecture du fichier…');
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handlePmReset = async (mode) => {
    if (!isAdmin) return;
    if (!pmMonthId) {
      setPmError('Veuillez sélectionner un mois PM.');
      return;
    }

    const isAll = String(mode) === 'all';
    const ok = window.confirm(
      isAll
        ? `Confirmer le reset COMPLET du mois ${pmMonth} ?\n\nCela supprime: planning + imports + lignes NOC.`
        : `Confirmer la suppression des imports du mois ${pmMonth} ?\n\nCela supprime: historique imports + lignes NOC (le planning reste).`
    );
    if (!ok) return;

    try {
      setPmResetBusy(true);
      setPmError('');
      setPmNotice('');

      const res = await apiFetchJson(`/api/pm/months/${pmMonthId}/reset`, {
        method: 'POST',
        body: JSON.stringify({ mode: isAll ? 'all' : 'imports' })
      });

      await loadPmItems(pmMonthId);
      await loadPmImports(pmMonthId);
      await loadPmDashboard(pmMonthId);

      const d = res?.deleted || {};
      const msg = isAll
        ? `✅ Reset mois terminé. Items supprimés: ${d.items || 0} • Imports: ${d.imports || 0} • Lignes NOC: ${d.nocRows || 0}`
        : `✅ Imports supprimés. Imports: ${d.imports || 0} • Lignes NOC: ${d.nocRows || 0}`;
      setPmNotice(msg);
    } catch (e) {
      setPmError(e?.message || 'Erreur lors du reset PM.');
    } finally {
      setPmResetBusy(false);
    }
  };

  const pingPresence = async (activity) => {
    await apiFetchJson('/api/presence/ping', {
      method: 'POST',
      body: JSON.stringify({ tabId, activity: String(activity || '') })
    });
  };

  const handleAddSite = async () => {
    if (!formData.nameSite || !formData.idSite || !formData.technician || !formData.generateur || !formData.capacite || !formData.kitVidange || !formData.nh1DV || !formData.dateDV || !formData.nh2A || !formData.dateA) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const nh1 = parseInt(formData.nh1DV);
    const nh2 = parseInt(formData.nh2A);
    const regime = calculateRegime(nh1, nh2, formData.dateDV, formData.dateA);
    const nhEstimated = calculateEstimatedNH(nh2, formData.dateA, regime);
    const diffNHs = calculateDiffNHs(nh1, nh2);
    const diffEstimated = calculateDiffNHs(nh1, nhEstimated);
    const epvDates = calculateEPVDates(regime, formData.dateA, nh1, nhEstimated);

    const newSite = {
      nameSite: formData.nameSite,
      idSite: formData.idSite,
      technician: formData.technician,
      generateur: formData.generateur,
      capacite: formData.capacite,
      kitVidange: formData.kitVidange,
      regime,
      nh1DV: nh1,
      dateDV: formData.dateDV,
      nh2A: nh2,
      dateA: formData.dateA,
      nhEstimated,
      diffNHs,
      diffEstimated,
      seuil: 250,
      retired: formData.retired,
      ...epvDates
    };

    try {
      const ok = window.confirm(`Confirmer l'ajout du site "${newSite.nameSite}" (ID: ${newSite.idSite}) ?`);
      if (!ok) return;
      await apiFetchJson('/api/sites', {
        method: 'POST',
        body: JSON.stringify(newSite)
      });
      await loadData();
      setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
      setShowAddForm(false);
      alert('✅ Site ajouté avec succès.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleUpdateSite = async () => {
    if (!formData.nh2A || !formData.dateA) {
      alert('Veuillez remplir NH2 A et Date A');
      return;
    }

    try {
      const site = selectedSite;
      const ok = window.confirm(
        `Confirmer la mise à jour du site "${site?.nameSite || ''}" (ID: ${site?.idSite || ''}) ?`
      );
      if (!ok) return;
      const nh2 = parseInt(formData.nh2A);
      const regime = calculateRegime(site.nh1DV, nh2, site.dateDV, formData.dateA);
      const nhEstimated = calculateEstimatedNH(nh2, formData.dateA, regime);
      const diffNHs = calculateDiffNHs(site.nh1DV, nh2);
      const diffEstimated = calculateDiffNHs(site.nh1DV, nhEstimated);

      const data = await apiFetchJson(`/api/sites/${site.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nh2A: nh2,
          dateA: formData.dateA,
          regime,
          nhEstimated,
          diffNHs,
          diffEstimated,
          retired: formData.retired
        })
      });

      if (data?.site?.id) {
        setSites(sites.map((s) => (String(s.id) === String(data.site.id) ? data.site : s)));
      }

      setShowUpdateForm(false);
      setSelectedSite(null);
      setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
      alert('✅ Site mis à jour.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleEditSite = async () => {
    if (!formData.nameSite || !formData.idSite || !formData.technician || !formData.generateur || !formData.capacite || !formData.kitVidange || !formData.nh1DV || !formData.dateDV || !formData.nh2A || !formData.dateA) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const site = selectedSite;
      const ok = window.confirm(
        `Confirmer la modification du site "${site?.nameSite || ''}" (ID: ${site?.idSite || ''}) ?`
      );
      if (!ok) return;
      const nh1 = parseInt(formData.nh1DV);
      const nh2 = parseInt(formData.nh2A);
      const regime = calculateRegime(nh1, nh2, formData.dateDV, formData.dateA);
      const nhEstimated = calculateEstimatedNH(nh2, formData.dateA, regime);
      const diffNHs = calculateDiffNHs(nh1, nh2);
      const diffEstimated = calculateDiffNHs(nh1, nhEstimated);

      const data = await apiFetchJson(`/api/sites/${site.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameSite: formData.nameSite,
          idSite: formData.idSite,
          technician: formData.technician,
          generateur: formData.generateur,
          capacite: formData.capacite,
          kitVidange: formData.kitVidange,
          nh1DV: nh1,
          dateDV: formData.dateDV,
          nh2A: nh2,
          dateA: formData.dateA,
          regime,
          nhEstimated,
          diffNHs,
          diffEstimated,
          retired: formData.retired
        })
      });

      if (data?.site?.id) {
        setSites(sites.map((s) => (String(s.id) === String(data.site.id) ? data.site : s)));
      }

      setShowEditForm(false);
      setSelectedSite(null);
      setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
      alert('✅ Site modifié.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleDeleteSite = async () => {
    try {
      await apiFetchJson(`/api/sites/${siteToDelete.id}`, { method: 'DELETE' });
      const updatedSites = sites.filter(site => String(site.id) !== String(siteToDelete.id));
      setSites(updatedSites);
      setShowDeleteConfirm(false);
      setSiteToDelete(null);
      alert('✅ Site supprimé.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleResetData = async (opts = {}) => {
    try {
      const includePm = Boolean(opts?.includePm);
      const ok = window.confirm(
        includePm
          ? 'Confirmer la réinitialisation complète (Vidanges + PM) ? Cette action est irréversible.'
          : 'Confirmer la réinitialisation Vidanges ? (PM conservé) Cette action est irréversible.'
      );
      if (!ok) return;
      if (authUser?.role === 'admin') {
        try {
          await apiFetchJson('/api/admin/reset', { method: 'POST', body: JSON.stringify({ includePm }) });
        } catch (e) {
          // ignore
        }
      }

      try {
        localStorage.removeItem(APP_VERSION_STORAGE_KEY);
      } catch {
        // ignore
      }

      setSites([]);
      setFicheHistory([]);
      setInterventions([]);
      setTicketNumber(1201);
      setFilterTechnician('all');
      setSelectedSite(null);
      setSiteToDelete(null);

      if (includePm) {
        setPmMonths([]);
        setPmItems([]);
        setPmImports([]);
        setPmDashboard(null);
        setPmMonthId('');
      }

      setShowResetConfirm(false);
      setShowDeleteConfirm(false);
      setShowCalendar(false);
      setShowTechCalendar(false);
      setShowHistory(false);
      setShowFicheModal(false);
      setShowBannerUpload(false);
      setShowPm(false);
      setBannerImage('');
      setSiteForFiche(null);
      setFicheContext(null);
      setSelectedDate(null);
      setSelectedDayEvents([]);
      setShowDayDetailsModal(false);
      setTechSelectedDate(null);
      setTechSelectedDayEvents([]);
      setShowTechDayDetailsModal(false);
      setIsBatchFiche(false);
      setBatchFicheSites([]);
      setBatchFicheIndex(0);

      if (includePm) {
        alert('✅ Réinitialisation complète terminée (Vidanges + PM).');
      } else {
        alert('✅ Réinitialisation Vidanges terminée (PM conservé).');
      }

      try {
        await loadData();
        await loadFicheHistory();
        if (authUser?.role === 'admin') {
          await loadTicketNumber();
        }
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setSites([]);
      setFicheHistory([]);
      setTicketNumber(1201);
      setShowResetConfirm(false);
      alert('✅ Données réinitialisées avec succès !');
    }
  };

  const handleBannerUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBannerImage(event.target.result);
      setShowBannerUpload(false);
      setShowFicheModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateFiche = (site) => {
    setIsBatchFiche(false);
    setBatchFicheSites([]);
    setBatchFicheIndex(0);
    setSiteForFiche(site);
    try {
      const today = new Date().toISOString().split('T')[0];
      const candidates = [
        { type: 'EPV1', date: site.epv1 },
        { type: 'EPV2', date: site.epv2 },
        { type: 'EPV3', date: site.epv3 }
      ].filter((c) => c.date);

      const next = candidates.find((c) => c.date >= today) || candidates[0];
      setFicheContext({ plannedDate: next?.date || null, epvType: next?.type || null });
    } catch (e) {
      setFicheContext(null);
    }
    setShowBannerUpload(true);
  };

  const startBatchFicheGeneration = (events) => {
    const uniqueEvents = Array.from(
      new Map((events || []).map((e) => [e.site.id, e])).values()
    );

    uniqueEvents.sort((a, b) => {
      const ta = String(a?.site?.technician || '');
      const tb = String(b?.site?.technician || '');
      const tCmp = ta.localeCompare(tb);
      if (tCmp !== 0) return tCmp;
      const na = String(a?.site?.nameSite || '');
      const nb = String(b?.site?.nameSite || '');
      return na.localeCompare(nb);
    });

    if (uniqueEvents.length === 0) {
      alert('Aucune vidange planifiée ce jour.');
      return;
    }

    setIsBatchFiche(true);
    setBatchFicheSites(uniqueEvents);
    setBatchFicheIndex(0);
    setSiteForFiche(uniqueEvents[0].site);
    setFicheContext({ plannedDate: uniqueEvents[0].date || null, epvType: uniqueEvents[0].type || null });
    setShowDayDetailsModal(false);
    setShowBannerUpload(true);
  };

  const handlePrintFiche = () => {
    (async () => {
      let usedTicketNumber = ticketNumber;

      if (isAdmin) {
        try {
          const data = await apiFetchJson('/api/meta/ticket-number/next', { method: 'POST', body: JSON.stringify({}) });
          if (Number.isFinite(Number(data?.ticketNumber))) {
            usedTicketNumber = Number(data.ticketNumber);
            setTicketNumber(usedTicketNumber);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }
        } catch (e) {
          // fallback: keep local state
        }
      }

      await new Promise((r) => setTimeout(r, 50));
      window.print();

      const newFiche = {
        id: Date.now(),
        ticketNumber: `T${String(usedTicketNumber).padStart(5, '0')}`,
        siteId: siteForFiche.id,
        siteName: siteForFiche.nameSite,
        technician: siteForFiche.technician,
        dateGenerated: new Date().toISOString(),
        status: 'En attente',
        nh1DV: siteForFiche.nh1DV,
        plannedDate: ficheContext?.plannedDate || null,
        epvType: ficheContext?.epvType || null,
        createdBy: authUser?.email || null
      };

      setFicheHistory((prev) => {
        const updatedHistory = [newFiche, ...prev];
        saveFicheHistory(updatedHistory);
        return updatedHistory;
      });

      if (isAdmin) {
        try {
          await loadTicketNumber();
        } catch (e) {
          // ignore
        }
      }

      if (isBatchFiche) {
        const nextIndex = batchFicheIndex + 1;
        if (nextIndex < batchFicheSites.length) {
          setBatchFicheIndex(nextIndex);
          setSiteForFiche(batchFicheSites[nextIndex].site);
          setFicheContext({ plannedDate: batchFicheSites[nextIndex].date || null, epvType: batchFicheSites[nextIndex].type || null });
        } else {
          setIsBatchFiche(false);
          setBatchFicheSites([]);
          setBatchFicheIndex(0);
          setShowFicheModal(false);
          setSiteForFiche(null);
          setBannerImage('');
          setFicheContext(null);
        }
      }
    })();
  };

  const handleSaveFichePdf = async () => {
    const el = document.getElementById('fiche-print');
    if (!el) {
      alert("Zone d'impression introuvable.");
      return;
    }

    try {
      let usedTicketNumber = ticketNumber;
      if (isAdmin) {
        try {
          const data = await apiFetchJson('/api/meta/ticket-number/next', { method: 'POST', body: JSON.stringify({}) });
          if (Number.isFinite(Number(data?.ticketNumber))) {
            usedTicketNumber = Number(data.ticketNumber);
            setTicketNumber(usedTicketNumber);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }
        } catch {
          // ignore
        }
      }

      const fileBase = `Fiche_${String(siteForFiche?.nameSite || 'Site').replace(/[^a-z0-9_-]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}`;

      await new Promise((r) => setTimeout(r, 80));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(1, Number(el.scrollWidth || el.clientWidth || 0)),
        windowHeight: Math.max(1, Number(el.scrollHeight || el.clientHeight || 0))
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      const pageW = 210;
      const pageH = 297;
      let imgW = pageW;
      let imgH = (canvas.height * imgW) / canvas.width;
      if (imgH > pageH) {
        const s = pageH / imgH;
        imgW *= s;
        imgH *= s;
      }
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;
      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');

      pdf.save(`${fileBase}.pdf`);

      if (isAdmin && Number.isFinite(Number(usedTicketNumber))) {
        const newFiche = {
          id: Date.now(),
          ticketNumber: `T${String(usedTicketNumber).padStart(5, '0')}`,
          siteId: siteForFiche.id,
          siteName: siteForFiche.nameSite,
          technician: siteForFiche.technician,
          dateGenerated: new Date().toISOString(),
          status: 'En attente',
          nh1DV: siteForFiche.nh1DV,
          plannedDate: ficheContext?.plannedDate || null,
          epvType: ficheContext?.epvType || null,
          createdBy: authUser?.email || null
        };

        setFicheHistory((prev) => {
          const updatedHistory = [newFiche, ...prev];
          saveFicheHistory(updatedHistory);
          return updatedHistory;
        });

        try {
          await loadTicketNumber();
        } catch {
          // ignore
        }
      }

      if (isAdmin && isBatchFiche) {
        const nextIndex = batchFicheIndex + 1;
        if (nextIndex < batchFicheSites.length) {
          setBatchFicheIndex(nextIndex);
          setSiteForFiche(batchFicheSites[nextIndex].site);
          setFicheContext({ plannedDate: batchFicheSites[nextIndex].date || null, epvType: batchFicheSites[nextIndex].type || null });
        } else {
          setIsBatchFiche(false);
          setBatchFicheSites([]);
          setBatchFicheIndex(0);
          setShowFicheModal(false);
          setSiteForFiche(null);
          setBannerImage('');
          setFicheContext(null);
        }
      }
    } catch (e) {
      alert(e?.message || 'Erreur lors de la génération du PDF.');
    }
  };

  const goBatchFiche = (delta) => {
    if (!isBatchFiche) return;
    const nextIndex = Number(batchFicheIndex) + Number(delta || 0);
    if (!Number.isFinite(nextIndex)) return;
    if (nextIndex < 0 || nextIndex >= batchFicheSites.length) return;
    setBatchFicheIndex(nextIndex);
    setSiteForFiche(batchFicheSites[nextIndex].site);
    setFicheContext({ plannedDate: batchFicheSites[nextIndex].date || null, epvType: batchFicheSites[nextIndex].type || null });
  };

  const handleMarkAsCompleted = (ficheId) => {
    const fiche = ficheHistory.find(f => f.id === ficheId);
    if (!fiche) return;

    // Trouver le site concerné
    const site = sites.find(s => s.id === fiche.siteId);
    if (!site) {
      alert('Site introuvable');
      return;
    }

    const intervalHours = Number(site.nh2A) - Number(site.nh1DV);
    const contractSeuil = Number(site.seuil || 250);
    const isWithinContract = Number.isFinite(intervalHours) ? intervalHours <= contractSeuil : null;

    // Mettre à jour le site: NH1 DV = NH2 A actuel, Date DV = aujourd'hui
    const updatedSites = sites.map(s => {
      if (s.id === fiche.siteId) {
        const newNh1DV = s.nh2A;
        const newDateDV = new Date().toISOString().split('T')[0];
        const regime = calculateRegime(newNh1DV, s.nh2A, newDateDV, s.dateA);
        const nhEstimated = calculateEstimatedNH(s.nh2A, s.dateA, regime);
        const diffNHs = 0; // Compteur repart à zéro
        const diffEstimated = calculateDiffNHs(newNh1DV, nhEstimated);
        const epvDates = calculateEPVDates(regime, s.dateA, newNh1DV, nhEstimated);

        return {
          ...s,
          nh1DV: newNh1DV,
          dateDV: newDateDV,
          regime,
          nhEstimated,
          diffNHs,
          diffEstimated,
          ...epvDates
        };
      }
      return s;
    });

    setSites(updatedSites);

    // Mettre à jour le statut de la fiche
    const updatedHistory = ficheHistory.map(f => 
      f.id === ficheId ? {
        ...f,
        status: 'Effectuée',
        dateCompleted: new Date().toISOString(),
        intervalHours,
        contractSeuil,
        isWithinContract
      } : f
    );
    setFicheHistory(updatedHistory);
    saveFicheHistory(updatedHistory);

    alert('✅ Vidange marquée comme effectuée ! Le compteur a été réinitialisé.');
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ok = window.confirm(
      `Confirmer l'import Excel ?\n\nCe fichier va remplacer la liste des sites en base.\nFichier: ${file?.name || ''}`
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    setImportBusy(true);
    setImportProgress(0);
    setImportStep('Lecture du fichier…');

    reader.onprogress = (evt) => {
      try {
        if (!evt || !evt.total) return;
        const pct = Math.max(0, Math.min(20, Math.round((evt.loaded / evt.total) * 20)));
        setImportProgress(pct);
      } catch {
        // ignore
      }
    };

    reader.onload = async (event) => {
      try {
        setImportStep('Analyse du fichier Excel…');
        setImportProgress((p) => Math.max(p, 25));
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        setImportStep('Préparation des sites…');
        setImportProgress((p) => Math.max(p, 40));

        console.log('Données importées:', jsonData);
        console.log('Première ligne:', jsonData[0]);

        const importedSites = [];
        const total = Array.isArray(jsonData) ? jsonData.length : 0;
        for (let index = 0; index < total; index += 1) {
          const row = jsonData[index] || {};
          if (!row['Name Site'] && !row['NameSite']) {
            continue;
          }

          const nh1 = parseInt(row['NH1 DV'] || row['NH1DV'] || 0);
          const nh2 = parseInt(row['NH2 A'] || row['NH2A'] || 0);

          const dateDV = row['Date DV'] || row['DateDV'];
          const dateA = row['Date A'] || row['DateA'];

          let dateDVStr, dateAStr;

          if (typeof dateDV === 'number') {
            const dvDate = XLSX.SSF.parse_date_code(dateDV);
            dateDVStr = `${dvDate.y}-${String(dvDate.m).padStart(2, '0')}-${String(dvDate.d).padStart(2, '0')}`;
          } else if (dateDV) {
            dateDVStr = dateDV;
          } else {
            dateDVStr = new Date().toISOString().split('T')[0];
          }

          if (typeof dateA === 'number') {
            const aDate = XLSX.SSF.parse_date_code(dateA);
            dateAStr = `${aDate.y}-${String(aDate.m).padStart(2, '0')}-${String(aDate.d).padStart(2, '0')}`;
          } else if (dateA) {
            dateAStr = dateA;
          } else {
            dateAStr = new Date().toISOString().split('T')[0];
          }

          const regime = calculateRegime(nh1, nh2, dateDVStr, dateAStr);
          const nhEstimated = calculateEstimatedNH(nh2, dateAStr, regime);
          const diffNHs = calculateDiffNHs(nh1, nh2);
          const diffEstimated = calculateDiffNHs(nh1, nhEstimated);
          const epvDates = calculateEPVDates(regime, dateAStr, nh1, nhEstimated);

          let retired = false;
          const retireValue = row['Retiré'] || row['Retire'] || row['retired'];
          if (retireValue === 'VRAI' || retireValue === true || retireValue === 'TRUE' || retireValue === 1) {
            retired = true;
          }

          importedSites.push({
            id: Date.now() + index,
            nameSite: row['Name Site'] || row['NameSite'] || `Site ${index + 1}`,
            idSite: row['ID Site'] || row['IDSite'] || row['Id Site'] || `ID${index + 1}`,
            technician: row['Techniciens'] || row['Technicians'] || row['Technicien'] || row['Technician'] || 'Non assigné',
            generateur: row['Generateur'] || row['Générateur'] || row['GENERATEUR'] || 'Non spécifié',
            capacite: row['Capacité'] || row['Capacite'] || row['CAPACITE'] || 'Non spécifié',
            kitVidange: row['Kit Vidange'] || row['KitVidange'] || row['KIT VIDANGE'] || 'Non spécifié',
            regime,
            nh1DV: nh1,
            dateDV: dateDVStr,
            nh2A: nh2,
            dateA: dateAStr,
            nhEstimated,
            diffNHs,
            diffEstimated,
            seuil: 250,
            retired,
            ...epvDates
          });

          if (index % 50 === 0) {
            const pct = 40 + Math.round(((index + 1) / Math.max(1, total)) * 40);
            setImportProgress((p) => Math.max(p, Math.min(80, pct)));
            setImportStep(`Préparation des sites… (${index + 1}/${total})`);
          }
        }

        setImportProgress((p) => Math.max(p, 80));

        setImportStep('Envoi vers le serveur…');
        setImportProgress((p) => Math.max(p, 85));
        console.log('Sites importés:', importedSites);
        await apiFetchJson('/api/sites/bulk-replace', {
          method: 'POST',
          body: JSON.stringify({ sites: importedSites })
        });
        setImportStep('Actualisation…');
        setImportProgress((p) => Math.max(p, 95));
        await loadData();
        setImportProgress(100);
        alert(`✅ ${importedSites.length} sites importés avec succès !`);
      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert(`❌ Erreur lors de l\'import du fichier Excel: ${error?.message || 'Erreur inconnue.'}`);
      } finally {
        setImportBusy(false);
        setTimeout(() => {
          setImportStep('');
          setImportProgress(0);
        }, 500);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportExcel = async () => {
    const ok = window.confirm('Exporter la liste des sites en Excel ?');
    if (!ok) return;

    const done = await runExport({
      label: 'Export Excel (sites)…',
      fn: async () => {
        const exportData = sites.map(site => {
          const updatedSite = getUpdatedSite(site);
          return {
            'Techniciens': updatedSite.technician,
            'ID Site': updatedSite.idSite,
            'Name Site': updatedSite.nameSite,
            'Generateur': updatedSite.generateur,
            'Capacité': updatedSite.capacite,
            'Kit Vidange': updatedSite.kitVidange,
            'Régime': updatedSite.regime,
            'NH1 DV': updatedSite.nh1DV,
            'Date DV': formatDate(updatedSite.dateDV),
            'NH2 A': updatedSite.nh2A,
            'Date A': formatDate(updatedSite.dateA),
            'NH Estimé': updatedSite.nhEstimated,
            'Diff NHs': updatedSite.diffNHs,
            'Diff Estimée': updatedSite.diffEstimated,
            'Seuil': updatedSite.seuil,
            'Date EPV 1': formatDate(updatedSite.epv1),
            'Jours EPV 1': getDaysUntil(updatedSite.epv1),
            'Date EPV 2': formatDate(updatedSite.epv2),
            'Jours EPV 2': getDaysUntil(updatedSite.epv2),
            'Date EPV 3': formatDate(updatedSite.epv3),
            'Jours EPV 3': getDaysUntil(updatedSite.epv3),
            'Retiré': updatedSite.retired ? 'VRAI' : 'FAUX'
          };
        });

        exportXlsx({
          fileBaseName: `Planning_Vidanges_${new Date().toISOString().split('T')[0]}`,
          sheets: [{ name: 'Vidanges', rows: exportData }]
        });
      }
    });

    if (done) alert('✅ Export Excel généré.');
  };

  const exportXlsx = ({ fileBaseName, sheets }) => {
    const base = String(fileBaseName || 'export').trim() || 'export';
    const safeBase = base.replace(/[\/:*?"<>|]+/g, '_');
    const wb = XLSX.utils.book_new();
    if (exportBusyRef.current) {
      setExportProgress((p) => Math.max(p, 55));
    }
    (Array.isArray(sheets) ? sheets : []).forEach((sh, idx) => {
      const nameRaw = String(sh?.name || `Feuille${idx + 1}`);
      const name = nameRaw.trim().slice(0, 31) || `Feuille${idx + 1}`;
      const rows = Array.isArray(sh?.rows) ? sh.rows : [];
      const ws = XLSX.utils.json_to_sheet(rows);

      const rowToMaxLines = new Map();
      for (const k of Object.keys(ws || {})) {
        if (!k || k[0] === '!') continue;
        const cell = ws[k];
        if (!cell || typeof cell.v !== 'string') continue;
        if (cell.v.includes('\n')) {
          const existingAlign = (cell.s || {}).alignment || {};
          cell.s = {
            ...(cell.s || {}),
            alignment: { ...existingAlign, wrapText: true, vertical: existingAlign.vertical || 'top' }
          };
          try {
            const rc = XLSX.utils.decode_cell(k);
            if (rc && Number.isFinite(rc.r)) {
              const lines = String(cell.v).split(/\r?\n/).length;
              const prev = Number(rowToMaxLines.get(rc.r) || 0);
              if (lines > prev) rowToMaxLines.set(rc.r, lines);
            }
          } catch {
            // ignore
          }
        }
      }

      if (rowToMaxLines.size > 0) {
        const max = Math.max(...Array.from(rowToMaxLines.keys()));
        const out = Array.isArray(ws['!rows']) ? ws['!rows'].slice() : [];
        while (out.length <= max) out.push(null);
        for (const [r, lines] of rowToMaxLines.entries()) {
          const prev = out[r] || {};
          const baseHpt = 18;
          const hpt = Math.max(Number(prev.hpt || 0), baseHpt * Math.max(1, Number(lines || 1)));
          const hpx = Math.max(Number(prev.hpx || 0), Math.round(hpt * (96 / 72)));
          out[r] = { ...prev, hpt, hpx };
        }
        ws['!rows'] = out;
      }

      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    if (exportBusyRef.current) {
      setExportProgress((p) => Math.max(p, 80));
    }
    XLSX.writeFile(wb, `${safeBase}.xlsx`, { cellStyles: true });
    if (exportBusyRef.current) {
      setExportProgress((p) => Math.max(p, 95));
    }
  };

  const computeDashboardData = (yyyymm) => {
    const techFilter = String(filterTechnician || 'all');

    const plannedByEpv = filteredSites
      .filter((s) => s && !s.retired)
      .flatMap((site) => {
        return [
          { type: 'EPV1', date: site.epv1 },
          { type: 'EPV2', date: site.epv2 },
          { type: 'EPV3', date: site.epv3 }
        ]
          .filter((ev) => ev.date && String(ev.date).slice(0, 7) === yyyymm)
          .map((ev) => ({
            key: `${site.id}|${ev.type}|${ev.date}`,
            siteId: site.id,
            siteName: site.nameSite,
            technician: site.technician,
            epvType: ev.type,
            plannedDate: ev.date
          }));
      });

    const doneByPlannedDate = ficheHistory
      .filter((f) => f && f.status === 'Effectuée' && f.plannedDate && String(f.plannedDate).slice(0, 7) === yyyymm)
      .filter((f) => techFilter === 'all' || String(f.technician || '') === techFilter);

    const plannedByFiches = doneByPlannedDate
      .map((f) => ({
        key: `${f.siteId}|${f.epvType || ''}|${f.plannedDate}`,
        siteId: f.siteId,
        siteName: f.siteName,
        technician: f.technician,
        epvType: f.epvType,
        plannedDate: f.plannedDate
      }))
      .filter((ev) => ev && ev.siteId && ev.plannedDate);

    const plannedMap = new Map();
    [...plannedByEpv, ...plannedByFiches].forEach((ev) => {
      plannedMap.set(String(ev.key), ev);
    });
    const plannedEvents = Array.from(plannedMap.values());

    const completedFichesInMonth = ficheHistory
      .filter((f) => f && f.status === 'Effectuée' && f.dateCompleted && isInMonth(f.dateCompleted, yyyymm))
      .filter((f) => techFilter === 'all' || String(f.technician || '') === techFilter);
    const contractOk = completedFichesInMonth.filter((f) => f.isWithinContract === true);
    const contractOver = completedFichesInMonth.filter((f) => f.isWithinContract === false);

    const completedKeys = new Set(doneByPlannedDate.map((f) => `${f.siteId}|${f.epvType || ''}|${f.plannedDate}`));
    const remainingEvents = plannedEvents.filter((ev) => !completedKeys.has(String(ev.key)));

    return { plannedEvents, remainingEvents, doneByPlannedDate, contractOk, contractOver };
  };

  const handleExportDashboardSummaryExcel = async () => {
    const ok = window.confirm(`Exporter le résumé Dashboard (${dashboardMonth}) en Excel ?`);
    if (!ok) return;
    const done = await runExport({
      label: 'Export Excel (dashboard résumé)…',
      fn: async () => {
        const { plannedEvents, remainingEvents, doneByPlannedDate, contractOk, contractOver } = computeDashboardData(dashboardMonth);
        exportXlsx({
          fileBaseName: `Dashboard_${dashboardMonth}_resume_${new Date().toISOString().slice(0, 10)}`,
          sheets: [
            {
              name: 'Résumé',
              rows: [
                { Section: 'Dans délai contractuel', Count: contractOk.length, Mois: dashboardMonth },
                { Section: 'Hors délai contractuel', Count: contractOver.length, Mois: dashboardMonth },
                { Section: 'Planifiées du mois', Count: plannedEvents.length, Mois: dashboardMonth },
                { Section: 'Restantes du mois', Count: remainingEvents.length, Mois: dashboardMonth },
                { Section: 'Effectuées du mois', Count: doneByPlannedDate.length, Mois: dashboardMonth }
              ]
            }
          ]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const handleExportDashboardDetailsExcel = async () => {
    const ok = window.confirm('Exporter ces détails Dashboard en Excel ?');
    if (!ok) return;
    const kind = String(dashboardDetails?.kind || '');
    const items = Array.isArray(dashboardDetails?.items) ? dashboardDetails.items : [];
    if (items.length === 0) return;

    const rows = (kind === 'contract_ok' || kind === 'contract_over' || kind === 'done')
      ? items.map((f) => ({
        Site: f.siteName,
        Ticket: f.ticketNumber,
        Technicien: f.technician,
        DateRéalisation: f.dateCompleted,
        DatePlanifiée: f.plannedDate,
        EPV: f.epvType,
        IntervalleHeures: f.intervalHours,
        Seuil: f.contractSeuil || 250,
        StatutContractuel: f.isWithinContract === true ? 'Dans délai' : f.isWithinContract === false ? 'Hors délai' : 'N/A'
      }))
      : items.map((ev) => ({
        Site: ev.siteName,
        Technicien: ev.technician,
        EPV: ev.epvType,
        DatePlanifiée: ev.plannedDate
      }));

    const done = await runExport({
      label: 'Export Excel (dashboard détails)…',
      fn: async () => {
        exportXlsx({
          fileBaseName: `Dashboard_${dashboardMonth}_${kind}_${new Date().toISOString().slice(0, 10)}`,
          sheets: [{ name: 'Détails', rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const handleExportScoringDetailsExcel = async () => {
    const ok = window.confirm(`Exporter ces détails Scoring (${scoringMonth}) en Excel ?`);
    if (!ok) return;
    const kind = String(scoringDetails?.kind || '');
    const items = Array.isArray(scoringDetails?.items) ? scoringDetails.items : [];
    if (!scoringDetails?.open || items.length === 0) return;

    const siteById = new Map(
      (Array.isArray(sites) ? sites : [])
        .filter((s) => s && s.id)
        .map((s) => [String(s.id), s])
    );

    const rows = kind === 'remaining'
      ? items.map((it) => {
        const site = siteById.get(String(it.siteId)) || null;
        return {
          Site: site?.nameSite || it.siteId,
          IdSite: site?.idSite || '',
          EPV: it.epvType,
          DatePlanifiée: it.plannedDate,
          Technicien: it.technicianName,
          Statut: it.status
        };
      })
      : items.map((f) => ({
        Site: f.siteName,
        Ticket: f.ticketNumber,
        Technicien: f.technician,
        DateRéalisation: f.dateCompleted,
        DatePlanifiée: f.plannedDate,
        EPV: f.epvType,
        IntervalleHeures: f.intervalHours,
        Seuil: f.contractSeuil || 250,
        StatutContractuel: f.isWithinContract === true ? 'Dans délai' : f.isWithinContract === false ? 'Hors délai' : 'N/A'
      }));

    const done = await runExport({
      label: 'Export Excel (scoring)…',
      fn: async () => {
        exportXlsx({
          fileBaseName: `Scoring_${scoringMonth}_${kind}_${new Date().toISOString().slice(0, 10)}`,
          sheets: [{ name: 'Détails', rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const handleExportSelectedDayExcel = async () => {
    const ok = window.confirm('Exporter les détails de ce jour en Excel ?');
    if (!ok) return;
    const items = Array.isArray(selectedDayEvents) ? selectedDayEvents : [];
    if (items.length === 0) return;
    const rows = items.map((evt) => ({
      Date: evt.date,
      EPV: evt.type,
      Site: evt?.site?.nameSite || '',
      IdSite: evt?.site?.idSite || '',
      Technicien: evt?.site?.technician || ''
    }));
    const done = await runExport({
      label: 'Export Excel (calendrier jour)…',
      fn: async () => {
        exportXlsx({
          fileBaseName: `Calendrier_${selectedDate || 'jour'}_${new Date().toISOString().slice(0, 10)}`,
          sheets: [{ name: 'Jour', rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const handleExportCalendarMonthExcel = async () => {
    const ok = window.confirm(`Exporter toutes les EPV du mois affiché en Excel ?`);
    if (!ok) return;
    const year = currentMonth?.getFullYear?.();
    const month = currentMonth?.getMonth?.();
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;
    const yyyymm = `${year}-${String(month + 1).padStart(2, '0')}`;

    const events = [];
    (Array.isArray(calendarFilteredSites) ? calendarFilteredSites : []).forEach((site) => {
      if (!site || site.retired) return;
      const pushIf = (type, date) => {
        if (!date) return;
        if (String(date).slice(0, 7) !== yyyymm) return;
        events.push({
          Date: date,
          EPV: type,
          Site: site.nameSite,
          IdSite: site.idSite,
          Technicien: site.technician
        });
      };
      pushIf('EPV1', site.epv1);
      pushIf('EPV2', site.epv2);
      pushIf('EPV3', site.epv3);
    });

    const rows = events
      .slice()
      .sort((a, b) => {
        const d = String(a.Date || '').localeCompare(String(b.Date || ''));
        if (d !== 0) return d;
        const t = String(a.Technicien || '').localeCompare(String(b.Technicien || ''));
        if (t !== 0) return t;
        return String(a.Site || '').localeCompare(String(b.Site || ''));
      });

    const done = await runExport({
      label: 'Export Excel (calendrier mois)…',
      fn: async () => {
        exportXlsx({
          fileBaseName: `Calendrier_${yyyymm}_${new Date().toISOString().slice(0, 10)}`,
          sheets: [{ name: 'Mois', rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const handleExportInterventionsExcel = async () => {
    const ok = window.confirm('Exporter la liste des interventions affichées en Excel ?');
    if (!ok) return;
    const siteById = new Map((Array.isArray(sites) ? sites : []).map((s) => [String(s.id), s]));
    const list = (Array.isArray(interventions) ? interventions : [])
      .slice()
      .sort((a, b) => String(a.plannedDate || '').localeCompare(String(b.plannedDate || '')));

    if (isAdmin) {
      const filtered = interventionsTechnicianUserId && interventionsTechnicianUserId !== 'all'
        ? list.filter((i) => String(i.technicianUserId || '') === String(interventionsTechnicianUserId))
        : list;
      const rows = filtered.map((it) => {
        const site = siteById.get(String(it.siteId)) || null;
        return {
          DatePlanifiée: it.plannedDate,
          EPV: it.epvType,
          Statut: it.status,
          Technicien: it.technicianName,
          Site: site?.nameSite || it.siteId,
          IdSite: site?.idSite || '',
          InterventionId: it.id
        };
      });
      const done = await runExport({
        label: 'Export Excel (interventions)…',
        fn: async () => {
          exportXlsx({
            fileBaseName: `Interventions_${interventionsMonth}_${interventionsStatus}_${interventionsTechnicianUserId}_${new Date().toISOString().slice(0, 10)}`,
            sheets: [{ name: 'Interventions', rows }]
          });
        }
      });
      if (done) alert('✅ Export Excel généré.');
      return;
    }

    if (isViewer) {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrowD = new Date(today);
      tomorrowD.setDate(tomorrowD.getDate() + 1);
      const tomorrow = tomorrowD.toISOString().slice(0, 10);

      const todayItems = list.filter((i) => i.plannedDate === today && i.status !== 'done');
      const tomorrowItems = list.filter((i) => i.plannedDate === tomorrow && i.status !== 'done');

      const toRows = (items) => items.map((it) => {
        const site = siteById.get(String(it.siteId)) || null;
        return {
          DatePlanifiée: it.plannedDate,
          EPV: it.epvType,
          Statut: it.status,
          Technicien: it.technicianName,
          Site: site?.nameSite || it.siteId,
          IdSite: site?.idSite || '',
          InterventionId: it.id
        };
      });

      const done = await runExport({
        label: 'Export Excel (interventions)…',
        fn: async () => {
          exportXlsx({
            fileBaseName: `Interventions_${interventionsMonth}_${interventionsStatus}_viewer_${new Date().toISOString().slice(0, 10)}`,
            sheets: [
              { name: "Aujourd'hui", rows: toRows(todayItems) },
              { name: 'Demain', rows: toRows(tomorrowItems) },
              { name: 'Toutes', rows: toRows(list) }
            ]
          });
        }
      });
      if (done) alert('✅ Export Excel généré.');
    }
  };

  const getUpdatedSite = (site) => {
    const nhEstimated = calculateEstimatedNH(site.nh2A, site.dateA, site.regime);
    const diffEstimated = calculateDiffNHs(site.nh1DV, nhEstimated);
    const epvDates = calculateEPVDates(site.regime, site.dateA, site.nh1DV, nhEstimated);
    
    return {
      ...site,
      nhEstimated,
      diffEstimated,
      epv1: epvDates.epv1,
      epv2: epvDates.epv2,
      epv3: epvDates.epv3,
      daysUntilEPV1: getDaysUntil(epvDates.epv1)
    };
  };

  const urgentSitesAll = sites
    .map(getUpdatedSite)
    .filter(site => {
      if (site.retired) return false;
      const days = getDaysUntil(site.epv1);
      return days !== null && days <= 3;
    })
    .sort((a, b) => getDaysUntil(a.epv1) - getDaysUntil(b.epv1));

  const urgentSites = urgentSitesAll.filter(site => filterTechnician === 'all' || site.technician === filterTechnician);

  const technicians = ['all', ...new Set(sites.map(s => s.technician))];
  const filteredSites = sites
    .map(getUpdatedSite)
    .filter(site => filterTechnician === 'all' || site.technician === filterTechnician);

  const calendarTechnicianName = (() => {
    const techId = String(calendarSendTechUserId || '').trim();
    if (!techId) return '';
    const tech = (Array.isArray(users) ? users : []).find((u) => u && String(u.id) === techId) || null;
    return String(tech?.technicianName || '').trim();
  })();

  const calendarMonthKey = yyyyMmFromDate(currentMonth);
  const calendarPrevMonthKey = (() => {
    const raw = String(calendarMonthKey || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})$/);
    if (!m) return '';
    const y = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return '';
    const prevY = mm === 1 ? y - 1 : y;
    const prevM = mm === 1 ? 12 : mm - 1;
    return `${prevY}-${String(prevM).padStart(2, '0')}`;
  })();

  const calendarPrevMonthRetiredSiteIds = (() => {
    try {
      if (!calendarPrevMonthKey) return new Set();
      const raw = localStorage.getItem(`retired_sites_snapshot:${calendarPrevMonthKey}`);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.map((v) => String(v)).filter(Boolean));
    } catch {
      return new Set();
    }
  })();

  const interventionsPrevMonthKey = (() => {
    const raw = String(interventionsMonth || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})$/);
    if (!m) return '';
    const y = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return '';
    const py = mm === 1 ? y - 1 : y;
    const pm = mm === 1 ? 12 : mm - 1;
    return `${py}-${String(pm).padStart(2, '0')}`;
  })();

  const interventionsPrevMonthRetiredSiteIds = (() => {
    try {
      if (!interventionsPrevMonthKey) return new Set();
      const raw = localStorage.getItem(`retired_sites_snapshot:${interventionsPrevMonthKey}`);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.map((v) => String(v)).filter(Boolean));
    } catch {
      return new Set();
    }
  })();

  useEffect(() => {
    if (!showCalendar) return;
    try {
      const retiredIds = (Array.isArray(sites) ? sites : [])
        .map(getUpdatedSite)
        .filter((s) => s && s.retired)
        .map((s) => String(s.id))
        .filter(Boolean);
      localStorage.setItem(`retired_sites_snapshot:${calendarMonthKey}`, JSON.stringify(retiredIds));
    } catch {
      // ignore
    }
  }, [showCalendar, calendarMonthKey, sites]);

  useEffect(() => {
    if (!showTechCalendar) return;
    if (!isTechnician) return;
    (async () => {
      try {
        await loadPmAssignments(techCalendarMonth);
      } catch {
        // ignore
      }
    })();
  }, [showTechCalendar, isTechnician, techCalendarMonth]);

  const calendarFilteredSites = sites
    .map(getUpdatedSite)
    .filter((site) => {
      if (!calendarTechnicianName) return true;
      return String(site.technician || '').trim() === calendarTechnicianName;
    });

  const interventionsByKey = new Map(
    (Array.isArray(interventions) ? interventions : []).filter(Boolean).map((i) => [getInterventionKey(i.siteId, i.plannedDate, i.epvType), i])
  );

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

    const ymdDiffDaysUtc = (aYmd, bYmd) => {
      const a = new Date(`${String(aYmd).slice(0, 10)}T00:00:00Z`).getTime();
      const b = new Date(`${String(bYmd).slice(0, 10)}T00:00:00Z`).getTime();
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return Math.round((a - b) / (1000 * 60 * 60 * 24));
    };

    const todayLocalYmd = (() => {
      const d = new Date();
      const pad2 = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    })();

    const isNonWorkingYmd = (ymdStr) => {
      const d = new Date(`${String(ymdStr).slice(0, 10)}T00:00:00Z`);
      const dow = d.getUTCDay();
      return dow === 0 || dow === 6 || isHolidayYmd(String(ymdStr).slice(0, 10));
    };

    if (!isNonWorkingYmd(v)) return '';

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

    // Règle explicite week-end: plus proche
    if (originDow === 6) {
      const prev = findPrevWorkday(v);
      return prev && prev !== v ? prev : '';
    }
    if (originDow === 0) {
      const next = findNextWorkday(v);
      return next && next !== v ? next : '';
    }

    // Jour férié sur jour ouvré: choisir le plus proche; tie-break selon urgence
    const prev = findPrevWorkday(v);
    const next = findNextWorkday(v);
    if (!prev && !next) return '';
    if (!prev) return next !== v ? next : '';
    if (!next) return prev !== v ? prev : '';

    const prevDist = Math.abs(Number(ymdDiffDaysUtc(v, prev) ?? 9999));
    const nextDist = Math.abs(Number(ymdDiffDaysUtc(next, v) ?? 9999));
    if (prevDist < nextDist) return prev !== v ? prev : '';
    if (nextDist < prevDist) return next !== v ? next : '';

    const prefer = String(opts?.prefer || 'auto').toLowerCase();
    if (prefer === 'before' || prefer === 'prev') return prev !== v ? prev : '';
    if (prefer === 'after' || prefer === 'next') return next !== v ? next : '';

    const daysUntil = ymdDiffDaysUtc(v, todayLocalYmd);
    const urgent = Number.isFinite(daysUntil) && daysUntil <= 3;
    const pick = urgent ? prev : next;
    return pick && pick !== v ? pick : '';
  };

  const techCalendarItemsInMonth = (() => {
    if (!isTechnician) return [];
    const month = String(techCalendarMonth || '').trim();
    const list = [];

    const pmTypeKey = (v) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');

    const pmInMonth = (Array.isArray(pmAssignments) ? pmAssignments : [])
      .filter((p) => p && String(p?.plannedDate || '').slice(0, 7) === month)
      .map((p) => ({
        ...p,
        plannedDate: ymdShiftForWorkdays(String(p?.plannedDate || '').slice(0, 10)) || String(p?.plannedDate || '').slice(0, 10)
      }));

    const hasAnyVidangeInMonthBySite = new Set();

    const pmFullBySiteDate = (() => {
      const m = new Map();
      for (const p of pmInMonth) {
        const mt = pmTypeKey(p?.maintenanceType);
        if (mt !== 'fullpmwo') continue;
        const siteId = String(p?.siteId || '').trim();
        const d = String(p?.plannedDate || '').slice(0, 10);
        if (!siteId || !d) continue;
        m.set(`${siteId}|${d}`, p);
      }
      return m;
    })();

    const pmDgBySite = (() => {
      const m = new Map();
      for (const p of pmInMonth) {
        const mt = pmTypeKey(p?.maintenanceType);
        if (mt !== 'dgservice') continue;
        const siteId = String(p?.siteId || '').trim();
        if (!siteId) continue;
        if (!m.has(siteId)) m.set(siteId, []);
        m.get(siteId).push(p);
      }
      for (const [k, arr] of m.entries()) {
        arr.sort((a, b) => String(a?.plannedDate || '').localeCompare(String(b?.plannedDate || '')));
        m.set(k, arr);
      }
      return m;
    })();

    const pickNearestPmTicket = (arr, targetYmd) => {
      if (!Array.isArray(arr) || arr.length === 0) return '';
      const t = new Date(`${String(targetYmd).slice(0, 10)}T00:00:00`).getTime();
      if (!Number.isFinite(t)) {
        const first = arr[0];
        return first?.pmNumber ? String(first.pmNumber) : '';
      }
      let best = arr[0];
      let bestDiff = Infinity;
      for (const p of arr) {
        const pd = new Date(`${String(p?.plannedDate || '').slice(0, 10)}T00:00:00`).getTime();
        if (!Number.isFinite(pd)) continue;
        const diff = Math.abs(pd - t);
        if (diff < bestDiff) {
          best = p;
          bestDiff = diff;
        }
      }
      return best?.pmNumber ? String(best.pmNumber) : '';
    };

    const out = [];
    for (const p of pmInMonth) {
      const mt = pmTypeKey(p?.maintenanceType);
      if (mt !== 'fullpmwo' && mt !== 'dgservice') continue;
      const siteId = String(p?.siteId || '').trim();
      const d = String(p?.plannedDate || '').slice(0, 10);
      if (!siteId || !d) continue;
      out.push({
        id: `pm:${mt}:${String(p?.pmNumber || p?.id || `${siteId}-${d}`)}`,
        siteId,
        plannedDate: d,
        maintenanceType: mt,
        pmNumber: p?.pmNumber ? String(p.pmNumber) : '',
        technicianName: String(authUser?.technicianName || ''),
        technicianUserId: String(authUser?.id || ''),
        status: String(p?.status || 'sent')
      });
    }

    out.sort((a, b) => {
      const da = String(a?.plannedDate || '');
      const db = String(b?.plannedDate || '');
      const c = da.localeCompare(db);
      if (c !== 0) return c;
      return String(a?.siteId || '').localeCompare(String(b?.siteId || ''));
    });

    return out;
  })();

  const techCalendarMatchInfoForItem = (it) => {
    if (!isTechnician) return null;
    const mt = String(it?.maintenanceType || '').trim();
    const ticket = it?.pmNumber ? String(it.pmNumber) : '';
    const siteId = String(it?.siteId || '').trim();
    const d = String(it?.plannedDate || '').slice(0, 10);
    if (!siteId || !d) return null;

    const rawSite =
      (Array.isArray(sites) ? sites : []).find((s) => String(s?.id) === siteId) ||
      (Array.isArray(sites) ? sites : []).find((s) => String(s?.idSite || '').trim() === siteId) ||
      null;
    if (!rawSite) return null;

    const normalizeAnyYmd = (v) => {
      const s = v == null ? '' : String(v).trim();
      if (!s) return '';
      const head = s.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
      const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      return '';
    };

    const computedSite = getUpdatedSite(rawSite);

    const monthKey = String(techCalendarMonth || '').trim();
    const plannedYmd = normalizeAnyYmd(d);
    const plannedShifted = ymdShiftForWorkdays(plannedYmd) || plannedYmd;

    const epv1Raw = normalizeAnyYmd(rawSite?.epv1) || normalizeAnyYmd(computedSite?.epv1);
    const epv2Raw = normalizeAnyYmd(rawSite?.epv2) || normalizeAnyYmd(computedSite?.epv2);
    const epv3Raw = normalizeAnyYmd(rawSite?.epv3) || normalizeAnyYmd(computedSite?.epv3);

    const epv1 = ymdShiftForWorkdays(epv1Raw) || epv1Raw;
    const epv2 = ymdShiftForWorkdays(epv2Raw) || epv2Raw;
    const epv3 = ymdShiftForWorkdays(epv3Raw) || epv3Raw;

    const epvShiftedAll = [epv1, epv2, epv3].filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')));
    const epvRawAll = [epv1Raw, epv2Raw, epv3Raw].filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')));

    const hasAnyEpvInMonth = [...epvRawAll, ...epvShiftedAll].some((v) => String(v).slice(0, 7) === monthKey);

    if (mt === 'fullpmwo') {
      const matchesEpv = epvShiftedAll.includes(plannedShifted);
      if (matchesEpv) return { kind: 'PM', ticket, label: 'PM et Vidange' };
      if (!hasAnyEpvInMonth) return { kind: 'PM_SIMPLE', ticket, label: 'PM Simple' };
      return null;
    }

    if (mt === 'dgservice') {
      const matches = [epv2, epv3].includes(plannedShifted);
      if (matches) return { kind: 'DG', ticket, label: 'Vidange Simple' };
      return null;
    }

    return null;
  };

  const getTechCalendarEventsForDay = (dateStr) => {
    if (!dateStr) return [];
    const day = String(dateStr).slice(0, 10);
    return techCalendarItemsInMonth
      .filter((it) => String(it?.plannedDate || '').slice(0, 10) === day)
      .map((it) => {
        const sid = String(it?.siteId || '').trim();
        const rawSite =
          (Array.isArray(sites) ? sites : []).find((s) => String(s?.id) === sid) ||
          (Array.isArray(sites) ? sites : []).find((s) => String(s?.idSite || '').trim() === sid) ||
          null;
        const site = rawSite ? getUpdatedSite(rawSite) : null;
        const matchInfo = techCalendarMatchInfoForItem(it);
        return { item: it, site, matchInfo };
      });
  };

  const techCalendarPmTypeLabel = (it) => {
    const mt = String(it?.maintenanceType || '').trim();
    if (mt === 'fullpmwo') return 'FullPMWO';
    if (mt === 'dgservice') return 'DG Service';
    return 'PM';
  };

  const getEventsForDay = (dateStr) => {
    if (!dateStr) return [];
    const events = [];

    calendarFilteredSites.forEach((site) => {
      if (site.retired) return;

      const wasRetiredPrevMonth = calendarPrevMonthRetiredSiteIds.has(String(site.id));

      const add = (type, rawDate) => {
        const src = String(rawDate || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(src)) return;
        const shifted = ymdShiftForWorkdays(src);
        const planned = shifted || src;
        if (planned !== String(dateStr)) return;
        const intervention =
          interventionsByKey.get(getInterventionKey(site.id, planned, type)) ||
          interventionsByKey.get(getInterventionKey(site.id, src, type)) ||
          null;
        events.push({ site, type, date: planned, originalDate: src, intervention, wasRetiredPrevMonth });
      };

      add('EPV1', site.epv1);
      add('EPV2', site.epv2);
      add('EPV3', site.epv3);
    });

    return events;
  };

  useEffect(() => {
    if (!showCalendar) return;
    if (authUser?.role !== 'admin') return;
    (async () => {
      try {
        await refreshUsers();
      } catch (e) {
        // ignore
      }
      try {
        const m = yyyyMmFromDate(currentMonth);
        await loadInterventions(m, 'all', 'all');
      } catch (e) {
        // ignore
      }
    })();
  }, [showCalendar, authUser?.role, currentMonth]);

  useEffect(() => {
    if (!showPm) return;
    if (!isAdmin) return;
    (async () => {
      try {
        await refreshUsers();
      } catch (e) {
        // ignore
      }
    })();
  }, [showPm, isAdmin]);

  const handleLogin = (e) => {
    e.preventDefault();

    const email = String(loginEmail || '').trim().toLowerCase();
    if (!email) {
      setLoginError('Veuillez saisir votre email.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Veuillez saisir le mot de passe.');
      return;
    }

    (async () => {
      try {
        const data = await apiFetchJson('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password: loginPassword })
        });

        if (data?.user?.email) {
          setAuthUser(data.user);
          setLoginError('');
          setShowAccountModal(false);
          setAccountForm({ password: '', confirm: '' });
          setAccountError('');
          await loadData();
          await loadFicheHistory();
          if (data?.user?.role === 'admin') {
            await loadTicketNumber();
          }
          if (data?.user?.role === 'technician') {
            setInterventionsStatus('all');
            setInterventionsTechnicianUserId('all');
            setTechnicianInterventionsTab('tomorrow');
            setShowTechnicianInterventionsFilters(false);
            setShowInterventions(true);
            await loadInterventions(interventionsMonth, 'all', 'all');
          }
        } else {
          setLoginError('Email ou mot de passe incorrect.');
        }
      } catch (err) {
        setLoginError(err?.message || 'Erreur serveur.');
      }
    })();
  };

  const handleLogout = () => {
    setShowUsersModal(false);
    setShowAccountModal(false);
    setShowPresenceModal(false);
    setShowCalendar(false);
    setShowHistory(false);
    setShowFicheModal(false);
    setShowInterventions(false);
    setShowScoring(false);
    setShowPm(false);
    setScoringDetails({ open: false, title: '', kind: '', items: [] });
    setAuthUser(null);
    setSites([]);
    setFicheHistory([]);
    setInterventions([]);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
    setAccountForm({ password: '', confirm: '' });
    setAccountError('');
    setAccountSaving(false);

    (async () => {
      try {
        await apiFetchJson('/api/auth/logout', { method: 'POST' });
      } catch (e) {
        // ignore
      }
    })();
  };

  useEffect(() => {
    if (!authUser?.email) return;
    (async () => {
      try {
        await pingPresence(getCurrentActivityLabel());
      } catch {
        // ignore
      }
    })();
  }, [
    authUser?.email,
    authUser?.role,
    authUser?.technicianName,
    showUsersModal,
    showPresenceModal,
    showCalendar,
    showHistory,
    showFicheModal,
    showBannerUpload,
    showPm,
    showDayDetailsModal,
    showAddForm,
    showEditForm,
    showUpdateForm,
    dashboardDetails.open,
    showResetConfirm,
    showInterventions
  ]);

  useEffect(() => {
    if (!authUser?.email) return;
    const tick = () => {
      (async () => {
        try {
          await pingPresence(getCurrentActivityLabel());
        } catch {
          // ignore
        }
      })();
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      clearInterval(interval);
    };
  }, [authUser?.email, authUser?.role, authUser?.technicianName, tabId]);

  useEffect(() => {
    if (!showPresenceModal) return;

    const refresh = async () => {
      try {
        const data = await apiFetchJson('/api/presence', { method: 'GET' });
        const list = Array.isArray(data?.sessions) ? data.sessions : [];
        setPresenceSessions(list);
      } catch (e) {
        setPresenceSessions([]);
      }
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => {
      clearInterval(interval);
    };
  }, [showPresenceModal]);

  const loadAuditLogs = async () => {
    if (!isAdmin) return;
    setAuditBusy(true);
    setAuditError('');
    try {
      const qs = new URLSearchParams();
      if (auditUserId) qs.set('userId', auditUserId);
      if (auditFrom) qs.set('from', auditFrom);
      if (auditTo) qs.set('to', auditTo);
      if (auditQuery) qs.set('q', auditQuery);
      qs.set('limit', '1000');

      const data = await apiFetchJson(`/api/audit?${qs.toString()}`, { method: 'GET' });
      setAuditLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e) {
      setAuditLogs([]);
      setAuditError(e?.message || 'Erreur serveur.');
    } finally {
      setAuditBusy(false);
    }
  };

  const handleExportAuditExcel = async () => {
    const rows = (Array.isArray(auditLogs) ? auditLogs : []).map((l) => ({
      Date: l?.createdAt || '',
      Email: l?.email || '',
      Role: l?.role || '',
      Action: l?.action || '',
      Method: l?.method || '',
      Path: l?.path || '',
      Status: l?.status ?? '',
      IP: l?.ip || '',
      "User-Agent": l?.userAgent || '',
      Metadata: l?.metadata ? JSON.stringify(l.metadata) : ''
    }));

    const done = await runExport({
      label: 'Export Excel (audit)…',
      fn: async () => {
        exportXlsx({
          fileBaseName: `Audit_${new Date().toISOString().slice(0, 10)}`,
          sheets: [{ name: 'Audit', rows }]
        });
      }
    });
    if (done) alert('✅ Export Excel généré.');
  };

  const technicianUnseenSentCount = isTechnician
    ? (Array.isArray(interventions) ? interventions : []).filter(
        (i) =>
          i &&
          i.status === 'sent' &&
          i.sentAt &&
          String(i.sentAt) > String(technicianSeenSentAt || '')
      ).length
    : 0;

  useEffect(() => {
    if (isTechnician && authUser?.technicianName) {
      setFilterTechnician(authUser.technicianName);
      setShowCalendar(false);
    }
  }, [isTechnician, authUser?.technicianName]);

  useEffect(() => {
    if (!authUser?.id || authUser?.role !== 'technician') return;
    try {
      const k = `tech_seen_sent_at:${String(authUser.id)}`;
      const v = localStorage.getItem(k);
      setTechnicianSeenSentAt(String(v || ''));
    } catch {
      setTechnicianSeenSentAt('');
    }
  }, [authUser?.id, authUser?.role]);

  useEffect(() => {
    if (!authUser?.id) return;

    let isActive = true;
    let isRefreshing = false;
    let isChecking = false;
    let lastVersion = null;

    const refreshAll = async () => {
      if (!isActive) return;
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        await loadData();
      } catch {
        // ignore
      }
      try {
        await loadFicheHistory();
      } catch {
        // ignore
      }
      try {
        await loadInterventions(interventionsMonth, interventionsStatus, interventionsTechnicianUserId);
      } catch {
        // ignore
      }
      isRefreshing = false;
    };

    const checkVersion = async () => {
      if (!isActive) return;
      if (isChecking) return;
      isChecking = true;
      try {
        const data = await apiFetchJson('/api/meta/version', { method: 'GET' });
        const v = String(data?.version || '');
        if (!v) return;
        if (lastVersion === null) {
          lastVersion = v;
          await refreshAll();
          return;
        }
        if (v !== lastVersion) {
          lastVersion = v;
          await refreshAll();
        }
      } catch {
        // ignore
      } finally {
        isChecking = false;
      }
    };

    checkVersion();
    const intervalId = setInterval(checkVersion, 5000);
    const onFocus = () => checkVersion();
    const onVisibility = () => {
      if (!document.hidden) checkVersion();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      isActive = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    authUser?.id,
    authUser?.role,
    interventionsMonth,
    interventionsStatus,
    interventionsTechnicianUserId
  ]);

  const monthToRange = (yyyymm) => {
    const [y, m] = String(yyyymm || '').split('-').map((v) => Number(v));
    if (!y || !m) return null;
    const start = new Date(y, m - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(y, m, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const isInMonth = (iso, yyyymm) => {
    if (!iso) return false;
    const range = monthToRange(yyyymm);
    if (!range) return false;
    const d = new Date(iso);
    return d >= range.start && d <= range.end;
  };

  const filteredFicheHistory = ficheHistory
    .filter((fiche) => {
      if (historyStatus !== 'all' && fiche.status !== historyStatus) return false;

      const query = historyQuery.trim().toLowerCase();
      if (query) {
        const haystack = [
          fiche.ticketNumber,
          fiche.siteName,
          fiche.technician,
          String(fiche.siteId ?? '')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (historyDateFrom) {
        const from = new Date(historyDateFrom);
        from.setHours(0, 0, 0, 0);
        const gen = new Date(fiche.dateGenerated);
        gen.setHours(0, 0, 0, 0);
        if (gen < from) return false;
      }

      if (historyDateTo) {
        const to = new Date(historyDateTo);
        to.setHours(23, 59, 59, 999);
        const gen = new Date(fiche.dateGenerated);
        if (gen > to) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (historySort === 'oldest') {
        return new Date(a.dateGenerated) - new Date(b.dateGenerated);
      }
      if (historySort === 'ticket') {
        return String(a.ticketNumber).localeCompare(String(b.ticketNumber));
      }
      return new Date(b.dateGenerated) - new Date(a.dateGenerated);
    });

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="bg-emerald-700 text-white rounded-2xl p-4">
              <Activity size={28} />
            </div>
            <div className="font-bold text-gray-900 text-lg">Gestion Maintenance & Vidanges</div>
            <div className="text-sm text-gray-600">
              Planifie, suis et historise les vidanges de tes générateurs.
            </div>
            <div className="text-sm text-gray-600">
              Interventions, fiches et compteurs (NH) dans une seule application.
            </div>
            <img
              src={STHIC_LOGO_SRC}
              alt="STHIC"
              className="h-12 mt-3 w-auto max-w-[240px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="mt-3 flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse" />
              Chargement…
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {renderPwaUpdateBanner()}
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-cyan-600 rounded-full flex items-center justify-center text-white mb-4">
              <Activity size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Gestion Maintenance & Vidanges</h1>
            <p className="text-gray-600 mt-1">Connexion</p>
            <div className="text-sm text-gray-600 mt-3">
              Planifie, suis et historise les vidanges de tes générateurs.
            </div>
            <div className="text-sm text-gray-600">
              Interventions, fiches et compteurs (NH) dans une seule application.
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  setLoginError('');
                }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                placeholder="ex: admin@domaine.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setLoginError('');
                }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                placeholder="********"
              />
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-cyan-600 text-white py-2 rounded-lg hover:bg-cyan-700 font-semibold"
            >
              Se connecter
            </button>

            <img
              src={STHIC_LOGO_SRC}
              alt="STHIC"
              className="h-14 mt-4 w-auto max-w-[260px] object-contain mx-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderPwaUpdateBanner()}
      {exportBusy && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
            <div className="font-bold text-gray-800 mb-1">Export en cours…</div>
            <div className="text-sm text-gray-600 mb-3">{exportStep || 'Préparation…'} ({exportProgress}%)</div>
            <div className="w-full h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-slate-800 rounded"
                style={{ width: `${Math.max(0, Math.min(100, Number(exportProgress) || 0))}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          body * { visibility: hidden !important; }
          #fiche-print, #fiche-print * { visibility: visible !important; }
          #fiche-print {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            margin: 0 auto;
            width: 210mm;
            height: 297mm;
            padding: 8mm;
            box-sizing: border-box;
            box-shadow: none !important;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div
          className={`w-64 bg-emerald-700 text-white border-r border-emerald-800 flex flex-col p-3 gap-1 fixed md:sticky top-0 left-0 h-screen overflow-y-auto z-50 md:z-auto transform transition-transform md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-2 px-2 py-2">
            <Activity size={18} className="text-white/90" />
            <div className="text-sm font-bold text-white leading-tight">Navigation</div>
            <div className="ml-auto md:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded hover:bg-emerald-800"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="h-px bg-emerald-600/60 my-1" />

          {canWriteSites && (
            <button
              onClick={() => {
                setSidebarOpen(false);
                setShowAddForm(!showAddForm);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <Plus size={18} />
              Nouveau Site
            </button>
          )}

          {canImportExport && (
            <div className="flex flex-col gap-2">
              <label
                onClick={() => setSidebarOpen(false)}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold ${
                  importBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-800 cursor-pointer'
                }`}
              >
                <Upload size={18} />
                {importBusy ? 'Import en cours…' : 'Importer Excel'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                  disabled={importBusy}
                />
              </label>

              {importBusy && (
                <div className="w-full">
                  <div className="text-[11px] text-gray-600 mb-1">{importStep || 'Import…'} ({importProgress}%)</div>
                  <div className="w-full h-2 bg-gray-200 rounded">
                    <div
                      className="h-2 bg-green-600 rounded"
                      style={{ width: `${Math.max(0, Math.min(100, Number(importProgress) || 0))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {canImportExport && (
            <button
              onClick={() => {
                setSidebarOpen(false);
                handleExportExcel();
              }}
              disabled={sites.length === 0 || exportBusy || importBusy}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 disabled:opacity-60 text-sm font-semibold"
            >
              <Download size={18} />
              Exporter Excel
            </button>
          )}

          {!isTechnician ? (
            <button
              onClick={() => {
                setSidebarOpen(false);
                setShowCalendar(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <Calendar size={18} />
              Calendrier
            </button>
          ) : (
            <button
              onClick={async () => {
                setSidebarOpen(false);
                const m = interventionsMonth || new Date().toISOString().slice(0, 7);
                setTechCalendarMonth(m);
                setShowTechCalendar(true);
                await loadInterventions(m, 'all', 'all');
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <Calendar size={18} />
              Calendrier
            </button>
          )}

          {canUseInterventions && (
            <button
              onClick={async () => {
                setSidebarOpen(false);
                setInterventionsStatus('all');
                setInterventionsTechnicianUserId('all');
                if (isTechnician) {
                  setTechnicianInterventionsTab('tomorrow');
                  setShowTechnicianInterventionsFilters(false);
                }
                setShowInterventions(true);
                if (authUser?.role === 'admin') {
                  try {
                    await refreshUsers();
                  } catch (e) {
                    // ignore
                  }
                }
                await loadInterventions();
              }}
              className="relative w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <CheckCircle size={18} />
              {isTechnician && technicianUnseenSentCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {technicianUnseenSentCount}
                </span>
              )}
              {isTechnician ? 'Mes interventions' : 'Interventions'}
            </button>
          )}

          {!isTechnician && (
            <button
              onClick={async () => {
                setSidebarOpen(false);
                const nextMonth = scoringMonth || new Date().toISOString().slice(0, 7);
                setScoringMonth(nextMonth);
                setScoringDetails({ open: false, title: '', kind: '', items: [] });
                setShowScoring(true);
                await loadInterventions(nextMonth, 'all', 'all');
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <TrendingUp size={18} />
              Scoring
            </button>
          )}

          {canUsePm && (
            <button
              onClick={async () => {
                setSidebarOpen(false);
                setShowAddForm(false);
                setShowUpdateForm(false);
                setShowEditForm(false);
                setShowResetConfirm(false);
                setShowDeleteConfirm(false);
                setShowCalendar(false);
                setShowHistory(false);
                setShowFicheModal(false);
                setShowBannerUpload(false);
                setShowDayDetailsModal(false);
                setShowInterventions(false);
                setShowScoring(false);
                setScoringDetails({ open: false, title: '', kind: '', items: [] });

                setShowPm(true);
                const m = pmMonth || new Date().toISOString().slice(0, 7);
                await refreshPmAll(m);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <TrendingUp size={18} />
              Maintenances (PM)
            </button>
          )}

          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowHistory(true);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
          >
            <Activity size={18} />
            Historique
          </button>

          {canReset && (
            <button
              onClick={() => {
                setSidebarOpen(false);
                setShowResetConfirm(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <X size={18} />
              Réinitialiser
            </button>
          )}

          {canManageUsers && (
            <button
              onClick={() => {
                setSidebarOpen(false);
                setShowUsersModal(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <Users size={18} />
              Utilisateurs
            </button>
          )}

          {canManageUsers && (
            <button
              onClick={() => {
                setSidebarOpen(false);
                setShowPresenceModal(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 text-sm font-semibold"
            >
              <Activity size={18} />
              Présence
            </button>
          )}

          <div className="mt-auto pt-4 pb-3 flex justify-center">
            <img
              src={STHIC_LOGO_SRC}
              alt="STHIC"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="bg-white border-b border-gray-200 shadow-sm px-3 sm:px-4 md:px-6 py-3 sticky top-0 z-40">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 rounded hover:bg-gray-100"
                >
                  <Menu size={20} />
                </button>
                <Activity className="text-blue-600" size={24} />
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 truncate">Gestion Maintenance & Vidanges</div>
                  <div className="text-xs sm:text-sm text-gray-600">Version {APP_VERSION} - Suivi H24/7j avec Fiches</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                <div className="text-left sm:text-right">
                  <div className="text-xs text-gray-500">Aujourd'hui</div>
                  <div className="text-sm sm:text-lg font-semibold text-gray-800">{formatDate(new Date().toISOString())}</div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2 sm:justify-end">
                    <span>
                      {authUser.email} ({authUser.role})
                    </span>
                    {isViewer && (
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                        Lecture seule
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <button
                    onClick={() => {
                      setAccountForm({ password: '', confirm: '' });
                      setAccountError('');
                      setShowAccountModal(true);
                    }}
                    className="bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-900 text-sm font-semibold"
                  >
                    Mon compte
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                  >
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              {!isTechnician && (
                <div className="flex items-center gap-2 mb-4">
                  <Filter size={18} className="text-gray-600" />
                  <select
                    value={filterTechnician}
                    onChange={(e) => setFilterTechnician(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 sm:flex-initial"
                  >
                    <option value="all">Tous les techniciens</option>
                    {technicians.filter(t => t !== 'all').map(tech => (
                      <option key={tech} value={tech}>{tech}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Dashboard</h2>
              <p className="text-xs text-gray-600">Résumé mensuel (seuil contractuel: 250H)</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <label className="text-xs text-gray-600">Mois</label>
              <input
                type="month"
                value={dashboardMonth}
                onChange={(e) => setDashboardMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await loadData();
                  } catch {
                    // ignore
                  }
                  try {
                    await loadFicheHistory();
                  } catch {
                    // ignore
                  }
                }}
                className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 flex items-center gap-2 text-sm font-semibold w-full sm:w-auto"
                disabled={exportBusy}
              >
                Rafraîchir
              </button>
              {canExportExcel && (
                <button
                  type="button"
                  onClick={handleExportDashboardSummaryExcel}
                  className="bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2 text-sm font-semibold w-full sm:w-auto"
                  disabled={exportBusy}
                >
                  <Download size={16} />
                  Exporter Excel
                </button>
              )}
            </div>
          </div>

          {(() => {
            const { plannedEvents, remainingEvents, doneByPlannedDate, contractOk, contractOver } = computeDashboardData(dashboardMonth);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setDashboardDetails({ open: true, title: 'Vidanges effectuées dans le délai contractuel', kind: 'contract_ok', items: contractOk })}
                  className="bg-green-50 border border-green-200 rounded-xl p-4 text-left hover:bg-green-100"
                >
                  <div className="text-xs text-green-800 font-semibold">Dans délai contractuel</div>
                  <div className="text-2xl font-bold text-green-700 mt-1">{contractOk.length}</div>
                  <div className="text-xs text-green-700 mt-2">Clique pour voir les sites</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardDetails({ open: true, title: 'Vidanges effectuées en dépassement du délai contractuel', kind: 'contract_over', items: contractOver })}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 text-left hover:bg-red-100"
                >
                  <div className="text-xs text-red-800 font-semibold">Hors délai contractuel</div>
                  <div className="text-2xl font-bold text-red-700 mt-1">{contractOver.length}</div>
                  <div className="text-xs text-red-700 mt-2">Clique pour voir les sites</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardDetails({ open: true, title: 'Vidanges planifiées du mois', kind: 'planned', items: plannedEvents })}
                  className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left hover:bg-blue-100"
                >
                  <div className="text-xs text-blue-800 font-semibold">Planifiées du mois</div>
                  <div className="text-2xl font-bold text-blue-700 mt-1">{plannedEvents.length}</div>
                  <div className="text-xs text-blue-700 mt-2">Clique pour voir les sites</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardDetails({ open: true, title: 'Vidanges restantes du mois', kind: 'remaining', items: remainingEvents })}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left hover:bg-amber-100"
                >
                  <div className="text-xs text-amber-800 font-semibold">Restantes du mois</div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">{remainingEvents.length}</div>
                  <div className="text-xs text-amber-700 mt-2">Clique pour voir les sites</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardDetails({ open: true, title: 'Vidanges effectuées du mois', kind: 'done', items: doneByPlannedDate })}
                  className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left hover:bg-emerald-100"
                >
                  <div className="text-xs text-emerald-800 font-semibold">Effectuées du mois</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{doneByPlannedDate.length}</div>
                  <div className="text-xs text-emerald-700 mt-2">Clique pour voir les sites</div>
                </button>
              </div>
            );
          })()}
        </div>

        {dashboardDetails.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gray-100">
                <h3 className="text-lg font-bold text-gray-800">{dashboardDetails.title}</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDashboardDetails({ open: false, title: '', kind: '', items: [] })}
                    className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {dashboardDetails.items.length === 0 ? (
                  <div className="text-gray-600">Aucun élément pour ce mois.</div>
                ) : dashboardDetails.kind === 'contract_ok' || dashboardDetails.kind === 'contract_over' || dashboardDetails.kind === 'done' ? (
                  <div className="space-y-3">
                    {dashboardDetails.items.map((f) => (
                      <div key={f.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-800">{f.siteName}</div>
                            <div className="text-xs text-gray-600">Ticket: {f.ticketNumber} | Technicien: {f.technician}</div>
                            {f.dateCompleted && (
                              <div className="text-xs text-gray-600">Réalisée: {formatDate(f.dateCompleted)}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-600">Intervalle</div>
                            <div className="font-bold text-gray-800">{Number.isFinite(f.intervalHours) ? `${f.intervalHours}H` : '-'}</div>
                            <div className="text-xs text-gray-500">Seuil: {f.contractSeuil || 250}H</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardDetails.items.map((ev) => (
                      <div key={ev.key} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-800">{ev.siteName}</div>
                            <div className="text-xs text-gray-600">{ev.technician}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs bg-gray-100 px-2 py-1 rounded inline-block">{ev.epvType}</div>
                            <div className="text-sm text-gray-800 mt-1">{formatDate(ev.plannedDate)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin ? (
                <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <button
                    onClick={() => setDashboardDetails({ open: false, title: '', kind: '', items: [] })}
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
                  >
                    Fermer
                  </button>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {canExportExcel && dashboardDetails.items.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportDashboardDetailsExcel}
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold flex items-center justify-center gap-2 w-full sm:w-auto"
                        disabled={exportBusy}
                      >
                        <Download size={18} />
                        Exporter Excel
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row gap-3 sm:justify-end">
                  {canExportExcel && dashboardDetails.items.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportDashboardDetailsExcel}
                      className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold flex items-center justify-center gap-2 w-full sm:w-auto"
                      disabled={exportBusy}
                    >
                      <Download size={18} />
                      Exporter Excel
                    </button>
                  )}
                  <button
                    onClick={() => setDashboardDetails({ open: false, title: '', kind: '', items: [] })}
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {showAccountModal && authUser?.email && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-slate-800 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Edit size={22} />
                  Mon compte
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowAccountModal(false);
                      setAccountForm({ password: '', confirm: '' });
                      setAccountError('');
                    }}
                    className="hover:bg-slate-900 p-2 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={authUser.email}
                      readOnly
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={accountForm.password}
                      onChange={(e) => {
                        setAccountForm((prev) => ({ ...(prev || {}), password: e.target.value }));
                        setAccountError('');
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Minimum 6 caractères"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Confirmer le mot de passe</label>
                    <input
                      type="password"
                      value={accountForm.confirm}
                      onChange={(e) => {
                        setAccountForm((prev) => ({ ...(prev || {}), confirm: e.target.value }));
                        setAccountError('');
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  {accountError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                      {accountError}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t bg-white flex flex-col sm:flex-row sm:justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAccountModal(false);
                    setAccountForm({ password: '', confirm: '' });
                    setAccountError('');
                  }}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
                  disabled={accountSaving}
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    (async () => {
                      try {
                        if (accountSaving) return;
                        const password = String(accountForm.password || '');
                        const confirm = String(accountForm.confirm || '');
                        if (!password) {
                          setAccountError('Veuillez saisir un mot de passe.');
                          return;
                        }
                        if (password.length < 6) {
                          setAccountError('Mot de passe trop court (min 6 caractères).');
                          return;
                        }
                        if (password !== confirm) {
                          setAccountError('Les mots de passe ne correspondent pas.');
                          return;
                        }
                        setAccountSaving(true);
                        setAccountError('');
                        await apiFetchJson('/api/auth/change-password', {
                          method: 'POST',
                          body: JSON.stringify({ password })
                        });
                        setShowAccountModal(false);
                        setAccountForm({ password: '', confirm: '' });
                        setAccountError('');
                        alert('✅ Mot de passe mis à jour.');
                      } catch (e) {
                        setAccountError(e?.message || 'Erreur serveur.');
                      } finally {
                        setAccountSaving(false);
                      }
                    })();
                  }}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold"
                  disabled={accountSaving}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {showPm && canUsePm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-7xl sm:max-h-[95vh]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-teal-800 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp size={22} />
                  Maintenances planifiées (PM)
                  {isViewer && (
                    <span className="ml-2 bg-white/15 text-white border border-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
                      Lecture seule
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowPm(false);
                      setPmError('');
                      setPmNotice('');
                    }}
                    className="hover:bg-teal-900 p-2 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mb-4">
                  <div className="xl:col-span-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-gray-700 mb-1">Mois</label>
                        <input
                          type="month"
                          value={pmMonth}
                          onChange={async (e) => {
                            const next = String(e.target.value || '').trim();
                            setPmMonth(next);
                            await refreshPmAll(next);
                          }}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                          disabled={pmBusy}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await refreshPmAll(pmMonth);
                        }}
                        className="bg-gray-200 text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                        disabled={pmBusy}
                      >
                        Rafraîchir
                      </button>
                      <button
                        type="button"
                        onClick={handlePmExportExcel}
                        className="sm:col-span-2 bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 text-sm font-semibold flex items-center justify-center gap-2"
                        disabled={pmBusy}
                      >
                        <Download size={16} />
                        Exporter Excel
                      </button>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="xl:col-span-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                        <div className="flex flex-col">
                          <label className="text-xs font-semibold text-emerald-900 mb-1">Technicien</label>
                          <select
                            value={pmSendTechUserId}
                            onChange={(e) => setPmSendTechUserId(e.target.value)}
                            className="border border-emerald-200 rounded-lg px-3 py-2 text-sm bg-white"
                            disabled={pmBusy || pmSendBusy}
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
                        </div>
                        <button
                          type="button"
                          onClick={handleSendPmMonthPlanning}
                          className="bg-emerald-700 text-white px-3 py-2 rounded-lg hover:bg-emerald-800 text-sm font-semibold disabled:bg-gray-400"
                          disabled={!pmSendTechUserId || pmBusy || pmSendBusy}
                        >
                          Envoyer planning PM
                        </button>
                      </div>
                      {(Array.isArray(users) ? users : []).filter((u) => u && u.role === 'technician').length === 0 && (
                        <div className="mt-2 text-xs text-emerald-900/80">
                          Aucun technicien trouvé. Vérifie que des utilisateurs "technician" existent dans le module Utilisateurs.
                        </div>
                      )}
                    </div>
                  )}

                  {isAdmin && (
                    <div className="xl:col-span-4 bg-teal-800 text-white rounded-xl p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
                      <div className="flex flex-col">
                        <label
                          className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${
                            pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-teal-900 cursor-pointer'
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
                          className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${
                            pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-teal-900 cursor-pointer'
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

                        <button
                          type="button"
                          onClick={() => handlePmReset('imports')}
                          className="text-left px-3 py-2 rounded-lg hover:bg-teal-900 font-semibold text-sm disabled:opacity-60"
                          disabled={pmBusy || pmResetBusy}
                        >
                          Suppr. imports
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePmReset('all')}
                          className="text-left px-3 py-2 rounded-lg hover:bg-teal-900 font-semibold text-sm disabled:opacity-60"
                          disabled={pmBusy || pmResetBusy}
                        >
                          Reset mois
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
                    <button
                      type="button"
                      onClick={handlePmExportReprogExcel}
                      className="bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-900 text-sm font-semibold flex items-center justify-center gap-2"
                      disabled={pmBusy || exportBusy}
                    >
                      <Download size={16} />
                      Export reprogrammées
                    </button>
                  </div>
                )}

                {pmError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                    {pmError}
                  </div>
                )}

                {pmNotice && !pmError && (
                  <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-lg text-sm">
                    {pmNotice}
                  </div>
                )}

                {pmClientProgress > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-700 mb-1">Import retour client: {pmClientStep || '…'}</div>
                    <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                      <div className="bg-slate-700 h-2" style={{ width: `${pmClientProgress}%` }} />
                    </div>
                  </div>
                )}

                {pmClientCompare && (
                  <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-sm font-semibold text-slate-900 mb-2">
                      Retour client vs planning de base ({pmClientCompare.month})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs text-slate-800">
                      <div className="bg-white border border-slate-200 rounded p-2">Base: <span className="font-semibold">{pmClientCompare.baseCount}</span></div>
                      <div className="bg-white border border-slate-200 rounded p-2">Client: <span className="font-semibold">{pmClientCompare.clientCount}</span></div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded p-2">Retenus: <span className="font-semibold">{pmClientCompare.retained.length}</span></div>
                      <div className="bg-red-50 border border-red-200 rounded p-2">Retirés: <span className="font-semibold">{pmClientCompare.removed.length}</span></div>
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 sm:col-span-2">Ajouts: <span className="font-semibold">{pmClientCompare.added.length}</span></div>
                      <div className="bg-white border border-slate-200 rounded p-2 sm:col-span-2">Plan ID: <span className="font-mono">{pmClientCompare.basePlanId}</span></div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="bg-white border border-slate-200 rounded-lg overflow-auto max-h-64">
                        <div className="text-xs font-semibold px-3 py-2 border-b">Retenus</div>
                        <table className="min-w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr>
                              <th className="p-2 border-b">Date</th>
                              <th className="p-2 border-b">Site</th>
                              <th className="p-2 border-b">Type</th>
                              <th className="p-2 border-b">Ticket</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pmClientCompare.retained.slice(0, 50).map((r, idx) => (
                              <tr key={`ret-${r.siteCode}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-2 border-b whitespace-nowrap">{r.plannedDate}</td>
                                <td className="p-2 border-b whitespace-pre-line leading-tight break-words">{r.siteName || r.siteCode}</td>
                                <td className="p-2 border-b">{r.maintenanceType}</td>
                                <td className="p-2 border-b">{r.number || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {pmClientCompare.retained.length > 50 && (
                          <div className="text-xs text-gray-600 p-2">Affichage limité (50) — total: {pmClientCompare.retained.length}</div>
                        )}
                      </div>

                      <div className="bg-white border border-red-200 rounded-lg overflow-auto max-h-64">
                        <div className="text-xs font-semibold px-3 py-2 border-b text-red-800">Retirés</div>
                        <table className="min-w-full text-xs">
                          <thead className="sticky top-0 bg-red-50">
                            <tr>
                              <th className="p-2 border-b">Date</th>
                              <th className="p-2 border-b">Site</th>
                              <th className="p-2 border-b">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pmClientCompare.removed.slice(0, 50).map((r, idx) => (
                              <tr key={`rem-${r.siteCode}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-red-50'}>
                                <td className="p-2 border-b whitespace-nowrap">{r.plannedDate}</td>
                                <td className="p-2 border-b whitespace-pre-line leading-tight break-words">{r.siteName || r.siteCode}</td>
                                <td className="p-2 border-b">{r.maintenanceType}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {pmClientCompare.removed.length > 50 && (
                          <div className="text-xs text-gray-600 p-2">Affichage limité (50) — total: {pmClientCompare.removed.length}</div>
                        )}
                      </div>

                      <div className="bg-white border border-amber-200 rounded-lg overflow-auto max-h-64">
                        <div className="text-xs font-semibold px-3 py-2 border-b text-amber-900">Ajouts</div>
                        <table className="min-w-full text-xs">
                          <thead className="sticky top-0 bg-amber-50">
                            <tr>
                              <th className="p-2 border-b">Date</th>
                              <th className="p-2 border-b">Site</th>
                              <th className="p-2 border-b">Type</th>
                              <th className="p-2 border-b">Ticket</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pmClientCompare.added.slice(0, 50).map((r, idx) => (
                              <tr key={`add-${r.siteCode}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-amber-50'}>
                                <td className="p-2 border-b whitespace-nowrap">{r.plannedDate}</td>
                                <td className="p-2 border-b whitespace-pre-line leading-tight break-words">{r.siteName || r.siteCode}</td>
                                <td className="p-2 border-b">{r.maintenanceType}</td>
                                <td className="p-2 border-b">{r.number || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {pmClientCompare.added.length > 50 && (
                          <div className="text-xs text-gray-600 p-2">Affichage limité (50) — total: {pmClientCompare.added.length}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-700 mb-4">
                  Tickets du mois: <span className="font-semibold">{Array.isArray(pmItems) ? pmItems.length : 0}</span>
                </div>

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
                  const dateFilter = normalizeYmd(pmFilterDate);
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
                    if (dateFilter) {
                      const sched = normalizeYmd(it?.scheduledWoDate);
                      if (sched !== dateFilter) return false;
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
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
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
                    if (bucket === 'closed') return { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
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
                      className: 'bg-red-700 border-red-800 hover:bg-red-800',
                      titleClassName: 'text-white/90',
                      valueClassName: 'text-white',
                      onClick: () => {
                        setPmFilterState('all');
                        setPmFilterReprog('all');
                      }
                    },
                    {
                      key: 'closed',
                      title: 'Closed Complete',
                      value: Number(counts.closed || 0),
                      className: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
                      titleClassName: 'text-gray-700',
                      valueClassName: 'text-gray-900',
                      onClick: () => {
                        setPmFilterState('closed');
                        setPmFilterReprog('all');
                      }
                    },
                    {
                      key: 'wip',
                      title: 'Work in progress',
                      value: Number(counts.wip || 0),
                      className: 'bg-rose-100 border-rose-200 hover:bg-rose-200',
                      titleClassName: 'text-gray-700',
                      valueClassName: 'text-gray-900',
                      onClick: () => {
                        setPmFilterState('wip');
                        setPmFilterReprog('all');
                      }
                    },
                    {
                      key: 'awaiting',
                      title: 'Awaiting Closure',
                      value: Number(counts.awaiting || 0),
                      className: 'bg-white border-gray-200 hover:bg-gray-50',
                      titleClassName: 'text-gray-700',
                      valueClassName: 'text-gray-900',
                      onClick: () => {
                        setPmFilterState('awaiting');
                        setPmFilterReprog('all');
                      }
                    },
                    {
                      key: 'assigned',
                      title: 'Assigned',
                      value: Number(counts.assigned || 0),
                      className: 'bg-amber-200 border-amber-300 hover:bg-amber-300',
                      titleClassName: 'text-gray-700',
                      valueClassName: 'text-gray-900',
                      onClick: () => {
                        setPmFilterState('assigned');
                        setPmFilterReprog('all');
                      }
                    },
                    {
                      key: 'reprog',
                      title: 'Reprogrammation',
                      value: Number(counts.reprog || 0),
                      className: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
                      titleClassName: 'text-gray-700',
                      valueClassName: 'text-gray-900',
                      onClick: () => {
                        setPmFilterState('all');
                        setPmFilterReprog('any');
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
                            <div className={`text-[11px] font-semibold ${c.titleClassName || 'text-gray-700'}`}>{c.title}</div>
                            <div className={`text-2xl font-bold mt-1 ${c.valueClassName || 'text-gray-900'}`}>{c.value}</div>
                          </button>
                        ))}
                      </div>

                      <div className="border border-gray-200 rounded-xl p-4 mb-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Date planifiée (jour)</label>
                            <input
                              type="date"
                              value={pmFilterDate}
                              onChange={(e) => setPmFilterDate(String(e.target.value || ''))}
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
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3">
                          <div className="text-xs text-gray-600">
                            Affichés: <span className="font-semibold text-gray-900">{tableFiltered.length}</span> / {items.length}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPmFilterState('all');
                              setPmFilterType('all');
                              setPmFilterZone('all');
                              setPmSearch('');
                              setPmFilterDate('');
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
                                {isAdmin && <th className="px-3 py-2 font-semibold whitespace-nowrap">Action</th>}
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
                                      {isAdmin && (
                                        <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => handlePmOpenReprog(it)}
                                            className="bg-teal-700 text-white px-3 py-1.5 rounded-lg hover:bg-teal-800 text-xs font-semibold"
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
                            <div className="flex justify-between items-center p-4 border-b bg-teal-800 text-white">
                              <div className="font-bold">Reprogrammation (PM)</div>
                              <button
                                onClick={() => {
                                  setPmReprogOpen(false);
                                  setPmReprogItem(null);
                                  setPmReprogForm({ date: '', status: '', reason: '' });
                                  setPmReprogError('');
                                }}
                                className="hover:bg-teal-900 p-2 rounded"
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
                                className="bg-teal-800 text-white px-4 py-2 rounded-lg hover:bg-teal-900 font-semibold"
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
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
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

              <div className={`relative p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:justify-end gap-2' : 'flex justify-end'}`}>
                <button
                  onClick={() => {
                    setShowPm(false);
                    setPmError('');
                    setPmNotice('');
                  }}
                  className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {showScoring && !isTechnician && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-slate-800 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp size={22} />
                  Scoring
                  {isViewer && (
                    <span className="ml-2 bg-white/15 text-white border border-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
                      Lecture seule
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowScoring(false);
                      setScoringDetails({ open: false, title: '', kind: '', items: [] });
                    }}
                    className="hover:bg-slate-900 p-2 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="text-sm text-slate-700">
                    Synthèse mensuelle (basée sur l'historique des fiches + interventions planifiées)
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs text-gray-600">Mois</label>
                    <input
                      type="month"
                      value={scoringMonth}
                      onChange={async (e) => {
                        const next = String(e.target.value || '').trim();
                        setScoringMonth(next);
                        setScoringDetails({ open: false, title: '', kind: '', items: [] });
                        await loadInterventions(next, 'all', 'all');
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {(() => {
                  const isInMonth = (ymd, yyyymm) => {
                    if (!ymd || !yyyymm) return false;
                    return String(ymd).slice(0, 7) === String(yyyymm);
                  };

                  const siteById = new Map(
                    (Array.isArray(sites) ? sites : [])
                      .filter((s) => s && s.id)
                      .map((s) => [String(s.id), s])
                  );

                  const doneInMonth = ficheHistory.filter(
                    (f) => f && f.status === 'Effectuée' && f.dateCompleted && isInMonth(f.dateCompleted, scoringMonth)
                  );
                  const doneWithin = doneInMonth.filter((f) => f.isWithinContract === true);
                  const doneOver = doneInMonth.filter((f) => f.isWithinContract === false);

                  const remainingInMonth = interventions
                    .filter(
                      (i) =>
                        i &&
                        i.plannedDate &&
                        isInMonth(i.plannedDate, scoringMonth) &&
                        (i.status === 'planned' || i.status === 'sent')
                    )
                    .slice()
                    .sort((a, b) => {
                      const statusRank = (s) => (s === 'sent' ? 0 : s === 'planned' ? 1 : 2);
                      const sr = statusRank(a.status) - statusRank(b.status);
                      if (sr !== 0) return sr;
                      const d = String(a.plannedDate || '').localeCompare(String(b.plannedDate || ''));
                      if (d !== 0) return d;
                      const sa = siteById.get(String(a.siteId))?.nameSite || '';
                      const sb = siteById.get(String(b.siteId))?.nameSite || '';
                      return String(sa).localeCompare(String(sb));
                    });

                  const cards = [
                    {
                      key: 'done',
                      title: 'Effectuées',
                      value: doneInMonth.length,
                      className: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
                      onClick: () => setScoringDetails({ open: true, title: 'Vidanges effectuées', kind: 'done', items: doneInMonth })
                    },
                    {
                      key: 'remaining',
                      title: 'Restantes',
                      value: remainingInMonth.length,
                      className: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
                      onClick: () => setScoringDetails({ open: true, title: 'Interventions restantes (planifiées/envoyées)', kind: 'remaining', items: remainingInMonth })
                    },
                    {
                      key: 'within',
                      title: 'Dans délai',
                      value: doneWithin.length,
                      className: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
                      onClick: () => setScoringDetails({ open: true, title: 'Vidanges dans le délai contractuel', kind: 'within', items: doneWithin })
                    },
                    {
                      key: 'over',
                      title: 'Hors délai',
                      value: doneOver.length,
                      className: 'bg-red-50 border-red-200 hover:bg-red-100',
                      onClick: () => setScoringDetails({ open: true, title: 'Vidanges hors délai contractuel', kind: 'over', items: doneOver })
                    }
                  ];

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                        {cards.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={c.onClick}
                            className={`${c.className} border rounded-xl p-4 text-left`}
                          >
                            <div className="text-xs font-semibold text-gray-700">{c.title}</div>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{c.value}</div>
                            <div className="text-xs text-gray-600 mt-1">Clique pour détails</div>
                          </button>
                        ))}
                      </div>

                      {scoringDetails.open && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 border-b border-gray-200">
                            <div className="font-semibold text-gray-800">{scoringDetails.title}</div>
                            <div className="flex items-center gap-2">
                              {canExportExcel && scoringDetails.items.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleExportScoringDetailsExcel}
                                  className="bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 text-sm font-semibold flex items-center gap-2"
                                  disabled={exportBusy}
                                >
                                  <Download size={16} />
                                  Exporter Excel
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setScoringDetails({ open: false, title: '', kind: '', items: [] })}
                                className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                              >
                                Fermer
                              </button>
                            </div>
                          </div>
                          <div className="p-3 sm:p-4">
                            {scoringDetails.items.length === 0 ? (
                              <div className="text-gray-600">Aucun élément.</div>
                            ) : scoringDetails.kind === 'remaining' ? (
                              <div className="space-y-2">
                                {scoringDetails.items.map((it) => (
                                  <div key={it.id} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        {(() => {
                                          const site = siteById.get(String(it.siteId)) || null;
                                          const title = site?.nameSite || it.siteId;
                                          const sub = site?.idSite ? `ID: ${site.idSite}` : null;
                                          return (
                                            <>
                                              <div className="font-semibold text-gray-800 truncate">{title}</div>
                                              {sub && <div className="text-xs text-gray-600">{sub}</div>}
                                            </>
                                          );
                                        })()}
                                        <div className="text-xs text-gray-600">{it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}</div>
                                      </div>
                                      <div className="text-right">
                                        <div
                                          className={`text-xs px-2 py-1 rounded inline-block ${
                                            it.status === 'sent'
                                              ? 'bg-blue-100 text-blue-800'
                                              : it.status === 'planned'
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-gray-100 text-gray-700'
                                          }`}
                                        >
                                          {it.status === 'sent' ? 'Envoyée' : it.status === 'planned' ? 'Planifiée' : String(it.status || '-')}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">Statut: <span className="font-semibold">{it.status}</span></div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {scoringDetails.items.map((f) => (
                                  <div key={f.id} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="font-semibold text-gray-800 truncate">{f.siteName}</div>
                                        <div className="text-xs text-gray-600">Ticket: {f.ticketNumber} • Technicien: {f.technician}</div>
                                        {f.dateCompleted && (
                                          <div className="text-xs text-gray-600">Réalisée: {formatDate(f.dateCompleted)}</div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className={`text-xs px-2 py-1 rounded inline-block ${f.isWithinContract === true ? 'bg-green-100 text-green-800' : f.isWithinContract === false ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                                          {f.isWithinContract === true ? 'Dans délai' : f.isWithinContract === false ? 'Hors délai' : 'N/A'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className={`relative p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:justify-end gap-2' : 'flex justify-end'}`}>
                <button
                  onClick={() => {
                    setShowScoring(false);
                    setScoringDetails({ open: false, title: '', kind: '', items: [] });
                  }}
                  className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {showInterventions && (
          <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isTechnician ? 'p-0' : 'p-0 sm:p-4'}`}>
            <div
              className={`bg-white shadow-xl overflow-hidden flex flex-col w-full ${
                isTechnician
                  ? 'h-[100svh] max-w-none max-h-none rounded-none'
                  : 'h-[100svh] max-w-none max-h-[100svh] rounded-none sm:h-auto sm:max-w-5xl sm:max-h-[90vh] sm:rounded-lg'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-emerald-700 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle size={24} />
                  {isTechnician ? 'Mes interventions' : 'Interventions'}
                  {isTechnician && technicianUnseenSentCount > 0 && (
                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {technicianUnseenSentCount}
                    </span>
                  )}
                  {isViewer && (
                    <span className="ml-2 bg-white/15 text-white border border-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
                      Lecture seule
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (isTechnician && authUser?.id) {
                        const maxSentAt = (Array.isArray(interventions) ? interventions : [])
                          .filter((i) => i && i.status === 'sent' && i.sentAt)
                          .map((i) => String(i.sentAt))
                          .sort()
                          .slice(-1)[0];
                        if (maxSentAt && String(maxSentAt) > String(technicianSeenSentAt || '')) {
                          setTechnicianSeenSentAt(String(maxSentAt));
                          try {
                            const k = `tech_seen_sent_at:${String(authUser.id)}`;
                            localStorage.setItem(k, String(maxSentAt));
                          } catch {
                            // ignore
                          }
                        }
                      }
                      setShowInterventions(false);
                      setInterventionsError('');
                      setPlanningAssignments({});
                      setCompleteModalOpen(false);
                      setCompleteModalIntervention(null);
                      setCompleteModalSite(null);
                      setCompleteForm({ nhNow: '', doneDate: '' });
                      setCompleteFormError('');
                      setNhModalOpen(false);
                      setNhModalIntervention(null);
                      setNhModalSite(null);
                      setNhForm({ nhValue: '', readingDate: '' });
                      setNhFormError('');
                    }}
                    className="hover:bg-emerald-800 p-2 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {isViewer && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm mb-4">
                    Mode lecture seule : vous pouvez consulter les interventions, sans planifier ni valider.
                  </div>
                )}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  {isTechnician && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      {(() => {
                        const pad2 = (n) => String(n).padStart(2, '0');
                        const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                        const today = ymdLocal(new Date());
                        const tomorrowD = new Date();
                        tomorrowD.setDate(tomorrowD.getDate() + 1);
                        const tomorrow = ymdLocal(tomorrowD);
                        const month = String(interventionsMonth || '').trim();

                        const todayCount = interventions.filter((i) => i.plannedDate === today && i.status !== 'done').length;
                        const tomorrowRaw = interventions.filter((i) => i.plannedDate === tomorrow && i.status !== 'done');
                        const tomorrowCount = tomorrowRaw.length;
                        const tomorrowSentCount = tomorrowRaw.filter((i) => i.status === 'sent').length;
                        const monthCount = month ? interventions.filter((i) => String(i?.plannedDate || '').slice(0, 7) === month && i.status !== 'done').length : interventions.filter((i) => i.status !== 'done').length;

                        return (
                      <div className="grid grid-cols-3 gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => setTechnicianInterventionsTab('today')}
                          className={`${technicianInterventionsTab === 'today' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-800 border border-gray-300'} px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                        >
                          Aujourd'hui ({todayCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTechnicianInterventionsTab('tomorrow')}
                          className={`${technicianInterventionsTab === 'tomorrow' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-800 border border-gray-300'} px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                        >
                          Demain ({tomorrowCount}{tomorrowSentCount ? `/${tomorrowSentCount} envoyée(s)` : ''})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTechnicianInterventionsTab('month')}
                          className={`${technicianInterventionsTab === 'month' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-800 border border-gray-300'} px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                        >
                          Mois ({monthCount})
                        </button>
                      </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => setShowTechnicianInterventionsFilters((v) => !v)}
                        className="bg-white text-gray-800 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 font-semibold text-sm w-full sm:w-auto"
                      >
                        Filtres
                      </button>
                    </div>
                  )}

                  {(!isTechnician || showTechnicianInterventionsFilters) && (
                    <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3 items-end`}>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600 mb-1">Mois</span>
                      <input
                        type="month"
                        value={interventionsMonth}
                        onChange={(e) => {
                          setInterventionsMonth(e.target.value);
                          const nextMonth = String(e.target.value || '').trim();
                          loadInterventions(nextMonth, interventionsStatus, interventionsTechnicianUserId);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600 mb-1">Statut</span>
                      <select
                        value={interventionsStatus}
                        onChange={(e) => {
                          const nextStatus = e.target.value;
                          setInterventionsStatus(nextStatus);
                          loadInterventions(interventionsMonth, nextStatus, interventionsTechnicianUserId);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="all">Tous</option>
                        <option value="planned">Planifiées</option>
                        <option value="sent">Envoyées</option>
                        <option value="done">Effectuées</option>
                      </select>
                    </div>

                    {isAdmin && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 mb-1">Technicien</span>
                        <select
                          value={interventionsTechnicianUserId}
                          onChange={(e) => {
                            const nextTechId = e.target.value;
                            setInterventionsTechnicianUserId(nextTechId);
                            loadInterventions(interventionsMonth, interventionsStatus, nextTechId);
                          }}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="all">Tous</option>
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
                      </div>
                    )}

                    {canExportExcel && (
                      <div className="flex flex-col w-full">
                        <span className="text-xs text-gray-600 mb-1 invisible">Actions</span>
                        <button
                          type="button"
                          onClick={handleExportInterventionsExcel}
                          className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm flex items-center justify-center gap-2 w-full"
                          disabled={exportBusy || interventionsBusy || interventions.length === 0}
                        >
                          <Download size={18} />
                          Exporter Excel
                        </button>
                      </div>
                    )}
                    </div>
                  )}

                  {interventionsError && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                      {interventionsError}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="font-semibold text-gray-800">Planification (à partir des EPV du mois)</div>
                        <div className="text-xs text-gray-600">Clique "Planifier" pour créer l'intervention en base.</div>
                      </div>
                    </div>

                    {(() => {
                      const techUsers = (Array.isArray(users) ? users : [])
                        .filter((u) => u && u.role === 'technician')
                        .slice()
                        .sort((a, b) => String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || '')));

                      const findTechUserIdByName = (name) => {
                        const needle = String(name || '').trim();
                        if (!needle) return '';
                        const found = techUsers.find((u) => String(u.technicianName || '').trim() === needle);
                        return found?.id ? String(found.id) : '';
                      };

                      const plannedEvents = filteredSites
                        .filter((s) => s && !s.retired)
                        .flatMap((site) => {
                          return [
                            { type: 'EPV1', date: site.epv1 },
                            { type: 'EPV2', date: site.epv2 },
                            { type: 'EPV3', date: site.epv3 }
                          ]
                            .filter((ev) => ev.date && String(ev.date).slice(0, 7) === interventionsMonth)
                            .map((ev) => ({
                              plannedDate: ymdShiftForWorkdays(String(ev.date).slice(0, 10)) || String(ev.date).slice(0, 10),
                              originalDate: String(ev.date).slice(0, 10),
                              siteId: site.id,
                              siteName: site.nameSite,
                              technicianName: site.technician,
                              wasRetiredPrevMonth: interventionsPrevMonthRetiredSiteIds.has(String(site.id)),
                              epvType: ev.type
                            }));
                        })
                        .sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)));

                      plannedEvents.forEach((ev) => {
                        ev.key = getInterventionKey(ev.siteId, ev.plannedDate, ev.epvType);
                      });

                      const already = new Set(
                        interventions.map((i) => getInterventionKey(i.siteId, i.plannedDate, i.epvType))
                      );

                      if (plannedEvents.length === 0) {
                        return <div className="text-sm text-gray-600">Aucun EPV trouvé sur ce mois.</div>;
                      }

                      return (
                        <div className="space-y-2">
                          {plannedEvents.map((ev) => (
                            <div key={ev.key} className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-800 truncate">{ev.siteName}</div>
                                <div className="text-xs text-gray-600">
                                  {ev.epvType} • {formatDate(ev.plannedDate)} • {ev.technicianName}
                                  {ev.originalDate && String(ev.originalDate) !== String(ev.plannedDate) && (
                                    <span className="ml-2 text-[11px] bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                                      Déplacée (origine: {formatDate(ev.originalDate)})
                                    </span>
                                  )}
                                  {ev.wasRetiredPrevMonth && (
                                    <span className="ml-2 text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                                      Justif hors délais (retiré {interventionsPrevMonthKey || 'le mois passé'})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {already.has(ev.key) ? (
                                  <span className="text-xs bg-green-100 text-green-800 border border-green-200 px-2 py-1 rounded font-semibold">Déjà planifiée</span>
                                ) : (
                                  (() => {
                                    const selectedTechId =
                                      planningAssignments?.[ev.key] ||
                                      findTechUserIdByName(ev.technicianName) ||
                                      '';

                                    return (
                                      <>
                                        <select
                                          value={selectedTechId}
                                          onChange={(e) => {
                                            const v = String(e.target.value || '');
                                            setPlanningAssignments((prev) => ({
                                              ...(prev || {}),
                                              [ev.key]: v
                                            }));
                                          }}
                                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                                        >
                                          <option value="">-- Technicien --</option>
                                          {techUsers.map((u) => (
                                            <option key={u.id} value={u.id}>
                                              {u.technicianName || u.email}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={() => handlePlanIntervention({ ...ev, technicianUserId: selectedTechId })}
                                          className="bg-emerald-700 text-white px-3 py-2 rounded-lg hover:bg-emerald-800 font-semibold text-sm disabled:bg-gray-400 disabled:hover:bg-gray-400"
                                          disabled={!selectedTechId}
                                          title={!selectedTechId ? 'Sélectionner un technicien' : ''}
                                        >
                                          Planifier
                                        </button>
                                      </>
                                    );
                                  })()
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {(() => {
                  const siteById = new Map(sites.map((s) => [String(s.id), s]));
                  const list = interventions
                    .slice()
                    .sort((a, b) => String(a.plannedDate || '').localeCompare(String(b.plannedDate || '')));

                  if (isAdmin) {
                    const filtered = interventionsTechnicianUserId && interventionsTechnicianUserId !== 'all'
                      ? list.filter((i) => String(i.technicianUserId || '') === String(interventionsTechnicianUserId))
                      : list;

                    const groupMap = new Map();
                    filtered.forEach((it) => {
                      const key = String(it.technicianName || 'Sans technicien');
                      if (!groupMap.has(key)) groupMap.set(key, []);
                      groupMap.get(key).push(it);
                    });

                    const groups = Array.from(groupMap.entries())
                      .map(([title, items]) => ({ title, items }))
                      .sort((a, b) => String(a.title).localeCompare(String(b.title)));

                    return (
                      <div className="space-y-6">
                        {groups.length === 0 ? (
                          <div className="text-sm text-gray-600">Aucune intervention.</div>
                        ) : (
                          groups.map((g) => (
                            <div key={g.title}>
                              <div className="font-semibold text-gray-800 mb-2">{g.title} ({g.items.length})</div>
                              {g.items.length === 0 ? (
                                <div className="text-sm text-gray-600">Aucune intervention.</div>
                              ) : (
                                <div className="space-y-2">
                                  {g.items.map((it) => {
                                    const site = siteById.get(String(it.siteId)) || null;
                                    const statusColor = it.status === 'done' ? 'bg-green-100 text-green-800 border-green-200' : it.status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200';
                                    const wasRetiredPrevMonth = Boolean(
                                      interventionsPrevMonthRetiredSiteIds.has(String(it.siteId)) &&
                                      String(interventionsMonth || '').trim() &&
                                      String(it?.plannedDate || '').slice(0, 7) === String(interventionsMonth || '').trim()
                                    );
                                    return (
                                      <div key={it.id} className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="font-semibold text-gray-800 truncate">{site?.nameSite || it.siteId}</div>
                                          {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                                          <div className="text-xs text-gray-600">{it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>{it.status}</span>
                                          {wasRetiredPrevMonth && (
                                            <span className="text-xs px-2 py-1 rounded border font-semibold bg-amber-50 text-amber-900 border-amber-200">
                                              Justif hors délais (retiré {interventionsPrevMonthKey || 'mois-1'})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    );
                  }

                  const pad2 = (n) => String(n).padStart(2, '0');
                  const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                  const today = ymdLocal(new Date());
                  const tomorrowD = new Date();
                  tomorrowD.setDate(tomorrowD.getDate() + 1);
                  const tomorrow = ymdLocal(tomorrowD);
                  const month = String(interventionsMonth || '').trim();

                  const statusRank = (st) => {
                    if (st === 'sent') return 0;
                    if (st === 'planned') return 1;
                    return 2;
                  };

                  const todayItems = list
                    .filter((i) => i.plannedDate === today && i.status !== 'done')
                    .slice()
                    .sort((a, b) => statusRank(a.status) - statusRank(b.status));

                  const tomorrowRaw = list.filter((i) => i.plannedDate === tomorrow && i.status !== 'done');
                  const tomorrowSentCount = tomorrowRaw.filter((i) => i.status === 'sent').length;
                  const tomorrowItems = tomorrowRaw
                    .slice()
                    .sort((a, b) => statusRank(a.status) - statusRank(b.status));

                  const renderItem = (it) => {
                    const site = siteById.get(String(it.siteId)) || null;
                    const statusColor = it.status === 'done' ? 'bg-green-100 text-green-800 border-green-200' : it.status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200';
                    const wasRetiredPrevMonth = Boolean(
                      interventionsPrevMonthRetiredSiteIds.has(String(it.siteId)) &&
                      String(interventionsMonth || '').trim() &&
                      String(it?.plannedDate || '').slice(0, 7) === String(interventionsMonth || '').trim()
                    );

                    const canCatchUpInMonth = Boolean(
                      isTechnician &&
                      technicianInterventionsTab === 'month' &&
                      String(it?.plannedDate || '')
                    );
                    const isOverdueInMonth = Boolean(
                      isTechnician &&
                      technicianInterventionsTab === 'month' &&
                      String(it?.plannedDate || '') &&
                      String(it.plannedDate) < String(today)
                    );
                    return (
                      <div key={it.id} className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{site?.nameSite || it.siteId}</div>
                          {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                          <div className="text-xs text-gray-600">{it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>{it.status}</span>
                          {wasRetiredPrevMonth && (
                            <span className="text-xs px-2 py-1 rounded border font-semibold bg-amber-50 text-amber-900 border-amber-200">
                              Justif hors délais (retiré {interventionsPrevMonthKey || 'mois-1'})
                            </span>
                          )}
                          {isOverdueInMonth && (
                            <span className="text-xs px-2 py-1 rounded border font-semibold bg-red-100 text-red-800 border-red-200">
                              RETARD
                            </span>
                          )}
                          {isTechnician && site && (
                            <button
                              type="button"
                              onClick={() => {
                                const offset = Number(site?.nhOffset || 0);
                                const raw = Math.max(0, Number(site?.nh2A || 0) - offset);
                                setNhModalIntervention(it);
                                setNhModalSite(site);
                                setNhForm({ nhValue: String(Math.trunc(raw)), readingDate: today });
                                setNhFormError('');
                                setNhModalOpen(true);
                              }}
                              className="bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm"
                            >
                              Mettre à jour NH
                            </button>
                          )}
                          {it.status !== 'done' && (isAdmin || (isTechnician && (technicianInterventionsTab !== 'month' || canCatchUpInMonth))) && (
                            <button
                              onClick={() => {
                                if (isTechnician) {
                                  setCompleteModalIntervention(it);
                                  setCompleteModalSite(site);
                                  setCompleteForm({ nhNow: String(site?.nhEstimated ?? ''), doneDate: today });
                                  setCompleteFormError('');
                                  setCompleteModalOpen(true);
                                  return;
                                }
                                handleCompleteIntervention(it.id);
                              }}
                              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 font-semibold text-sm"
                            >
                              Marquer effectuée
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  };

                  if (isTechnician) {
                    if (technicianInterventionsTab === 'month') {
                      const prevMonth = (() => {
                        const raw = String(month || '').trim();
                        const m = raw.match(/^(\d{4})-(\d{2})$/);
                        if (!m) return '';
                        const y = Number(m[1]);
                        const mm = Number(m[2]);
                        if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return '';
                        const py = mm === 1 ? y - 1 : y;
                        const pm = mm === 1 ? 12 : mm - 1;
                        return `${py}-${String(pm).padStart(2, '0')}`;
                      })();

                      const catchUpPrevMonthItems = list
                        .filter((i) => i && i.status !== 'done')
                        .filter((i) => {
                          if (!prevMonth) return false;
                          return String(i.plannedDate || '').slice(0, 7) === prevMonth;
                        });

                      const monthItems = list
                        .filter((i) => i && i.status !== 'done')
                        .filter((i) => {
                          if (!month) return true;
                          return String(i.plannedDate || '').slice(0, 7) === month;
                        });

                      const merged = [...catchUpPrevMonthItems, ...monthItems].filter(Boolean);

                      const byDate = new Map();
                      merged.forEach((it) => {
                        const k = String(it.plannedDate || '');
                        if (!byDate.has(k)) byDate.set(k, []);
                        byDate.get(k).push(it);
                      });

                      const dates = Array.from(byDate.keys()).sort((a, b) => String(a).localeCompare(String(b)));
                      return (
                        <div className="space-y-6">
                          {catchUpPrevMonthItems.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 text-sm">
                              Rattrapage: <span className="font-semibold">{catchUpPrevMonthItems.length}</span> vidange(s) en retard du mois précédent affichée(s) dans ce mois.
                            </div>
                          )}
                          {dates.length === 0 ? (
                            <div className="text-sm text-gray-600">Aucune intervention.</div>
                          ) : (
                            dates.map((d) => (
                              <div key={d}>
                                <div className="font-semibold text-gray-800 mb-2">{formatDate(d)} ({byDate.get(d).length})</div>
                                <div className="space-y-2">
                                  {byDate.get(d).map((it) => renderItem(it))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    }

                    const selectedKey = technicianInterventionsTab === 'today' ? 'today' : 'tomorrow';
                    const selected = selectedKey === 'today' ? todayItems : tomorrowItems;
                    const title = selectedKey === 'today' ? "Aujourd'hui" : `Demain (${tomorrowItems.length} dont ${tomorrowSentCount} envoyée(s))`;
                    return (
                      <div className="space-y-6">
                        <div>
                          <div className="font-semibold text-gray-800 mb-2">{title}</div>
                          {selected.length === 0 ? (
                            <div className="text-sm text-gray-600">Aucune intervention.</div>
                          ) : (
                            <div className="space-y-2">{selected.map((it) => renderItem(it))}</div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const groups = [
                    { key: 'today', title: "Aujourd'hui", items: todayItems },
                    { key: 'tomorrow', title: `Demain (${tomorrowItems.length} dont ${tomorrowSentCount} envoyée(s))`, items: tomorrowItems },
                    { key: 'all', title: 'Toutes', items: list }
                  ];

                  return (
                    <div className="space-y-6">
                      {groups.map((g) => (
                        <div key={g.key}>
                          <div className="font-semibold text-gray-800 mb-2">{g.title}</div>
                          {g.items.length === 0 ? (
                            <div className="text-sm text-gray-600">Aucune intervention.</div>
                          ) : (
                            <div className="space-y-2">{g.items.map((it) => renderItem(it))}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {completeModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
                      <div className="flex justify-between items-center p-4 border-b bg-green-700 text-white">
                        <div className="font-bold">Valider l'intervention</div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setCompleteModalOpen(false);
                              setCompleteModalIntervention(null);
                              setCompleteModalSite(null);
                              setCompleteForm({ nhNow: '', doneDate: '' });
                              setCompleteFormError('');
                            }}
                            className="hover:bg-green-800 p-2 rounded"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-gray-900">{completeModalSite?.nameSite || completeModalIntervention?.siteId || ''}</div>
                          {completeModalSite?.idSite && (
                            <div className="text-xs text-gray-600">ID: {completeModalSite.idSite}</div>
                          )}
                          <div className="text-xs text-gray-600">{completeModalIntervention?.epvType} • {formatDate(completeModalIntervention?.plannedDate)}</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Date de vidange</label>
                            <input
                              type="date"
                              value={completeForm.doneDate}
                              onChange={(e) => {
                                setCompleteForm((prev) => ({ ...(prev || {}), doneDate: e.target.value }));
                                setCompleteFormError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Compteur (NH) relevé</label>
                            <input
                              type="number"
                              value={completeForm.nhNow}
                              onChange={(e) => {
                                setCompleteForm((prev) => ({ ...(prev || {}), nhNow: e.target.value }));
                                setCompleteFormError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        {completeFormError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                            {completeFormError}
                          </div>
                        )}
                      </div>
                      <div className={`p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2' : 'flex justify-end gap-2'}`}>
                        <button
                          onClick={() => {
                            setCompleteModalOpen(false);
                            setCompleteModalIntervention(null);
                            setCompleteModalSite(null);
                            setCompleteForm({ nhNow: '', doneDate: '' });
                            setCompleteFormError('');
                          }}
                          className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={async () => {
                            const interventionId = completeModalIntervention?.id;
                            if (!interventionId) {
                              setCompleteFormError('Intervention introuvable.');
                              return;
                            }
                            const doneDate = String(completeForm?.doneDate || '').trim();
                            const nhNow = Number(String(completeForm?.nhNow || '').trim());
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(doneDate)) {
                              setCompleteFormError('Date invalide.');
                              return;
                            }
                            if (!Number.isFinite(nhNow)) {
                              setCompleteFormError('Veuillez saisir un compteur (NH) valide.');
                              return;
                            }
                            try {
                              await handleCompleteIntervention(interventionId, { nhNow, doneDate });
                              setCompleteModalOpen(false);
                              setCompleteModalIntervention(null);
                              setCompleteModalSite(null);
                              setCompleteForm({ nhNow: '', doneDate: '' });
                              setCompleteFormError('');
                            } catch (e) {
                              // handled in handler
                            }
                          }}
                          className={`bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                        >
                          Confirmer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {nhModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
                      <div className="flex justify-between items-center p-4 border-b bg-slate-800 text-white">
                        <div className="font-bold">Mettre à jour le NH</div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setNhModalOpen(false);
                              setNhModalIntervention(null);
                              setNhModalSite(null);
                              setNhForm({ nhValue: '', readingDate: '' });
                              setNhFormError('');
                            }}
                            className="hover:bg-slate-900 p-2 rounded"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-gray-900">{nhModalSite?.nameSite || nhModalIntervention?.siteId || ''}</div>
                          {nhModalSite?.idSite && <div className="text-xs text-gray-600">ID: {nhModalSite.idSite}</div>}
                          <div className="text-xs text-gray-600">Saisir le compteur tel qu'affiché sur le générateur (DEEPSEA).</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Date du relevé</label>
                            <input
                              type="date"
                              value={nhForm.readingDate}
                              onChange={(e) => {
                                setNhForm((prev) => ({ ...(prev || {}), readingDate: e.target.value }));
                                setNhFormError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">NH actuel</label>
                            <input
                              type="number"
                              value={nhForm.nhValue}
                              onChange={(e) => {
                                setNhForm((prev) => ({ ...(prev || {}), nhValue: e.target.value }));
                                setNhFormError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        {nhFormError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                            {nhFormError}
                          </div>
                        )}
                      </div>
                      <div className={`p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2' : 'flex justify-end gap-2'}`}>
                        <button
                          onClick={() => {
                            setNhModalOpen(false);
                            setNhModalIntervention(null);
                            setNhModalSite(null);
                            setNhForm({ nhValue: '', readingDate: '' });
                            setNhFormError('');
                          }}
                          className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={async () => {
                            const siteId = nhModalSite?.id;
                            if (!siteId) {
                              setNhFormError('Site introuvable.');
                              return;
                            }
                            const readingDate = String(nhForm?.readingDate || '').trim();
                            const nhValue = Number(String(nhForm?.nhValue || '').trim());
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
                              setNhFormError('Date invalide.');
                              return;
                            }
                            if (!Number.isFinite(nhValue) || nhValue < 0) {
                              setNhFormError('Veuillez saisir un NH valide.');
                              return;
                            }
                            try {
                              const data = await apiFetchJson(`/api/sites/${siteId}/nh`, {
                                method: 'POST',
                                body: JSON.stringify({ readingDate, nhValue })
                              });
                              await loadData();
                              await loadInterventions();
                              if (data?.isReset) {
                                alert('⚠️ Reset détecté (compteur revenu à 0 ou inférieur). Historique enregistré et calculs recalculés.');
                              } else {
                                alert('✅ NH mis à jour.');
                              }
                              setNhModalOpen(false);
                              setNhModalIntervention(null);
                              setNhModalSite(null);
                              setNhForm({ nhValue: '', readingDate: '' });
                              setNhFormError('');
                            } catch (e) {
                              setNhFormError(e?.message || 'Erreur serveur.');
                            }
                          }}
                          className={`bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                        >
                          Confirmer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:justify-end gap-2' : 'flex justify-end'}`}>
                <button
                  onClick={() => {
                    setShowInterventions(false);
                    setInterventionsError('');
                    setPlanningAssignments({});
                    setCompleteModalOpen(false);
                    setCompleteModalIntervention(null);
                    setCompleteModalSite(null);
                    setCompleteForm({ nhNow: '', doneDate: '' });
                    setCompleteFormError('');
                    setNhModalOpen(false);
                    setNhModalIntervention(null);
                    setNhModalSite(null);
                    setNhForm({ nhValue: '', readingDate: '' });
                    setNhFormError('');
                  }}
                  className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {showPresenceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-indigo-700 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity size={22} />
                  Présence & activité
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowPresenceModal(false)} className="hover:bg-indigo-800 p-2 rounded">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {isAdmin && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setPresenceTab('sessions')}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold ${presenceTab === 'sessions' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                    >
                      Sessions
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setPresenceTab('history');
                        try {
                          await refreshUsers();
                        } catch {
                          // ignore
                        }
                        await loadAuditLogs();
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold ${presenceTab === 'history' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                    >
                      Historique
                    </button>
                  </div>
                )}

                {presenceTab === 'history' && isAdmin ? (
                  <div>
                    <div className="text-xs text-gray-600 mb-3">
                      Historique des connexions et actions (audit). Filtre par date/utilisateur/recherche.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Utilisateur</label>
                        <select
                          value={auditUserId}
                          onChange={(e) => setAuditUserId(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                          <option value="">Tous</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Du</label>
                        <input
                          type="date"
                          value={auditFrom}
                          onChange={(e) => setAuditFrom(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Au</label>
                        <input
                          type="date"
                          value={auditTo}
                          onChange={(e) => setAuditTo(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Recherche</label>
                        <input
                          type="text"
                          value={auditQuery}
                          onChange={(e) => setAuditQuery(e.target.value)}
                          placeholder="email, action, path…"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>

                    {auditError && <div className="text-sm text-red-600 mb-3">{auditError}</div>}

                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <button
                        type="button"
                        onClick={loadAuditLogs}
                        disabled={auditBusy}
                        className="bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 font-semibold disabled:bg-gray-400"
                      >
                        {auditBusy ? 'Chargement…' : 'Rechercher'}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportAuditExcel}
                        disabled={auditBusy || (Array.isArray(auditLogs) ? auditLogs.length === 0 : true) || exportBusy}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-semibold disabled:bg-gray-400"
                      >
                        Export Excel
                      </button>
                    </div>

                    {auditLogs.length === 0 ? (
                      <div className="text-gray-600">Aucun log.</div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg overflow-auto max-h-[55vh]">
                        <table className="min-w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="text-left">
                              <th className="p-2 border-b">Date</th>
                              <th className="p-2 border-b">Email</th>
                              <th className="p-2 border-b">Rôle</th>
                              <th className="p-2 border-b">Action</th>
                              <th className="p-2 border-b">Méthode</th>
                              <th className="p-2 border-b">Chemin</th>
                              <th className="p-2 border-b">Status</th>
                              <th className="p-2 border-b">Metadata</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogs.slice(0, 500).map((l) => (
                              <tr key={l.id} className="odd:bg-white even:bg-gray-50">
                                <td className="p-2 border-b whitespace-nowrap">{l.createdAt || ''}</td>
                                <td className="p-2 border-b">{l.email || '—'}</td>
                                <td className="p-2 border-b whitespace-nowrap">{l.role || '-'}</td>
                                <td className="p-2 border-b whitespace-nowrap">{l.action || '-'}</td>
                                <td className="p-2 border-b whitespace-nowrap">{l.method || ''}</td>
                                <td className="p-2 border-b">{l.path || ''}</td>
                                <td className="p-2 border-b whitespace-nowrap">{l.status ?? ''}</td>
                                <td className="p-2 border-b">{l.metadata ? JSON.stringify(l.metadata) : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {auditLogs.length > 500 ? (
                          <div className="text-xs text-gray-500 p-2">Affichage limité à 500 lignes (export disponible sur l’ensemble chargé).</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-gray-600 mb-3">
                      Sessions actives (tous rôles, multi-appareils). Actualisation automatique.
                    </div>
                    {presenceSessions.length === 0 ? (
                      <div className="text-gray-600">Aucun utilisateur actif détecté.</div>
                    ) : (
                      <div className="space-y-2">
                        {presenceSessions.map((s) => {
                          const lastSeenMs = Number(s.lastSeenMs);
                          const secondsAgo = Number.isFinite(lastSeenMs) ? Math.max(0, Math.round((Date.now() - lastSeenMs) / 1000)) : null;
                          const isActive = secondsAgo !== null && secondsAgo <= 8;
                          return (
                            <div key={s.id || `${s.userId || ''}|${s.tabId || ''}|${s.email || ''}`} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-800 truncate">{s.email || 'Utilisateur'}</div>
                                <div className="text-xs text-gray-600">Rôle: {s.role || '-'}</div>
                                <div className="text-xs text-gray-600 mt-1">Activité: <span className="font-semibold text-gray-800">{s.activity || '-'}</span></div>
                              </div>
                              <div className="text-right">
                                <div className={`text-xs px-2 py-1 rounded inline-block ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                                  {isActive ? 'Actif' : 'Inactif'}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">{secondsAgo === null ? '-' : `Vu il y a ${secondsAgo}s`}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`relative p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:justify-end gap-2' : 'flex justify-end'}`}>
                <button
                  onClick={() => setShowPresenceModal(false)}
                  className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {showUsersModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-slate-700 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users size={22} />
                  Gestion des utilisateurs
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setShowUsersModal(false); setUserFormError(''); }} className="hover:bg-slate-800 p-2 rounded">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="font-bold text-gray-800 mb-3">Utilisateurs</div>
                    <div className="space-y-2">
                      {users.map((u) => (
                        <div key={u.id} className="border border-gray-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 truncate">{u.email}</div>
                            <div className="text-xs text-gray-600">Rôle: {u.role}{u.technicianName ? ` | Technicien: ${u.technicianName}` : ''}</div>
                          </div>
                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                setUserFormId(u.id);
                                setUserForm({ email: u.email, role: u.role, technicianName: u.technicianName || '', password: '' });
                                setUserFormError('');
                              }}
                              className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold w-full sm:w-auto"
                            >
                              Modifier
                            </button>
                            <button
                              disabled={u.role === 'admin'}
                              onClick={() => {
                                (async () => {
                                  try {
                                    await apiFetchJson(`/api/users/${u.id}`, { method: 'DELETE' });
                                    await refreshUsers();
                                  } catch (e) {
                                    setUserFormError(e?.message || 'Erreur serveur.');
                                  }
                                })();
                              }}
                              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                            >
                              Suppr.
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="font-bold text-gray-800 mb-3">Ajouter / Modifier</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={userForm.email}
                          onChange={(e) => { setUserForm({ ...userForm, email: e.target.value }); setUserFormError(''); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="user@domaine.com"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Rôle</label>
                        <select
                          value={userForm.role}
                          onChange={(e) => { setUserForm({ ...userForm, role: e.target.value }); setUserFormError(''); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="viewer">viewer (lecture)</option>
                          <option value="technician">technician</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Nom technicien (si technician)</label>
                        <input
                          type="text"
                          value={userForm.technicianName}
                          onChange={(e) => { setUserForm({ ...userForm, technicianName: e.target.value }); setUserFormError(''); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="Ex: John Doe"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Mot de passe (obligatoire pour créer / changer)</label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => { setUserForm({ ...userForm, password: e.target.value }); setUserFormError(''); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="********"
                        />
                      </div>
                    </div>

                    {userFormError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mt-3">
                        {userFormError}
                      </div>
                    )}

                    <div className={`flex flex-col sm:flex-row gap-2 mt-4 ${isAdmin ? 'sm:justify-between' : ''}`}>
                      <button
                        onClick={() => {
                          const email = String(userForm.email || '').trim().toLowerCase();
                          if (!email) {
                            setUserFormError('Email requis.');
                            return;
                          }
                          if (!userForm.password) {
                            setUserFormError('Mot de passe requis.');
                            return;
                          }

                          (async () => {
                            try {
                              if (userFormId) {
                                await apiFetchJson(`/api/users/${userFormId}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    email,
                                    role: userForm.role,
                                    technicianName: userForm.technicianName || ''
                                  })
                                });

                                await apiFetchJson(`/api/users/${userFormId}/reset-password`, {
                                  method: 'POST',
                                  body: JSON.stringify({ password: userForm.password })
                                });
                              } else {
                                await apiFetchJson('/api/users', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    email,
                                    role: userForm.role,
                                    technicianName: userForm.technicianName || '',
                                    password: userForm.password
                                  })
                                });
                              }

                              await refreshUsers();
                              setUserFormId(null);
                              setUserForm({ email: '', role: 'viewer', technicianName: '', password: '' });
                              setUserFormError('');
                            } catch (e) {
                              setUserFormError(e?.message || 'Erreur serveur.');
                            }
                          })();
                        }}
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold w-full sm:w-auto"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => { setUserFormId(null); setUserForm({ email: '', role: 'viewer', technicianName: '', password: '' }); setUserFormError(''); }}
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
                      >
                        Réinitialiser
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t bg-white" />
            </div>
          </div>
        )}

        {/* Modal Calendrier (Technicien) */}
        {showTechCalendar && isTechnician && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-6xl sm:max-h-[90vh]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-cyan-600 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar size={24} />
                  Calendrier
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowTechCalendar(false);
                      setTechSelectedDate(null);
                      setTechSelectedDayEvents([]);
                      setShowTechDayDetailsModal(false);
                    }}
                    className="hover:bg-cyan-700 p-2 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs font-semibold text-gray-700">Mois</label>
                    <input
                      type="month"
                      value={techCalendarMonth}
                      onChange={(e) => {
                        const next = String(e.target.value || '').trim();
                        setTechCalendarMonth(next);
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <div className="text-xs text-white/90 bg-cyan-700/40 border border-white/20 rounded-lg px-3 py-2">
                    Lecture seule
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                    <div key={day} className="text-center font-bold text-gray-700 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const m = String(techCalendarMonth || '').trim();
                    const mm = m.match(/^(\d{4})-(\d{2})$/);
                    const year = mm ? Number(mm[1]) : new Date().getFullYear();
                    const month = mm ? Number(mm[2]) - 1 : new Date().getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
                    const days = [];

                    for (let i = 0; i < startDay; i++) {
                      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 rounded" />);
                    }

                    const pad2 = (n) => String(n).padStart(2, '0');
                    const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                    const todayStr = ymd(new Date());

                    for (let day = 1; day <= lastDay.getDate(); day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dow = new Date(`${dateStr}T00:00:00`).getDay();
                      const isWeekend = dow === 0 || dow === 6;

                      if (isWeekend) {
                        days.push(
                          <div
                            key={day}
                            className="h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full bg-slate-200/70 border-gray-300"
                          />
                        );
                        continue;
                      }

                      const eventsForDay = getTechCalendarEventsForDay(dateStr);
                      const isToday = todayStr === dateStr;
                      const isSelected = techSelectedDate === dateStr;

                      days.push(
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const ev = getTechCalendarEventsForDay(dateStr);
                            setTechSelectedDate(dateStr);
                            setTechSelectedDayEvents(ev);
                            setShowTechDayDetailsModal(true);
                          }}
                          className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full hover:bg-gray-50 ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
                        >
                          <div className="text-sm font-semibold text-gray-700">{day}</div>
                          {eventsForDay.length > 0 && (
                            <div className="text-xs space-y-1 mt-1">
                              {eventsForDay.slice(0, 2).map((ev) => {
                                const daysUntil = getDaysUntil(dateStr);
                                const color = daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                                const ticket = String(ev?.item?.pmNumber || '').trim();
                                const typeLabel = techCalendarPmTypeLabel(ev?.item);
                                return (
                                  <div key={`${ev?.site?.id || ev?.item?.id}`} className={`${color} text-white px-1 rounded flex items-start gap-1`}>
                                    <span className="min-w-0 flex-1 whitespace-pre-line leading-tight break-words">{ev?.site?.nameSite || ev?.item?.siteId || '-'}</span>
                                    <span className="ml-auto text-[10px] font-bold opacity-90">
                                      {typeLabel}{ticket ? `:${ticket}` : ''}
                                      {ev?.matchInfo?.label ? ` • ${ev.matchInfo.label === 'PM Simple' ? 'PM' : ev.matchInfo.label === 'PM et Vidange' ? 'PM+V' : 'V'}` : ''}
                                    </span>
                                  </div>
                                );
                              })}
                              {eventsForDay.length > 2 && (
                                <div className="text-gray-600 text-center">+{eventsForDay.length - 2}</div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    }

                    return days;
                  })()}
                </div>
              </div>

              <div className="p-3 border-t bg-white" />
            </div>
          </div>
        )}

        {showTechDayDetailsModal && showTechCalendar && isTechnician && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-cyan-600 text-white">
                <div className="font-bold">Détails du {techSelectedDate ? formatDate(techSelectedDate) : ''}</div>
                <button
                  onClick={() => {
                    setShowTechDayDetailsModal(false);
                  }}
                  className="hover:bg-cyan-700 p-2 rounded"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {techSelectedDayEvents.length === 0 ? (
                  <div className="text-gray-600">Aucune activité planifiée ce jour.</div>
                ) : (
                  <div className="space-y-2">
                    {techSelectedDayEvents.map((evt) => {
                      const it = evt?.item;
                      const site = evt?.site;
                      const matchInfo = evt?.matchInfo;
                      const statusColor = it?.status === 'done' ? 'bg-green-100 text-green-800 border-green-200' : it?.status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200';
                      const ticket = String(it?.pmNumber || '').trim();
                      const typeLabel = techCalendarPmTypeLabel(it);
                      return (
                        <div key={String(it?.id || `${site?.id}-${it?.plannedDate}-${it?.maintenanceType}`)} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800 whitespace-pre-line leading-tight break-words">{site?.nameSite || it?.siteId || '-'}</div>
                              {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                              <div className="text-xs text-gray-600">{typeLabel} • {formatDate(it?.plannedDate)} • {String(it?.technicianName || '')}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 rounded border font-semibold bg-slate-50 text-slate-800 border-slate-200">
                                  {typeLabel}{ticket ? `: ${ticket}` : ''}
                                </span>
                                {matchInfo?.label && (
                                  <span className={`text-xs px-2 py-1 rounded border font-semibold ${matchInfo.kind === 'PM' || matchInfo.kind === 'PM_SIMPLE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-800 border-slate-200'}`}>
                                    {matchInfo.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>{String(it?.status || '')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-white flex justify-end">
                <button
                  onClick={() => setShowTechDayDetailsModal(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {urgentSites.length > 0 && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-red-800 flex items-center gap-2 mb-3 md:mb-4">
              <AlertCircle size={20} />
              <span className="hidden sm:inline">ALERTES URGENTES - Vidanges à effectuer ({urgentSites.length})</span>
              <span className="sm:hidden">URGENT ({urgentSites.length})</span>
            </h2>
            <div className="grid gap-2 sm:gap-3">
              {urgentSites.map(site => {
                const daysUntil = getDaysUntil(site.epv1);
                return (
                  <div key={site.id} className="bg-white rounded-lg p-3 sm:p-4 border-l-4 border-red-600">
                    <div className="flex flex-col sm:flex-row justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base sm:text-lg text-gray-800">{site.nameSite}</h3>
                          <span className="text-xs bg-gray-200 px-2 py-1 rounded">{site.idSite}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          Technicien: {site.technician} | Régime: {site.regime}H/j | NH Estimé: {site.nhEstimated}H | Diff: {site.diffEstimated}H
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl sm:text-2xl font-bold text-red-600">
                          {daysUntil < 0 ? 'RETARD' : daysUntil === 0 ? 'AUJOURD\'HUI' : `${daysUntil}j`}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">{formatDate(site.epv1)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showDayDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gray-100">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">Détails du jour</h2>
                  <div className="text-sm text-gray-600">{selectedDate ? formatDate(selectedDate) : ''}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowDayDetailsModal(false);
                      setSelectedDayEvents([]);
                    }}
                    className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {selectedDayEvents.length === 0 ? (
                  <div className="text-gray-600">Aucune vidange planifiée ce jour.</div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayEvents.map((evt) => {
                      const daysUntil = getDaysUntil(evt.date);
                      const color = daysUntil !== null && daysUntil <= 3 ? 'bg-red-500' : daysUntil !== null && daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                      const st = String(evt?.intervention?.status || '');
                      const dot = st === 'done' ? 'bg-green-200' : st === 'sent' ? 'bg-blue-200' : st === 'planned' ? 'bg-amber-200' : 'bg-gray-200';
                      const moved = evt?.originalDate && String(evt.originalDate) !== String(evt.date);
                      const daysLabel =
                        daysUntil === null
                          ? '-'
                          : daysUntil < 0
                            ? `RETARD ${Math.abs(daysUntil)}j`
                            : daysUntil === 0
                              ? "AUJOURD'HUI"
                              : `${daysUntil}j`;

                      return (
                        <div key={`${evt.site.id}-${evt.type}`} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800 whitespace-pre-line leading-tight break-words">{evt.site.nameSite}</div>
                              <div className="text-xs text-gray-600">
                                {evt.type} • {formatDate(evt.date)} • {evt.site.technician}
                                {moved && (
                                  <span className="ml-2 text-[11px] bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                                    Déplacée (origine: {formatDate(evt.originalDate)})
                                  </span>
                                )}
                                {evt?.wasRetiredPrevMonth && (
                                  <span className="ml-2 text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                                    Retiré le mois passé
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-xs px-2 py-1 rounded inline-flex items-center gap-2 ${color} text-white`}>
                                <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                                {daysLabel}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isAdmin ? (
                <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <button
                    onClick={() => {
                      setShowDayDetailsModal(false);
                      setSelectedDayEvents([]);
                    }}
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
                  >
                    Fermer
                  </button>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {canExportExcel && (
                      <button
                        type="button"
                        onClick={handleExportSelectedDayExcel}
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold disabled:bg-gray-400 flex items-center justify-center gap-2 w-full sm:w-auto"
                        disabled={exportBusy || selectedDayEvents.length === 0}
                      >
                        <Download size={18} />
                        Exporter Excel
                      </button>
                    )}
                    {canGenerateFiche && (
                      <button
                        disabled={selectedDayEvents.length === 0}
                        onClick={() => startBatchFicheGeneration(selectedDayEvents)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                      >
                        Générer les fiches (batch)
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <button
                    onClick={() => {
                      setShowDayDetailsModal(false);
                      setSelectedDayEvents([]);
                    }}
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
                  >
                    Fermer
                  </button>
                  {canExportExcel && (
                    <button
                      type="button"
                      onClick={handleExportSelectedDayExcel}
                      className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold disabled:bg-gray-400 flex items-center gap-2"
                      disabled={exportBusy || selectedDayEvents.length === 0}
                    >
                      <Download size={18} />
                      Exporter Excel
                    </button>
                  )}
                  {canGenerateFiche && (
                    <button
                      disabled={selectedDayEvents.length === 0}
                      onClick={() => startBatchFicheGeneration(selectedDayEvents)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400"
                    >
                      Générer les fiches (batch)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modale Réinitialisation */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-600" size={32} />
                  <h2 className="text-xl font-bold text-gray-800">⚠️ ATTENTION</h2>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Choisissez ce que vous souhaitez réinitialiser. Cette action est <strong>irréversible</strong>.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleResetData({ includePm: false })}
                  className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold w-full"
                >
                  Réinitialiser Vidanges (PM conservé)
                </button>

                <button
                  onClick={() => handleResetData({ includePm: true })}
                  className="bg-red-800 text-white px-4 py-3 rounded-lg hover:bg-red-900 font-semibold w-full"
                >
                  Tout supprimer (incluant PM)
                </button>

                <button
                  onClick={handleSetNextTicketNumber}
                  className="bg-slate-700 text-white px-4 py-3 rounded-lg hover:bg-slate-800 font-semibold w-full"
                >
                  Définir le prochain ticket
                </button>

                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold w-full"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale Suppression Site */}
        {showDeleteConfirm && siteToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-600" size={32} />
                  <h2 className="text-xl font-bold text-gray-800">⚠️ Confirmer la suppression</h2>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                Êtes-vous sûr de vouloir supprimer le site <strong>{siteToDelete.nameSite}</strong> ?
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Cette action est <strong>irréversible</strong>. Toutes les données du site seront perdues.
              </p>
              <div className={isAdmin ? 'flex flex-col sm:flex-row sm:justify-between gap-3' : 'flex gap-3'}>
                <button
                  onClick={handleDeleteSite}
                  className={isAdmin ? 'bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold w-full sm:w-auto' : 'flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold'}
                >
                  Oui, supprimer
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSiteToDelete(null);
                  }}
                  className={isAdmin ? 'bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto' : 'flex-1 bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold'}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale Upload Bannière */}
        {showBannerUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-800">📤 Uploader la bannière</h2>
              </div>
              <p className="text-gray-600 mb-4">
                Sélectionnez l'image PNG contenant les logos Helios Towers et STHIC
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleBannerUpload}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
              />
              <button
                onClick={() => {
                  setShowBannerUpload(false);
                  setIsBatchFiche(false);
                  setBatchFicheSites([]);
                  setBatchFicheIndex(0);
                  setSiteForFiche(null);
                  setBannerImage('');
                  setFicheContext(null);
                }}
                className="w-full bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Modale Fiche d'Intervention */}
        {showFicheModal && siteForFiche && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gray-100">
                <h2 className="text-xl font-bold text-gray-800">📄 Fiche d'Intervention - Aperçu</h2>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
                  {isBatchFiche && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => goBatchFiche(-1)}
                        disabled={batchFicheIndex <= 0}
                        className="bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700 font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                      >
                        Précédent
                      </button>
                      <button
                        onClick={() => goBatchFiche(1)}
                        disabled={batchFicheIndex >= batchFicheSites.length - 1}
                        className="bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700 font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                      >
                        Suivant
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handlePrintFiche}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold w-full sm:w-auto"
                  >
                    Imprimer
                  </button>
                  <button
                    onClick={handleSaveFichePdf}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold w-full sm:w-auto"
                  >
                    Enregistrer le PDF
                  </button>
                  <button
                    onClick={() => {
                      setShowFicheModal(false);
                      setSiteForFiche(null);
                      setBannerImage('');
                      setIsBatchFiche(false);
                      setBatchFicheSites([]);
                      setBatchFicheIndex(0);
                      setFicheContext(null);
                    }}
                    className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="relative border-b bg-white h-0">
                <div className="h-20" />
              </div>

              <div className="bg-white p-8 overflow-auto" style={{maxHeight: '80vh'}}>
                <div
                  id="fiche-print"
                  className="bg-white mx-auto flex flex-col"
                  style={{ maxWidth: '210mm', width: '100%', height: '277mm', boxSizing: 'border-box' }}
                >
                  {bannerImage && (
                    <div className="mb-3 border-2 border-gray-300 rounded overflow-hidden bg-gray-200">
                      <img
                        src={bannerImage}
                        alt="Bannière Helios Towers - STHIC"
                        className="w-full"
                        style={{ height: 'auto', display: 'block' }}
                      />
                    </div>
                  )}

                  {!bannerImage && (
                    <div className="mb-4 bg-yellow-50 border-2 border-yellow-300 rounded p-3 text-center">
                      <p className="text-yellow-800 font-semibold">⚠️ Bannière non chargée</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs mb-1">CLIENT</p>
                      <p className="font-bold text-base">HTC</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs mb-1">SITE</p>
                      <p className="font-bold text-base">{siteForFiche.nameSite}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs mb-1">RÉFÉRENCE TICKET</p>
                      <p className="font-bold text-base">T{String(ticketNumber).padStart(5, '0')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs mb-1">NOM(S) DE L'INTERVENANT</p>
                      <p className="font-bold text-base">{siteForFiche.technician}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600 text-xs mb-1">BPV N°</p>
                      <p className="font-bold text-base">{formatDate(new Date().toISOString())}</p>
                    </div>
                  </div>

                  <hr className="my-3 border-gray-800" style={{borderWidth: '2px'}} />

                  <div className="mb-6">
                    <p className="text-gray-600 text-xs mb-2">OBJET</p>
                    <p className="font-bold text-sm">
                      VIDANGE DU GE {siteForFiche.generateur} {siteForFiche.capacite} + Filtre à air GE + 05 Litres liquide de refroidissement
                    </p>
                  </div>

                  <hr className="my-3 border-gray-800" style={{borderWidth: '2px'}} />

                  <div className="flex-1 flex flex-col">
                    <table className="w-full border-2 border-gray-800 text-sm" style={{height: '100%'}}>
                      <thead>
                        <tr>
                          <th className="border-2 border-gray-800 p-3 bg-gray-100 text-center" style={{width: '15%'}}>Qtés</th>
                          <th className="border-2 border-gray-800 p-3 bg-gray-100 text-center" style={{width: '20%'}}>PMW000xxxxxx</th>
                          <th className="border-2 border-gray-800 p-3 bg-gray-100" style={{width: '65%'}}>Désignations</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-2 border-gray-800 p-4" style={{verticalAlign: 'top'}}>&nbsp;</td>
                          <td className="border-2 border-gray-800 p-4" style={{verticalAlign: 'top'}}>&nbsp;</td>
                          <td className="border-2 border-gray-800 p-6" style={{verticalAlign: 'top'}}>
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                              {siteForFiche.kitVidange.split('/').map((item, idx) => (
                                <div key={idx} className="text-sm">{item.trim()}</div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mt-auto pt-4">
                    <div className="border-2 border-gray-800 p-4" style={{minHeight: '90px'}}>
                      <p className="font-bold mb-3 text-base">H</p>
                      <p className="text-3xl font-bold text-center mt-2">{siteForFiche.nh1DV} H</p>
                    </div>
                    <div className="border-2 border-gray-800 p-4" style={{minHeight: '90px'}}>
                      <p className="font-bold mb-3 text-right text-base">SIGNATURE RESPONSABLE</p>
                      <div style={{height: '45px'}}></div>
                      <p className="text-xs text-right mt-3">DATE</p>
                      <p className="text-right font-bold">{formatDate(new Date().toISOString())}</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Historique */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:rounded-lg">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-amber-600 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity size={24} />
                  Historique des Fiches d'Intervention
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowHistory(false)} className="hover:bg-amber-700 p-2 rounded">
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
                    <div className="flex flex-col w-full min-w-0">
                      <span className="text-xs text-gray-600 mb-1">Recherche</span>
                      <input
                        type="text"
                        value={historyQuery}
                        onChange={(e) => setHistoryQuery(e.target.value)}
                        placeholder="Ticket / site / technicien"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full min-w-0">
                      <div className="flex flex-col w-full min-w-0">
                        <span className="text-xs text-gray-600 mb-1">Du</span>
                        <input
                          type="date"
                          value={historyDateFrom}
                          onChange={(e) => setHistoryDateFrom(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
                        />
                      </div>
                      <div className="flex flex-col w-full min-w-0">
                        <span className="text-xs text-gray-600 mb-1">Au</span>
                        <input
                          type="date"
                          value={historyDateTo}
                          onChange={(e) => setHistoryDateTo(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full min-w-0"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col w-full min-w-0">
                      <span className="text-xs text-gray-600 mb-1">Statut</span>
                      <select
                        value={historyStatus}
                        onChange={(e) => setHistoryStatus(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                      >
                        <option value="all">Tous statuts</option>
                        <option value="En attente">En attente</option>
                        <option value="Effectuée">Effectuée</option>
                      </select>
                    </div>
                    <div className="flex flex-col w-full min-w-0">
                      <span className="text-xs text-gray-600 mb-1">Tri</span>
                      <select
                        value={historySort}
                        onChange={(e) => setHistorySort(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                      >
                        <option value="newest">Plus récent</option>
                        <option value="oldest">Plus ancien</option>
                        <option value="ticket">Ticket (A→Z)</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-3 flex justify-between">
                    <span>Résultats: <strong>{filteredFicheHistory.length}</strong></span>
                    <button
                      onClick={() => {
                        setHistoryQuery('');
                        setHistoryDateFrom('');
                        setHistoryDateTo('');
                        setHistoryStatus('all');
                        setHistorySort('newest');
                      }}
                      className="text-amber-700 hover:underline"
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>

                {ficheHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Activity size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold">Aucune fiche générée pour le moment</p>
                    <p className="text-sm mt-2">Les fiches apparaîtront ici après génération</p>
                  </div>
                ) : filteredFicheHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Activity size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold">Aucun résultat</p>
                    <p className="text-sm mt-2">Aucune fiche ne correspond aux filtres actuels</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFicheHistory.map(fiche => (
                      <div key={fiche.id} className={`border-2 rounded-lg p-4 ${fiche.status === 'Effectuée' ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg text-gray-800 truncate">{fiche.ticketNumber}</h3>
                            <p className="text-sm text-gray-600 truncate">{fiche.siteName}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold self-start ${fiche.status === 'Effectuée' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}>
                            {fiche.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                          <div className="min-w-0 flex flex-wrap items-baseline">
                            <span className="text-gray-600">Technicien:</span>
                            <span className="ml-2 font-semibold break-words">{fiche.technician}</span>
                          </div>
                          <div className="min-w-0 flex flex-wrap items-baseline">
                            <span className="text-gray-600">Heures vidangées:</span>
                            <span className="ml-2 font-semibold break-words">
                              {Number.isFinite(Number(fiche.intervalHours)) ? `${Number(fiche.intervalHours)}H` : '-'}
                            </span>
                            {fiche.isWithinContract === true && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
                                Dans délai
                              </span>
                            )}
                            {fiche.isWithinContract === false && (
                              <span className="ml-2 text-xs bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                                Hors délai
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex flex-wrap items-baseline">
                            <span className="text-gray-600">NH1 DV:</span>
                            <span className="ml-2 font-semibold break-words">
                              {Number.isFinite(Number(fiche.nh1DV)) ? `${Number(fiche.nh1DV)}H` : '-'}
                            </span>
                          </div>
                          <div className="min-w-0 flex flex-wrap items-baseline">
                            <span className="text-gray-600">Date DV:</span>
                            <span className="ml-2 break-words">{fiche.dateDV ? formatDate(fiche.dateDV) : '-'}</span>
                          </div>
                          <div className="min-w-0 flex flex-wrap items-baseline">
                            <span className="text-gray-600">NH relevé:</span>
                            <span className="ml-2 font-semibold break-words">
                              {Number.isFinite(Number(fiche.nhNow)) ? `${Number(fiche.nhNow)}H` : '-'}
                            </span>
                          </div>
                          <div className="min-w-0 flex flex-wrap items-baseline">
                            <span className="text-gray-600">Date génération fiche:</span>
                            <span className="ml-2 break-words">{formatDate(fiche.dateGenerated)}</span>
                          </div>
                          <div className="min-w-0 flex flex-wrap items-baseline">
                            <span className="text-gray-600">Date réalisation:</span>
                            <span className="ml-2 break-words">{fiche.dateCompleted ? formatDate(fiche.dateCompleted) : '-'}</span>
                          </div>
                        </div>
                        
                        {fiche.status === 'En attente' && canMarkCompleted && (
                          <button
                            onClick={() => handleMarkAsCompleted(fiche.id)}
                            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold"
                          >
                            ✅ Marquer comme Effectuée
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t bg-white" />
            </div>
          </div>
        )}

        {/* Modal Calendrier */}
        {showCalendar && !isTechnician && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-7xl sm:max-h-[95vh]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-cyan-600 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar size={24} />
                  Calendrier des Vidanges
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowCalendar(false)} className="hover:bg-cyan-700 p-2 rounded">
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-3 sm:p-6 overflow-y-auto flex-1">
                <div className="mb-4 sm:mb-6 space-y-3">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="bg-cyan-600 text-white px-3 py-2 rounded-lg hover:bg-cyan-700 w-full"
                    >
                      ← Précédent
                    </button>
                    <h3 className="text-base sm:text-xl font-bold text-gray-800 text-center">
                      {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="bg-cyan-600 text-white px-3 py-2 rounded-lg hover:bg-cyan-700 w-full"
                    >
                      Suivant →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                    {isAdmin ? (
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-semibold text-gray-700">Technicien</div>
                        <select
                          value={calendarSendTechUserId}
                          onChange={(e) => setCalendarSendTechUserId(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full"
                        >
                          <option value="">Tous</option>
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
                      </div>
                    ) : (
                      <div />
                    )}
                    <div />
                    <div />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
                    <div className="bg-cyan-600 text-white rounded-xl p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
                      <div className="flex flex-col">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={handleSendCalendarMonthPlanning}
                            className="text-left px-3 py-2 rounded-lg hover:bg-cyan-700 font-semibold text-sm disabled:opacity-60"
                            disabled={!calendarSendTechUserId}
                          >
                            Envoyer planning du mois
                          </button>
                        )}
                        {canExportExcel && (
                          <button
                            type="button"
                            onClick={handleExportCalendarMonthExcel}
                            className="text-left px-3 py-2 rounded-lg hover:bg-cyan-700 font-semibold text-sm disabled:opacity-60"
                            disabled={exportBusy}
                          >
                            Exporter Excel
                          </button>
                        )}
                        {isAdmin && (
                          <label className={`text-left px-3 py-2 rounded-lg font-semibold text-sm ${basePlanBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-cyan-700 cursor-pointer'}`}>
                            Importer base (Excel)
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={handleImportBasePlanExcel}
                              className="hidden"
                              disabled={basePlanBusy}
                            />
                          </label>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={generateBasePlanPreview}
                            className="text-left px-3 py-2 rounded-lg hover:bg-cyan-700 font-semibold text-sm disabled:opacity-60"
                            disabled={basePlanBusy || basePlanBaseRows.length === 0}
                          >
                            Générer planning mois suivant
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={exportBasePlanPreviewExcel}
                            className="text-left px-3 py-2 rounded-lg hover:bg-cyan-700 font-semibold text-sm disabled:opacity-60"
                            disabled={basePlanBusy || basePlanPreview.length === 0}
                          >
                            Exporter planning base
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={saveBasePlanToDb}
                            className="text-left px-3 py-2 rounded-lg hover:bg-cyan-700 font-semibold text-sm disabled:opacity-60"
                            disabled={basePlanBusy || basePlanPreview.length === 0}
                          >
                            Enregistrer (DB)
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={deleteBasePlanFromDb}
                            className="text-left px-3 py-2 rounded-lg hover:bg-cyan-700 font-semibold text-sm disabled:opacity-60"
                            disabled={basePlanBusy}
                          >
                            Supprimer (DB)
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {isAdmin && (basePlanBusy || basePlanErrors.length > 0 || basePlanPreview.length > 0) && (
                        <div className="mt-0 space-y-2">
                          {basePlanBusy && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${basePlanProgress}%` }} />
                            </div>
                          )}
                          {basePlanTargetMonth && (
                            <div className="text-xs text-gray-700">
                              Mois cible: <strong>{basePlanTargetMonth}</strong> | Base: <strong>{basePlanBaseRows.length}</strong> | Planning: <strong>{basePlanPreview.length}</strong>
                            </div>
                          )}
                          {basePlanErrors.length > 0 && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 max-h-32 overflow-auto">
                              {basePlanErrors.slice(0, 20).map((m, idx) => (
                                <div key={idx}>{m}</div>
                              ))}
                              {basePlanErrors.length > 20 && <div>… ({basePlanErrors.length - 20} autres)</div>}
                            </div>
                          )}
                          {basePlanPreview.length > 0 && (
                            <div className="border rounded-lg overflow-auto max-h-64">
                              <table className="min-w-full text-xs">
                                <thead className="sticky top-0 bg-gray-50">
                                  <tr className="text-left">
                                    <th className="p-2 border-b">Date</th>
                                    <th className="p-2 border-b">Technicien</th>
                                    <th className="p-2 border-b">Site</th>
                                    <th className="p-2 border-b">Type</th>
                                    <th className="p-2 border-b">EPV</th>
                                    <th className="p-2 border-b">PairGroup</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const items = Array.isArray(basePlanPreview) ? basePlanPreview.slice(0, 80) : [];
                                    const groups = new Map();
                                    for (const it of items) {
                                      const g = String(it?.pairGroup || '').trim();
                                      const key = `${it.plannedDate}||${it.technician}||${g || it.siteCode || it.siteName || ''}`;
                                      if (!groups.has(key)) groups.set(key, []);
                                      groups.get(key).push(it);
                                    }
                                    const out = [];
                                    for (const arr of groups.values()) {
                                      const sorted = arr
                                        .slice()
                                        .sort((a, b) => Number(a?.importOrder ?? 0) - Number(b?.importOrder ?? 0));
                                      const first = sorted[0] || {};
                                      const second = sorted[1] || null;
                                      const hasTwo = sorted.length === 2;
                                      out.push({
                                        plannedDate: first.plannedDate,
                                        technician: first.technician,
                                        siteCode: hasTwo ? `${first.siteCode || ''}\n${second?.siteCode || ''}`.trim() : first.siteCode || '',
                                        siteName: hasTwo ? `${first.siteName || ''}\n${second?.siteName || ''}`.trim() : first.siteName || '',
                                        maintenanceType:
                                          hasTwo && first.recommendedMaintenanceType !== second?.recommendedMaintenanceType
                                            ? `${first.recommendedMaintenanceType || ''} + ${second?.recommendedMaintenanceType || ''}`.trim()
                                            : first.recommendedMaintenanceType || '',
                                        epvSlot: first.epvSlot,
                                        pairGroup: first.pairGroup || ''
                                      });
                                    }
                                    out.sort((a, b) => {
                                      const d = String(a.plannedDate || '').localeCompare(String(b.plannedDate || ''));
                                      if (d !== 0) return d;
                                      return String(a.technician || '').localeCompare(String(b.technician || ''));
                                    });
                                    return out.map((it, idx) => (
                                      <tr key={`${it.siteCode}-${it.plannedDate}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="p-2 border-b whitespace-nowrap">{it.plannedDate}</td>
                                        <td className="p-2 border-b">{it.technician}</td>
                                        <td className="p-2 border-b whitespace-pre-line leading-tight break-words">{it.siteName || it.siteCode}</td>
                                        <td className="p-2 border-b">{it.maintenanceType}</td>
                                        <td className="p-2 border-b">{it.epvSlot}</td>
                                        <td className="p-2 border-b">{it.pairGroup || ''}</td>
                                      </tr>
                                    ));
                                  })()}
                                </tbody>
                              </table>
                              {basePlanPreview.length > 80 && (
                                <div className="text-xs text-gray-600 p-2">Affichage limité aux 80 premières lignes (total: {basePlanPreview.length}).</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
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
                          className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full hover:bg-gray-50 ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
                        >
                          <div className="text-sm font-semibold text-gray-700">{day}</div>
                          {eventsForDay.length > 0 && (
                            <div className="text-xs space-y-1 mt-1">
                              {eventsForDay.slice(0, 2).map((ev) => {
                                const daysUntil = getDaysUntil(dateStr);
                                const color = daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                                const st = String(ev?.intervention?.status || '');
                                const dot = st === 'done' ? 'bg-green-200' : st === 'sent' ? 'bg-blue-200' : st === 'planned' ? 'bg-amber-200' : 'bg-gray-200';
                                const moved = ev?.originalDate && String(ev.originalDate) !== String(ev.date);
                                return (
                                  <div key={`${ev.site.id}-${ev.type}`} className={`${color} text-white px-1 rounded flex items-start gap-1`}>
                                    <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                                    <span className="min-w-0 flex-1 whitespace-pre-line leading-tight break-words">{ev.site.nameSite}</span>
                                    {moved && <span className="ml-auto text-[10px] font-bold opacity-90">↔</span>}
                                  </div>
                                );
                              })}
                              {eventsForDay.length > 2 && (
                                <div className="text-gray-600 text-center">+{eventsForDay.length - 2}</div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    }

                    return days;
                  })()}
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

              <div className="p-3 border-t bg-white" />
            </div>
          </div>
        )}

        {/* Formulaire Ajout */}
        {showAddForm && canWriteSites && (
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Ajouter un Nouveau Site</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <input
                type="text"
                placeholder="ID Site (ex: CBBZ0057)"
                value={formData.idSite}
                onChange={(e) => setFormData({...formData, idSite: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Nom du Site"
                value={formData.nameSite}
                onChange={(e) => setFormData({...formData, nameSite: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Technicien"
                value={formData.technician}
                onChange={(e) => setFormData({...formData, technician: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Generateur (ex: ELCOS)"
                value={formData.generateur}
                onChange={(e) => setFormData({...formData, generateur: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Capacité (ex: 30 KVA)"
                value={formData.capacite}
                onChange={(e) => setFormData({...formData, capacite: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Kit Vidange"
                value={formData.kitVidange}
                onChange={(e) => setFormData({...formData, kitVidange: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base col-span-1 sm:col-span-2 lg:col-span-3"
              />
              <input
                type="number"
                placeholder="NH1 DV"
                value={formData.nh1DV}
                onChange={(e) => setFormData({...formData, nh1DV: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="date"
                value={formData.dateDV}
                onChange={(e) => setFormData({...formData, dateDV: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="number"
                placeholder="NH2 A"
                value={formData.nh2A}
                onChange={(e) => setFormData({...formData, nh2A: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="date"
                value={formData.dateA}
                onChange={(e) => setFormData({...formData, dateA: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 sm:px-4 py-2">
                <input
                  type="checkbox"
                  id="retired-add"
                  checked={formData.retired}
                  onChange={(e) => setFormData({...formData, retired: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="retired-add" className="text-sm sm:text-base cursor-pointer">Site Retiré</label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
              <button
                onClick={handleAddSite}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
              >
                Ajouter
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
                }}
                className="bg-gray-400 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-500 text-sm sm:text-base"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Formulaire MAJ */}
        {showUpdateForm && selectedSite && canWriteSites && (
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                MAJ - {selectedSite.nameSite}
              </h2>
              <button onClick={() => {
                setShowUpdateForm(false);
                setSelectedSite(null);
              }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <input
                type="number"
                placeholder="NH2 A (nouveau)"
                value={formData.nh2A}
                onChange={(e) => setFormData({...formData, nh2A: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="date"
                value={formData.dateA}
                onChange={(e) => setFormData({...formData, dateA: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 sm:px-4 py-2">
                <input
                  type="checkbox"
                  id="retired-update"
                  checked={formData.retired}
                  onChange={(e) => setFormData({...formData, retired: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="retired-update" className="text-sm sm:text-base cursor-pointer">Site Retiré</label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
              <button
                onClick={handleUpdateSite}
                className="bg-green-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-green-700 text-sm sm:text-base"
              >
                Mettre à jour
              </button>
              <button
                onClick={() => {
                  setShowUpdateForm(false);
                  setSelectedSite(null);
                  setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
                }}
                className="bg-gray-400 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-500 text-sm sm:text-base"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Formulaire Modifier */}
        {showEditForm && selectedSite && canWriteSites && (
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                Modifier - {selectedSite.nameSite}
              </h2>
              <button onClick={() => {
                setShowEditForm(false);
                setSelectedSite(null);
              }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <input
                type="text"
                placeholder="ID Site"
                value={formData.idSite}
                onChange={(e) => setFormData({...formData, idSite: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Nom du Site"
                value={formData.nameSite}
                onChange={(e) => setFormData({...formData, nameSite: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Technicien"
                value={formData.technician}
                onChange={(e) => setFormData({...formData, technician: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Generateur"
                value={formData.generateur}
                onChange={(e) => setFormData({...formData, generateur: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Capacité"
                value={formData.capacite}
                onChange={(e) => setFormData({...formData, capacite: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="text"
                placeholder="Kit Vidange"
                value={formData.kitVidange}
                onChange={(e) => setFormData({...formData, kitVidange: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base col-span-1 sm:col-span-2 lg:col-span-3"
              />
              <input
                type="number"
                placeholder="NH1 DV"
                value={formData.nh1DV}
                onChange={(e) => setFormData({...formData, nh1DV: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="date"
                value={formData.dateDV}
                onChange={(e) => setFormData({...formData, dateDV: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="number"
                placeholder="NH2 A"
                value={formData.nh2A}
                onChange={(e) => setFormData({...formData, nh2A: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <input
                type="date"
                value={formData.dateA}
                onChange={(e) => setFormData({...formData, dateA: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              />
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 sm:px-4 py-2">
                <input
                  type="checkbox"
                  id="retired-edit"
                  checked={formData.retired}
                  onChange={(e) => setFormData({...formData, retired: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="retired-edit" className="text-sm sm:text-base cursor-pointer">Site Retiré</label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
              <button
                onClick={handleEditSite}
                className="bg-green-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-green-700 text-sm sm:text-base"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setSelectedSite(null);
                  setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
                }}
                className="bg-gray-400 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-500 text-sm sm:text-base"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="mb-6">
          {filteredSites.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
              Aucun site trouvé. Ajoutez un site ou importez votre Excel.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filteredSites.map(site => {
                const daysUntil = getDaysUntil(site.epv1);
                const urgencyClass = getUrgencyClass(daysUntil, site.retired);

                const badgeColor = site.retired
                  ? 'bg-gray-500'
                  : daysUntil !== null && daysUntil <= 3
                    ? 'bg-red-600'
                    : daysUntil !== null && daysUntil <= 7
                      ? 'bg-orange-600'
                      : 'bg-green-600';

                return (
                  <div key={site.id} className={`bg-white rounded-xl shadow-md border-l-4 ${urgencyClass} overflow-hidden`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base text-gray-800 truncate">{site.nameSite}</h3>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono border border-gray-200">{site.idSite}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {site.technician} | {site.generateur} | {site.capacite}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className={`${badgeColor} text-white text-xs px-2 py-1 rounded-lg font-semibold`}>
                            {site.retired ? 'RETIRÉ' : 'ACTIF'}
                          </span>
                          {!site.retired && daysUntil !== null && (
                            <div className="text-sm font-bold text-gray-900">
                              {daysUntil < 0 ? `Retard ${Math.abs(daysUntil)}j` : daysUntil === 0 ? 'AUJOURD\'HUI' : `${daysUntil}j`}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <div className="text-xs text-gray-600">NH estimé</div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-blue-600">{Number.isFinite(Number(site.nhEstimated)) ? `${site.nhEstimated}H` : '-'}</span>
                            {daysUntil < 0 && !site.retired && (
                              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                En retard
                              </span>
                            )}
                            {site.status === 'done' && <CheckCircle className="text-green-500" size={16} />}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <div className="text-xs text-gray-600">Diff estimée</div>
                          <div className="text-lg font-bold text-blue-600">{site.diffEstimated}H</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-lg border border-gray-200 p-2 text-center">
                          <div className="text-[10px] text-gray-500">EPV1</div>
                          <div className="text-xs font-semibold text-gray-800">{formatDate(site.epv1)}</div>
                          {!site.retired && getDaysUntil(site.epv1) !== null && (
                            <div className="text-[10px] text-gray-500">{getDaysUntil(site.epv1)}j</div>
                          )}
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-2 text-center">
                          <div className="text-[10px] text-gray-500">EPV2</div>
                          <div className="text-xs font-semibold text-gray-800">{formatDate(site.epv2)}</div>
                          {!site.retired && getDaysUntil(site.epv2) !== null && (
                            <div className="text-[10px] text-gray-500">{getDaysUntil(site.epv2)}j</div>
                          )}
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-2 text-center">
                          <div className="text-[10px] text-gray-500">EPV3</div>
                          <div className="text-xs font-semibold text-gray-800">{formatDate(site.epv3)}</div>
                          {!site.retired && getDaysUntil(site.epv3) !== null && (
                            <div className="text-[10px] text-gray-500">{getDaysUntil(site.epv3)}j</div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {canWriteSites && (
                          <button
                            onClick={() => {
                              setSelectedSite(site);
                              setFormData({
                                nameSite: site.nameSite,
                                idSite: site.idSite,
                                technician: site.technician,
                                generateur: site.generateur,
                                capacite: site.capacite,
                                kitVidange: site.kitVidange,
                                nh1DV: site.nh1DV,
                                dateDV: site.dateDV,
                                nh2A: '',
                                dateA: '',
                                retired: site.retired
                              });
                              setShowUpdateForm(true);
                            }}
                            className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
                          >
                            MAJ
                          </button>
                        )}
                        {canWriteSites && (
                          <button
                            onClick={() => {
                              setSelectedSite(site);
                              setFormData({
                                nameSite: site.nameSite,
                                idSite: site.idSite,
                                technician: site.technician,
                                generateur: site.generateur,
                                capacite: site.capacite,
                                kitVidange: site.kitVidange,
                                nh1DV: site.nh1DV,
                                dateDV: site.dateDV,
                                nh2A: site.nh2A,
                                dateA: site.dateA,
                                retired: site.retired
                              });
                              setShowEditForm(true);
                            }}
                            className="bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 text-sm font-semibold"
                          >
                            Modifier
                          </button>
                        )}
                        {canWriteSites && (
                          <button
                            onClick={() => {
                              setSiteToDelete(site);
                              setShowDeleteConfirm(true);
                            }}
                            className="bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-semibold"
                          >
                            Suppr.
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0" size={28} />
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Sites</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{isTechnician ? filteredSites.length : sites.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={28} />
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Vidanges Urgentes</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{urgentSites.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Activity className="text-gray-600 flex-shrink-0" size={28} />
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Sites Retirés</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">
                  {isTechnician ? filteredSites.filter(s => s.retired).length : sites.filter(s => s.retired).length}
                </p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <Calendar className="text-blue-600 flex-shrink-0" size={28} />
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Prochain Ticket</p>
                  <p className="text-base sm:text-lg font-bold text-gray-800">
                    T{String(ticketNumber).padStart(5, '0')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
    </div>
  </div>
  </div>
  );
};

export default GeneratorMaintenanceApp;