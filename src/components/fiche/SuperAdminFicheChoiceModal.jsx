import React from 'react';
import { X } from 'lucide-react';

const SuperAdminFicheChoiceModal = ({ open, onClose, onSendToWarehouse, onSelfCheck, busy, summary }) => {
  if (!open) return null;

  const isBusy = Boolean(busy);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b bg-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">📄 Fiches - Choisir le mode</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-200"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="text-sm text-gray-700">Que souhaites-tu faire ?</div>

          {summary && !isBusy && (
            <div className="mt-3 text-xs text-gray-600 border border-gray-200 rounded-lg p-3 bg-gray-50 whitespace-pre-line">
              {String(summary)}
            </div>
          )}

          {isBusy && (
            <div className="mt-3 text-sm text-gray-700 border border-gray-200 rounded-lg p-3 bg-gray-50 font-semibold">
              Vérification en cours…
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={onSendToWarehouse}
              disabled={isBusy}
              className="w-full bg-indigo-700 text-white py-3 rounded-lg hover:bg-indigo-800 font-bold disabled:bg-indigo-300"
            >
              Envoyer pour contrôle magasin
            </button>

            <button
              type="button"
              onClick={onSelfCheck}
              disabled={isBusy}
              className="w-full bg-emerald-700 text-white py-3 rounded-lg hover:bg-emerald-800 font-bold disabled:bg-emerald-300"
            >
              Faire le contrôle soi-même
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="w-full bg-gray-400 text-white py-2.5 rounded-lg hover:bg-gray-500 font-semibold disabled:bg-gray-300"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminFicheChoiceModal;
