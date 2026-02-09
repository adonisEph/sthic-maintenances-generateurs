import React from 'react';
import { Activity, X } from 'lucide-react';

const HistoryModal = ({
  open,
  onClose,
  historyQuery,
  setHistoryQuery,
  historyDateFrom,
  setHistoryDateFrom,
  historyDateTo,
  setHistoryDateTo,
  historyStatus,
  setHistoryStatus,
  historySort,
  setHistorySort,
  historyZone,
  setHistoryZone,
  showZoneFilter,
  ficheHistory,
  filteredFicheHistory,
  canMarkCompleted,
  handleMarkAsCompleted,
  isViewer,
  isAdmin,
  formatDate
}) => {
  if (!open) return null;

  const zones = ['ALL', 'BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
  const listAll = Array.isArray(filteredFicheHistory) ? filteredFicheHistory : [];
  const list =
    showZoneFilter && historyZone && historyZone !== 'ALL'
      ? listAll.filter((f) => String(f?.zone || '').trim() === String(historyZone))
      : listAll;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:rounded-lg">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-amber-600 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity size={24} />
            Historique des Fiches d'Intervention
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-amber-700 p-2 rounded">
              <X size={20} />
            </button>
          </div>
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

            {showZoneFilter && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs text-gray-600">Zone</span>
                <select
                  value={historyZone}
                  onChange={(e) => setHistoryZone(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-auto"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z === 'ALL' ? 'Toutes' : z}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-xs text-gray-600 mt-3 flex justify-between">
              <span>
                Résultats: <strong>{list.length}</strong>
              </span>
              <button
                onClick={() => {
                  setHistoryQuery('');
                  setHistoryDateFrom('');
                  setHistoryDateTo('');
                  setHistoryStatus('all');
                  setHistorySort('newest');
                  if (showZoneFilter) setHistoryZone('ALL');
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
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-semibold">Aucun résultat</p>
              <p className="text-sm mt-2">Aucune fiche ne correspond aux filtres actuels</p>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((fiche) => (
                <div
                  key={fiche.id}
                  className={`border-2 rounded-lg p-4 ${fiche.status === 'Effectuée' ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg text-gray-800 truncate">{fiche.ticketNumber}</h3>
                      <p className="text-sm text-gray-600 truncate">{fiche.siteName}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold self-start ${fiche.status === 'Effectuée' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}
                    >
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

        <div className="p-3 border-t bg-white" />
      </div>
    </div>
  );
};

export default HistoryModal;
