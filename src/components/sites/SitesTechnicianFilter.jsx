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
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);

  const siteOptionsWithLabel = useMemo(() => {
    return siteOptions.map((s) => {
      const idSite = String(s?.idSite || '').trim();
      const name = String(s?.nameSite || '').trim();
      const label = idSite ? `${idSite} - ${name}` : name;
      return {
        id: String(s?.id || ''),
        label
      };
    });
  }, [siteOptions]);

  const siteSuggestions = useMemo(() => {
    if (!siteDropdownOpen) return [];

    const q = String(siteInput || '').trim().toLowerCase();
    if (!q) return siteOptionsWithLabel.slice(0, 50);

    return siteOptionsWithLabel
      .filter((o) => String(o?.label || '').toLowerCase().includes(q))
      .slice(0, 50);
  }, [siteDropdownOpen, siteInput, siteOptionsWithLabel]);

  useEffect(() => {
    if (!showSiteFilter) return;
    setSiteInput(selectedSiteLabel);
  }, [selectedSiteLabel, showSiteFilter]);

  const applySiteSelectionFromLabel = (label) => {
    const v = String(label || '').trim();

    if (!v) {
      onChangeSite('all');
      return;
    }

    const match = siteOptionsWithLabel.find((o) => String(o?.label || '') === v);
    if (match && match.id) {
      onChangeSite(match.id);
    }
  };

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
          <div className="relative flex-1 sm:flex-initial">
            <input
              value={siteInput}
              onChange={(e) => {
                setSiteInput(String(e.target.value || ''));
                setSiteDropdownOpen(true);
              }}
              onFocus={() => {
                setSiteDropdownOpen(true);
              }}
              onBlur={() => {
                const v = String(siteInput || '').trim();
                const exact = siteOptionsWithLabel.find((o) => String(o?.label || '') === v);

                if (!v) {
                  onChangeSite('all');
                  setSiteDropdownOpen(false);
                  return;
                }

                if (exact) {
                  applySiteSelectionFromLabel(v);
                  setSiteDropdownOpen(false);
                } else {
                  setSiteInput(selectedSiteLabel);
                  setSiteDropdownOpen(false);
                }
              }}
              placeholder="Tous les sites"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            />

            {siteDropdownOpen && siteSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white text-black shadow-lg">
                {siteSuggestions.map((o) => (
                  <button
                    key={o.id || o.label}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSiteInput(o.label);
                      applySiteSelectionFromLabel(o.label);
                      setSiteDropdownOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SitesTechnicianFilter;
