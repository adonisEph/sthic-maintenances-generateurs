import React from 'react';
import { Download } from 'lucide-react';

const DashboardHeader = ({
  dashboardMonth,
  onDashboardMonthChange,
  onRefresh,
  canExportExcel,
  onExportExcel,
  exportBusy
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-xs text-gray-600">Résumé mensuel (seuil contractuel: 250H)</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
        <label className="text-xs text-gray-600">Mois</label>
        <input
          type="month"
          value={dashboardMonth}
          onChange={(e) => onDashboardMonthChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={onRefresh}
          className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 flex items-center gap-2 text-sm font-semibold w-full sm:w-auto"
          disabled={exportBusy}
        >
          Rafraîchir
        </button>
        {canExportExcel && (
          <button
            type="button"
            onClick={onExportExcel}
            className="bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2 text-sm font-semibold w-full sm:w-auto"
            disabled={exportBusy}
          >
            <Download size={16} />
            Exporter Excel
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
