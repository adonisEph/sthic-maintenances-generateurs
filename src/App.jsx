import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Plus, Upload, Download, Calendar, Activity, CheckCircle, X, Edit, Filter, TrendingUp, Users, Menu, ChevronLeft, Trash2, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useStorage } from './hooks/useStorage';
import PmModal from './components/PmModal';
import CalendarModal from './components/CalendarModal';
import AddSiteForm from './components/sites/AddSiteForm';
import UpdateSiteForm from './components/sites/UpdateSiteForm';
import EditSiteForm from './components/sites/EditSiteForm';
import DeleteSiteConfirmModal from './components/sites/DeleteSiteConfirmModal';
import SitesStats from './components/sites/SitesStats';
import SitesTechnicianFilter from './components/sites/SitesTechnicianFilter';
import SidebarSitesActions from './components/sites/SidebarSitesActions';
import DashboardHeader from './components/dashboard/DashboardHeader';
import DashboardKpiGrid from './components/dashboard/DashboardKpiGrid';
import DashboardDetailsModal from './components/dashboard/DashboardDetailsModal';
import AccountModal from './components/account/AccountModal';
import UsersModal from './components/users/UsersModal';
import PresenceModal from './components/presence/PresenceModal';
import ResetConfirmModal from './components/reset/ResetConfirmModal';
import InterventionsModal from './components/interventions/InterventionsModal';
import ScoringModal from './components/scoring/ScoringModal';
import HistoryModal from './components/history/HistoryModal';
import UploadBannerModal from './components/fiche/UploadBannerModal';
import FicheModal from './components/fiche/FicheModal';
import TechnicianCalendarModal from './components/calendar/TechnicianCalendarModal';
import DayDetailsModal from './components/calendar/DayDetailsModal';

import {
  calculateRegime,
  calculateDiffNHs,
  calculateEstimatedNH,
  calculateEPVDates,
  formatDate,
  getDaysUntil,
  getUrgencyClass
} from './utils/calculations';

const APP_VERSION = '2.1.6';
const APP_VERSION_STORAGE_KEY = 'gma_app_version_seen';
const DAILY_NH_UPDATE_STORAGE_KEY = 'gma_daily_nh_update_ymd';
const STHIC_LOGO_SRC = '/Logo_sthic.png';
const SPLASH_MIN_MS = 4300;

const GeneratorMaintenanceApp = () => {
  const storage = useStorage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarDockedOpen, setSidebarDockedOpen] = useState(true);
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
  const [usersBusy, setUsersBusy] = useState(false);
  const [usersError, setUsersError] = useState('');
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
  const [userForm, setUserForm] = useState({ email: '', role: 'viewer', zone: 'BZV/POOL', technicianName: '', password: '' });
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
  const [pmGlobalProgress, setPmGlobalProgress] = useState(0);
  const [pmGlobalStep, setPmGlobalStep] = useState('');
  const [pmGlobalCompare, setPmGlobalCompare] = useState(null);
  const [pmRetiredSites, setPmRetiredSites] = useState(null);
  const [pmResetBusy, setPmResetBusy] = useState(false);
  const [pmFilterState, setPmFilterState] = useState('all');
  const [pmFilterType, setPmFilterType] = useState('all');
  const [pmFilterZone, setPmFilterZone] = useState('all');
  const [pmFilterDate, setPmFilterDate] = useState('');
  const [pmFilterReprog, setPmFilterReprog] = useState('all');
  const [pmSearch, setPmSearch] = useState('');
  const [pmReprogExportDate, setPmReprogExportDate] = useState('');
  const [pmDetails, setPmDetails] = useState({ open: false, title: '', items: [] });
  const [pmRejectedModalOpen, setPmRejectedModalOpen] = useState(false);
  const [pmRejectedDateFilter, setPmRejectedDateFilter] = useState('');
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
  const isManager = currentRole === 'manager';
  const canWriteSites = isAdmin;
  const canImportExport = isAdmin;
  const canExportExcel = isAdmin || isViewer;
  const canReset = isAdmin;
  const canGenerateFiche = isAdmin;
  const canMarkCompleted = isAdmin || isTechnician;
  const canManageUsers = isAdmin;
  const canUseInterventions = isAdmin || isTechnician || isViewer;
  const canUsePm = isAdmin || isManager || isViewer;

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
      setPmNocProgress(0);
      setPmNocStep('');
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

  const ymdInTimeZone = (d, timeZone) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };

  const runDailyNhUpdate = async () => {
    const todayYmd = ymdInTimeZone(new Date(), 'Africa/Brazzaville');
    const stored = await storage.get(DAILY_NH_UPDATE_STORAGE_KEY);
    const already = stored?.value ? String(stored.value).slice(0, 10) === todayYmd : false;
    if (already) return { ok: true, skipped: true, today: todayYmd };

    const res = await apiFetchJson('/api/sites/daily-update', {
      method: 'POST',
      body: JSON.stringify({})
    });
    await storage.set(DAILY_NH_UPDATE_STORAGE_KEY, todayYmd);
    return res;
  };

  const refreshUsers = async () => {
    setUsersBusy(true);
    setUsersError('');
    try {
      const data = await apiFetchJson('/api/users', { method: 'GET' });
      setUsers(Array.isArray(data?.users) ? data.users : []);
      return data;
    } catch (e) {
      setUsersError(e?.message || 'Erreur lors du chargement des techniciens.');
      throw e;
    } finally {
      setUsersBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      const startedAt = Date.now();
      try {
        const data = await apiFetchJson('/api/auth/me', { method: 'GET' });
        if (data?.user?.email) {
          setAuthUser(data.user);
          try {
            await runDailyNhUpdate();
          } catch (e) {
            // ignore
          }
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
    if (s.includes('epv1')) return 'EPV1';
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

    const refreshPmRetiredSites = async (monthId, yyyymm) => {
    const mId = String(monthId || '').trim();
    const month = String(yyyymm || '').trim();
    if (!mId || !month) {
      setPmRetiredSites(null);
      return;
    }

    const authZone = String(authUser?.zone || '').trim();
    const superAdmin = Boolean(authUser?.role === 'admin' && authZone === 'BZV/POOL');

    const normalizeZone = (z) =>
      String(z || '')
        .trim()
        .toUpperCase()
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s+/g, ' ');

    const normalizeSiteCode = (v) =>
      String(v || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

    const scopeZones = superAdmin ? ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'] : authZone ? [authZone] : [];
    const scopeZonesNorm = scopeZones.map(normalizeZone).filter(Boolean);
    if (scopeZones.length === 0) {
      setPmRetiredSites(null);
      return;
    }

    const normalizeType = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, '');
    const isFullPmwo = (maintenanceType, shortDescription) => {
    const v1 = normalizeType(maintenanceType);
    const v2 = normalizeType(shortDescription);
    const isFull = (v) => v === 'fullpmwo' || v.includes('fullpmwo') || v === 'epv1' || v.includes('epv1');
    return isFull(v1) || isFull(v2);
  };

    const [globalRes, clientRes] = await Promise.all([
      apiFetchJson(`/api/pm/months/${mId}/global-items`, { method: 'GET' }),
      apiFetchJson(`/api/pm/months/${mId}/items`, { method: 'GET' })
    ]);

    const globalItemsRaw = Array.isArray(globalRes?.items) ? globalRes.items : [];
    const clientItemsRaw = Array.isArray(clientRes?.items) ? clientRes.items : [];

    // Global: ensemble de sites (par zone scope)
    const globalSites = new Map();
    for (const it of globalItemsRaw) {
    const siteCode = normalizeSiteCode(it?.siteCode);
    const zone = normalizeZone(it?.zone || it?.region || '');
    if (!siteCode || !zone) continue;
    if (!scopeZonesNorm.includes(zone)) continue;

    const key = `${zone}|${siteCode}`;
  if (!globalSites.has(key)) {
    globalSites.set(key, {
      siteCode,
      siteName: String(it?.siteName || '').trim(),
      zone,
      maintenanceType: it?.maintenanceType || ''
    });
  }
}

    // Client: ensemble de sites FullPMWO (par zone scope)
    const clientSites = new Set();
    for (const it of clientItemsRaw) {
      const siteCode = normalizeSiteCode(it?.siteCode);
      const zone = normalizeZone(it?.zone || it?.region || '');
    if (!siteCode || !zone) continue;
    if (!scopeZonesNorm.includes(zone)) continue;

    if (!isFullPmwo(it?.maintenanceType, it?.shortDescription)) continue;

    const key = `${zone}|${siteCode}`;
    clientSites.add(key);
  }

    // Retirés = globalSites - clientSites (par siteCode)
const items = [];
for (const [key, g] of globalSites.entries()) {
  if (clientSites.has(key)) continue;
  items.push(g);
}

    items.sort(
      (a, b) =>
        String(a.zone || '').localeCompare(String(b.zone || '')) ||
        String(a.siteCode || '').localeCompare(String(b.siteCode || ''))
    );

    const byZone = {};
    for (const z of scopeZonesNorm) byZone[z] = 0;
    for (const it of items) {
      const z = normalizeZone(it?.zone || '');
      if (!z) continue;
      byZone[z] = Number(byZone[z] || 0) + 1;
    }

    setPmRetiredSites({
      month,
      scopeZones: scopeZonesNorm,
      total: items.length,
      byZone,
      items
    });
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
        await refreshPmRetiredSites(id, m);
      } else {
        setPmItems([]);
        setPmImports([]);
        setPmDashboard(null);
        setPmRetiredSites(null);
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

        let baseItems = [];
        if (basePlan?.id) {
          const itemsRes = await apiFetchJson(`/api/pm/base-plans/${String(basePlan.id)}/items`, { method: 'GET' });
          baseItems = Array.isArray(itemsRes?.items) ? itemsRes.items : [];
        } else {
          baseItems = [];
        }

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
            const rawType = pmGet(row, 'Maintenance Type', 'Maintenance type', 'Type') || pmInferType(row);
            const rawDate = pmNormalizeDate(pmGet(row, 'Scheduled WO Date', 'Scheduled Wo Date', 'Scheduled date', 'Scheduled Date', 'Date'));
            const shortDescription = String(pmGet(row, 'Short description', 'Short Description', 'Description') || '').trim();
            const assignedTo = String(pmGet(row, 'Assigned to', 'Assigned To') || '').trim();
            const rawZone = pmGet(row, 'Zone', 'zone', 'Region', 'region');
            const zone = String(rawZone || '').trim();
            const codes = basePlanSplitCell(rawSiteCode);
            const names = basePlanSplitCell(rawSiteName);
            const nums = basePlanSplitCell(rawNumber);
            const n = Math.max(codes.length, names.length, nums.length, 1);
            for (let i = 0; i < Math.min(n, 2); i += 1) {
              let siteCode = String(codes[i] || codes[0] || '').trim();
              let siteName = String(names[i] || names[0] || '').trim();
              const number = String(nums[i] || nums[0] || '').trim();
              if (!siteCode && !siteName) continue;

              const resolved = findSite(siteCode, siteName || siteCode);
              if (resolved?.idSite) {
                siteCode = String(resolved.idSite).trim();
                if (!siteName) siteName = String(resolved?.nameSite || '').trim();
              }

              out.push({
                number,
                siteCode,
                siteName,
                maintenanceType: String(rawType || '').trim(),
                scheduledWoDate: rawDate,
                shortDescription,
                assignedTo,
                zone,
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
          basePlanId: basePlan?.id ? String(basePlan.id) : '',
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
            region: String(b?.region || s?.region || s?.zone || r?.zone || '').trim(),
            zone: String(b?.zone || b?.region || s?.zone || s?.region || r?.zone || '').trim(),
            shortDescription: String(r?.shortDescription || b?.shortDescription || '').trim(),
            maintenanceType: String(r?.maintenanceType || b?.recommendedMaintenanceType || '').trim(),
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
        await refreshPmRetiredSites(monthId, pmMonth);

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

    // TODO: Implémenter une nouvelle logique simple de répartition des dates EPVs
    // Pour l'instant, on vide simplement les erreurs et le preview
    setBasePlanErrors([]);
    setBasePlanPreview([]);

    alert(`⚠️ Ancien algorithme supprimé. Nouvelle logique simple à implémenter pour ${month}.`);
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
        const normYmd = (v) => {
          const s = v == null ? '' : String(v).trim();
          const head = s.slice(0, 10);
          return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : '';
        };

        const bySite = new Map();
        const sortedItems = items
          .slice()
          .sort((a, b) => {
            const oa = Number(a?.importOrder ?? 0);
            const ob = Number(b?.importOrder ?? 0);
            if (oa !== ob) return oa - ob;
            const da = String(a?.plannedDate || '').localeCompare(String(b?.plannedDate || ''));
            if (da !== 0) return da;
            return String(a?.siteCode || '').localeCompare(String(b?.siteCode || ''));
          });

        for (const it of sortedItems) {
          const siteCode = String(it?.siteCode || '').trim();
          const siteName = String(it?.siteName || '').trim();
          const key = siteCode || siteName;
          if (!key) continue;

          if (!bySite.has(key)) {
            bySite.set(key, {
              siteCode,
              siteName,
              region: String(it?.region || it?.zone || '').trim(),
              assignedTo: String(it?.assignedTo || '').trim(),
              number: String(it?.number || '').trim(),
              dateOfClosing: String(it?.dateOfClosing || '').trim(),
              state: String(it?.state || '').trim(),
              pairGroup: String(it?.pairGroup || '').trim(),
              shortDescription: '',
              scheduledWoDate: '',
              epv2: '',
              epv3: '',
              _order: Number(it?.importOrder ?? 0)
            });
          }

          const row = bySite.get(key);
          row._order = Math.min(row._order, Number(it?.importOrder ?? 0));
          if (!row.siteCode) row.siteCode = siteCode;
          if (!row.siteName) row.siteName = siteName;
          if (!row.region) row.region = String(it?.region || it?.zone || '').trim();
          if (!row.assignedTo) row.assignedTo = String(it?.assignedTo || '').trim();
          if (!row.number) row.number = String(it?.number || '').trim();
          if (!row.dateOfClosing) row.dateOfClosing = String(it?.dateOfClosing || '').trim();
          if (!row.state) row.state = String(it?.state || '').trim();
          if (!row.pairGroup) row.pairGroup = String(it?.pairGroup || '').trim();

          const slot = String(it?.epvSlot || '').trim().toUpperCase();
          const plannedDate = normYmd(it?.plannedDate);
          if (slot === 'EPV1' || slot === 'PM' || slot === 'MANUAL') {
            if (!row.scheduledWoDate && plannedDate) row.scheduledWoDate = plannedDate;
            if (!row.shortDescription) row.shortDescription = String(it?.shortDescription || '').trim();
          }
          if (slot === 'EPV2' && plannedDate) row.epv2 = plannedDate;
          if (slot === 'EPV3' && plannedDate) row.epv3 = plannedDate;
        }

        const rows = Array.from(bySite.values())
          .sort((a, b) => {
            const oa = Number(a?._order ?? 0);
            const ob = Number(b?._order ?? 0);
            if (oa !== ob) return oa - ob;
            return String(a.siteCode || a.siteName || '').localeCompare(String(b.siteCode || b.siteName || ''));
          })
          .map((r) => ({
            Site: r.siteCode || '',
            'Site Name': r.siteName || '',
            Region: r.region || '',
            'Short description': r.shortDescription || '',
            Number: r.number || '',
            'Assigned to': r.assignedTo || '',
            'Scheduled WO Date': r.scheduledWoDate || '',
            'Date of closing': r.dateOfClosing || '',
            State: r.state || '',
            PairGroup: r.pairGroup || '',
            EPV2: r.epv2 || '',
            EPV3: r.epv3 || ''
          }));

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

    const exportDayYmd = String(pmReprogExportDate || '').trim().slice(0, 10);

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
      .filter((it) => {
        if (!it) return false;
        if (!effectiveReprogStatus(it)) return false;
        if (exportDayYmd) {
          const d = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
          return d === exportDayYmd;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        const da = String(a?.scheduledWoDate || '').slice(0, 10);
        const db = String(b?.scheduledWoDate || '').slice(0, 10);
        const d = da.localeCompare(db);
        if (d !== 0) return d;
        return String(a?.number || '').localeCompare(String(b?.number || ''));
      });

    const rows = reprogItems.map((it) => ({
      Zone: it.zone || '',
      Region: it.region || '',
      Site: it.siteCode || '',
      'Site Name': it.siteName || '',
      'Maintenance Type': it.maintenanceType || '',
      Number: it.number || '',
      'Assigned to': it.assignedTo || '',
      'Scheduled WO Date': it.scheduledWoDate || '',
      'Statut reprogrammation': effectiveReprogStatus(it) || '',
      Reprogrammation: it.reprogrammationDate || '',
      Raisons: it.reprogrammationReason || '',
      State: it.state || ''
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
        await refreshPmRetiredSites(monthId, pmMonth);

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
        const isSuperAdmin = authUser?.role === 'admin' && authUser?.zone === 'BZV/POOL';

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

          const zoneRaw = row['Zone'] || row['zone'] || row['ZONE'] || '';
          const zone = String(zoneRaw || '').trim().toUpperCase();
          const normalizedZone =
  zone === 'BZV/POOL' || zone === 'PNR/KOUILOU' || zone === 'UPCN'
    ? zone
    : '';

          importedSites.push({
            id: Date.now() + index,
            ...(isSuperAdmin && normalizedZone ? { zone: normalizedZone } : {}),
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
            'Date updatée': formatDate(updatedSite.dateA),
            'NH updaté': updatedSite.nhEstimated,
            'Diff NHs': updatedSite.diffNHs,
            'Diff updatée': updatedSite.diffEstimated,
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
      const ascension = new Date(easterSunday.getTime());
      ascension.setUTCDate(ascension.getUTCDate() + 39);
      const pentecostMonday = new Date(easterSunday.getTime());
      pentecostMonday.setUTCDate(pentecostMonday.getUTCDate() + 50);

      const s = String(ymdStr);
      return s === ymdFromUtcDate(easterMonday) || s === ymdFromUtcDate(ascension) || s === ymdFromUtcDate(pentecostMonday);
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

    // Jour férié sur jour ouvré: choisir le plus proche
    const prev = findPrevWorkday(v);
    const next = findNextWorkday(v);
    if (!prev && !next) return '';
    if (!prev) return next !== v ? next : '';
    if (!next) return prev !== v ? prev : '';

    const prefer = String(opts?.prefer || 'before').toLowerCase();
    if (prefer === 'after' || prefer === 'next') return next !== v ? next : '';
    return prev !== v ? prev : '';
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
    })();
  }, [showCalendar, authUser?.role]);

  useEffect(() => {
    if (!showCalendar) return;
    if (authUser?.role !== 'admin') return;
    (async () => {
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
              className="h-14 mt-3 w-auto max-w-[260px] object-contain"
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
              className="h-16 mt-4 w-auto max-w-[300px] object-contain mx-auto"
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
    <div className="min-h-[100svh] bg-gray-50 md:min-h-screen">
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
      <div className="flex min-h-[100svh] md:min-h-screen">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-emerald-950/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div
          className={`bg-emerald-950 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 text-white border-emerald-900/60 border-r-4 border-r-emerald-400/30 flex flex-col p-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pt-20 gap-1 fixed md:sticky top-0 left-0 h-[100svh] md:h-screen overflow-y-auto z-50 md:z-auto transform transition-transform md:translate-x-0 md:transition-[width,padding,transform] ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${
            sidebarDockedOpen ? 'md:w-64 md:p-4' : 'md:w-0 md:p-0 md:border-r-0 md:overflow-hidden'
          }`}
        >
          <div className="flex items-center gap-2 px-2 py-2">
            <Activity size={20} className="text-slate-100/90" />
            <div className="text-lg font-bold text-slate-100 leading-tight">Navigation</div>
            <div className="ml-auto flex items-center">
              <button
                type="button"
                onClick={() => setSidebarDockedOpen(false)}
                className="hidden md:inline-flex p-2 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                title="Réduire le menu"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-700/60 my-1" />

          <SidebarSitesActions
            canWriteSites={canWriteSites}
            canImportExport={canImportExport}
            onCloseSidebar={() => setSidebarOpen(false)}
            onToggleAddForm={() => setShowAddForm(!showAddForm)}
            importBusy={importBusy}
            importStep={importStep}
            importProgress={importProgress}
            onImportExcelChange={handleImportExcel}
            sitesCount={sites.length}
            exportBusy={exportBusy}
            onExportExcel={handleExportExcel}
          />

          {!isTechnician ? (
            <button
              onClick={async () => {
                setSidebarOpen(false);
                setShowCalendar(true);
                if (authUser?.role === 'admin') {
                  try {
                    await refreshUsers();
                  } catch {
                    // ignore
                  }
                }
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
              className="relative w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
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
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 flex items-center gap-2 text-base font-semibold"
            >
              <Activity size={18} />
              Présence
            </button>
          )}

          <div className="mt-auto pt-4 pb-3 flex justify-center">
            <img
              src={`${STHIC_LOGO_SRC}?v=${APP_VERSION}`}
              alt="STHIC"
              className="h-24 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="bg-white border-b border-gray-200 shadow-sm px-3 sm:px-6 md:px-10 py-3 sticky top-0 z-40">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 rounded hover:bg-gray-100"
                >
                  <Menu size={20} />
                </button>
                {!sidebarDockedOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarDockedOpen(true)}
                    className="hidden md:inline-flex p-2 rounded hover:bg-gray-100"
                    title="Ouvrir le menu"
                  >
                    <Menu size={20} />
                  </button>
                )}
                <Activity className="text-blue-600" size={24} />
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold text-gray-800">Gestion Maintenance & Vidanges</div>
                  <div className="text-xs text-gray-600">Version {APP_VERSION} - Suivi H24/7j avec Fiches</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                <div className="text-left sm:text-right">
                  <div className="text-xs text-gray-500">Aujourd'hui</div>
                  <div className="text-sm sm:text-lg font-semibold text-gray-800">{formatDate(new Date().toISOString())}</div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-col gap-1 min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:justify-end">
                    <span className="min-w-0 truncate">
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
            <SitesTechnicianFilter
              isTechnician={isTechnician}
              filterTechnician={filterTechnician}
              onChange={setFilterTechnician}
              technicians={technicians}
            />
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 md:mb-6">
          <DashboardHeader
              dashboardMonth={dashboardMonth}
              onDashboardMonthChange={setDashboardMonth}
              onRefresh={async () => {
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
              canExportExcel={canExportExcel}
              onExportExcel={handleExportDashboardSummaryExcel}
              exportBusy={exportBusy}
          />

          {(() => {
            const { plannedEvents, remainingEvents, doneByPlannedDate, contractOk, contractOver } = computeDashboardData(dashboardMonth);

            return (
              <DashboardKpiGrid
                contractOk={contractOk}
                contractOver={contractOver}
                plannedEvents={plannedEvents}
                remainingEvents={remainingEvents}
                doneByPlannedDate={doneByPlannedDate}
                onOpenDetails={(title, kind, items) =>
                  setDashboardDetails({ open: true, title, kind, items })
                }
              />
            );
          })()}
        </div>

        <DashboardDetailsModal
          open={dashboardDetails.open}
          title={dashboardDetails.title}
          kind={dashboardDetails.kind}
          items={dashboardDetails.items}
          isAdmin={isAdmin}
          canExportExcel={canExportExcel}
          exportBusy={exportBusy}
          onClose={() => setDashboardDetails({ open: false, title: '', kind: '', items: [] })}
          onExportExcel={handleExportDashboardDetailsExcel}
          formatDate={formatDate}
        />  

        <AccountModal
  open={showAccountModal}
  email={authUser?.email || ''}
  accountForm={accountForm}
  onChange={(next) => {
    setAccountForm(next);
    setAccountError('');
  }}
  accountError={accountError}
  accountSaving={accountSaving}
  onClose={() => {
    setShowAccountModal(false);
    setAccountForm({ password: '', confirm: '' });
    setAccountError('');
  }}
  onSave={() => {
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
/>
                <PmModal
          showPm={showPm}
          appVersion={APP_VERSION}
          canUsePm={canUsePm}
          isViewer={isViewer}
          isAdmin={isAdmin}
          isManager={isManager}
          setShowPm={setShowPm}
          setPmError={setPmError}
          setPmNotice={setPmNotice}
          pmMonth={pmMonth}
          setPmMonth={setPmMonth}
          refreshPmAll={refreshPmAll}
          pmBusy={pmBusy}
          handlePmExportExcel={handlePmExportExcel}
          pmReprogExportDate={pmReprogExportDate}
          setPmReprogExportDate={setPmReprogExportDate}
          handlePmExportReprogExcel={handlePmExportReprogExcel}
          exportBusy={exportBusy}
          users={users}
          pmSendTechUserId={pmSendTechUserId}
          setPmSendTechUserId={setPmSendTechUserId}
          pmSendBusy={pmSendBusy}
          handleSendPmMonthPlanning={handleSendPmMonthPlanning}
          setPmRejectedDateFilter={setPmRejectedDateFilter}
          setPmRejectedModalOpen={setPmRejectedModalOpen}
          pmResetBusy={pmResetBusy}
          handlePmReset={handlePmReset}
          handlePmNocImport={handlePmNocImport}
          handlePmClientImport={handlePmClientImport}
          handlePmGlobalImport={handlePmGlobalImport}
          pmError={pmError}
          pmNotice={pmNotice}
          pmClientProgress={pmClientProgress}
          pmClientStep={pmClientStep}
          pmClientCompare={pmClientCompare}
          pmGlobalProgress={pmGlobalProgress}
          pmGlobalStep={pmGlobalStep}
          pmGlobalCompare={pmGlobalCompare}
          pmRetiredSites={pmRetiredSites}
          pmItems={pmItems}
          pmImports={pmImports}
          pmSearch={pmSearch}
          setPmSearch={setPmSearch}
          pmFilterDate={pmFilterDate}
          setPmFilterDate={setPmFilterDate}
          pmFilterState={pmFilterState}
          setPmFilterState={setPmFilterState}
          pmFilterType={pmFilterType}
          setPmFilterType={setPmFilterType}
          pmFilterZone={pmFilterZone}
          setPmFilterZone={setPmFilterZone}
          pmFilterReprog={pmFilterReprog}
          setPmFilterReprog={setPmFilterReprog}
          pmDetails={pmDetails}
          setPmDetails={setPmDetails}
          pmRejectedModalOpen={pmRejectedModalOpen}
          pmRejectedDateFilter={pmRejectedDateFilter}
          pmReprogOpen={pmReprogOpen}
          setPmReprogOpen={setPmReprogOpen}
          pmReprogItem={pmReprogItem}
          setPmReprogItem={setPmReprogItem}
          pmReprogForm={pmReprogForm}
          setPmReprogForm={setPmReprogForm}
          pmReprogError={pmReprogError}
          setPmReprogError={setPmReprogError}
          pmReprogSaving={pmReprogSaving}
          handlePmOpenReprog={handlePmOpenReprog}
          handlePmSaveReprog={handlePmSaveReprog}
          formatDate={formatDate}
          apiFetchJson={apiFetchJson}
          isSuperAdmin={Boolean(authUser?.role === 'admin' && authUser?.zone === 'BZV/POOL')}
          authZone={String(authUser?.zone || '')}
        />

        <ScoringModal
          open={showScoring}
          isTechnician={isTechnician}
          isViewer={isViewer}
          isAdmin={isAdmin}
          scoringMonth={scoringMonth}
          setScoringMonth={setScoringMonth}
          loadInterventions={loadInterventions}
          sites={sites}
          ficheHistory={ficheHistory}
          interventions={interventions}
          scoringDetails={scoringDetails}
          setScoringDetails={setScoringDetails}
          canExportExcel={canExportExcel}
          handleExportScoringDetailsExcel={handleExportScoringDetailsExcel}
          exportBusy={exportBusy}
          formatDate={formatDate}
          onClose={() => setShowScoring(false)}
        />

        <InterventionsModal
            open={showInterventions}
            isTechnician={isTechnician}
            isAdmin={isAdmin}
            isViewer={isViewer}
            authUser={authUser}
            technicianUnseenSentCount={technicianUnseenSentCount}
            technicianSeenSentAt={technicianSeenSentAt}
            setTechnicianSeenSentAt={setTechnicianSeenSentAt}
            interventions={interventions}
            setShowInterventions={setShowInterventions}
            interventionsBusy={interventionsBusy}
            interventionsError={interventionsError}
            setInterventionsError={setInterventionsError}
            users={users}
            sites={sites}
            filteredSites={filteredSites}
            interventionsMonth={interventionsMonth}
            setInterventionsMonth={setInterventionsMonth}
            interventionsStatus={interventionsStatus}
            setInterventionsStatus={setInterventionsStatus}
            interventionsTechnicianUserId={interventionsTechnicianUserId}
            setInterventionsTechnicianUserId={setInterventionsTechnicianUserId}
            loadInterventions={loadInterventions}
            canExportExcel={canExportExcel}
            handleExportInterventionsExcel={handleExportInterventionsExcel}
            exportBusy={exportBusy}
            planningAssignments={planningAssignments}
            setPlanningAssignments={setPlanningAssignments}
            getInterventionKey={getInterventionKey}
            ymdShiftForWorkdays={ymdShiftForWorkdays}
            interventionsPrevMonthRetiredSiteIds={interventionsPrevMonthRetiredSiteIds}
            interventionsPrevMonthKey={interventionsPrevMonthKey}
            handlePlanIntervention={handlePlanIntervention}
            technicianInterventionsTab={technicianInterventionsTab}
            setTechnicianInterventionsTab={setTechnicianInterventionsTab}
            showTechnicianInterventionsFilters={showTechnicianInterventionsFilters}
            setShowTechnicianInterventionsFilters={setShowTechnicianInterventionsFilters}
            handleCompleteIntervention={handleCompleteIntervention}
            formatDate={formatDate}
            completeModalOpen={completeModalOpen}
            setCompleteModalOpen={setCompleteModalOpen}
            completeModalSite={completeModalSite}
            setCompleteModalSite={setCompleteModalSite}
            completeModalIntervention={completeModalIntervention}
            setCompleteModalIntervention={setCompleteModalIntervention}
            completeForm={completeForm}
            setCompleteForm={setCompleteForm}
            completeFormError={completeFormError}
            setCompleteFormError={setCompleteFormError}
            nhModalOpen={nhModalOpen}
            setNhModalOpen={setNhModalOpen}
            nhModalSite={nhModalSite}
            setNhModalSite={setNhModalSite}
            nhModalIntervention={nhModalIntervention}
            setNhModalIntervention={setNhModalIntervention}
            nhForm={nhForm}
            setNhForm={setNhForm}
            nhFormError={nhFormError}
            setNhFormError={setNhFormError}
            apiFetchJson={apiFetchJson}
            loadData={loadData}
          />

        <PresenceModal
  open={showPresenceModal}
  isAdmin={isAdmin}
  presenceTab={presenceTab}
  onSelectSessions={() => setPresenceTab('sessions')}
  onSelectHistory={async () => {
    setPresenceTab('history');
    try {
      await refreshUsers();
    } catch {
      // ignore
    }
    await loadAuditLogs();
  }}
  users={users}
  auditUserId={auditUserId}
  onAuditUserIdChange={(v) => setAuditUserId(v)}
  auditFrom={auditFrom}
  onAuditFromChange={(v) => setAuditFrom(v)}
  auditTo={auditTo}
  onAuditToChange={(v) => setAuditTo(v)}
  auditQuery={auditQuery}
  onAuditQueryChange={(v) => setAuditQuery(v)}
  auditError={auditError}
  auditBusy={auditBusy}
  auditLogs={auditLogs}
  onSearchAudit={loadAuditLogs}
  onExportAuditExcel={handleExportAuditExcel}
  exportBusy={exportBusy}
  presenceSessions={presenceSessions}
  onClose={() => setShowPresenceModal(false)}
/>

        <UsersModal
  open={showUsersModal}
  users={users}
  userForm={userForm}
  userFormId={userFormId}
  userFormError={userFormError}
  onClose={() => {
    setShowUsersModal(false);
    setUserFormError('');
  }}
  onEditUser={(u) => {
    setUserFormId(u.id);
    setUserForm({ email: u.email, role: u.role, zone: u.zone || 'BZV/POOL', technicianName: u.technicianName || '', password: '' });
    setUserFormError('');
  }}
  onDeleteUser={(u) => {
    (async () => {
      try {
        await apiFetchJson(`/api/users/${u.id}`, { method: 'DELETE' });
        await refreshUsers();
      } catch (e) {
        setUserFormError(e?.message || 'Erreur serveur.');
      }
    })();
  }}
  onChangeUserForm={(next) => {
    setUserForm(next);
    setUserFormError('');
  }}
  onSave={() => {
    const email = String(userForm.email || '').trim().toLowerCase();
    const zone = String(userForm.zone || '').trim();
    if (!email) {
      setUserFormError('Email requis.');
      return;
    }
    if (!zone) {
  setUserFormError('Zone requise.');
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
              zone,
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
              zone,
              technicianName: userForm.technicianName || '',
              password: userForm.password
            })
          });
        }

        await refreshUsers();
        setUserFormId(null);
        setUserForm({ email: '', role: 'viewer', zone: 'BZV/POOL' ,technicianName: '', password: '' });
        setUserFormError('');
      } catch (e) {
        setUserFormError(e?.message || 'Erreur serveur.');
      }
    })();
  }}
  onReset={() => {
    setUserFormId(null);
    setUserForm({ email: '', role: 'viewer', zone: 'BZV/POOL', technicianName: '', password: '' });
    setUserFormError('');
  }}
/>

        {/* Modal Calendrier (Technicien) */}
              <TechnicianCalendarModal
                open={showTechCalendar}
                isTechnician={isTechnician}
                techCalendarMonth={techCalendarMonth}
                setTechCalendarMonth={setTechCalendarMonth}
                techSelectedDate={techSelectedDate}
                setTechSelectedDate={setTechSelectedDate}
                techSelectedDayEvents={techSelectedDayEvents}
                setTechSelectedDayEvents={setTechSelectedDayEvents}
                showTechDayDetailsModal={showTechDayDetailsModal}
                setShowTechDayDetailsModal={setShowTechDayDetailsModal}
                getTechCalendarEventsForDay={getTechCalendarEventsForDay}
                techCalendarPmTypeLabel={techCalendarPmTypeLabel}
                formatDate={formatDate}
                getDaysUntil={getDaysUntil}
                onClose={() => {
                  setShowTechCalendar(false);
                  setTechSelectedDate(null);
                  setTechSelectedDayEvents([]);
                  setShowTechDayDetailsModal(false);
                }}
              /> 

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
                          Technicien: {site.technician} | Régime: {site.regime}H/j | NH updaté: {site.nhEstimated}H | Diff updatée: {site.diffEstimated}H
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

        <DayDetailsModal
          open={showDayDetailsModal}
          selectedDate={selectedDate}
          selectedDayEvents={selectedDayEvents}
          setSelectedDayEvents={setSelectedDayEvents}
          isAdmin={isAdmin}
          canExportExcel={canExportExcel}
          canGenerateFiche={canGenerateFiche}
          exportBusy={exportBusy}
          handleExportSelectedDayExcel={handleExportSelectedDayExcel}
          startBatchFicheGeneration={startBatchFicheGeneration}
          formatDate={formatDate}
          getDaysUntil={getDaysUntil}
          onClose={() => {
            setShowDayDetailsModal(false);
            setSelectedDayEvents([]);
          }}
        />   

        {/* Modale Réinitialisation */}
        <ResetConfirmModal
          open={showResetConfirm}
          onResetVidanges={() => handleResetData({ includePm: false })}
          onResetAll={() => handleResetData({ includePm: true })}
          onSetNextTicket={handleSetNextTicketNumber}
          onCancel={() => setShowResetConfirm(false)}
        />

        {/* Modale Suppression Site */}
        {showDeleteConfirm && siteToDelete && (
          <DeleteSiteConfirmModal
            site={siteToDelete}
            isAdmin={isAdmin}
            onConfirm={handleDeleteSite}
            onCancel={() => {
              setShowDeleteConfirm(false);
              setSiteToDelete(null);
            }}
          />
        )}

        {/* Modale Upload Bannière */}
        <UploadBannerModal
          open={showBannerUpload}
          handleBannerUpload={handleBannerUpload}
          onCancel={() => {
            setShowBannerUpload(false);
            setIsBatchFiche(false);
            setBatchFicheSites([]);
            setBatchFicheIndex(0);
            setSiteForFiche(null);
            setBannerImage('');
            setFicheContext(null);
          }}
        />


        {/* Modale Fiche d'Intervention */}
          <FicheModal
            open={showFicheModal}
            siteForFiche={siteForFiche}
            bannerImage={bannerImage}
            ticketNumber={ticketNumber}
            isBatchFiche={isBatchFiche}
            batchFicheIndex={batchFicheIndex}
            batchFicheSites={batchFicheSites}
            goBatchFiche={goBatchFiche}
            handlePrintFiche={handlePrintFiche}
            handleSaveFichePdf={handleSaveFichePdf}
            onClose={() => {
              setShowFicheModal(false);
              setSiteForFiche(null);
              setBannerImage('');
              setIsBatchFiche(false);
              setBatchFicheSites([]);
              setBatchFicheIndex(0);
              setFicheContext(null);
            }}
            formatDate={formatDate}
          />  

        {/* Modal Historique */}
          <HistoryModal
            open={showHistory}
            onClose={() => setShowHistory(false)}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            historyDateFrom={historyDateFrom}
            setHistoryDateFrom={setHistoryDateFrom}
            historyDateTo={historyDateTo}
            setHistoryDateTo={setHistoryDateTo}
            historyStatus={historyStatus}
            setHistoryStatus={setHistoryStatus}
            historySort={historySort}
            setHistorySort={setHistorySort}
            ficheHistory={ficheHistory}
            filteredFicheHistory={filteredFicheHistory}
            canMarkCompleted={canMarkCompleted}
            handleMarkAsCompleted={handleMarkAsCompleted}
            formatDate={formatDate}
          />

        {/* Modal Calendrier */}
        
                <CalendarModal
          showCalendar={showCalendar}
          appVersion={APP_VERSION}
          authUser={authUser}
          isTechnician={isTechnician}
          setShowCalendar={setShowCalendar}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          isAdmin={isAdmin}
          sites={sites}
          calendarSendTechUserId={calendarSendTechUserId}
          setCalendarSendTechUserId={setCalendarSendTechUserId}
          users={users}
          usersBusy={usersBusy}
          usersError={usersError}
          refreshUsers={refreshUsers}
          handleSendCalendarMonthPlanning={handleSendCalendarMonthPlanning}
          canExportExcel={canExportExcel}
          handleExportCalendarMonthExcel={handleExportCalendarMonthExcel}
          exportBusy={exportBusy}
          basePlanBusy={basePlanBusy}
          basePlanErrors={basePlanErrors}
          basePlanPreview={basePlanPreview}
          basePlanTargetMonth={basePlanTargetMonth}
          basePlanBaseRows={basePlanBaseRows}
          basePlanProgress={basePlanProgress}
          handleImportBasePlanExcel={handleImportBasePlanExcel}
          generateBasePlanPreview={generateBasePlanPreview}
          exportBasePlanPreviewExcel={exportBasePlanPreviewExcel}
          saveBasePlanToDb={saveBasePlanToDb}
          deleteBasePlanFromDb={deleteBasePlanFromDb}
          getEventsForDay={getEventsForDay}
          getDaysUntil={getDaysUntil}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          setSelectedDayEvents={setSelectedDayEvents}
          setShowDayDetailsModal={setShowDayDetailsModal}
        />

        {/* Formulaire Ajout */}
        {showAddForm && canWriteSites && (
          <AddSiteForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAddSite}
            onClose={() => setShowAddForm(false)}
            onCancel={() => {
              setShowAddForm(false);
              setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
            }}
          />
        )}

        {/* Formulaire MAJ */}
        {showUpdateForm && selectedSite && canWriteSites && (
          <UpdateSiteForm
            selectedSite={selectedSite}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateSite}
            onClose={() => {
              setShowUpdateForm(false);
              setSelectedSite(null);
            }}
            onCancel={() => {
              setShowUpdateForm(false);
              setSelectedSite(null);
              setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
            }}
          />
        )}

        {/* Formulaire Modifier */}
        {showEditForm && selectedSite && canWriteSites && (
          <EditSiteForm
            selectedSite={selectedSite}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditSite}
            onClose={() => {
              setShowEditForm(false);
              setSelectedSite(null);
            }}
            onCancel={() => {
              setShowEditForm(false);
              setSelectedSite(null);
              setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
            }}
          />
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
                          <div className="text-[10px] text-gray-500 mt-1">
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

                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-2 text-center min-w-0">
                          <div className="text-[10px] text-gray-500">NH updaté</div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-gray-800 break-words leading-tight">{Number.isFinite(Number(site.nhEstimated)) ? `${site.nhEstimated}H` : '-'}</span>
                            {daysUntil < 0 && !site.retired && (
                              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                En retard
                              </span>
                            )}
                            {site.status === 'done' && <CheckCircle className="text-green-500" size={16} />}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-2 text-center min-w-0">
                          <div className="text-[10px] text-gray-500">Diff updatée</div>
                          <div className="text-xs font-semibold text-gray-800 break-words leading-tight">{site.diffEstimated}H</div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-2 text-center min-w-0">
                          <div className="text-[10px] text-gray-500">Date updatée</div>
                          <div className="text-xs font-semibold text-gray-800 break-words leading-tight">{formatDate(site.dateA)}</div>
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
        <SitesStats
          isAdmin={isAdmin}
          sitesCount={isTechnician ? filteredSites.length : sites.length}
          urgentSitesCount={urgentSites.length}
          retiredSitesCount={isTechnician ? filteredSites.filter((s) => s.retired).length : sites.filter((s) => s.retired).length}
          ticketNumber={ticketNumber}
        />

      </div>
    </div>
    </div>

  </div>
  </div>
  
  );
};

export default GeneratorMaintenanceApp;