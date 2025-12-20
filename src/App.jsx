import React, { useState, useEffect } from 'react';
import { AlertCircle, Plus, Upload, Download, Calendar, Activity, CheckCircle, X, Edit, Filter, TrendingUp, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [interventions, setInterventions] = useState([]);
  const [interventionsMonth, setInterventionsMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [interventionsStatus, setInterventionsStatus] = useState('all');
  const [interventionsBusy, setInterventionsBusy] = useState(false);
  const [interventionsError, setInterventionsError] = useState('');
  const [planningAssignments, setPlanningAssignments] = useState({});
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeModalIntervention, setCompleteModalIntervention] = useState(null);
  const [completeModalSite, setCompleteModalSite] = useState(null);
  const [completeForm, setCompleteForm] = useState({ nhNow: '', doneDate: '' });
  const [completeFormError, setCompleteFormError] = useState('');
  const [siteToDelete, setSiteToDelete] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [filterTechnician, setFilterTechnician] = useState('all');
  const [ticketNumber, setTicketNumber] = useState(1122);
  const [bannerImage, setBannerImage] = useState('');
  const [siteForFiche, setSiteForFiche] = useState(null);
  const [ficheContext, setFicheContext] = useState(null);
  const [ficheHistory, setFicheHistory] = useState([]);
  const [authUser, setAuthUser] = useState(null);
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSites, setSelectedSites] = useState([]);
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false);
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
      const msg = data?.error || 'Erreur serveur.';
      throw new Error(msg);
    }
    return data;
  };

  const refreshUsers = async () => {
    const data = await apiFetchJson('/api/users', { method: 'GET' });
    setUsers(Array.isArray(data?.users) ? data.users : []);
  };

  useEffect(() => {
    loadTicketNumber();

    (async () => {
      try {
        const data = await apiFetchJson('/api/auth/me', { method: 'GET' });
        if (data?.user?.email) {
          setAuthUser(data.user);
          await loadData();
          await loadFicheHistory();
        }
      } catch (e) {
        // ignore
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

  const loadInterventions = async (yyyyMm = interventionsMonth, status = interventionsStatus) => {
    setInterventionsError('');
    setInterventionsBusy(true);
    try {
      const { from, to } = monthRange(yyyyMm);
      const qs = new URLSearchParams({ from, to });
      if (status && status !== 'all') qs.set('status', status);
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
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleSendJ1 = async () => {
    try {
      const data = await apiFetchJson('/api/interventions/send-j1', { method: 'POST' });
      alert(`✅ Envoi J-1: ${data?.updated || 0} intervention(s) marquée(s) envoyée(s) pour ${data?.plannedDate || ''}`);
      await loadInterventions();
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleCompleteIntervention = async (interventionId, payload = {}) => {
    try {
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
      const result = await storage.get('ticket-number');
      if (result && result.value) {
        setTicketNumber(parseInt(result.value));
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
      await storage.set('ticket-number', num.toString());
    } catch (error) {
      console.error('Erreur sauvegarde numéro:', error);
    }
  };

  const PRESENCE_KEY = 'gma-presence';
  const PRESENCE_TTL_MS = 20000;

  const readPresence = () => {
    try {
      const raw = localStorage.getItem(PRESENCE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const writePresence = (list) => {
    try {
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(list));
    } catch (e) {
      // ignore
    }
  };

  const cleanPresence = (list, nowMs = Date.now()) => {
    return (Array.isArray(list) ? list : []).filter((s) => s && s.lastSeen && nowMs - s.lastSeen < PRESENCE_TTL_MS);
  };

  const removePresenceEntry = () => {
    const now = Date.now();
    const next = cleanPresence(readPresence(), now).filter((s) => s.tabId !== tabId);
    writePresence(next);
  };

  const getCurrentActivityLabel = () => {
    if (showUsersModal) return 'Gestion des utilisateurs';
    if (showPresenceModal) return 'Consultation présence';
    if (showCalendar) return 'Calendrier';
    if (showHistory) return 'Historique';
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

  const upsertPresenceEntry = (patch) => {
    const now = Date.now();
    const existing = cleanPresence(readPresence(), now);
    const next = [
      ...existing.filter((s) => s.tabId !== tabId),
      {
        tabId,
        ...patch,
        lastSeen: now
      }
    ];
    writePresence(next);
    return next;
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
      await apiFetchJson('/api/sites', {
        method: 'POST',
        body: JSON.stringify(newSite)
      });
      await loadData();
      setFormData({ nameSite: '', idSite: '', technician: '', generateur: '', capacite: '', kitVidange: '', nh1DV: '', dateDV: '', nh2A: '', dateA: '', retired: false });
      setShowAddForm(false);
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
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  };

  const handleResetData = async () => {
    try {
      if (authUser?.role === 'admin') {
        try {
          await apiFetchJson('/api/sites/bulk-replace', { method: 'POST', body: JSON.stringify({ sites: [] }) });
        } catch (e) {
          // ignore
        }
      }
      localStorage.clear();
      setSites([]);
      setFicheHistory([]);
      setTicketNumber(1122);
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
      setTicketNumber(1122);
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
    const currentTicketNumber = ticketNumber;
    window.print();

    setTicketNumber((prev) => {
      const nextNumber = prev + 1;
      saveTicketNumber(nextNumber);
      return nextNumber;
    });

    const newFiche = {
      id: Date.now(),
      ticketNumber: `T${String(currentTicketNumber).padStart(5, '0')}`,
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

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        console.log('Données importées:', jsonData);
        console.log('Première ligne:', jsonData[0]);

        const importedSites = jsonData.map((row, index) => {
          if (!row['Name Site'] && !row['NameSite']) {
            return null;
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

          return {
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
          };
        }).filter(site => site !== null);

        console.log('Sites importés:', importedSites);
        await apiFetchJson('/api/sites/bulk-replace', {
          method: 'POST',
          body: JSON.stringify({ sites: importedSites })
        });
        await loadData();
        alert(`✅ ${importedSites.length} sites importés avec succès !`);
      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('❌ Erreur lors de l\'import du fichier Excel. Vérifiez la console pour plus de détails.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportExcel = () => {
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

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vidanges');
    XLSX.writeFile(wb, `Planning_Vidanges_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  const getEventsForDay = (dateStr) => {
    if (!dateStr) return [];
    const events = [];

    filteredSites.forEach((site) => {
      if (site.retired) return;
      if (site.epv1 === dateStr) events.push({ site, type: 'EPV1', date: site.epv1 });
      if (site.epv2 === dateStr) events.push({ site, type: 'EPV2', date: site.epv2 });
      if (site.epv3 === dateStr) events.push({ site, type: 'EPV3', date: site.epv3 });
    });

    return events;
  };

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
        } else {
          setLoginError('Email ou mot de passe incorrect.');
        }
      } catch (err) {
        setLoginError(err?.message || 'Erreur serveur.');
      }
    })();
  };

  const handleLogout = () => {
    removePresenceEntry();
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
    upsertPresenceEntry({ email: authUser.email, role: authUser.role, technicianName: authUser.technicianName || '', activity: getCurrentActivityLabel() });
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
      upsertPresenceEntry({ email: authUser.email, role: authUser.role, technicianName: authUser.technicianName || '', activity: getCurrentActivityLabel() });
    };
    tick();
    const interval = setInterval(tick, 5000);
    const onBeforeUnload = () => {
      removePresenceEntry();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onBeforeUnload);
      removePresenceEntry();
    };
  }, [authUser?.email, authUser?.role, authUser?.technicianName, tabId]);

  useEffect(() => {
    if (!showPresenceModal) return;

    const refresh = () => {
      const now = Date.now();
      const list = cleanPresence(readPresence(), now)
        .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
      setPresenceSessions(list);
      writePresence(list);
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    const onStorage = (e) => {
      if (e.key === PRESENCE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [showPresenceModal]);

  const currentRole = authUser?.role || 'viewer';
  const isAdmin = currentRole === 'admin';
  const isViewer = currentRole === 'viewer';
  const isTechnician = currentRole === 'technician';
  const canWriteSites = isAdmin;
  const canImportExport = isAdmin;
  const canReset = isAdmin;
  const canGenerateFiche = isAdmin;
  const canMarkCompleted = isAdmin || isTechnician;
  const canManageUsers = isAdmin;
  const canUseInterventions = isAdmin || isTechnician;

  useEffect(() => {
    if (isTechnician && authUser?.technicianName) {
      setFilterTechnician(authUser.technicianName);
      setShowCalendar(false);
    }
  }, [isTechnician, authUser?.technicianName]);

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
              <p className="text-sm text-gray-600">Gestion des Vidanges de Générateurs</p>
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
                <span className="hidden sm:inline">Gestion des Vidanges de Générateurs</span>
                <span className="sm:hidden">Vidanges Générateurs</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Version 2.0 - Suivi H24/7j avec Fiches</p>
            </div>
            <div className="text-left sm:text-right flex flex-col gap-2">
              <div>
                <p className="text-xs text-gray-500">Aujourd'hui</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-800">{formatDate(new Date().toISOString())}</p>
                <p className="text-xs text-gray-500 mt-1">{authUser.email} ({authUser.role})</p>
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
              <label className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base">
                <Upload size={18} />
                <span className="hidden sm:inline">Importer Excel</span>
                <span className="sm:hidden">Import</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>
            )}

            {canImportExport && (
              <button
                onClick={handleExportExcel}
                disabled={sites.length === 0}
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
                className="bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-emerald-800 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <CheckCircle size={18} />
                <span className="hidden sm:inline">Interventions</span>
                <span className="sm:hidden">Int.</span>
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
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Mois</label>
              <input
                type="month"
                value={dashboardMonth}
                onChange={(e) => setDashboardMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {(() => {
            const plannedEvents = filteredSites
              .filter((s) => !s.retired)
              .flatMap((site) => {
                return [
                  { type: 'EPV1', date: site.epv1 },
                  { type: 'EPV2', date: site.epv2 },
                  { type: 'EPV3', date: site.epv3 }
                ]
                  .filter((ev) => ev.date && String(ev.date).slice(0, 7) === dashboardMonth)
                  .map((ev) => ({
                    key: `${site.id}|${ev.type}|${ev.date}`,
                    siteId: site.id,
                    siteName: site.nameSite,
                    technician: site.technician,
                    epvType: ev.type,
                    plannedDate: ev.date
                  }));
              });

            const completedFichesInMonth = ficheHistory.filter((f) => f.status === 'Effectuée' && f.dateCompleted && isInMonth(f.dateCompleted, dashboardMonth));
            const contractOk = completedFichesInMonth.filter((f) => f.isWithinContract === true);
            const contractOver = completedFichesInMonth.filter((f) => f.isWithinContract === false);

            const completedKeys = new Set(
              ficheHistory
                .filter((f) => f.status === 'Effectuée' && f.plannedDate && String(f.plannedDate).slice(0, 7) === dashboardMonth)
                .map((f) => `${f.siteId}|${f.epvType || ''}|${f.plannedDate}`)
            );
            const remainingEvents = plannedEvents.filter((ev) => !completedKeys.has(ev.key));

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
              </div>
            );
          })()}
        </div>

        {dashboardDetails.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-gray-100">
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
                ) : dashboardDetails.kind === 'contract_ok' || dashboardDetails.kind === 'contract_over' ? (
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
              <div className="p-4 border-t bg-white flex justify-end">
                <button
                  onClick={() => setDashboardDetails({ open: false, title: '', kind: '', items: [] })}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {showInterventions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-emerald-700 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle size={24} />
                  Interventions
                </h2>
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
                  }}
                  className="hover:bg-emerald-800 p-2 rounded"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600 mb-1">Mois</span>
                      <input
                        type="month"
                        value={interventionsMonth}
                        onChange={(e) => setInterventionsMonth(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-600 mb-1">Statut</span>
                      <select
                        value={interventionsStatus}
                        onChange={(e) => setInterventionsStatus(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="all">Tous</option>
                        <option value="planned">Planifiées</option>
                        <option value="sent">Envoyées</option>
                        <option value="done">Effectuées</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => loadInterventions(interventionsMonth, interventionsStatus)}
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 font-semibold text-sm"
                        disabled={interventionsBusy}
                      >
                        Rafraîchir
                      </button>
                      {isAdmin && (
                        <button
                          onClick={handleSendJ1}
                          className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 font-semibold text-sm"
                          disabled={interventionsBusy}
                        >
                          Envoyer J-1
                        </button>
                      )}
                    </div>
                  </div>

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
                      <button
                        onClick={async () => {
                          try {
                            await refreshUsers();
                          } catch (e) {
                            // ignore
                          }
                          await loadInterventions(interventionsMonth, 'all');
                        }}
                        className="bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm"
                        disabled={interventionsBusy}
                      >
                        Recharger users + interventions
                      </button>
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
                  const today = new Date().toISOString().slice(0, 10);
                  const tomorrowD = new Date(today);
                  tomorrowD.setDate(tomorrowD.getDate() + 1);
                  const tomorrow = tomorrowD.toISOString().slice(0, 10);

                  const list = interventions
                    .slice()
                    .sort((a, b) => String(a.plannedDate || '').localeCompare(String(b.plannedDate || '')));

                  const groups = [
                    { title: "Aujourd'hui", items: list.filter((i) => i.plannedDate === today && i.status !== 'done') },
                    { title: 'Demain', items: list.filter((i) => i.plannedDate === tomorrow && i.status !== 'done') },
                    { title: 'Toutes', items: list }
                  ];

                  return (
                    <div className="space-y-6">
                      {groups.map((g) => (
                        <div key={g.title}>
                          <div className="font-semibold text-gray-800 mb-2">{g.title}</div>
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
                                      <div className="text-xs text-gray-600">{it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>{it.status}</span>
                                      {(isAdmin || isTechnician) && it.status !== 'done' && (
                                        <button
                                          onClick={() => {
                                            if (isTechnician) {
                                              setCompleteModalIntervention(it);
                                              setCompleteModalSite(site);
                                              const today = new Date().toISOString().slice(0, 10);
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
                              })}
                            </div>
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
              <div className="flex justify-between items-center p-4 border-b bg-indigo-700 text-white">
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
                  Sessions actives (multi-onglets sur le même navigateur). Actualisation automatique.
                </div>
                {presenceSessions.length === 0 ? (
                  <div className="text-gray-600">Aucun utilisateur actif détecté.</div>
                ) : (
                  <div className="space-y-2">
                    {presenceSessions.map((s) => {
                      const secondsAgo = s.lastSeen ? Math.max(0, Math.round((Date.now() - s.lastSeen) / 1000)) : null;
                      const isActive = secondsAgo !== null && secondsAgo <= 8;
                      return (
                        <div key={s.tabId} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
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
              <div className="flex justify-between items-center p-4 border-b bg-slate-700 text-white">
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
                        <div key={u.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 truncate">{u.email}</div>
                            <div className="text-xs text-gray-600">Rôle: {u.role}{u.technicianName ? ` | Technicien: ${u.technicianName}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setUserFormId(u.id);
                                setUserForm({ email: u.email, role: u.role, technicianName: u.technicianName || '', password: '' });
                                setUserFormError('');
                              }}
                              className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold"
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
                              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-semibold disabled:bg-gray-400"
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
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => { setUserFormId(null); setUserForm({ email: '', role: 'viewer', technicianName: '', password: '' }); setUserFormError(''); }}
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
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
              <div className="flex justify-between items-center p-4 border-b bg-gray-100">
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
                      return (
                        <div key={`${evt.site.id}-${evt.type}`} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-800">{evt.site.nameSite}</div>
                              <div className="text-sm text-gray-600">{evt.site.idSite} | {evt.site.technician}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className={`${color} text-white text-xs px-2 py-1 rounded`}>{evt.type}</div>
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
              <div className="flex justify-between items-center p-4 border-b bg-gray-100">
                <h2 className="text-xl font-bold text-gray-800">📄 Fiche d'Intervention - Aperçu</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintFiche}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b bg-amber-600 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity size={24} />
                  Historique des Fiches d'Intervention
                </h2>
                <button onClick={() => setShowHistory(false)} className="hover:bg-amber-700 p-2 rounded">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto" style={{maxHeight: 'calc(90vh - 80px)'}}>
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
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg text-gray-800">{fiche.ticketNumber}</h3>
                            <p className="text-sm text-gray-600">{fiche.siteName}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${fiche.status === 'Effectuée' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}>
                            {fiche.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Technicien:</span>
                            <span className="ml-2 font-semibold">{fiche.technician}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">NH1 DV:</span>
                            <span className="ml-2 font-semibold">{fiche.nh1DV}H</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Date génération:</span>
                            <span className="ml-2">{formatDate(fiche.dateGenerated)}</span>
                          </div>
                          {fiche.dateCompleted && (
                            <div>
                              <span className="text-gray-600">Date réalisation:</span>
                              <span className="ml-2">{formatDate(fiche.dateCompleted)}</span>
                            </div>
                          )}
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-cyan-600 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar size={24} />
                  Calendrier des Vidanges
                </h2>
                <button onClick={() => setShowCalendar(false)} className="hover:bg-cyan-700 p-2 rounded">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
                  >
                    ← Mois précédent
                  </button>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
                  >
                    Mois suivant →
                  </button>
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
                      const sitesForDay = filteredSites.filter(site => 
                        site.epv1 === dateStr || site.epv2 === dateStr || site.epv3 === dateStr
                      );

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
                          {sitesForDay.length > 0 && (
                            <div className="text-xs space-y-1 mt-1">
                              {sitesForDay.slice(0, 2).map(site => {
                                const daysUntil = getDaysUntil(dateStr);
                                const color = daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                                return (
                                  <div key={site.id} className={`${color} text-white px-1 rounded truncate`}>
                                    {site.nameSite}
                                  </div>
                                );
                              })}
                              {sitesForDay.length > 2 && (
                                <div className="text-gray-600 text-center">+{sitesForDay.length - 2}</div>
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
                            <div className="text-lg font-bold text-blue-600">{site.nhEstimated}H</div>
                            <TrendingUp size={16} className="text-blue-500" />
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
                        {canGenerateFiche && (
                          <button
                            onClick={() => handleGenerateFiche(site)}
                            className="bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-semibold"
                          >
                            📄 Fiche
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

          {!isTechnician && (
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