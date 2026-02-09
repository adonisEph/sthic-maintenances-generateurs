import React from 'react';
import { CheckCircle, Download, X } from 'lucide-react';
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

  const isManager = String(authUser?.role || '') === 'manager';
  const authZone = String(authUser?.zone || '').trim();

  const zones = ['ALL', 'BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
  const interventionsAll = Array.isArray(interventions) ? interventions : [];
  const zoneActive = showZoneFilter && interventionsZone && interventionsZone !== 'ALL' ? String(interventionsZone) : '';
  const interventionsScoped = zoneActive
    ? interventionsAll.filter((i) => String(i?.zone || '').trim() === zoneActive)
    : interventionsAll;

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

                  const todayCount = interventionsScoped.filter((i) => i.plannedDate === today && i.status !== 'done').length;
                  const tomorrowRaw = interventionsScoped.filter((i) => i.plannedDate === tomorrow && i.status !== 'done');
                  const tomorrowCount = tomorrowRaw.length;
                  const tomorrowSentCount = tomorrowRaw.filter((i) => i.status === 'sent').length;
                  const monthCount = month
                    ? interventionsScoped.filter((i) => String(i?.plannedDate || '').slice(0, 7) === month && i.status !== 'done').length
                    : interventionsScoped.filter((i) => i.status !== 'done').length;

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
            const siteById = new Map(sites.map((s) => [String(s.id), s]));
            const list = interventionsScoped
              .slice()
              .sort((a, b) => String(a.plannedDate || '').localeCompare(String(b.plannedDate || '')));

            if (isAdmin) {
              const filtered =
                interventionsTechnicianUserId && interventionsTechnicianUserId !== 'all'
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
                        <div className="font-semibold text-gray-800 mb-2">
                          {g.title} ({g.items.length})
                        </div>
                        {g.items.length === 0 ? (
                          <div className="text-sm text-gray-600">Aucune intervention.</div>
                        ) : (
                          <div className="space-y-2">
                            {g.items.map((it) => {
                              const site = siteById.get(String(it.siteId)) || null;
                              const statusColor =
                                it.status === 'done'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : it.status === 'sent'
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200';
                              const wasRetiredPrevMonth = Boolean(
                                interventionsPrevMonthRetiredSiteIds.has(String(it.siteId)) &&
                                  String(interventionsMonth || '').trim() &&
                                  String(it?.plannedDate || '').slice(0, 7) === String(interventionsMonth || '').trim()
                              );
                              return (
                                <div
                                  key={it.id}
                                  className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="font-semibold text-gray-800 truncate">{site?.nameSite || it.siteId}</div>
                                    {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                                    <div className="text-xs text-gray-600">
                                      {it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}
                                    </div>
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
              const statusColor =
                it.status === 'done'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : it.status === 'sent'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200';
              const wasRetiredPrevMonth = Boolean(
                interventionsPrevMonthRetiredSiteIds.has(String(it.siteId)) &&
                  String(interventionsMonth || '').trim() &&
                  String(it?.plannedDate || '').slice(0, 7) === String(interventionsMonth || '').trim()
              );

              const canCatchUpInMonth = Boolean(
                isTechnician && technicianInterventionsTab === 'month' && String(it?.plannedDate || '')
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
                    <div className="text-xs text-gray-600">
                      {it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}
                    </div>
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
                    {it.status !== 'done' &&
                      (isAdmin || (isTechnician && (technicianInterventionsTab !== 'month' || canCatchUpInMonth))) && (
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
                          <div className="font-semibold text-gray-800 mb-2">
                            {formatDate(d)} ({byDate.get(d).length})
                          </div>
                          <div className="space-y-2">{byDate.get(d).map((it) => renderItem(it))}</div>
                        </div>
                      ))
                    )}
                  </div>
                );
              }

              const selectedKey = technicianInterventionsTab === 'today' ? 'today' : 'tomorrow';
              const selected = selectedKey === 'today' ? todayItems : tomorrowItems;
              const title =
                selectedKey === 'today'
                  ? "Aujourd'hui"
                  : `Demain (${tomorrowItems.length} dont ${tomorrowSentCount} envoyée(s))`;
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
