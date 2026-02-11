import React from 'react';
import { CheckCircle, CheckCircle2, Download, X } from 'lucide-react';
import CompleteInterventionModal from './CompleteInterventionModal';
import NhUpdateModal from './NhUpdateModal';

const InterventionsModal = ({
  open,
  isTechnician,
  isAdmin,
  isViewer,
  authUser,
  interventionsZone,
  setInterventionsZone,
  showZoneFilter,
  technicianUnseenSentCount,
  technicianSeenSentAt,
  setTechnicianSeenSentAt,
  interventions,
  setShowInterventions,
  interventionsBusy,
  interventionsError,
  setInterventionsError,
  users,
  sites,
  filteredSites,
  interventionsMonth,
  setInterventionsMonth,
  interventionsStatus,
  setInterventionsStatus,
  interventionsTechnicianUserId,
  setInterventionsTechnicianUserId,
  loadInterventions,
  canExportExcel,
  handleExportInterventionsExcel,
  exportBusy,
  planningAssignments,
  setPlanningAssignments,
  getInterventionKey,
  ymdShiftForWorkdays,
  interventionsPrevMonthRetiredSiteIds,
  interventionsPrevMonthKey,
  handlePlanIntervention,
  technicianInterventionsTab,
  setTechnicianInterventionsTab,
  showTechnicianInterventionsFilters,
  setShowTechnicianInterventionsFilters,
  handleCompleteIntervention,
  formatDate,
  completeModalOpen,
  setCompleteModalOpen,
  completeModalSite,
  setCompleteModalSite,
  completeModalIntervention,
  setCompleteModalIntervention,
  completeForm,
  setCompleteForm,
  completeFormError,
  setCompleteFormError,
  nhModalOpen,
  setNhModalOpen,
  nhModalSite,
  setNhModalSite,
  nhModalIntervention,
  setNhModalIntervention,
  nhForm,
  setNhForm,
  nhFormError,
  setNhFormError,
  apiFetchJson,
  loadData
}) => {
  if (!open) return null;

  const [pmAssignments, setPmAssignments] = React.useState([]);
  const [pmBusy, setPmBusy] = React.useState(false);
  const [pmError, setPmError] = React.useState('');

  const isManager = String(authUser?.role || '') === 'manager';
  const authZone = String(authUser?.zone || '').trim();

  const zones = ['ALL', 'BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
  const interventionsAll = Array.isArray(interventions) ? interventions : [];
  const zoneActive = showZoneFilter && interventionsZone && interventionsZone !== 'ALL' ? String(interventionsZone) : '';
  const interventionsScoped = zoneActive
    ? interventionsAll.filter((i) => String(i?.zone || '').trim() === zoneActive)
    : interventionsAll;

  React.useEffect(() => {
    if (!open) return;
    if (!isTechnician) return;
    if (typeof apiFetchJson !== 'function') return;
    (async () => {
      setPmError('');
      setPmBusy(true);
      try {
        const month = String(interventionsMonth || '').trim();
        const mm = month.match(/^\d{4}-\d{2}$/);
        if (!mm) {
          setPmAssignments([]);
          return;
        }
        const from = `${month}-01`;
        const to = `${month}-31`;
        const qs = new URLSearchParams({ from, to });
        const data = await apiFetchJson(`/api/pm-assignments?${qs.toString()}`, { method: 'GET' });
        setPmAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
      } catch (e) {
        setPmAssignments([]);
        setPmError(e?.message || 'Erreur serveur.');
      } finally {
        setPmBusy(false);
      }
    })();
  }, [open, isTechnician, apiFetchJson, interventionsMonth]);

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isTechnician ? 'p-0' : 'p-0 sm:p-4'}`}>
      <div
        className={`bg-white shadow-xl overflow-hidden flex flex-col w-full ${
          isTechnician
            ? 'h-[100svh] max-w-none max-h-none rounded-none'
            : 'h-[100svh] max-w-none max-h-[100svh] rounded-none sm:h-auto sm:max-w-5xl sm:max-h-[90vh] sm:rounded-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-3 py-3 sm:p-4 border-b bg-emerald-700 text-white">
          <div className="min-w-0 flex items-center gap-2">
            <CheckCircle size={24} className="flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 min-w-0">
                <span className="min-w-0 truncate">{isTechnician ? 'Mes interventions' : 'Interventions'}</span>
                {isTechnician && technicianUnseenSentCount > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                    {technicianUnseenSentCount}
                  </span>
                )}
                {isViewer && (
                  <span className="bg-white/15 text-white border border-white/20 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                    Lecture seule
                  </span>
                )}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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

                  const normalizePmType = (v) =>
                    String(v || '')
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .trim()
                      .toLowerCase()
                      .replace(/\s+/g, '');

                  const pmAll = (Array.isArray(pmAssignments) ? pmAssignments : [])
                    .filter(Boolean)
                    .filter((p) => {
                      if (!zoneActive) return true;
                      const z = String(p?.zone || '').trim();
                      return !z || z === zoneActive;
                    })
                    .filter((p) => {
                      const mt = normalizePmType(p?.maintenanceType);
                      return mt === 'fullpmwo' || mt === 'dgservice';
                    })
                    .map((p) => ({
                      plannedDate: String(p?.plannedDate || '').slice(0, 10)
                    }))
                    .filter((p) => p.plannedDate);

                  const vidToday = interventionsScoped.filter((i) => i.plannedDate === today);
                  const vidTomorrow = interventionsScoped.filter((i) => i.plannedDate === tomorrow);
                  const vidMonth = month
                    ? interventionsScoped.filter((i) => String(i?.plannedDate || '').slice(0, 7) === month)
                    : interventionsScoped;

                  const pmTodayCount = pmAll.filter((p) => p.plannedDate === today).length;
                  const pmTomorrowCount = pmAll.filter((p) => p.plannedDate === tomorrow).length;
                  const pmMonthCount = month
                    ? pmAll.filter((p) => String(p?.plannedDate || '').slice(0, 7) === month).length
                    : pmAll.length;

                  const todayCount = vidToday.length + pmTodayCount;
                  const tomorrowCount = vidTomorrow.length + pmTomorrowCount;
                  const tomorrowSentCount = vidTomorrow.filter((i) => i.status === 'sent').length;
                  const monthCount = vidMonth.length + pmMonthCount;

                  return (
                    <div className="grid grid-cols-3 gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => setTechnicianInterventionsTab('today')}
                        className={`${
                          technicianInterventionsTab === 'today'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-gray-800 border border-gray-300'
                        } px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                      >
                        Aujourd'hui ({todayCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTechnicianInterventionsTab('tomorrow')}
                        className={`${
                          technicianInterventionsTab === 'tomorrow'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-gray-800 border border-gray-300'
                        } px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                      >
                        Demain ({tomorrowCount}{tomorrowSentCount ? `/${tomorrowSentCount} envoyée(s)` : ''})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTechnicianInterventionsTab('month')}
                        className={`${
                          technicianInterventionsTab === 'month'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-gray-800 border border-gray-300'
                        } px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
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

                {(isAdmin || isManager) && (
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
                        .filter((u) => (isManager ? String(u?.zone || '').trim() === authZone : true))
                        .slice()
                        .sort((a, b) =>
                          String(a.technicianName || a.email || '').localeCompare(
                            String(b.technicianName || b.email || '')
                          )
                        )
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

                {showZoneFilter && (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600 mb-1">Zone</span>
                    <select
                      value={interventionsZone}
                      onChange={(e) => {
                        const next = e.target.value;
                        setInterventionsZone(next);
                        loadInterventions(interventionsMonth, interventionsStatus, interventionsTechnicianUserId);
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {zones.map((z) => (
                        <option key={z} value={z}>
                          {z === 'ALL' ? 'Toutes' : z}
                        </option>
                      ))}
                    </select>
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

          {(isAdmin || isManager) && (
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
                  .filter((u) => (isManager ? String(u?.zone || '').trim() === authZone : true))
                  .slice()
                  .sort((a, b) =>
                    String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || ''))
                  );

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

                const already = new Set(interventionsScoped.map((i) => getInterventionKey(i.siteId, i.plannedDate, i.epvType)));

                if (plannedEvents.length === 0) {
                  return <div className="text-sm text-gray-600">Aucun EPV trouvé sur ce mois.</div>;
                }

                return (
                  <div className="space-y-2">
                    {plannedEvents.map((ev) => (
                      <div
                        key={ev.key}
                        className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
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
                            <span className="text-xs bg-green-100 text-green-800 border border-green-200 px-2 py-1 rounded font-semibold">
                              Déjà planifiée
                            </span>
                          ) : (
                            (() => {
                              const selectedTechId =
                                planningAssignments?.[ev.key] || findTechUserIdByName(ev.technicianName) || '';

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
            const pad2 = (n) => String(n).padStart(2, '0');
            const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            const today = ymdLocal(new Date());
            const tomorrowD = new Date();
            tomorrowD.setDate(tomorrowD.getDate() + 1);
            const tomorrow = ymdLocal(tomorrowD);
            const month = String(interventionsMonth || '').trim();

            const siteById = new Map((Array.isArray(sites) ? sites : []).map((s) => [String(s.id), s]));

            const statusRank = (st) => {
              const s = String(st || '');
              if (s === 'sent') return 0;
              if (s === 'planned') return 1;
              if (s === 'done') return 2;
              return 3;
            };

            const list = interventionsScoped.slice();

            const pendingEpv23BySiteId = (() => {
              const s = new Set();
              list.forEach((i) => {
                if (!i) return;
                if (String(i?.kind || '') === 'PM') return;
                const st = String(i?.status || '');
                if (st === 'done') return;
                const t = String(i?.epvType || '').trim().toUpperCase();
                if (t !== 'EPV2' && t !== 'EPV3') return;
                const sid = String(i?.siteId || '').trim();
                if (sid) s.add(sid);
              });
              return s;
            })();

            const normalizePmType = (v) =>
              String(v || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '');

            const pmItems = (Array.isArray(pmAssignments) ? pmAssignments : [])
              .filter(Boolean)
              .filter((p) => {
                if (!zoneActive) return true;
                const z = String(p?.zone || '').trim();
                return !z || z === zoneActive;
              })
              .filter((p) => {
                const mt = normalizePmType(p?.maintenanceType);
                return mt === 'fullpmwo' || mt === 'dgservice';
              })
              .map((p) => {
                const mt = normalizePmType(p?.maintenanceType);
                return {
                  id: String(p?.id || `pm:${String(p?.pmNumber || '')}`),
                  kind: 'PM',
                  maintenanceType: mt,
                  pmNumber: String(p?.pmNumber || ''),
                  siteId: String(p?.siteId || ''),
                  plannedDate: String(p?.plannedDate || '').slice(0, 10),
                  status: String(p?.pmState || p?.status || ''),
                  scheduledWoDate: String(p?.scheduledWoDate || '').slice(0, 10),
                  reprogrammationDate: String(p?.reprogrammationDate || '').slice(0, 10),
                  closedAt: String(p?.closedAt || '').slice(0, 10)
                };
              })
              .filter((p) => p.siteId && p.plannedDate);

            const interventionKeySet = new Set(
              list.map((i) => `${String(i?.siteId || '')}|${String(i?.plannedDate || '').slice(0, 10)}|${String(i?.epvType || '')}`)
            );

            const findLinkedVidangeForPm = (p) => {
              if (!p || !p.siteId || !p.plannedDate) return null;
              if (p.maintenanceType !== 'fullpmwo') return null;
              const candidates = list
                .filter((i) => String(i?.epvType || '') === 'EPV1')
                .filter((i) => String(i?.siteId || '') === String(p.siteId))
                .filter((i) => i?.plannedDate);
              let best = null;
              let bestAbs = null;
              candidates.forEach((i) => {
                const diff = daysBetween(p.plannedDate, i.plannedDate);
                if (diff === null) return;
                const abs = Math.abs(diff);
                const ok = abs === 0 || (abs >= 2 && abs <= 6);
                if (!ok) return;
                if (bestAbs === null || abs < bestAbs) {
                  bestAbs = abs;
                  best = i;
                }
              });
              return best;
            };

            const pmSentLabel = (p) => {
              if (!p) return '';
              if (p.maintenanceType === 'dgservice') return 'Vidange Simple';
              if (p.maintenanceType !== 'fullpmwo') return 'PM';
              const linked = findLinkedVidangeForPm(p);
              if (linked) return 'PM+Vidange';
              return 'PM Simple';
            };

            const pmStatusDisplay = (p) => {
              const st = String(p?.status || '').trim().toUpperCase();
              if (
                st === 'EFFECTUEE' ||
                st === 'DONE' ||
                st === 'CLOSED' ||
                st === 'CLOSED COMPLETE' ||
                st === 'CLOSED_COMPLETE' ||
                st === 'CLOSEDCOMPLETE' ||
                st === 'AWAITING CLOSURE' ||
                st === 'AWAITING_CLOSURE'
              ) {
                return { label: 'EFFECTUEE', date: p.closedAt || p.plannedDate };
              }
              if (st === 'REPROGRAMMEE' || st === 'REPROGRAMMED') {
                return { label: 'REPROGRAMMEE', date: p.reprogrammationDate || p.plannedDate };
              }
              if (st === 'ASSIGNED' || st === 'SENT' || st === 'PLANNED') {
                return { label: 'ASSIGNED', date: p.scheduledWoDate || p.plannedDate };
              }
              return { label: st || 'ASSIGNED', date: p.plannedDate };
            };

            const isPmDone = (p) => {
              const st = String(p?.status || '').trim().toUpperCase();
              return (
                st === 'EFFECTUEE' ||
                st === 'DONE' ||
                st === 'CLOSED' ||
                st === 'CLOSED COMPLETE' ||
                st === 'CLOSED_COMPLETE' ||
                st === 'CLOSEDCOMPLETE' ||
                st === 'AWAITING CLOSURE' ||
                st === 'AWAITING_CLOSURE'
              );
            };

            const isPmReprogrammed = (p) => {
              const st = String(p?.status || '').trim().toUpperCase();
              return st === 'REPROGRAMMEE' || st === 'REPROGRAMMED';
            };

            const ymdToDate = (ymd) => {
              const s = String(ymd || '').slice(0, 10);
              const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (!m) return null;
              return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
            };

            const daysBetween = (aYmd, bYmd) => {
              const a = ymdToDate(aYmd);
              const b = ymdToDate(bYmd);
              if (!a || !b) return null;
              const ms = b.getTime() - a.getTime();
              return Math.round(ms / (24 * 60 * 60 * 1000));
            };

            const monthItems = month
              ? list.filter((i) => String(i?.plannedDate || '').slice(0, 7) === month)
              : list;

            const vidangesFiltered =
              technicianInterventionsTab === 'today'
                ? list.filter((i) => i.plannedDate === today)
                : technicianInterventionsTab === 'tomorrow'
                  ? list.filter((i) => i.plannedDate === tomorrow)
                  : monthItems;

            const pmFiltered =
              technicianInterventionsTab === 'today'
                ? pmItems.filter((p) => p.plannedDate === today)
                : technicianInterventionsTab === 'tomorrow'
                  ? pmItems.filter((p) => p.plannedDate === tomorrow)
                  : month
                    ? pmItems.filter((p) => String(p?.plannedDate || '').slice(0, 7) === month)
                    : pmItems;

            const pmFilteredByStatus = (() => {
              const f = String(interventionsStatus || 'all');
              if (!f || f === 'all') return pmFiltered;
              if (f === 'done') return pmFiltered.filter((p) => isPmDone(p));
              if (f === 'sent') return pmFiltered.filter((p) => String(p?.status || '').trim().toUpperCase() === 'SENT');
              if (f === 'planned') return pmFiltered.filter((p) => !isPmDone(p) && String(p?.status || '').trim().toUpperCase() !== 'SENT');
              return pmFiltered;
            })();

            const items = [...pmFilteredByStatus, ...vidangesFiltered]
              .slice()
              .sort((a, b) => {
                const isDone = (x) => {
                  if (!x) return false;
                  if (String(x?.kind || '') === 'PM') {
                    return isPmDone(x);
                  }
                  return String(x?.status || '') === 'done';
                };

                if (technicianInterventionsTab === 'month') {
                  const da = isDone(a) ? 1 : 0;
                  const db = isDone(b) ? 1 : 0;
                  if (da !== db) return da - db;
                }
                const da = String(a?.plannedDate || '');
                const db = String(b?.plannedDate || '');
                const c = da.localeCompare(db);
                if (c !== 0) return c;
                const ra = statusRank(a?.status);
                const rb = statusRank(b?.status);
                if (ra !== rb) return ra - rb;
                return String(a?.siteId || '').localeCompare(String(b?.siteId || ''));
              });

            const renderItem = (it) => {
              const isPm = String(it?.kind || '') === 'PM';
              const site = siteById.get(String(it?.siteId || '')) || null;

              if (isPm) {
                const info = pmStatusDisplay(it);
                const label = pmSentLabel(it);
                const pmDone = isPmDone(it);
                const pmReprog = isPmReprogrammed(it);
                const linkedVidange = findLinkedVidangeForPm(it);
                const linkedVidangeOverdue =
                  linkedVidange &&
                  String(linkedVidange?.status || '') !== 'done' &&
                  String(linkedVidange?.plannedDate || '').slice(0, 10) < today;
                const focusVidange = Boolean(linkedVidangeOverdue) || pendingEpv23BySiteId.has(String(it?.siteId || '').trim());
                const focusPm = Boolean(linkedVidange) && !focusVidange;
                return (
                  <div
                    key={it.id}
                    className={`border rounded-lg p-3 relative ${
                      pmDone ? 'border-green-200 bg-green-50' : pmReprog ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
                    }`}
                  >
                    {pmDone && (
                      <div className="absolute top-2 right-2 text-green-700" title="Effectuée">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-extrabold px-2 py-1 rounded border ${
                              pmDone
                                ? 'bg-green-100 text-green-900 border-green-200'
                                : pmReprog
                                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            PM
                          </span>
                          <div className="font-semibold text-gray-800 truncate">
                            {site?.nameSite || it.siteId}
                            {it?.maintenanceType === 'fullpmwo' ? ' - FullPMWO' : it?.maintenanceType === 'dgservice' ? ' - DG-Service' : ''}
                          </div>
                        </div>
                        {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                        <div className="text-xs text-gray-600 mt-1">
                          Statut : {info.label} - {formatDate(info.date)}
                        </div>
                        {pmReprog && it?.reprogrammationDate && (
                          <div className="text-xs text-amber-900 mt-1 font-semibold">
                            Nouvelle date : {formatDate(it.reprogrammationDate)}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 rounded border font-semibold bg-slate-50 text-slate-800 border-slate-200">
                            Ticket: {String(it?.pmNumber || '').trim() ? `#${String(it.pmNumber).trim()}` : '-'}
                          </span>
                          {label ? (
                            <span className="text-xs px-2 py-1 rounded border font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
                              sent • {label}
                            </span>
                          ) : null}
                        </div>

                        {focusPm && isTechnician && site && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const offset = Number(site?.nhOffset || 0);
                                const raw = Math.max(0, Number(site?.nh2A || 0) - offset);
                                setNhModalIntervention(linkedVidange);
                                setNhModalSite(site);
                                setNhForm({ nhValue: String(Math.trunc(raw)), readingDate: today });
                                setNhFormError('');
                                setNhModalOpen(true);
                              }}
                              className="bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm"
                            >
                              Mettre à jour NH
                            </button>
                            {String(linkedVidange?.status || '') !== 'done' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompleteModalIntervention(linkedVidange);
                                  setCompleteModalSite(site);
                                  setCompleteForm({ nhNow: String(site?.nhEstimated ?? ''), doneDate: today });
                                  setCompleteFormError('');
                                  setCompleteModalOpen(true);
                                }}
                                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 font-semibold text-sm"
                              >
                                Marquer effectuée
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              const st = String(it?.status || '');
              const isOverdue = st !== 'done' && String(it?.plannedDate || '') < today;

              const linkedPm = pmItems.find((p) => {
                if (!p || p.maintenanceType !== 'fullpmwo') return false;
                const link = findLinkedVidangeForPm(p);
                return link && String(link?.id) === String(it?.id);
              });
              const movedToPm = Boolean(linkedPm);
              const siteId = String(it?.siteId || '').trim();
              const focusVidange = Boolean(isOverdue) || pendingEpv23BySiteId.has(siteId);

              if (movedToPm && !focusVidange) return null;
              const statusColor =
                st === 'done'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : st === 'sent'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200';

              const cardTone =
                st === 'done'
                  ? 'border-green-200 bg-green-50'
                  : st === 'sent'
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200';

              return (
                <div key={it.id} className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${cardTone}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        VIDANGES
                      </span>
                      <div className="font-semibold text-gray-800 truncate">{site?.nameSite || it.siteId}</div>
                    </div>
                    {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                    <div className="text-xs text-gray-600">
                      {it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>{st}</span>
                    {isOverdue && (
                      <span className="text-xs px-2 py-1 rounded border font-semibold bg-red-50 text-red-800 border-red-200">
                        RETARD
                      </span>
                    )}
                    {(() => {
                      if (!focusVidange && movedToPm) return null;
                      return (
                        isTechnician && site && (
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
                        )
                      );
                    })()}
                    {(() => {
                      if (!focusVidange && movedToPm) return null;
                      return (
                        st !== 'done' && (isAdmin || isTechnician) && (
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
                        )
                      );
                    })()}
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-3">
                {pmError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                    {pmError}
                  </div>
                )}
                {pmBusy && (
                  <div className="text-xs text-gray-600">Chargement PM…</div>
                )}
                {items.length === 0 ? (
                  <div className="text-sm text-gray-600">Aucune intervention.</div>
                ) : (
                  (() => {
                    if (technicianInterventionsTab !== 'month') {
                      return <div className="space-y-2">{items.map((it) => renderItem(it))}</div>;
                    }

                    const out = [];
                    let lastDate = '';
                    items.forEach((it) => {
                      const d = String(it?.plannedDate || '').slice(0, 10);
                      const el = renderItem(it);
                      if (!el) return;
                      if (d && d !== lastDate) {
                        lastDate = d;
                        out.push(
                          <div
                            key={`h:${d}`}
                            className="mt-4 mb-2 text-sm font-extrabold text-slate-800 bg-slate-100 border border-slate-200 px-4 py-3 rounded-lg"
                          >
                            {formatDate(d)}
                          </div>
                        );
                      }
                      out.push(el);
                    });
                    return <div className="space-y-2">{out}</div>;
                  })()
                )}
              </div>
            );
          })()}
          <CompleteInterventionModal
            open={completeModalOpen}
            completeModalSite={completeModalSite}
            completeModalIntervention={completeModalIntervention}
            formatDate={formatDate}
            completeForm={completeForm}
            onChangeDoneDate={(v) => {
              setCompleteForm((prev) => ({ ...(prev || {}), doneDate: v }));
              setCompleteFormError('');
            }}
            onChangeNhNow={(v) => {
              setCompleteForm((prev) => ({ ...(prev || {}), nhNow: v }));
              setCompleteFormError('');
            }}
            completeFormError={completeFormError}
            isAdmin={isAdmin}
            onClose={() => {
              setCompleteModalOpen(false);
              setCompleteModalIntervention(null);
              setCompleteModalSite(null);
              setCompleteForm({ nhNow: '', doneDate: '' });
              setCompleteFormError('');
            }}
            onCancel={() => {
              setCompleteModalOpen(false);
              setCompleteModalIntervention(null);
              setCompleteModalSite(null);
              setCompleteForm({ nhNow: '', doneDate: '' });
              setCompleteFormError('');
            }}
            onConfirm={async () => {
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
          />

          <NhUpdateModal
            open={nhModalOpen}
            nhModalSite={nhModalSite}
            nhModalIntervention={nhModalIntervention}
            nhForm={nhForm}
            onChangeReadingDate={(v) => {
              setNhForm((prev) => ({ ...(prev || {}), readingDate: v }));
              setNhFormError('');
            }}
            onChangeNhValue={(v) => {
              setNhForm((prev) => ({ ...(prev || {}), nhValue: v }));
              setNhFormError('');
            }}
            nhFormError={nhFormError}
            isAdmin={isAdmin}
            onClose={() => {
              setNhModalOpen(false);
              setNhModalIntervention(null);
              setNhModalSite(null);
              setNhForm({ nhValue: '', readingDate: '' });
              setNhFormError('');
            }}
            onCancel={() => {
              setNhModalOpen(false);
              setNhModalIntervention(null);
              setNhModalSite(null);
              setNhForm({ nhValue: '', readingDate: '' });
              setNhFormError('');
            }}
            onConfirm={async () => {
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
          />
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
  );
};

export default InterventionsModal;
