import React from 'react';
import { X } from 'lucide-react';

const CompleteInterventionModal = ({
  open,
  completeModalSite,
  completeModalIntervention,
  formatDate,
  completeForm,
  onChangeDoneDate,
  onChangeNhNow,
  completeFormError,
  isAdmin,
  onClose,
  onCancel,
  onConfirm
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-indigo-700 text-white">
          <div className="font-bold">Valider l'intervention</div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-indigo-800 p-2 rounded">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-gray-700">
            <div className="font-semibold text-gray-900">{completeModalSite?.nameSite || completeModalIntervention?.siteId || ''}</div>
            {completeModalSite?.idSite && <div className="text-xs text-gray-600">ID: {completeModalSite.idSite}</div>}
            <div className="text-xs text-gray-600">
              {completeModalIntervention?.epvType} • {formatDate ? formatDate(completeModalIntervention?.plannedDate) : (completeModalIntervention?.plannedDate || '')}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Date de vidange</label>
              <input
                type="date"
                value={completeForm?.doneDate || ''}
                onChange={(e) => onChangeDoneDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Compteur (NH) relevé</label>
              <input
                type="number"
                value={completeForm?.nhNow || ''}
                onChange={(e) => onChangeNhNow(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {completeFormError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {completeFormError}
            </div>
          )}
        </div>
        <div className={`p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2' : 'flex justify-end gap-2'}`}>
          <button
            onClick={onCancel}
            className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteInterventionModal;
