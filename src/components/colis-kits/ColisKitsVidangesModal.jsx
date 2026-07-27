import React, { useMemo, useState } from 'react';
import { X, Package, Search, ChevronRight, AlertTriangle, CheckCircle, Loader2, MapPin, User, Calendar, Filter } from 'lucide-react';
import { calculateEPVDates, calculateEstimatedNH, calculateDiffNHs, getDaysUntil, formatDate } from '../../utils/calculations';

const ColisKitsVidangesModal = ({
  open,
  onClose,
  users,
  sites,
  ficheHistory,
  onGenerate,
  generating,
  generateResult,
}) => {
  const [step, setStep] = useState(1);
  const [techSearch, setTechSearch] = useState('');
  const [selectedTechUserId, setSelectedTechUserId] = useState(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState(new Set());
  const [siteSearch, setSiteSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  const handleClose = () => {
    setStep(1);
    setTechSearch('');
    setSelectedTechUserId(null);
    setSelectedSiteIds(new Set());
    setSiteSearch('');
    setUrgencyFilter('all');
    if (typeof onClose === 'function') onClose();
  };

  const technicians = useMemo(() => {
    return (Array.isArray(users) ? users : [])
      .filter((u) => u && u.role === 'technician' && !(u.disabledAt || u.disabled_at));
  }, [users]);

  const filteredTechnicians = useMemo(() => {
    const q = techSearch.trim().toLowerCase();
    if (!q) return technicians;
    return technicians.filter((u) => {
      const name = String(u.technicianName || u.technician_name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const zone = String(u.zone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || zone.includes(q);
    });
  }, [technicians, techSearch]);

  const selectedTech = useMemo(() => {
    return technicians.find((u) => String(u.id) === String(selectedTechUserId)) || null;
  }, [technicians, selectedTechUserId]);

  const techSites = useMemo(() => {
    if (!selectedTech) return [];
    const techName = String(selectedTech.technicianName || selectedTech.technician_name || '').trim();
    if (!techName) return [];

    const normTech = (v) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    const techKey = normTech(techName);

    return (Array.isArray(sites) ? sites : [])
      .filter((s) => s)
      .filter((s) => {
        const sTech = normTech(s.technician);
        return sTech && sTech === techKey;
      })
      .map((s) => {
        const regime = Number(s.regime) || 0;
        const nhEstimated = calculateEstimatedNH(s.nh2A, s.dateA, regime);
        const diffNHs = calculateDiffNHs(s.nh1DV, nhEstimated);
        const seuil = Number(s.seuil) > 0 ? Number(s.seuil) : 250;
        const epvDates = calculateEPVDates(regime, s.dateA, s.nh1DV, nhEstimated, seuil);

        const siteFiches = (Array.isArray(ficheHistory) ? ficheHistory : [])
          .filter((f) => f && String(f.siteId) === String(s.id))
          .filter((f) => {
            const st = String(f.status || '').trim().toLowerCase();
            return st !== 'annul' && st !== 'brouillon';
          });

        const totalFichesCount = siteFiches.length;
        const completedCount = siteFiches.filter((f) => {
          const st = String(f.status || '').trim().toLowerCase();
          return st === 'effectu' || st === 'termin';
        }).length;

        const epvNum = totalFichesCount + 1;
        const epvKey = `epv${epvNum}`;
        const nextEpvType = `EPV${epvNum}`;
        const nextEpvDate = epvDates[epvKey] || 'N/A';
        const nextEpvDays = getDaysUntil(nextEpvDate);

        const existingFichesForSite = siteFiches;
        const hasExistingFiche = existingFichesForSite.length > 0;

        const urgencyLevel = nextEpvDays === null ? 'normal' : nextEpvDays < 0 ? 'overdue' : nextEpvDays <= 7 ? 'critical' : nextEpvDays <= 30 ? 'soon' : 'normal';

        return {
          ...s,
          regime,
          nhEstimated,
          diffNHs,
          seuil,
          epvDates,
          nextEpvType,
          nextEpvDate,
          nextEpvDays,
          hasExistingFiche,
          existingFicheCount: existingFichesForSite.length,
          completedCount,
          urgencyLevel,
          isRetired: Boolean(s.retired),
        };
      })
      .sort((a, b) => {
        if (a.isRetired !== b.isRetired) return a.isRetired ? 1 : -1;
        const urgencyOrder = { overdue: 0, critical: 1, soon: 2, normal: 3 };
        const ua = urgencyOrder[a.urgencyLevel] ?? 3;
        const ub = urgencyOrder[b.urgencyLevel] ?? 3;
        if (ua !== ub) return ua - ub;
        const da = a.nextEpvDays === null ? 9999 : a.nextEpvDays;
        const db = b.nextEpvDays === null ? 9999 : b.nextEpvDays;
        return da - db;
      });
  }, [selectedTech, sites, ficheHistory]);

  const filteredSites = useMemo(() => {
    let list = techSites;
    if (urgencyFilter !== 'all') {
      list = list.filter((s) => s.urgencyLevel === urgencyFilter);
    }
    const q = siteSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const name = String(s.nameSite || '').toLowerCase();
        const idSite = String(s.idSite || '').toLowerCase();
        const gen = String(s.generateur || '').toLowerCase();
        return name.includes(q) || idSite.includes(q) || gen.includes(q);
      });
    }
    return list;
  }, [techSites, siteSearch, urgencyFilter]);

  const toggleSite = (siteId) => {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) { next.delete(siteId); } else { next.add(siteId); }
      return next;
    });
  };

  const toggleAllSites = () => {
    const eligible = filteredSites;
    if (selectedSiteIds.size === eligible.length && eligible.every((s) => selectedSiteIds.has(s.id))) {
      setSelectedSiteIds(new Set());
    } else {
      setSelectedSiteIds(new Set(eligible.map((s) => s.id)));
    }
  };

  const handleSelectTech = (techId) => {
    setSelectedTechUserId(techId);
    setSelectedSiteIds(new Set());
    setStep(2);
  };

  const handleGenerate = () => {
    const selectedSites = techSites.filter((s) => selectedSiteIds.has(s.id));
    if (selectedSites.length === 0) return;
    const items = selectedSites.map((s) => ({
      siteId: String(s.id),
      siteName: String(s.nameSite || '').trim(),
      technician: String(s.technician || '').trim(),
      plannedDate: String(s.nextEpvDate || '').slice(0, 10),
      epvType: String(s.nextEpvType || '').trim(),
    }));
    setStep(3);
    if (typeof onGenerate === 'function') {
      onGenerate(items);
    }
  };

  const urgencyBadge = (level, days) => {
    if (level === 'overdue') {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white">En retard ({days}j)</span>;
    }
    if (level === 'critical') {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-500 text-white">{days}j</span>;
    }
    if (level === 'soon') {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-900">{days}j</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">{days !== null ? `${days}j` : '-'}</span>;
  };

  if (!open) return null;

  const eligibleSites = filteredSites;
  const selectedCount = selectedSiteIds.size;

  return (
    <div className="fixed inset-0 bg-indigo-900/35 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:h-auto sm:max-w-5xl sm:max-h-[92vh] sm:rounded-xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package size={24} />
            Colis Kits Vidanges
          </h2>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className={`px-2 py-1 rounded font-semibold ${step === 1 ? 'bg-white text-indigo-700' : 'bg-white/20'}`}>1. Technicien</span>
              <ChevronRight size={16} />
              <span className={`px-2 py-1 rounded font-semibold ${step === 2 ? 'bg-white text-indigo-700' : 'bg-white/20'}`}>2. Sites</span>
              <ChevronRight size={16} />
              <span className={`px-2 py-1 rounded font-semibold ${step === 3 ? 'bg-white text-indigo-700' : 'bg-white/20'}`}>3. Generation</span>
            </div>
            <button onClick={handleClose} className="hover:bg-white/10 p-2 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <User size={20} className="text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-800">Selectionner un technicien</h3>
              </div>
              <p className="text-sm text-gray-600">Choisissez le technicien pour lequel vous souhaitez preparer les colis kits vidanges.</p>
            </div>

            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                placeholder="Rechercher par nom, email ou zone..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {filteredTechnicians.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <User size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-semibold">Aucun technicien trouve</p>
                <p className="text-sm mt-2">Aucun technicien actif ne correspond a votre recherche</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTechnicians.map((tech) => {
                  const techName = String(tech.technicianName || tech.technician_name || '').trim();
                  const techZone = String(tech.zone || '').trim();
                  const normTech = (v) =>
                    String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
                  const techKey = normTech(techName);
                  const siteCount = (Array.isArray(sites) ? sites : [])
                    .filter((s) => s && normTech(s.technician) === techKey).length;

                  return (
                    <button
                      key={tech.id}
                      onClick={() => handleSelectTech(tech.id)}
                      className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-gray-800 truncate">{techName || tech.email}</div>
                          {techName && <div className="text-xs text-gray-500 truncate">{tech.email}</div>}
                        </div>
                        <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{techZone || 'BZV/POOL'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">{siteCount} site{siteCount > 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={20} className="text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-800">
                  Sites de <span className="text-indigo-600">{selectedTech?.technicianName || selectedTech?.technician_name || selectedTech?.email}</span>
                </h3>
              </div>
              <p className="text-sm text-gray-600">Selectionnez les sites pour la generation des fiches et tickets. Tries par urgence de vidange.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={siteSearch}
                    onChange={(e) => setSiteSearch(e.target.value)}
                    placeholder="Rechercher par nom, ID site, generateur..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">Toutes urgences</option>
                    <option value="overdue">En retard</option>
                    <option value="critical">Critique (7j ou moins)</option>
                    <option value="soon">Bientot (30j ou moins)</option>
                    <option value="normal">Normal (plus de 30j)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <button onClick={toggleAllSites} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                {eligibleSites.length > 0 && selectedSiteIds.size === eligibleSites.length
                  ? 'Tout deselectionner'
                  : `Tout selectionner (${eligibleSites.length} eligible${eligibleSites.length > 1 ? 's' : ''})`}
              </button>
              <span className="text-sm text-gray-600">
                <strong>{selectedCount}</strong> site{selectedCount > 1 ? 's' : ''} selectionne{selectedCount > 1 ? 's' : ''}
              </span>
            </div>

            {filteredSites.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-semibold">Aucun site trouve</p>
                <p className="text-sm mt-2">Aucun site ne correspond aux filtres actuels</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSites.map((site) => {
                  const isSelected = selectedSiteIds.has(site.id);
                  return (
                    <div
                      key={site.id}
                      className={`border-2 rounded-lg p-3 transition-colors ${
                        isSelected ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer" onClick={(e) => { toggleSite(site.id); }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <div className="font-bold text-gray-800 truncate">{site.nameSite}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {site.idSite} - {site.generateur || '-'} - {site.capacite || '-'} kVA
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {urgencyBadge(site.urgencyLevel, site.nextEpvDays)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {site.nextEpvType}: {site.nextEpvDate && site.nextEpvDate !== 'N/A' ? formatDate(site.nextEpvDate) : 'N/A'}
                            </span>
                            <span>Regime: <strong>{site.regime}h/j</strong></span>
                            <span>NH diff: <strong>{Math.round(site.diffNHs)}</strong> / {site.seuil}</span>
                            {site.isRetired && (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-[10px] border border-red-200">
                                Retire pour le mois en cours
                              </span>
                            )}
                            {!site.isRetired && (
                              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px] border border-green-200">
                                Actif pour le mois en cours
                              </span>
                            )}
                            {site.hasExistingFiche && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px] border border-amber-200">
                                {site.existingFicheCount} fiche{site.existingFicheCount > 1 ? 's' : ''} deja generee{site.existingFicheCount > 1 ? 's' : ''} ({site.completedCount} effectuee{site.completedCount > 1 ? 's' : ''})
                              </span>
                            )}
                            {site.nextEpvDate === 'N/A' && (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-[10px] border border-red-200">
                                EPV{site.nextEpvType.replace('EPV', '')} non planifiable
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex items-center justify-between gap-3 mt-4">
              <button
                onClick={() => { setStep(1); setSelectedSiteIds(new Set()); }}
                className="px-4 py-2 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleGenerate}
                disabled={selectedCount === 0}
                className="px-6 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Package size={18} />
                Generer {selectedCount} fiche{selectedCount > 1 ? 's' : ''} + ticket{selectedCount > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {generating ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={48} className="animate-spin text-indigo-600 mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Generation en cours...</h3>
                <p className="text-sm text-gray-600 mt-2">Creation des fiches, tickets et interventions pour les techniciens.</p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={24} className="text-green-600" />
                    <h3 className="text-lg font-bold text-gray-800">Generation terminee</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {generateResult?.total || 0} fiche(s) generee(s) avec succes.
                    {generateResult?.errors?.length > 0 && ` ${generateResult.errors.length} erreur(s).`}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-700">{generateResult?.total || 0}</div>
                    <div className="text-sm text-green-600 font-semibold">Fiches generees</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-700">{generateResult?.errors?.length || 0}</div>
                    <div className="text-sm text-red-600 font-semibold">Erreurs</div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-indigo-700">{selectedCount}</div>
                    <div className="text-sm text-indigo-600 font-semibold">Sites selectionnes</div>
                  </div>
                </div>

                {generateResult?.fiches?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-bold text-gray-800 mb-3">Fiches creees</h4>
                    <div className="space-y-2">
                      {generateResult.fiches.map((fiche) => (
                        <div key={fiche.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-gray-800">{fiche.ticketNumber}</div>
                              <div className="text-sm text-gray-600 truncate">{fiche.siteName}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">
                                {fiche.epvType}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                En attente magasin
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Technicien: {fiche.technician} - Date prevue: {fiche.plannedDate ? formatDate(fiche.plannedDate) : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {generateResult?.errors?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                      <AlertTriangle size={18} />
                      Erreurs
                    </h4>
                    <div className="space-y-2">
                      {generateResult.errors.map((err, i) => (
                        <div key={i} className="border border-red-200 rounded-lg p-3 bg-red-50">
                          <div className="text-sm font-semibold text-red-800">Site: {err.siteId || '-'}</div>
                          <div className="text-xs text-red-600">{err.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => { setStep(1); setSelectedTechUserId(null); setSelectedSiteIds(new Set()); }}
                    className="px-4 py-2 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Nouvelle generation
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ColisKitsVidangesModal;
