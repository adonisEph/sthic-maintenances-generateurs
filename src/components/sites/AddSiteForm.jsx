import React from 'react';
import { X } from 'lucide-react';

const AddSiteForm = ({ formData, setFormData, onSubmit, onClose, onCancel }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">Ajouter un Nouveau Site</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <input
          type="text"
          placeholder="ID Site (ex: CBBZ0057)"
          value={formData.idSite}
          onChange={(e) => setFormData({ ...formData, idSite: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="text"
          placeholder="Nom du Site"
          value={formData.nameSite}
          onChange={(e) => setFormData({ ...formData, nameSite: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="text"
          placeholder="Technicien"
          value={formData.technician}
          onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="text"
          placeholder="Generateur (ex: ELCOS)"
          value={formData.generateur}
          onChange={(e) => setFormData({ ...formData, generateur: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="text"
          placeholder="Capacité (ex: 30 KVA)"
          value={formData.capacite}
          onChange={(e) => setFormData({ ...formData, capacite: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="text"
          placeholder="Kit Vidange"
          value={formData.kitVidange}
          onChange={(e) => setFormData({ ...formData, kitVidange: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base col-span-1 sm:col-span-2 lg:col-span-3"
        />
        <input
          type="number"
          placeholder="NH1 DV"
          value={formData.nh1DV}
          onChange={(e) => setFormData({ ...formData, nh1DV: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="date"
          value={formData.dateDV}
          onChange={(e) => setFormData({ ...formData, dateDV: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
        />
        <input
          type="number"
          placeholder="NH2 A"
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
            id="retired-add"
            checked={formData.retired}
            onChange={(e) => setFormData({ ...formData, retired: e.target.checked })}
            className="w-4 h-4"
          />
          <label htmlFor="retired-add" className="text-sm sm:text-base cursor-pointer">Site Retiré</label>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
        <button
          onClick={onSubmit}
          className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
        >
          Ajouter
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

export default AddSiteForm;
