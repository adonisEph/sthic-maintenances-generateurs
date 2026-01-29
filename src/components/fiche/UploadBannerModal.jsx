import React from 'react';

const UploadBannerModal = ({ open, handleBannerUpload, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">📤 Uploader la bannière</h2>
        </div>
        <p className="text-gray-600 mb-4">
          Sélectionnez l'image PNG contenant les logos Helios Towers et STHIC
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleBannerUpload}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
        />
        <button
          onClick={onCancel}
          className="w-full bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default UploadBannerModal;
