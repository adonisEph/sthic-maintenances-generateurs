import React from 'react';
import { Filter } from 'lucide-react';

const SitesTechnicianFilter = ({ isTechnician, filterTechnician, onChange, technicians }) => {
  if (isTechnician) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <Filter size={18} className="text-gray-600" />
      <select
        value={filterTechnician}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 sm:flex-initial"
      >
        <option value="all">Tous les techniciens</option>
        {technicians.filter((t) => t !== 'all').map((tech) => (
          <option key={tech} value={tech}>
            {tech}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SitesTechnicianFilter;
