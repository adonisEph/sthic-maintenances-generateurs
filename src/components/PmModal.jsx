import React from 'react';
import { TrendingUp, X, Upload, Download, Trash2, RotateCcw } from 'lucide-react';

const STHIC_LOGO_SRC = '/Logo_sthic.png';

const PmModal = (props) => {
  const {
    showPm,
    canUsePm,
    isViewer,
    isAdmin,
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
    pmError,
    pmNotice,
    pmClientProgress,
    pmClientStep,
    pmClientCompare,
    pmItems,
    pmImports,
    pmSearch,
    setPmSearch,
    pmFilterDate,
    setPmFilterDate,
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
    formatDate
  } = props;

  if (!showPm || !canUsePm) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-2">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-7xl sm:max-h-[98vh] sm:h-[98vh]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b border-gray-200 bg-white text-gray-900 shadow-sm">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp size={22} className="text-blue-600" />
            Maintenances planifiées (PM)
            {isViewer && (
              <span className="ml-2 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-semibold">
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
              className="hover:bg-gray-100 p-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row h-full min-h-0">
            <div className="lg:w-72 w-full flex-shrink-0 bg-slate-900 text-slate-100 border-b border-slate-800 lg:border-b-0 lg:border-r lg:border-slate-800 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-200/90 mb-2">Période</div>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-200/90 mb-1">Mois</label>
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
                      className="w-full bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 text-sm font-semibold"
                      disabled={pmBusy}
                    >
                      Rafraîchir
                    </button>

                    <button
                      type="button"
                      onClick={handlePmExportExcel}
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 text-sm font-semibold flex items-center justify-center gap-2"
                      disabled={pmBusy}
                    >
                      <Download size={16} />
                      Exporter Excel
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-200/90 mb-2">Exports</div>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-200/90 mb-1">Reprogrammations (jour)</label>
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
                      className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-900 text-sm font-semibold flex items-center justify-center gap-2"
                      disabled={pmBusy || exportBusy}
                    >
                      <Download size={16} />
                      Export reprogrammées
                    </button>
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-200/90 mb-2">Technicien</div>
                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-200/90 mb-1">Destinataire</label>
                        <select
                          value={pmSendTechUserId}
                          onChange={(e) => setPmSendTechUserId(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
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
                        className="w-full bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-400"
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
                        className="w-full bg-white border border-teal-200 text-teal-800 px-3 py-2 rounded-lg hover:bg-teal-50 text-sm font-semibold"
                        disabled={pmBusy}
                      >
                        Voir reprog rejetées
                      </button>

                      {(Array.isArray(users) ? users : []).filter((u) => u && u.role === 'technician').length === 0 && (
                        <div className="text-xs text-slate-200/80">
                          Aucun technicien trouvé.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-200/90 mb-2">Actions</div>
                    <div className="flex flex-col">
                      <label
                        className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800 cursor-pointer'
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
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800 cursor-pointer'
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
                        className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60 flex items-center gap-2"
                        disabled={pmBusy || pmResetBusy}
                      >
                        <Trash2 size={16} />
                        Suppr. imports
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePmReset('all')}
                        className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60 flex items-center gap-2"
                        disabled={pmBusy || pmResetBusy}
                      >
                        <RotateCcw size={16} />
                        Reset mois
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
              <div className="text-sm text-gray-700 mb-4">
                Tickets du mois: <span className="font-semibold">{Array.isArray(pmItems) ? pmItems.length : 0}</span>
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
                  setPmDetails({ open: true, title: 'Total', items: baseFiltered.slice() });
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
                  setPmDetails({ open: true, title: 'Closed Complete', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'closed') });
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
                  setPmDetails({ open: true, title: 'Work in progress', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'wip') });
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
                  setPmDetails({ open: true, title: 'Awaiting Closure', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'awaiting') });
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
                  setPmDetails({ open: true, title: 'Assigned', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'assigned') });
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
                      <div className={`text-[11px] font-semibold ${c.titleClassName || 'text-gray-700'}`}>{c.title}</div>
                      <div className={`text-2xl font-bold mt-1 ${c.valueClassName || 'text-gray-900'}`}>{c.value}</div>
                    </button>
                  ))}
                </div>

                {pmDetails?.open && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
                      <div className="flex justify-between items-center p-4 border-b bg-teal-800 text-white">
                        <div className="font-bold">Détails PM — {pmDetails?.title || ''}</div>
                        <button
                          type="button"
                          onClick={() => setPmDetails({ open: false, title: '', items: [] })}
                          className="hover:bg-teal-900 p-2 rounded"
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
                      <div className="flex justify-between items-center p-4 border-b bg-teal-800 text-white">
                        <div className="font-bold">Reprogrammations rejetées</div>
                        <button
                          type="button"
                          onClick={() => {
                            setPmRejectedModalOpen(false);
                            setPmRejectedDateFilter('');
                          }}
                          className="hover:bg-teal-900 p-2 rounded"
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
          </div>
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
  );
};

export default PmModal;
