import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const NhUpdateModal = ({
  open,
  nhModalSite,
  nhModalIntervention,
  nhForm,
  onChangeReadingDate,
  onChangeNhValue,
  nhFormError,
  quarantineInfo,
  onOpenQuarantine,
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

          <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            Si le compteur/deepsea a été remplacé (NH inférieur à NH1 DV), la valeur sera mise en
            quarantaine — un rebase pourra y être confirmé.
          </div>

          {nhFormError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {nhFormError}
            </div>
          )}

          {quarantineInfo && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Valeur mise en quarantaine</div>
                  <div className="text-xs mt-0.5">{quarantineInfo.message}</div>
                  {onOpenQuarantine && (
                    <button
                      type="button"
                      onClick={onOpenQuarantine}
                      className="mt-2 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-700"
                    >
                      Ouvrir le centre de quarantaine
                    </button>
                  )}
                </div>
              </div>
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
