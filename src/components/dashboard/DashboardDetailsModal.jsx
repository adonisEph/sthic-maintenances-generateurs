import React from 'react';
import { Download, X } from 'lucide-react';

const DashboardDetailsModal = ({
  open,
  title,
  kind,
  items,
  isAdmin,
  canExportExcel,
  exportBusy,
  onClose,
  onExportExcel,
  formatDate
}) => {
  if (!open) return null;

  const list = Array.isArray(items) ? items : [];
  const isContractKind = kind === 'contract_ok' || kind === 'contract_over' || kind === 'done';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {list.length === 0 ? (
            <div className="text-gray-600">Aucun élément pour ce mois.</div>
          ) : isContractKind ? (
            <div className="space-y-3">
              {list.map((f) => (
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
              {list.map((ev) => (
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

        {isAdmin ? (
          <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
            >
              Fermer
            </button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {canExportExcel && list.length > 0 && (
                <button
                  type="button"
                  onClick={onExportExcel}
                  className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold flex items-center justify-center gap-2 w-full sm:w-auto"
                  disabled={exportBusy}
                >
                  <Download size={18} />
                  Exporter Excel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative p-4 border-t bg-white flex flex-col sm:flex-row gap-3 sm:justify-end">
            {canExportExcel && list.length > 0 && (
              <button
                type="button"
                onClick={onExportExcel}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold flex items-center justify-center gap-2 w-full sm:w-auto"
                disabled={exportBusy}
              >
                <Download size={18} />
                Exporter Excel
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardDetailsModal;
