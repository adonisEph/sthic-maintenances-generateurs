import React from 'react';
import { Download, X } from 'lucide-react';

const DayDetailsModal = ({
  open,
  selectedDate,
  selectedDayEvents,
  setSelectedDayEvents,
  isAdmin,
  canExportExcel,
  canGenerateFiche,
  exportBusy,
  handleExportSelectedDayExcel,
  startBatchFicheGeneration,
  formatDate,
  getDaysUntil,
  onClose
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gray-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Détails du jour</h2>
            <div className="text-sm text-gray-600">{selectedDate ? formatDate(selectedDate) : ''}</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {selectedDayEvents.length === 0 ? (
            <div className="text-gray-600">Aucune vidange planifiée ce jour.</div>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map((evt) => {
                const daysUntil = getDaysUntil(evt.date);
                const color =
                  daysUntil !== null && daysUntil <= 3
                    ? 'bg-red-500'
                    : daysUntil !== null && daysUntil <= 7
                      ? 'bg-orange-500'
                      : 'bg-green-500';
                const st = String(evt?.intervention?.status || '');
                const dot =
                  st === 'done'
                    ? 'bg-green-200'
                    : st === 'sent'
                      ? 'bg-blue-200'
                      : st === 'planned'
                        ? 'bg-amber-200'
                        : 'bg-gray-200';
                const moved = evt?.originalDate && String(evt.originalDate) !== String(evt.date);
                const daysLabel =
                  daysUntil === null
                    ? '-'
                    : daysUntil < 0
                      ? `RETARD ${Math.abs(daysUntil)}j`
                      : daysUntil === 0
                        ? "AUJOURD'HUI"
                        : `${daysUntil}j`;

                return (
                  <div key={`${evt.site.id}-${evt.type}`} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-800 whitespace-pre-line leading-tight break-words">
                          {evt.site.nameSite}
                        </div>
                        <div className="text-xs text-gray-600">
                          {evt.type} • {formatDate(evt.date)} • {evt.site.technician}
                          {moved && (
                            <span className="ml-2 text-[11px] bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                              Déplacée (origine: {formatDate(evt.originalDate)})
                            </span>
                          )}
                          {evt?.wasRetiredPrevMonth && (
                            <span className="ml-2 text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                              Retiré le mois passé
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs px-2 py-1 rounded inline-flex items-center gap-2 ${color} text-white`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                          {daysLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin ? (
          <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
            >
              Fermer
            </button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {canExportExcel && (
                <button
                  type="button"
                  onClick={handleExportSelectedDayExcel}
                  className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold disabled:bg-gray-400 flex items-center justify-center gap-2 w-full sm:w-auto"
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                >
                  Générer les fiches (batch)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onClose}
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
        )}
      </div>
    </div>
  );
};

export default DayDetailsModal;
