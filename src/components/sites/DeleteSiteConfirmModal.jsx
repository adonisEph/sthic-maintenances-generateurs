import React from 'react';
import { AlertCircle } from 'lucide-react';

const DeleteSiteConfirmModal = ({ site, isAdmin, onConfirm, onCancel }) => {
  if (!site) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-600" size={32} />
            <h2 className="text-xl font-bold text-gray-800">⚠️ Confirmer la suppression</h2>
          </div>
        </div>
        <p className="text-gray-700 mb-4">
          Êtes-vous sûr de vouloir supprimer le site <strong>{site.nameSite}</strong> ?
        </p>
        <p className="text-sm text-gray-600 mb-6">
          Cette action est <strong>irréversible</strong>. Toutes les données du site seront perdues.
        </p>
        <div className={isAdmin ? 'flex flex-col sm:flex-row sm:justify-between gap-3' : 'flex gap-3'}>
          <button
            onClick={onConfirm}
            className={
              isAdmin
                ? 'bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold w-full sm:w-auto'
                : 'flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-semibold'
            }
          >
            Oui, supprimer
          </button>
          <button
            onClick={onCancel}
            className={
              isAdmin
                ? 'bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto'
                : 'flex-1 bg-gray-300 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-400 font-semibold'
            }
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSiteConfirmModal;
