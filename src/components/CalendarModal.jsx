import React, { useMemo, useState } from 'react';
import { Calendar, X, Users, MapPin, Clock, AlertCircle, Download, Sparkles, Activity, Menu, ChevronLeft } from 'lucide-react';
import * as XLSX from 'xlsx';

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

  const [planningBusy, setPlanningBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [showIntelligentWizard, setShowIntelligentWizard] = useState(false);
  const [intelligentTechUserId, setIntelligentTechUserId] = useState('');
  const [intelligentDoneTechIds, setIntelligentDoneTechIds] = useState(() => new Set());
  const [intelligentError, setIntelligentError] = useState('');
  const [intelligentLastStats, setIntelligentLastStats] = useState(null);
  const [intelligentExportBusy, setIntelligentExportBusy] = useState(false);

  const todayDay = useMemo(() => {
    try {
      return Number(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Brazzaville',
          day: '2-digit'
        }).format(new Date())
      );
    } catch {
      return new Date().getDate();
    }
  }, []);

  const isIntelligentDay = todayDay === 23;

  const zoneForIntelligent = useMemo(() => {
    if (isSuperAdmin) return String(calendarZone || authZone || 'BZV/POOL');
    if (isManager) return String(authZone || 'BZV/POOL');
    return String(calendarZone || authZone || 'BZV/POOL');
  }, [isSuperAdmin, calendarZone, authZone, isManager]);

  const zoneTechnicians = useMemo(() => {
    const all = (Array.isArray(users) ? users : []).filter((u) => u && u.role === 'technician');
    const z = String(zoneForIntelligent || '').trim();
    const scoped = isSuperAdmin && (calendarZone === 'ALL' || !calendarZone) ? all : all.filter((u) => String(u?.zone || '').trim() === z);
    return scoped
      .slice()
      .sort((a, b) => String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || '')));
  }, [users, zoneForIntelligent, isSuperAdmin, calendarZone]);

  const targetMonthLabel = useMemo(() => {
    try {
      const d = new Date();
      const y = d.getFullYear();
      const m = d.getMonth();
      const next = new Date(y, m + 1, 1);
      const pad2 = (n) => String(n).padStart(2, '0');
      return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`;
    } catch {
      return '';
    }
  }, []);

  const todayLabel = useMemo(() => {
    try {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    } catch {
      return '';
    }
  }, []);

  const exportIntelligentExcel = async () => {
    setIntelligentExportBusy(true);
    setIntelligentError('');
    try {
      const z = String(zoneForIntelligent || '').trim();
      if (!z || z === 'ALL') {
        setIntelligentError('Veuillez sélectionner une zone.');
        return;
      }
      const resp = await fetch(`/api/intelligent-planning/items?month=${encodeURIComponent(targetMonthLabel)}&zone=${encodeURIComponent(z)}`);
      const raw = await resp.text();
      const data = raw ? JSON.parse(raw) : null;
      const items = Array.isArray(data?.items) ? data.items : [];
      if (!resp.ok) throw new Error(data?.error || 'Erreur export snapshot.');
      if (items.length === 0) {
        setIntelligentError('Aucun planning trouvé pour ce mois/zone.');
        return;
      }

      const rows = items.map((it) => ({
        Site: String(it?.siteCode || it?.siteId || ''),
        'Site Name': String(it?.siteName || ''),
        Region: String(it?.zone || it?.region || ''),
        'Short description': String(it?.shortDescription || ''),
        Number: String(it?.number || ''),
        'Assigned to': String(it?.assignedTo || ''),
        'Scheduled WO Date': String(it?.scheduledWoDate || ''),
        'Date of closing': String(it?.dateOfClosing || ''),
        State: String(it?.state || ''),
        EPV2: String(it?.epv2 || ''),
        EPV3: String(it?.epv3 || ''),
        'Paire Site': String(it?.pairSiteCode || '')
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Planning PM');
      XLSX.writeFile(wb, `planning_intelligent_${z}_${targetMonthLabel}.xlsx`);
    } catch (e) {
      setIntelligentError(e?.message || 'Erreur export.');
    } finally {
      setIntelligentExportBusy(false);
    }
  };

  const generateIntelligentPlanning = async () => {
    setIntelligentError('');
    setIntelligentLastStats(null);
    setShowIntelligentWizard(true);
  };

  const runIntelligentForTechnician = async () => {
    setPlanningBusy(true);
    setIntelligentError('');
    setIntelligentLastStats(null);
    try {
      if (!intelligentTechUserId) {
        setIntelligentError('Veuillez sélectionner un technicien.');
        return;
      }
      const resp = await fetch('/api/intelligent-planning/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianUserId: intelligentTechUserId })
      });
      const raw = await resp.text();
      const data = raw ? JSON.parse(raw) : null;
      if (!resp.ok) throw new Error(data?.error || 'Erreur génération planning intelligent.');

      setIntelligentDoneTechIds((prev) => {
        const next = new Set(prev);
        next.add(String(intelligentTechUserId));
        return next;
      });
      setIntelligentLastStats(data?.stats || null);
    } catch (e) {
      setIntelligentError(e?.message || 'Erreur génération planning intelligent.');
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
              <div className="lg:w-[280px] w-full flex-shrink-0 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 text-white border-indigo-900/60 overflow-y-auto border-r-4 border-r-sky-400/30">
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
                <div className="p-3 space-y-5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Mois</div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="bg-white/10 hover:bg-white/15 text-white border border-white/10 px-2 py-2 rounded-lg w-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                    >
                      ←
                    </button>

                    <div className="text-sm font-bold text-white text-center capitalize">
                      {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="bg-white/10 hover:bg-white/15 text-white border border-white/10 px-2 py-2 rounded-lg w-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
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
                      className="mt-3 w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
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
                          className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                        >
                          Recharger les techniciens
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSendCalendarMonthPlanning}
                        className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
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
                      <button
                        type="button"
                        onClick={() => setShowClustering(!showClustering)}
                        className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                      >
                        <Users size={16} />
                        {showClustering ? 'Masquer le clustering' : 'Clustering sites'}
                      </button>

                      <button
                        type="button"
                        onClick={generateIntelligentPlanning}
                        className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
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
                                  isPaired ? 'bg-teal-800/60 border-teal-400/60' : isFirst ? 'bg-amber-900/40 border-amber-500' : 'hover:bg-white/15 border-white/10'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-2 h-2 rounded-full ${
                                        isPaired ? 'bg-teal-200' : isFirst ? 'bg-amber-400' : 'bg-white/40'
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
                                  <div className="text-teal-200 mt-1 text-xs">⚭ Jumelé avec: {pairedWith.code} - {pairedWith.name}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex-1 bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 text-sm font-semibold disabled:opacity-60"
                            onClick={saveClustering}
                            disabled={clusteringBusy || selectedPairs.size === 0}
                          >
                            {clusteringBusy ? 'Sauvegarde...' : 'Enregistrer les paires'}
                          </button>
                          <button
                            type="button"
                            className="flex-1 bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                            onClick={() => setSelectedPairs(new Map())}
                          >
                            Réinitialiser
                          </button>
                        </div>
                        {selectedPairs.size > 0 && (
                          <div className="text-xs text-teal-200 bg-teal-900/20 border border-teal-800 rounded p-2">
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
                        className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
                    className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <X size={20} className="text-gray-700" />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6 space-y-3">
              {showIntelligentWizard && (isAdmin || isManager) && (
                <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-bold text-indigo-900">Planning intelligent (campagne {targetMonthLabel})</div>
                      <div className="text-xs text-indigo-900/80 mt-1">
                        Zone: <span className="font-semibold">{String(zoneForIntelligent || '')}</span>
                      </div>
                      <div className="text-xs text-indigo-900/70 mt-1">
                        Aujourd’hui: <span className="font-semibold">{todayLabel}</span> — Mois cible: <span className="font-semibold">{targetMonthLabel}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowIntelligentWizard(false);
                        setIntelligentError('');
                        setIntelligentLastStats(null);
                      }}
                      className="p-2 rounded hover:bg-indigo-100 transition-colors"
                      title="Fermer"
                    >
                      <X size={18} className="text-indigo-900" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-indigo-900 mb-1">Technicien</div>
                      <select
                        value={intelligentTechUserId}
                        onChange={(e) => setIntelligentTechUserId(e.target.value)}
                        className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                        disabled={planningBusy}
                      >
                        <option value="">-- Sélectionner --</option>
                        {zoneTechnicians.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.technicianName || u.email}
                          </option>
                        ))}
                      </select>
                      <div className="text-[11px] text-indigo-900/70 mt-1">
                        Avancement zone: {intelligentDoneTechIds.size}/{zoneTechnicians.length} technicien(s) traités
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={runIntelligentForTechnician}
                        disabled={planningBusy || !intelligentTechUserId}
                        className="w-full bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60"
                      >
                        {planningBusy ? 'Construction...' : 'Déclencher la construction du planning PM'}
                      </button>

                      <button
                        type="button"
                        onClick={exportIntelligentExcel}
                        disabled={
                          intelligentExportBusy ||
                          zoneTechnicians.length === 0 ||
                          intelligentDoneTechIds.size !== zoneTechnicians.length
                        }
                        className="w-full bg-white text-indigo-900 border border-indigo-200 px-3 py-2 rounded-lg hover:bg-indigo-50 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        <Download size={16} />
                        {intelligentExportBusy
                          ? 'Export...'
                          : `Exporter en Excel (Planning PM campagne '${targetMonthLabel}')`}
                      </button>
                    </div>
                  </div>

                  {intelligentError && (
                    <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{intelligentError}</div>
                  )}

                  {intelligentLastStats && (
                    <div className="mt-3 text-xs text-indigo-900 bg-white border border-indigo-200 rounded p-2">
                      <div className="font-semibold">Résultat</div>
                      <div>Sites: {intelligentLastStats.sites} • Visites: {intelligentLastStats.visits} • Cadence: {intelligentLastStats.capacityVisitsPerDay} visite(s)/jour</div>
                      <div>Jours ouvrés: {intelligentLastStats.workdays} • Snapshot: {intelligentLastStats.snapshotInserted} lignes • Interventions: {intelligentLastStats.interventionsUpserted}</div>
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
