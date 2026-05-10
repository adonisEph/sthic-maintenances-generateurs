import React, { useMemo, useState } from 'react';
import { Plus, Upload, Download } from 'lucide-react';

const SidebarSitesActions = ({
  canWriteSites,
  canImportSites,
  canImportConsoleRms,
  canExportSites,
  onCloseSidebar,
  onToggleAddForm,
  importBusy,
  importStep,
  importProgress,
  onImportExcelChange,
  consoleRmsImportBusy,
  consoleRmsImportStep,
  consoleRmsImportProgress,
  onImportConsoleRmsChange,
  sitesCount,
  exportBusy,
  onExportExcel
}) => {
  const [accordionOpen, setAccordionOpen] = useState(() => ({
    sites: true,
    excel: true
  }));

  const hasSitesSection = Boolean(canWriteSites);
  const hasExcelSection = Boolean(canImportSites || canImportConsoleRms || canExportSites);

  const orderedSections = useMemo(() => {
    const sections = [];
    if (hasSitesSection) sections.push('sites');
    if (hasExcelSection) sections.push('excel');
    return sections;
  }, [hasSitesSection, hasExcelSection]);

  const AccordionSection = ({ id, title, children }) => {
    if (!orderedSections.includes(id)) return null;

    const open = Boolean(accordionOpen[id]);

    return (
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setAccordionOpen((prev) => ({ ...(prev || {}), [id]: !prev?.[id] }))}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
        >
          <div className="text-xs font-bold uppercase tracking-wide text-white/90">{title}</div>
          <div className="text-white/80 text-sm font-bold">{open ? '–' : '+'}</div>
        </button>
        {open && <div className="px-3 pb-3 pt-2 space-y-2">{children}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <AccordionSection id="sites" title="Sites">
        {canWriteSites && (
          <button
            type="button"
            onClick={() => {
              onCloseSidebar();
              onToggleAddForm();
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950 flex items-center gap-2 text-sm font-semibold"
          >
            <Plus size={16} />
            Nouveau Site
          </button>
        )}
      </AccordionSection>

      <AccordionSection id="excel" title="Excel">
        {canImportSites && (
          <div className="flex flex-col gap-2">
            <label
              onClick={onCloseSidebar}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                importBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
              }`}
            >
              <Upload size={16} />
              {importBusy ? 'Import en cours…' : 'Importer Excel'}

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={onImportExcelChange}
                className="hidden"
                disabled={importBusy}
              />
            </label>

            {importBusy && (
              <div className="w-full">
                <div className="text-[11px] text-white/80 mb-1">
                  {importStep || 'Import…'} ({importProgress}%)
                </div>
                <div className="w-full h-2 bg-white/15 rounded">
                  <div
                    className="h-2 bg-sky-400 rounded"
                    style={{ width: `${Math.max(0, Math.min(100, Number(importProgress) || 0))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {canImportConsoleRms && (
          <div className="flex flex-col gap-2">
            <label
              onClick={onCloseSidebar}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                consoleRmsImportBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
              }`}
            >
              <Upload size={16} />
              {consoleRmsImportBusy ? 'Import RMS en cours…' : 'Import CONSOLE RMS'}

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={onImportConsoleRmsChange}
                className="hidden"
                disabled={consoleRmsImportBusy}
              />
            </label>

            {consoleRmsImportBusy && (
              <div className="w-full">
                <div className="text-[11px] text-white/80 mb-1">
                  {consoleRmsImportStep || 'Import RMS…'} ({consoleRmsImportProgress}%)
                </div>
                <div className="w-full h-2 bg-white/15 rounded">
                  <div
                    className="h-2 bg-sky-400 rounded"
                    style={{ width: `${Math.max(0, Math.min(100, Number(consoleRmsImportProgress) || 0))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {canExportSites && (
          <button
            type="button"
            onClick={() => {
              onCloseSidebar();
              onExportExcel();
            }}
            disabled={sitesCount === 0 || exportBusy || importBusy || consoleRmsImportBusy}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950 flex items-center gap-2 disabled:opacity-60 text-sm font-semibold"
          >
            <Download size={16} />
            Exporter Excel
          </button>
        )}
      </AccordionSection>
    </div>
  );
};

export default SidebarSitesActions;
