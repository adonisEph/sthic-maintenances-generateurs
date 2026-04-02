import React, { useEffect, useMemo, useState } from 'react';
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

  const selectedSiteLabel = useMemo(() => {
    if (!showSiteFilter) return '';
    if (String(filterSite || '') === 'all') return '';

    const selected = siteOptions.find((s) => String(s?.id || '') === String(filterSite || ''));
    if (!selected) return '';

    const idSite = String(selected?.idSite || '').trim();
    const name = String(selected?.nameSite || '').trim();
    return idSite ? `${idSite} - ${name}` : name;
  }, [filterSite, showSiteFilter, siteOptions]);

  const [siteInput, setSiteInput] = useState('');

  useEffect(() => {
    if (!showSiteFilter) return;
    setSiteInput(selectedSiteLabel);
  }, [selectedSiteLabel, showSiteFilter]);

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
            value={siteInput}
            onChange={(e) => {
              setSiteInput(String(e.target.value || ''));
            }}
            onBlur={() => {
              const v = String(siteInput || '').trim();

              if (!v) {
                onChangeSite('all');
                return;
              }

              const match = siteOptions.find((s) => {
                const idSite = String(s?.idSite || '').trim();
                const name = String(s?.nameSite || '').trim();
                const label = idSite ? `${idSite} - ${name}` : name;
                return label === v;
              });

              if (match) {
                onChangeSite(String(match?.id || ''));
              } else {
                setSiteInput(selectedSiteLabel);
              }
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
