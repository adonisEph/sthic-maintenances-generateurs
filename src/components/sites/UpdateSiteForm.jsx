import React from 'react';
import { X } from 'lucide-react';

const UpdateSiteForm = ({ selectedSite, formData, setFormData, onSubmit, onClose, onCancel }) => {
  if (!selectedSite) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">MAJ - {selectedSite.nameSite}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <input
          type="number"
          placeholder="NH2 A (nouveau)"
          value={formData.nh2A}
          onChange={(e) => setFormData({ ...formData, nh2A: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="date"
          value={formData.dateA}
          onChange={(e) => setFormData({ ...formData, dateA: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 sm:px-4 py-2">
          <input
            type="checkbox"
            id="retired-update"
            checked={formData.retired}
            onChange={(e) => setFormData({ ...formData, retired: e.target.checked })}
            className="w-4 h-4"
          />
          <label htmlFor="retired-update" className="text-sm sm:text-base cursor-pointer">Site Retiré</label>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
        <button
          onClick={onSubmit}
          className="bg-green-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-green-700 text-sm sm:text-base"
        >
          Mettre à jour
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-400 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-500 text-sm sm:text-base"
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default UpdateSiteForm;
