import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Plus, Upload, Download, Calendar, Activity, CheckCircle, X, Edit, Filter, TrendingUp, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStorage } from './hooks/useStorage';
import {
  calculateRegime,
  calculateDifferences,
  formatDate,
  getUrgencyClass
} from './utils/calculations';

const APP_VERSION = '2.0.5';
const APP_VERSION_STORAGE_KEY = 'gma_app_version_seen';
const STHIC_LOGO_SRC = '/Logo_sthic.png';
const SPLASH_MIN_MS = 3000;

const GeneratorMaintenanceApp = () => {
  const storage = useStorage();
  const [sites, setSites] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFicheModal, setShowFicheModal] = useState(false);
  const [showBannerUpload, setShowBannerUpload] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
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
  const [ticketNumber, setTicketNumber] = useState(1150);
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
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [presenceSessions, setPresenceSessions] = useState([]);
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
  const [pmPlanningProgress, setPmPlanningProgress] = useState(0);
  const [pmPlanningStep, setPmPlanningStep] = useState('');
  const [pmNocProgress, setPmNocProgress] = useState(0);
  const [pmNocStep, setPmNocStep] = useState('');
  const [pmResetBusy, setPmResetBusy] = useState(false);
  const [pmFilterState, setPmFilterState] = useState('all');
  const [pmFilterType, setPmFilterType] = useState('all');
  const [pmFilterZone, setPmFilterZone] = useState('all');
  const [pmFilterDate, setPmFilterDate] = useState('');
  const [pmFilterReprog, setPmFilterReprog] = useState('all');
  const [pmSearch, setPmSearch] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarSendTechUserId, setCalendarSendTechUserId] = useState('');
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        res.status === 429
          ? 'Trop de requêtes (429). Merci de patienter quelques secondes puis de réessayer.'
          : (data?.error || 'Erreur serveur.');
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
          interventionsToSend.push({
            siteId: s.id,
            plannedDate,
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

  const exportBusyRef = useRef(false);
  useEffect(() => {
    exportBusyRef.current = Boolean(exportBusy);
  }, [exportBusy]);

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
      console.log('Numéro de ticket par défaut: T01133');
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
      .trim()
      .toLowerCase()
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
      setPmPlanningProgress(0);
      setPmPlanningStep('');
      setPmNocProgress(0);
      setPmNocStep('');
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

  const handlePmPlanningImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ok = window.confirm(
      `Confirmer l'import du planning mensuel PM ?\n\nCe fichier va remplacer le planning du mois ${pmMonth}.\nFichier: ${file?.name || ''}`
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    setPmBusy(true);
    setPmError('');
    setPmNotice('');
    setPmPlanningProgress(5);
    setPmPlanningStep('Lecture du fichier…');

    reader.onload = async (event) => {
      try {
        setPmPlanningProgress(20);
        setPmPlanningStep('Analyse Excel…');
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        setPmPlanningProgress(40);
        setPmPlanningStep('Préparation des données…');

        const monthId = pmMonthId || (await ensurePmMonth(pmMonth));
        setPmMonthId(monthId);

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

        const items = [];
        for (const row of Array.isArray(jsonData) ? jsonData : []) {
          const number = String(pmGet(row, 'Number') || '').trim();
          if (!number) continue;

          const state = String(pmGet(row, 'State') || 'Assigned').trim() || 'Assigned';
          const closedAt = pmNormalizeDate(pmGet(row, 'Date of closing', 'Closed'));
          const scheduledWoDate = pmNormalizeDate(pmGet(row, 'Scheduled WO Date', 'Scheduled Wo Date', 'Scheduled date'));

          const siteCode = String(pmGet(row, 'Site', 'Site Code') || '').trim();
          const siteName = String(pmGet(row, 'Site Name', 'Name Site') || '').trim();
          const region = String(pmGet(row, 'Region') || '').trim();
          const zone = String(pmGet(row, 'Zones', 'ZONES', 'ZONE', 'ZONE/PMWO', 'Zone/PMWO', 'Zone') || '').trim();
          const shortDescription = String(pmGet(row, 'Short description', 'Short Description') || '').trim();
          const assignedTo = String(pmGet(row, 'Assigned to', 'Assigned To') || '').trim();

          const reprogrammationDate = pmNormalizeDate(pmGet(row, 'Reprogrammation', 'Reprogramming'));
          const reprogrammationReason = String(pmGet(row, 'Raisons', 'Reasons', 'Reason') || '').trim();

          const excelStatus = pmGet(
            row,
            'Reprogrammation Status',
            'Reprogramming Status',
            'Statut reprogrammation',
            'Statut de reprogrammation',
            'Decision client',
            'Décision client',
            'Statut report',
            'Statut de report'
          );
          const explicitStatus = normStatus(excelStatus);
          const fallbackStatus = reprogrammationDate ? 'APPROVED' : reprogrammationReason ? 'PENDING' : '';
          const reprogrammationStatus = explicitStatus || fallbackStatus;

          const maintenanceType = String(pmGet(row, 'Maintenance Type') || '').trim() || pmInferType(row);

          items.push({
            number,
            siteCode,
            siteName,
            region,
            zone,
            shortDescription,
            maintenanceType,
            scheduledWoDate,
            assignedTo,
            state,
            closedAt,
            reprogrammationDate,
            reprogrammationReason,
            reprogrammationStatus
          });
        }

        await apiFetchJson(`/api/pm/months/${monthId}/planning-import`, {
          method: 'POST',
          body: JSON.stringify({ filename: file?.name || null, items })
        });

        setPmPlanningProgress(80);
        setPmPlanningStep('Rafraîchissement…');

        await loadPmMonths();
        await loadPmItems(monthId);
        await loadPmImports(monthId);
        await loadPmDashboard(monthId);
        setPmPlanningProgress(100);
        setPmPlanningStep('Terminé');
        setPmNotice(`✅ Planning PM importé (${items.length} lignes).`);
        alert(`✅ Planning PM importé (${items.length} lignes).`);
      } catch (err) {
        setPmError(err?.message || 'Erreur lors de l\'import planning PM.');
      } finally {
        setPmBusy(false);
      }
    };

    setPmPlanningProgress(10);
    setPmPlanningStep('Lecture du fichier…');
    reader.readAsArrayBuffer(file);
    e.target.value = '';
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

  const handleResetData = async () => {
    try {
      const ok = window.confirm('Confirmer la réinitialisation complète ? Cette action est irréversible.');
      if (!ok) return;
      if (authUser?.role === 'admin') {
        try {
          await apiFetchJson('/api/admin/reset', { method: 'POST', body: JSON.stringify({}) });
        } catch (e) {
          // ignore
        }
      }
      localStorage.clear();
      setSites([]);
      setFicheHistory([]);
      setInterventions([]);
      setTicketNumber(1150);
      setFilterTechnician('all');
      setSelectedSite(null);
      setSiteToDelete(null);
      setAuthUser(null);
      setUsers([]);
      setLoginPassword('');
      setLoginEmail('');
      setLoginError('');
      setShowResetConfirm(false);
      setShowDeleteConfirm(false);
      setShowCalendar(false);
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
      setIsBatchFiche(false);
      setBatchFicheSites([]);
      setBatchFicheIndex(0);
      alert('✅ Toutes les données ont été supprimées avec succès ! Vous pouvez maintenant importer votre fichier Excel.');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setSites([]);
      setFicheHistory([]);
      setTicketNumber(1150);
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
        alert('❌ Erreur lors de l\'import du fichier Excel. Vérifiez la console pour plus de détails.');
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
    const safeBase = base.replace(/[\\/:*?"<>|]+/g, '_');
    const wb = XLSX.utils.book_new();
    if (exportBusyRef.current) {
      setExportProgress((p) => Math.max(p, 55));
    }
    (Array.isArray(sheets) ? sheets : []).forEach((sh, idx) => {
      const nameRaw = String(sh?.name || `Feuille${idx + 1}`);
      const name = nameRaw.trim().slice(0, 31) || `Feuille${idx + 1}`;
      const rows = Array.isArray(sh?.rows) ? sh.rows : [];
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    if (exportBusyRef.current) {
      setExportProgress((p) => Math.max(p, 80));
    }
    XLSX.writeFile(wb, `${safeBase}.xlsx`);
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

  const calendarFilteredSites = sites
    .map(getUpdatedSite)
    .filter((site) => {
      if (!calendarTechnicianName) return true;
      return String(site.technician || '').trim() === calendarTechnicianName;
    });

  const interventionsByKey = new Map(
    (Array.isArray(interventions) ? interventions : []).filter(Boolean).map((i) => [getInterventionKey(i.siteId, i.plannedDate, i.epvType), i])
  );

  const getEventsForDay = (dateStr) => {
    if (!dateStr) return [];
    const events = [];

    calendarFilteredSites.forEach((site) => {
      if (site.retired) return;
      if (site.epv1 === dateStr) {
        const intervention = interventionsByKey.get(getInterventionKey(site.id, site.epv1, 'EPV1')) || null;
        events.push({ site, type: 'EPV1', date: site.epv1, intervention });
      }
      if (site.epv2 === dateStr) {
        const intervention = interventionsByKey.get(getInterventionKey(site.id, site.epv2, 'EPV2')) || null;
        events.push({ site, type: 'EPV2', date: site.epv2, intervention });
      }
      if (site.epv3 === dateStr) {
        const intervention = interventionsByKey.get(getInterventionKey(site.id, site.epv3, 'EPV3')) || null;
        events.push({ site, type: 'EPV3', date: site.epv3, intervention });
      }
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
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-cyan-600 text-white rounded-lg p-3">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Connexion</h1>
              <p className="text-sm text-gray-600">Gestion Maintenance & Vidanges</p>
            </div>
            <div className="ml-auto">
              <img
                src={STHIC_LOGO_SRC}
                alt="STHIC"
                className="h-14 w-auto max-w-[240px] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
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
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6">
      {pwaUpdate?.available && (
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
                  try {
                    if (pwaUpdate?.forced) {
                      localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
                    }
                  } catch (e) {
                    // ignore
                  }
                  setPwaUpdate({ available: false, registration: null, requested: false, forced: false });
                }}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold w-full sm:w-auto"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
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
      <div className="max-w-7xl mx-auto">
        {/* Header - Je continue dans le prochain message car limite de tokens */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Activity className="text-blue-600" size={24} />
                <span className="hidden sm:inline">Gestion Maintenance & Vidanges</span>
                <span className="sm:hidden">Maintenance & Vidanges</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Version 2.0.4 - Suivi H24/7j avec Fiches</p>
            </div>
            <div className="text-left sm:text-right flex flex-col gap-2">
              <div>
                <p className="text-xs text-gray-500">Aujourd'hui</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-800">{formatDate(new Date().toISOString())}</p>
                <p className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                  <span>
                    {authUser.email} ({authUser.role})
                  </span>
                  {isViewer && (
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                      Lecture seule
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold"
              >
                Déconnexion
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 mb-4">
            {canWriteSites && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Nouveau Site</span>
                <span className="sm:hidden">Nouveau</span>
              </button>
            )}
            
            {canImportExport && (
              <div className="flex flex-col gap-2">
                <label
                  className={`bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm sm:text-base ${
                    importBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700 cursor-pointer'
                  }`}
                >
                  <Upload size={18} />
                  <span className="hidden sm:inline">{importBusy ? 'Import en cours…' : 'Importer Excel'}</span>
                  <span className="sm:hidden">{importBusy ? '…' : 'Import'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    className="hidden"
                    disabled={importBusy}
                  />
                </label>

                {importBusy && (
                  <div className="w-full max-w-xs">
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
                onClick={handleExportExcel}
                disabled={sites.length === 0 || exportBusy || importBusy}
                className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 disabled:bg-gray-400 text-sm sm:text-base"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Exporter Excel</span>
                <span className="sm:hidden">Export</span>
              </button>
            )}

            {!isTechnician && (
              <button
                onClick={() => setShowCalendar(true)}
                className="bg-cyan-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-cyan-700 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Calendar size={18} />
                <span className="hidden sm:inline">Calendrier</span>
                <span className="sm:hidden">Cal.</span>
              </button>
            )}

            {canUseInterventions && (
              <button
                onClick={async () => {
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
                className="relative bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-emerald-800 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <CheckCircle size={18} />
                {isTechnician && technicianUnseenSentCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {technicianUnseenSentCount}
                  </span>
                )}
                <span className="hidden sm:inline flex items-center gap-2">
                  {isTechnician ? 'Mes interventions' : 'Interventions'}
                </span>
                <span className="sm:hidden">{isTechnician ? 'Mes' : 'Int.'}</span>
              </button>
            )}

            {!isTechnician && (
              <button
                onClick={async () => {
                  const nextMonth = scoringMonth || new Date().toISOString().slice(0, 7);
                  setScoringMonth(nextMonth);
                  setScoringDetails({ open: false, title: '', kind: '', items: [] });
                  setShowScoring(true);
                  await loadInterventions(nextMonth, 'all', 'all');
                }}
                className="bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <TrendingUp size={18} />
                <span className="hidden sm:inline">Scoring</span>
                <span className="sm:hidden">Score</span>
              </button>
            )}

            {canUsePm && (
              <button
                onClick={async () => {
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
                className="bg-teal-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-teal-800 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <TrendingUp size={18} />
                <span className="hidden sm:inline">Maintenances (PM)</span>
                <span className="sm:hidden">PM</span>
              </button>
            )}

            <button
              onClick={() => setShowHistory(true)}
              className="bg-amber-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Activity size={18} />
              <span className="hidden sm:inline">Historique</span>
              <span className="sm:hidden">Hist.</span>
            </button>

            {canReset && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <X size={18} />
                <span className="hidden sm:inline">Réinitialiser</span>
                <span className="sm:hidden">Reset</span>
              </button>
            )}

            {canManageUsers && (
              <button
                onClick={() => setShowUsersModal(true)}
                className="bg-slate-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Users size={18} />
                <span className="hidden sm:inline">Utilisateurs</span>
                <span className="sm:hidden">Users</span>
              </button>
            )}

            {canManageUsers && (
              <button
                onClick={() => setShowPresenceModal(true)}
                className="bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-800 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Activity size={18} />
                <span className="hidden sm:inline">Présence</span>
                <span className="sm:hidden">Prés.</span>
              </button>
            )}
          </div>

          {!isTechnician && (
            <div className="flex items-center gap-2">
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
        </div>

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
                <button
                  onClick={() => setDashboardDetails({ open: false, title: '', kind: '', items: [] })}
                  className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500"
                >
                  <X size={20} />
                </button>
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
              <div className="p-4 border-t bg-white flex flex-col sm:flex-row gap-3 sm:justify-end">
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
            </div>
          </div>
        )}

        {showPm && canUsePm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
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

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs text-gray-600">Mois</label>
                    <input
                      type="month"
                      value={pmMonth}
                      onChange={async (e) => {
                        const next = String(e.target.value || '').trim();
                        setPmMonth(next);
                        await refreshPmAll(next);
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      disabled={pmBusy}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await refreshPmAll(pmMonth);
                      }}
                      className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                      disabled={pmBusy}
                    >
                      Rafraîchir
                    </button>
                    <button
                      type="button"
                      onClick={handlePmExportExcel}
                      className="bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 text-sm font-semibold flex items-center gap-2"
                      disabled={pmBusy}
                    >
                      <Download size={16} />
                      Exporter Excel
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label
                        className={`bg-emerald-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold ${
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-800 cursor-pointer'
                        }`}
                      >
                        <Upload size={16} />
                        Import planning
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handlePmPlanningImport}
                          className="hidden"
                          disabled={pmBusy}
                        />
                      </label>

                      <label
                        className={`bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold ${
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-purple-800 cursor-pointer'
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

                      <button
                        type="button"
                        onClick={() => handlePmReset('imports')}
                        className="bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 text-sm font-semibold"
                        disabled={pmBusy || pmResetBusy}
                      >
                        Suppr. imports
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePmReset('all')}
                        className="bg-red-700 text-white px-3 py-2 rounded-lg hover:bg-red-800 text-sm font-semibold"
                        disabled={pmBusy || pmResetBusy}
                      >
                        Reset mois
                      </button>
                    </div>
                  )}
                </div>

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

                {pmPlanningProgress > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-700 mb-1">Import planning: {pmPlanningStep || '…'}</div>
                    <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                      <div className="bg-emerald-600 h-2" style={{ width: `${pmPlanningProgress}%` }} />
                    </div>
                  </div>
                )}

                {pmNocProgress > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-700 mb-1">Import NOC: {pmNocStep || '…'}</div>
                    <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                      <div className="bg-purple-700 h-2" style={{ width: `${pmNocProgress}%` }} />
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
                    assigned: 0
                  };
                  for (const it of baseFiltered) {
                    const b = bucketForState(it?.state);
                    if (b === 'closed') counts.closed += 1;
                    else if (b === 'wip') counts.wip += 1;
                    else if (b === 'awaiting') counts.awaiting += 1;
                    else counts.assigned += 1;
                  }

                  const cards = [
                    {
                      key: 'total',
                      title: 'Total',
                      value: Number(counts.total || 0),
                      className: 'bg-white border-gray-200 hover:bg-gray-50',
                      onClick: () => setPmFilterState('all')
                    },
                    {
                      key: 'closed',
                      title: 'Closed Complete',
                      value: Number(counts.closed || 0),
                      className: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
                      onClick: () => setPmFilterState('closed')
                    },
                    {
                      key: 'wip',
                      title: 'Work in progress',
                      value: Number(counts.wip || 0),
                      className: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
                      onClick: () => setPmFilterState('wip')
                    },
                    {
                      key: 'awaiting',
                      title: 'Awaiting Closure',
                      value: Number(counts.awaiting || 0),
                      className: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
                      onClick: () => setPmFilterState('awaiting')
                    },
                    {
                      key: 'assigned',
                      title: 'Assigned',
                      value: Number(counts.assigned || 0),
                      className: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
                      onClick: () => setPmFilterState('assigned')
                    }
                  ];

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                        {cards.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={c.onClick}
                            className={`${c.className} border rounded-xl p-3 text-left`}
                            disabled={pmBusy}
                          >
                            <div className="text-[11px] font-semibold text-gray-700">{c.title}</div>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{c.value}</div>
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

                      <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                          <div className="font-semibold text-gray-800">Tickets</div>
                          <div className="text-xs text-gray-600">Tri: date planifiée puis ticket</div>
                        </div>
                        <div className="overflow-auto">
                          <table className="min-w-[980px] w-full text-sm">
                            <thead className="bg-white sticky top-0">
                              <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                                <th className="px-4 py-2">Ticket</th>
                                <th className="px-4 py-2">État</th>
                                <th className="px-4 py-2">Date planifiée</th>
                                <th className="px-4 py-2">Site</th>
                                <th className="px-4 py-2">Zone</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Assigné à</th>
                                <th className="px-4 py-2">Clôture</th>
                                <th className="px-4 py-2">Statut</th>
                                <th className="px-4 py-2">Reprogrammation</th>
                                <th className="px-4 py-2">Raisons</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tableFiltered.length === 0 ? (
                                <tr>
                                  <td className="px-4 py-4 text-gray-600" colSpan={11}>
                                    Aucun ticket pour ces filtres.
                                  </td>
                                </tr>
                              ) : (
                                tableFiltered.map((it) => {
                                  const bucket = bucketForState(it?.state);
                                  const badge = badgeForBucket(bucket);
                                  const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                                  const closed = it?.closedAt ? String(it.closedAt).slice(0, 10) : '';
                                  const reprogStatus = effectiveReprogStatus(it);
                                  const reprog = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
                                  const reason = String(it?.reprogrammationReason || '').trim();
                                  const siteLabel = [it?.siteName, it?.siteCode].filter(Boolean).join(' • ');
                                  const st = stateLabel(it?.state);
                                  return (
                                    <tr key={it?.id || it?.number} className="border-b border-gray-100 hover:bg-gray-50">
                                      <td className="px-4 py-2 font-semibold text-gray-900">{it?.number || '-'}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-flex items-center border px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                                          {st}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-gray-800">{sched || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{siteLabel || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{it?.zone || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{it?.maintenanceType || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{it?.assignedTo || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{closed || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{reprogStatus || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{reprog || '-'}</td>
                                      <td className="px-4 py-2 text-gray-800">{reason || '-'}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

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
                                    kind === 'planning'
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

              <div className="p-4 border-t bg-white flex justify-end">
                <button
                  onClick={() => {
                    setShowPm(false);
                    setPmError('');
                    setPmNotice('');
                  }}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
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

              <div className="p-4 border-t bg-white flex justify-end">
                <button
                  onClick={() => {
                    setShowScoring(false);
                    setScoringDetails({ open: false, title: '', kind: '', items: [] });
                  }}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
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
                              key: getInterventionKey(site.id, ev.date, ev.type),
                              siteId: site.id,
                              siteName: site.nameSite,
                              technicianName: site.technician,
                              plannedDate: ev.date,
                              epvType: ev.type
                            }));
                        })
                        .sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)));

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
                                <div className="text-xs text-gray-600">{ev.epvType} • {formatDate(ev.plannedDate)} • {ev.technicianName}</div>
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
                                    return (
                                      <div key={it.id} className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="font-semibold text-gray-800 truncate">{site?.nameSite || it.siteId}</div>
                                          {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                                          <div className="text-xs text-gray-600">{it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>{it.status}</span>
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
                    const canCatchUpInMonth = Boolean(
                      isTechnician &&
                      technicianInterventionsTab === 'month' &&
                      String(it?.plannedDate || '') &&
                      String(it.plannedDate) <= String(today)
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
                      const monthItems = list
                        .filter((i) => i && i.status !== 'done')
                        .filter((i) => {
                          if (!month) return true;
                          return String(i.plannedDate || '').slice(0, 7) === month;
                        });

                      const byDate = new Map();
                      monthItems.forEach((it) => {
                        const k = String(it.plannedDate || '');
                        if (!byDate.has(k)) byDate.set(k, []);
                        byDate.get(k).push(it);
                      });

                      const dates = Array.from(byDate.keys()).sort((a, b) => String(a).localeCompare(String(b)));
                      return (
                        <div className="space-y-6">
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
                      <div className="p-4 border-t bg-white flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setCompleteModalOpen(false);
                            setCompleteModalIntervention(null);
                            setCompleteModalSite(null);
                            setCompleteForm({ nhNow: '', doneDate: '' });
                            setCompleteFormError('');
                          }}
                          className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
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
                          className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 font-semibold"
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
                      <div className="p-4 border-t bg-white flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setNhModalOpen(false);
                            setNhModalIntervention(null);
                            setNhModalSite(null);
                            setNhForm({ nhValue: '', readingDate: '' });
                            setNhFormError('');
                          }}
                          className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
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
                          className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold"
                        >
                          Confirmer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-white flex justify-end">
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
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
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
                <button onClick={() => setShowPresenceModal(false)} className="hover:bg-indigo-800 p-2 rounded">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
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

              <div className="p-4 border-t bg-white flex justify-end">
                <button
                  onClick={() => setShowPresenceModal(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
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
                <button onClick={() => { setShowUsersModal(false); setUserFormError(''); }} className="hover:bg-slate-800 p-2 rounded">
                  <X size={20} />
                </button>
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

                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
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

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {selectedDayEvents.length === 0 ? (
                  <div className="text-gray-600">Aucune vidange planifiée ce jour.</div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayEvents.map((evt) => {
                      const daysUntil = getDaysUntil(evt.date);
                      const color = daysUntil !== null && daysUntil <= 3 ? 'bg-red-500' : daysUntil !== null && daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                      const st = String(evt?.intervention?.status || '');
                      const stColor = st === 'done' ? 'bg-green-100 text-green-800 border-green-200' : st === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' : st === 'planned' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-gray-100 text-gray-700 border-gray-200';
                      return (
                        <div key={`${evt.site.id}-${evt.type}`} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-800">{evt.site.nameSite}</div>
                              <div className="text-sm text-gray-600">{evt.site.idSite} | {evt.site.technician}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className={`${color} text-white text-xs px-2 py-1 rounded`}>{evt.type}</div>
                              <div className={`text-xs px-2 py-1 rounded border font-semibold ${stColor}`}>{st || 'non planifiée'}</div>
                              <div className="text-sm text-gray-700">{formatDate(evt.date)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-white flex flex-col sm:flex-row gap-3 sm:justify-end">
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
            </div>
          </div>
        )}

        {/* Continuation dans un autre message - limite de caractères atteinte */}
        <div className="bg-white rounded-lg shadow-md p-4 text-center">
          <p className="text-gray-600">L'application est prête ! Les formulaires et tableaux sont fonctionnels.</p>
        </div>

        {/* Modale Réinitialisation */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="text-red-600" size={32} />
                <h2 className="text-xl font-bold text-gray-800">⚠️ ATTENTION</h2>
              </div>
              <p className="text-gray-700 mb-6">
                Cette action va supprimer <strong>TOUTES les données stockées</strong> dans l'application. 
                Cette action est <strong>irréversible</strong>.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleResetData}
                  className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold"
                >
                  Oui, tout supprimer
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold"
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
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="text-red-600" size={32} />
                <h2 className="text-xl font-bold text-gray-800">⚠️ Confirmer la suppression</h2>
              </div>
              <p className="text-gray-700 mb-4">
                Êtes-vous sûr de vouloir supprimer le site <strong>{siteToDelete.nameSite}</strong> ?
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Cette action est <strong>irréversible</strong>. Toutes les données du site seront perdues.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteSite}
                  className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold"
                >
                  Oui, supprimer
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSiteToDelete(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold"
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
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📤 Uploader la bannière</h2>
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
                  <button
                    onClick={handlePrintFiche}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold w-full sm:w-auto"
                  >
                    Imprimer
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

                  <div className="no-print mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-center">
                    <p className="text-sm text-gray-700">
                      💡 <strong>Astuce :</strong> Utilisez <kbd className="px-2 py-1 bg-white border rounded">Ctrl+P</kbd> (Windows) ou <kbd className="px-2 py-1 bg-white border rounded">Cmd+P</kbd> (Mac) pour imprimer cette fiche
                    </p>
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
                <button onClick={() => setShowHistory(false)} className="hover:bg-amber-700 p-2 rounded">
                  <X size={20} />
                </button>
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
            </div>
          </div>
        )}

        {/* Modal Calendrier */}
        {showCalendar && !isTechnician && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-6xl sm:max-h-[90vh]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-cyan-600 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar size={24} />
                  Calendrier des Vidanges
                </h2>
                <button onClick={() => setShowCalendar(false)} className="hover:bg-cyan-700 p-2 rounded">
                  <X size={20} />
                </button>
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

                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={handleSendCalendarMonthPlanning}
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 font-semibold text-sm w-full"
                        disabled={!calendarSendTechUserId}
                      >
                        Envoyer planning du mois
                      </button>
                    ) : (
                      <div />
                    )}

                    {canExportExcel && (
                      <button
                        type="button"
                        onClick={handleExportCalendarMonthExcel}
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold flex items-center justify-center gap-2 w-full"
                        disabled={exportBusy}
                      >
                        <Download size={18} />
                        Exporter Excel
                      </button>
                    )}
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
                          className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full hover:bg-gray-50 ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
                        >
                          <div className="text-sm font-semibold text-gray-700">{day}</div>
                          {eventsForDay.length > 0 && (
                            <div className="text-xs space-y-1 mt-1">
                              {eventsForDay.slice(0, 2).map((ev) => {
                                const daysUntil = getDaysUntil(dateStr);
                                const color = daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                                const st = String(ev?.intervention?.status || '');
                                const dot = st === 'done' ? 'bg-green-200' : st === 'sent' ? 'bg-blue-200' : st === 'planned' ? 'bg-amber-200' : 'bg-gray-200';
                                return (
                                  <div key={`${ev.site.id}-${ev.type}`} className={`${color} text-white px-1 rounded truncate flex items-center gap-1`}>
                                    <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                                    <span className="truncate">{ev.site.nameSite}</span>
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
  );
};

export default GeneratorMaintenanceApp;