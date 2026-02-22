import React from 'react';
import { TrendingUp, X, Download } from 'lucide-react';

const ScoringModal = ({
  open,
  isTechnician,
  isViewer,
  isAdmin,
  authUser,
  scoringZone,
  setScoringZone,
  showZoneFilter,
  scoringMonth,
  setScoringMonth,
  loadInterventions,
  sites,
  ficheHistory,
  interventions,
  scoringDetails,
  setScoringDetails,
  canExportExcel,
  handleExportScoringDetailsExcel,
  exportBusy,
  formatDate,
  onClose
}) => {
  if (!open || isTechnician) return null;

  const zones = ['ALL', 'BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
  const zoneActive = showZoneFilter && scoringZone && scoringZone !== 'ALL' ? String(scoringZone) : '';

  return (
    <div className="fixed inset-0 bg-indigo-900/35 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 text-white">
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
                onClose();
                setScoringDetails({ open: false, title: '', kind: '', items: [] });
              }}
              className="hover:bg-white/10 p-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="text-sm text-slate-700">Synthèse mensuelle (basée sur l'historique des fiches + interventions planifiées)</div>
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

              {showZoneFilter && (
                <>
                  <label className="text-xs text-gray-600">Zone</label>
                  <select
                    value={scoringZone}
                    onChange={(e) => {
                      setScoringZone(e.target.value);
                      setScoringDetails({ open: false, title: '', kind: '', items: [] });
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z === 'ALL' ? 'Toutes' : z}
                      </option>
                    ))}
                  </select>
                </>
              )}
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

            const doneInMonth = ficheHistory
              .filter((f) => f && f.status === 'Effectuée' && f.dateCompleted && isInMonth(f.dateCompleted, scoringMonth))
              .filter((f) => !zoneActive || String(f?.zone || '').trim() === zoneActive);
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
              .filter((i) => !zoneActive || String(i?.zone || '').trim() === zoneActive)
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
                className: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
                onClick: () => setScoringDetails({ open: true, title: 'Vidanges effectuées', kind: 'done', items: doneInMonth })
              },
              {
                key: 'remaining',
                title: 'Restantes',
                value: remainingInMonth.length,
                className: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
                onClick: () =>
                  setScoringDetails({ open: true, title: 'Interventions restantes (planifiées/envoyées)', kind: 'remaining', items: remainingInMonth })
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
                                  <div className="text-xs text-gray-600">
                                    {it.epvType} • {formatDate(it.plannedDate)} • {it.technicianName}
                                  </div>
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
                              <div className="text-xs text-gray-600 mt-1">
                                Statut: <span className="font-semibold">{it.status}</span>
                              </div>
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
                                  <div
                                    className={`text-xs px-2 py-1 rounded inline-block ${
                                      f.isWithinContract === true
                                        ? 'bg-green-100 text-green-800'
                                        : f.isWithinContract === false
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
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
              onClose();
              setScoringDetails({ open: false, title: '', kind: '', items: [] });
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

export default ScoringModal;
