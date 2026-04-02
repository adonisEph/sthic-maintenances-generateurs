import React from 'react';
import { Filter } from 'lucide-react';

const SitesTechnicianFilter = ({
  isTechnician,
  filterTechnician,
  onChange,
  technicians,
  filterSite,
  onChangeSite,
  sites
}) => {
  if (isTechnician) return null;

  const siteOptions = Array.isArray(sites) ? sites : [];
  const showSiteFilter = typeof onChangeSite === 'function' && filterSite !== undefined;

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
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

      {showSiteFilter && (
        <>
          <input
            value={String(filterSite || '') === 'all' ? '' : String(filterSite || '')}
            onChange={(e) => {
              const v = String(e.target.value || '');
              onChangeSite(v.trim() ? v : 'all');
            }}
            list="sites-filter-datalist"
            placeholder="Tous les sites"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 sm:flex-initial"
          />
          <datalist id="sites-filter-datalist">
            {siteOptions.map((s) => {
              const idSite = String(s?.idSite || '').trim();
              const name = String(s?.nameSite || '').trim();
              const label = idSite ? `${idSite} - ${name}` : name;
              return <option key={String(s?.id || '')} value={label} />;
            })}
          </datalist>
        </>
      )}
    </div>
  );
};

export default SitesTechnicianFilter;
