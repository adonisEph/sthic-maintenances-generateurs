import React, { useState } from 'react';
import { Calendar, X, Users, MapPin, Clock, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const CalendarModal = (props) => {
  const {
    showCalendar,
    isTechnician,
    setShowCalendar,
    currentMonth,
    setCurrentMonth,
    isAdmin,
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
    basePlanBusy,
    basePlanErrors,
    basePlanPreview,
    basePlanTargetMonth,
    basePlanBaseRows,
    basePlanProgress,
    handleImportBasePlanExcel,
    generateBasePlanPreview,
    exportBasePlanPreviewExcel,
    saveBasePlanToDb,
    deleteBasePlanFromDb,
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

    if (originDow === 6) {
      const prev = findPrevWorkday(v);
      return prev && prev !== v ? prev : '';
    }
    if (originDow === 0) {
      const next = findNextWorkday(v);
      return next && next !== v ? next : '';
    }

    const prev = findPrevWorkday(v);
    const next = findNextWorkday(v);
    if (!prev && !next) return '';
    if (!prev) return next !== v ? next : '';
    if (!next) return prev !== v ? prev : '';

    const prefer = String(opts?.prefer || 'before').toLowerCase();
    if (prefer === 'after' || prefer === 'next') return next !== v ? next : '';
    return prev !== v ? prev : '';
  };

  const exportIntelligentPlanningExcel = () => {
    const items = Array.isArray(planningData) ? planningData : [];
    if (items.length === 0) {
      alert('Aucun planning intelligent à exporter.');
      return;
    }

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const month = nextMonth.toISOString().slice(0, 7);
    const safeBase = `planning_intelligent_${month}`.replace(/[\\/:*?"<>|]+/g, '_');

    const rows = items.map((it) => ({
      Date: String(it?.plannedDate || '').slice(0, 10),
      Technicien: String(it?.technician || ''),
      Site: String(it?.siteCode || ''),
      'Site Name': String(it?.siteName || ''),
      Region: String(it?.region || ''),
      Regime: String(it?.regime || ''),
      EPV: String(it?.epvType || ''),
      Urgence: Number(it?.urgency || 0),
      Pair: String(it?.pairId ? String(it.pairId).split('-')[1] : '')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Planning');
    XLSX.writeFile(wb, `${safeBase}.xlsx`);
  };

  const calculateUrgencyScore = (site) => {
    // Priority by regime: H24 > H20 > H18 > H16 > H15 > H14 > H12 > H9
    const regimePriority = {
      'H24': 100, 'H20': 90, 'H18': 80, 'H16': 70,
      'H15': 60, 'H14': 50, 'H12': 40, 'H9': 30
    };
    
    const regimeScore = regimePriority[site.regime] || 0;
    
    // Days since last vidange (older = more urgent)
    const lastVidange = new Date(site.lastVidange);
    const today = new Date();
    const daysSinceVidange = Math.floor((today - lastVidange) / (1000 * 60 * 60 * 24));
    const vidangeScore = Math.min(daysSinceVidange * 2, 100); // Cap at 100
    
    return regimeScore + vidangeScore;
  };

  const getEPVPriority = (site) => {
    // Dynamic EPV priority based on current month and last maintenance
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Check if EPV1 is still pending from current month
    const hasPendingEPV1 = site.dateA && new Date(site.dateA).getMonth() === currentMonth && 
                         new Date(site.dateA).getFullYear() === currentYear;
    
    if (hasPendingEPV1) {
      // EPV2 becomes first priority, EPV3 becomes second
      return { first: 'EPV2', second: 'EPV3' };
    }
    
    // Normal priority: EPV1 -> EPV2 -> EPV3
    return { first: 'EPV1', second: 'EPV2' };
  };

  const getTechnicianCapacity = (technicianId, siteCount) => {
    // >20 sites = 2 sites/day, <=20 sites = 1 site/day
    return siteCount > 20 ? 2 : 1;
  };

  const generateIntelligentPlanning = async () => {
    setPlanningBusy(true);
    setPlanningErrors([]);
    
    try {
      // Load all sites with clustering data
      const sitesResponse = await fetch('/api/sites/all-with-clustering');
      if (!sitesResponse.ok) throw new Error('Erreur chargement sites');
      const allSites = await sitesResponse.json();
      
      // Group sites by technician
      const sitesByTech = new Map();
      allSites.forEach(site => {
        if (!sitesByTech.has(site.technicianId)) {
          sitesByTech.set(site.technicianId, []);
        }
        sitesByTech.get(site.technicianId).push(site);
      });
      
      const planning = [];
      const targetMonth = new Date();
      targetMonth.setMonth(targetMonth.getMonth() + 1); // Next month
      
      // Process each technician
      for (const [techId, sites] of sitesByTech.entries()) {
        const capacity = getTechnicianCapacity(techId, sites.length);
        const techUser = users.find(u => u.id === techId);
        const techName = techUser?.technicianName || techUser?.email || 'Unknown';
        
        // Load clustering pairs for this technician
        const pairsResponse = await fetch(`/api/clustering/by-technician/${techId}`);
        const pairs = pairsResponse.ok ? await pairsResponse.json() : [];
        const pairMap = new Map();
        pairs.forEach(pair => {
          pairMap.set(pair.siteId1, pair.siteId2);
          pairMap.set(pair.siteId2, pair.siteId1);
        });
        
        // Group sites into pairs (for capacity=2) or single (for capacity=1)
        const groups = [];
        const processed = new Set();
        
        sites.forEach(site => {
          if (!processed.has(site.id)) {
            if (capacity === 2 && pairMap.has(site.id)) {
              // Create pair
              const pairedSite = sites.find(s => s.id === pairMap.get(site.id));
              if (pairedSite && !processed.has(pairedSite.id)) {
                // Calculate urgency for the pair (most urgent wins)
                const urgency1 = calculateUrgencyScore(site);
                const urgency2 = calculateUrgencyScore(pairedSite);
                const mostUrgent = urgency1 >= urgency2 ? site : pairedSite;
                
                groups.push({
                  type: 'pair',
                  sites: [site, pairedSite],
                  urgency: Math.max(urgency1, urgency2),
                  mostUrgent
                });
                processed.add(site.id);
                processed.add(pairedSite.id);
              }
            } else {
              // Single site
              groups.push({
                type: 'single',
                sites: [site],
                urgency: calculateUrgencyScore(site),
                mostUrgent: site
              });
              processed.add(site.id);
            }
          }
        });
        
        // Sort groups by urgency (most urgent first)
        groups.sort((a, b) => b.urgency - a.urgency);
        
        // Schedule groups
        let currentDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
        const usedCapacity = new Map(); // date -> used slots
        
        groups.forEach(group => {
          let plannedDate = null;
          let attempts = 0;
          const maxAttempts = 60; // Max 2 months of attempts
          
          while (!plannedDate && attempts < maxAttempts) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const used = usedCapacity.get(dateStr) || 0;
            const needed = group.type === 'pair' ? 2 : 1;
            
            if (used + needed <= capacity) {
              plannedDate = dateStr;
              usedCapacity.set(dateStr, used + needed);
            } else {
              currentDate.setDate(currentDate.getDate() + 1);
              attempts++;
            }
          }
          
          if (plannedDate) {
            const finalDate = ymdShiftForWorkdays(plannedDate) || plannedDate;
            
            // Get EPV priorities for each site
            group.sites.forEach(site => {
              const epvPriority = getEPVPriority(site);
              const epvType = site === group.mostUrgent ? epvPriority.first : epvPriority.second;
              
              planning.push({
                siteId: site.id,
                siteCode: site.idSite,
                siteName: site.nameSite,
                region: site.region,
                technician: techName,
                technicianId: techId,
                plannedDate: finalDate,
                epvType: epvType,
                regime: site.regime,
                lastVidange: site.lastVidange,
                urgency: calculateUrgencyScore(site),
                pairId: group.type === 'pair' ? `${site.id}-${pairMap.get(site.id)}` : null
              });
            });
          }
        });
      }
      
      // Sort final planning by date, technician, urgency
      planning.sort((a, b) => {
        const dateCompare = a.plannedDate.localeCompare(b.plannedDate);
        if (dateCompare !== 0) return dateCompare;
        const techCompare = a.technician.localeCompare(b.technician);
        if (techCompare !== 0) return techCompare;
        return b.urgency - a.urgency;
      });
      
      setPlanningData(planning);
      setShowPlanning(true);
      
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
      const sites = await response.json();
      
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
    if (newPairs.has(siteId)) {
      // Remove pair
      const pairedId = newPairs.get(siteId);
      newPairs.delete(siteId);
      newPairs.delete(pairedId);
    } else {
      // Find first unpaired site to pair with
      const unpairedSite = clusteringData.find(site => 
        site.id !== siteId && !newPairs.has(site.id)
      );
      if (unpairedSite) {
        newPairs.set(siteId, unpairedSite.id);
        newPairs.set(unpairedSite.id, siteId);
      } else {
        setClusteringErrors(['Aucun autre site disponible pour former une paire']);
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b border-gray-200 bg-white text-gray-900 shadow-sm">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={24} className="text-blue-600" />
            Calendrier des Vidanges
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCalendar(false)} className="hover:bg-gray-100 p-2 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row h-full min-h-0">
            <div className="lg:w-[280px] w-full flex-shrink-0 bg-slate-900 text-slate-100 border-b border-slate-800 lg:border-b-0 lg:border-r lg:border-slate-800 overflow-y-auto">
              <div className="p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Mois</div>
              <div className="grid grid-cols-3 gap-2 items-center mb-3">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="bg-slate-800 text-white px-2 py-2 rounded-lg hover:bg-slate-700 w-full text-sm font-semibold"
                >
                  ←
                </button>
                <div className="text-sm font-bold text-white text-center capitalize">
                  {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="bg-slate-800 text-white px-2 py-2 rounded-lg hover:bg-slate-700 w-full text-sm font-semibold"
                >
                  →
                </button>
              </div>

              {isAdmin && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3">
                  <div className="text-xs font-semibold text-slate-200 mb-1">Technicien</div>
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

                  {usersBusy && <div className="mt-1 text-xs text-slate-200/80">Chargement des techniciens…</div>}
                  {!usersBusy && usersError && <div className="mt-1 text-xs text-rose-300">{usersError}</div>}
                  {!usersBusy &&
                    !usersError &&
                    (Array.isArray(users) ? users : []).filter((u) => u && u.role === 'technician').length === 0 && (
                      <div className="mt-1 text-xs text-slate-200/80">Aucun technicien chargé.</div>
                    )}

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
                      className="mt-2 w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-600 text-sm font-semibold"
                    >
                      Recharger les techniciens
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSendCalendarMonthPlanning}
                    className="mt-2 w-full bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-600 text-sm font-semibold disabled:opacity-60"
                    disabled={!calendarSendTechUserId || usersBusy}
                  >
                    Envoyer planning du mois
                  </button>
                </div>
              )}

              {isAdmin && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3">
                  <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <Users size={14} />
                    Clustering Sites
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowClustering(!showClustering)}
                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-600 text-sm font-semibold"
                  >
                    {showClustering ? 'Masquer' : 'Gérer'} les paires de sites
                  </button>
                </div>
              )}

              {isAdmin && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3">
                  <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <Users size={14} />
                    Planning Intelligent
                  </div>
                  <button
                    type="button"
                    onClick={generateIntelligentPlanning}
                    className="w-full bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm font-semibold disabled:opacity-60"
                    disabled={planningBusy}
                  >
                    {planningBusy ? 'Génération...' : 'Générer planning intelligent'}
                  </button>
                </div>
              )}

              <div className="h-px bg-slate-700/60 my-2" />

              <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
              <div className="flex flex-col">
                {canExportExcel && (
                  <button
                    type="button"
                    onClick={handleExportCalendarMonthExcel}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={exportBusy}
                  >
                    Exporter Excel
                  </button>
                )}
                {isAdmin && (
                  <label
                    className={`text-left px-3 py-2 rounded-lg font-semibold text-sm ${
                      basePlanBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
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
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy || basePlanBaseRows.length === 0}
                  >
                    Générer planning mois suivant
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={exportBasePlanPreviewExcel}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy || basePlanPreview.length === 0}
                  >
                    Exporter planning base
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={saveBasePlanToDb}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy || basePlanPreview.length === 0}
                  >
                    Enregistrer (DB)
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={deleteBasePlanFromDb}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy}
                  >
                    Supprimer (DB)
                  </button>
                )}
              </div>

              {/* Clustering Interface */}
              {showClustering && isAdmin && (
                <div className="bg-slate-800 border-t border-slate-700 p-3">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-200">Technicien cible</div>
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
                        <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                          <MapPin size={12} />
                          Sites à regrouper ({clusteringData.length} sites)
                        </div>
                        <div className="text-xs text-slate-400 mb-2">
                          Cliquez sur les sites pour les regrouper en paires
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {clusteringData.map((site) => {
                            const isPaired = selectedPairs.has(site.id);
                            const pairedWith = isPaired ? clusteringData.find(s => s.id === selectedPairs.get(site.id)) : null;
                            
                            return (
                              <div
                                key={site.id}
                                onClick={() => togglePair(site.id)}
                                className={`bg-slate-700 rounded p-2 text-xs cursor-pointer transition-colors ${
                                  isPaired ? 'bg-blue-800 border border-blue-600' : 'hover:bg-slate-600'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      isPaired ? 'bg-blue-400' : 'bg-slate-400'
                                    }`} />
                                    <span className="font-semibold">{site.code}</span> - {site.name}
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-400">
                                    <Clock size={10} />
                                    <span>{site.regime}</span>
                                  </div>
                                </div>
                                <div className="text-slate-400 mt-1">
                                  {site.region || site.zone} • Dernière vidange: {site.lastVidange}
                                </div>
                                {pairedWith && (
                                  <div className="text-blue-400 mt-1 text-xs">
                                    ⚭ Jumelé avec: {pairedWith.code} - {pairedWith.name}
                                  </div>
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
                            className="flex-1 bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700 text-sm font-semibold"
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
                        {planningData.length} sites planifiés • {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </div>
                      

                      <div className="border rounded-lg overflow-auto max-h-96">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="text-left">
                              <th className="p-2 border-b">Date</th>
                              <th className="p-2 border-b">Technicien</th>
                              <th className="p-2 border-b">Site</th>
                              <th className="p-2 border-b">Nom</th>
                              <th className="p-2 border-b">Région</th>
                              <th className="p-2 border-b">Régime</th>
                              <th className="p-2 border-b">EPV</th>
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
                                <td className="p-2 border-b">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                    {item.regime}
                                  </span>
                                </td>
                                <td className="p-2 border-b">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    item.epvType === 'EPV1' ? 'bg-green-100 text-green-800' :
                                    item.epvType === 'EPV2' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-orange-100 text-orange-800'
                                  }`}>
                                    {item.epvType}
                                  </span>
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
                                    <span className="text-xs text-purple-600">⚭ {item.pairId.split('-')[1]}</span>
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
                </div>
              )}

              {isAdmin && (basePlanBusy || basePlanErrors.length > 0 || basePlanPreview.length > 0) && (
                <div className="mt-0 space-y-2">
                  {basePlanBusy && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${basePlanProgress}%` }} />
                    </div>
                  )}
                  {basePlanTargetMonth && (
                    <div className="text-xs text-gray-700">
                      Mois cible: <strong>{basePlanTargetMonth}</strong> | Base: <strong>{basePlanBaseRows.length}</strong> | Planning:{' '}
                      <strong>{basePlanPreview.length}</strong>
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
                            <th className="p-2 border-b">Site</th>
                            <th className="p-2 border-b">Site Name</th>
                            <th className="p-2 border-b">Region</th>
                            <th className="p-2 border-b">Short description</th>
                            <th className="p-2 border-b">Number</th>
                            <th className="p-2 border-b">Assigned to</th>
                            <th className="p-2 border-b">Scheduled WO Date</th>
                            <th className="p-2 border-b">Date of closing</th>
                            <th className="p-2 border-b">State</th>
                            <th className="p-2 border-b">PairGroup</th>
                            <th className="p-2 border-b">EPV2</th>
                            <th className="p-2 border-b">EPV3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const normYmd = (v) => {
                              const s = v == null ? '' : String(v).trim();
                              const head = s.slice(0, 10);
                              return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : '';
                            };

                            const items = Array.isArray(basePlanPreview) ? basePlanPreview : [];
                            const bySite = new Map();
                            for (const it of items) {
                              const siteCode = String(it?.siteCode || '').trim();
                              const siteName = String(it?.siteName || '').trim();
                              const key = siteCode || siteName;
                              if (!key) continue;

                              if (!bySite.has(key)) {
                                bySite.set(key, {
                                  siteCode,
                                  siteName,
                                  region: String(it?.region || it?.zone || '').trim(),
                                  shortDescription: '',
                                  number: String(it?.number || '').trim(),
                                  assignedTo: String(it?.assignedTo || '').trim(),
                                  scheduledWoDate: '',
                                  dateOfClosing: String(it?.dateOfClosing || '').trim(),
                                  state: String(it?.state || '').trim(),
                                  pairGroup: String(it?.pairGroup || '').trim(),
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
                              if (!row.number) row.number = String(it?.number || '').trim();
                              if (!row.assignedTo) row.assignedTo = String(it?.assignedTo || '').trim();
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

                            const out = Array.from(bySite.values())
                              .sort((a, b) => {
                                const oa = Number(a?._order ?? 0);
                                const ob = Number(b?._order ?? 0);
                                if (oa !== ob) return oa - ob;
                                return String(a.siteCode || a.siteName || '').localeCompare(String(b.siteCode || b.siteName || ''));
                              })
                              .slice(0, 80);

                            return out.map((it, idx) => (
                              <tr key={`${it.siteCode || it.siteName}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-2 border-b whitespace-nowrap">{it.siteCode}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.siteName}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.region}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.shortDescription}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.number}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.assignedTo}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.scheduledWoDate}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.dateOfClosing}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.state}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.pairGroup}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.epv2}</td>
                                <td className="p-2 border-b whitespace-nowrap">{it.epv3}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                      {basePlanPreview.length > 80 && (
                        <div className="text-xs text-gray-600 p-2">
                          Affichage limité aux 80 premières lignes (total: {basePlanPreview.length}).
                        </div>
                      )}
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
        </div>

        <div className="p-3 border-t bg-white" />
      </div>
    </div>
  );
};

export default CalendarModal;
