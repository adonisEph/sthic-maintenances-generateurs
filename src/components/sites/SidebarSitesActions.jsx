import React from 'react';
import { Plus, Upload, Download } from 'lucide-react';

const SidebarSitesActions = ({
  canWriteSites,
  canImportExport,
  onCloseSidebar,
  onToggleAddForm,
  importBusy,
  importStep,
  importProgress,
  onImportExcelChange,
  sitesCount,
  exportBusy,
  onExportExcel
}) => {
  return (
    <>
      {canWriteSites && (
        <button
          onClick={() => {
            onCloseSidebar();
            onToggleAddForm();
          }}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 flex items-center gap-2 text-base font-semibold"
        >
          <Plus size={18} />
          Nouveau Site
        </button>
      )}

      {canImportExport && (
        <div className="flex flex-col gap-2">
          <label
            onClick={onCloseSidebar}
            className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-base font-semibold transition-colors focus-within:ring-2 focus-within:ring-blue-500/70 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${
              importBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800/80 cursor-pointer'
            }`}
          >
            <Upload size={18} />
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
              <div className="text-[11px] text-gray-600 mb-1">{importStep || 'Import…'} ({importProgress}%)</div>
              <div className="w-full h-2 bg-gray-200 rounded">
                <div
                  className="h-2 bg-green-600 rounded"
                  style={{ width: `${Math.max(0, Math.min(100, Number(importProgress) || 0))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {canImportExport && (
        <button
          onClick={() => {
            onCloseSidebar();
            onExportExcel();
          }}
          disabled={sitesCount === 0 || exportBusy || importBusy}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 flex items-center gap-2 disabled:opacity-60 text-base font-semibold"
        >
          <Download size={18} />
          Exporter Excel
        </button>
      )}
    </>
  );
};

export default SidebarSitesActions;
