import React from 'react';
import { X } from 'lucide-react';

const NhUpdateModal = ({
  open,
  nhModalSite,
  nhModalIntervention,
  nhForm,
  onChangeReadingDate,
  onChangeNhValue,
  onChangeReset,
  nhFormError,
  isAdmin,
  onClose,
  onCancel,
  onConfirm
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-800 text-white">
          <div className="font-bold">Mettre à jour le NH</div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-slate-900 p-2 rounded">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-gray-700">
            <div className="font-semibold text-gray-900">{nhModalSite?.nameSite || nhModalIntervention?.siteId || ''}</div>
            {nhModalSite?.idSite && <div className="text-xs text-gray-600">ID: {nhModalSite.idSite}</div>}
            <div className="text-xs text-gray-600">Saisir le compteur tel qu'affiché sur le générateur (DEEPSEA).</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Date du relevé</label>
              <input
                type="date"
                value={nhForm?.readingDate || ''}
                onChange={(e) => onChangeReadingDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">NH actuel</label>
              <input
                type="number"
                value={nhForm?.nhValue || ''}
                onChange={(e) => onChangeNhValue(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <input
              id="nh-reset"
              type="checkbox"
              checked={Boolean(nhForm?.reset)}
              onChange={(e) => onChangeReset(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="nh-reset" className="text-xs text-gray-700">
              Reset compteur (à cocher uniquement si le compteur a réellement été remis à zéro / remplacé).
            </label>
          </div>

          {nhFormError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {nhFormError}
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
            className={`bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

export default NhUpdateModal;
