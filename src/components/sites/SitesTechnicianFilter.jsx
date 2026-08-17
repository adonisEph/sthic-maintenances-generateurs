import React, { useEffect, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';

const SitesTechnicianFilter = ({
  isTechnician,
  filterTechnician,
  onChange,
  technicians,
  filterSite,
  onChangeSite,
  sites,
  filterUrgency,
  onToggleUrgency,
  onResetUrgency
}) => {
  if (isTechnician) return null;

  const urgencyOpts = [
    { key: 'red', label: 'Urgents', dot: 'bg-red-500', activeBg: 'bg-red-500', ring: 'ring-red-200' },
    { key: 'orange', label: 'Bientôt', dot: 'bg-orange-500', activeBg: 'bg-orange-500', ring: 'ring-orange-200' },
    { key: 'green', label: 'Non urgents', dot: 'bg-green-500', activeBg: 'bg-green-500', ring: 'ring-green-200' }
  ];

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
      <Filter size={18} className="text-gray-600 flex-shrink-0" />
      <select
        value={filterTechnician}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 sm:flex-initial bg-white hover:border-gray-400 transition-colors"
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
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full bg-white hover:border-gray-400 transition-colors"
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

      {onToggleUrgency && (
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide hidden sm:inline">Statut</span>
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
            {urgencyOpts.map((opt) => {
              const active = Array.isArray(filterUrgency) && filterUrgency.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => onToggleUrgency(opt.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                    active
                      ? `${opt.activeBg} text-white shadow-sm`
                      : 'text-gray-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-white' : opt.dot}`} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {Array.isArray(filterUrgency) && filterUrgency.length > 0 && (
            <button
              onClick={onResetUrgency}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all duration-150 border border-gray-300 shadow-sm"
              title="Réinitialiser les filtres de statut"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              Réinitialiser
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SitesTechnicianFilter;
