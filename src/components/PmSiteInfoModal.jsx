import React from 'react';
import { X } from 'lucide-react';

const PmSiteInfoModal = ({
  open,
  busy,
  error,
  site,
  item,
  formatDate,
  onClose,
  onTriggerFiche,
  canTriggerFiche
}) => {
  if (!open) return null;

  const scheduled = item?.scheduledWoDate ? String(item.scheduledWoDate).slice(0, 10) : '';
  const ticket = item?.number ? String(item.number).trim() : '';
  const type = item?.maintenanceType ? String(item.maintenanceType).trim() : '';
  const state = item?.state ? String(item.state).trim() : '';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900">Voir date PM</div>
            <div className="text-sm text-gray-600 truncate">{site?.nameSite || site?.idSite || ''}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-gray-100 p-2 rounded"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {busy ? (
          <div className="text-sm text-gray-600">Chargement…</div>
        ) : error ? (
          <div className="text-sm text-red-700 font-semibold">{error}</div>
        ) : !item ? (
          <div className="text-sm text-gray-700">Aucune PM trouvée pour ce site (FullPMWO / DG Service) sur le mois sélectionné.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">Scheduled WO Date (Date planifiée)</div>
              <div className="font-bold text-gray-900 mt-1">{formatDate ? formatDate(scheduled) : scheduled || '-'}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">Ticket</div>
              <div className="font-bold text-gray-900 mt-1">{ticket || '-'}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">Type</div>
              <div className="font-bold text-gray-900 mt-1">{type || '-'}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">État</div>
              <div className="font-bold text-gray-900 mt-1">{state || '-'}</div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          {canTriggerFiche && (
            <button
              type="button"
              onClick={onTriggerFiche}
              disabled={busy || !item}
              className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-60"
            >
              Déclencher la fiche
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PmSiteInfoModal;
