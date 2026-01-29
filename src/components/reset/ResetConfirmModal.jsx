import React from 'react';
import { AlertCircle } from 'lucide-react';

const ResetConfirmModal = ({ open, onResetVidanges, onResetAll, onSetNextTicket, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-600" size={32} />
            <h2 className="text-xl font-bold text-gray-800">⚠️ ATTENTION</h2>
          </div>
        </div>
        <p className="text-gray-700 mb-6">
          Choisissez ce que vous souhaitez réinitialiser. Cette action est <strong>irréversible</strong>.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onResetVidanges}
            className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold w-full"
          >
            Réinitialiser Vidanges (PM conservé)
          </button>

          <button
            onClick={onResetAll}
            className="bg-red-800 text-white px-4 py-3 rounded-lg hover:bg-red-900 font-semibold w-full"
          >
            Tout supprimer (incluant PM)
          </button>

          <button
            onClick={onSetNextTicket}
            className="bg-slate-700 text-white px-4 py-3 rounded-lg hover:bg-slate-800 font-semibold w-full"
          >
            Définir le prochain ticket
          </button>

          <button
            onClick={onCancel}
            className="bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold w-full"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetConfirmModal;
