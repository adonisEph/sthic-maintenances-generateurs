import React from 'react';

const DashboardKpiGrid = ({
  contractOk,
  contractOver,
  plannedEvents,
  remainingEvents,
  doneByPlannedDate,
  onOpenDetails
}) => {
  const ok = Array.isArray(contractOk) ? contractOk : [];
  const over = Array.isArray(contractOver) ? contractOver : [];
  const planned = Array.isArray(plannedEvents) ? plannedEvents : [];
  const remaining = Array.isArray(remainingEvents) ? remainingEvents : [];
  const done = Array.isArray(doneByPlannedDate) ? doneByPlannedDate : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges effectuées dans le délai contractuel', 'contract_ok', ok)}
        className="bg-green-50 border border-green-200 rounded-xl p-4 text-left hover:bg-green-100"
      >
        <div className="text-xs text-green-800 font-semibold">Dans délai contractuel</div>
        <div className="text-2xl font-bold text-green-700 mt-1">{ok.length}</div>
        <div className="text-xs text-green-700 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges effectuées en dépassement du délai contractuel', 'contract_over', over)}
        className="bg-red-50 border border-red-200 rounded-xl p-4 text-left hover:bg-red-100"
      >
        <div className="text-xs text-red-800 font-semibold">Hors délai contractuel</div>
        <div className="text-2xl font-bold text-red-700 mt-1">{over.length}</div>
        <div className="text-xs text-red-700 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges planifiées du mois', 'planned', planned)}
        className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left hover:bg-blue-100"
      >
        <div className="text-xs text-blue-800 font-semibold">Planifiées du mois</div>
        <div className="text-2xl font-bold text-blue-700 mt-1">{planned.length}</div>
        <div className="text-xs text-blue-700 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges restantes du mois', 'remaining', remaining)}
        className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left hover:bg-amber-100"
      >
        <div className="text-xs text-amber-800 font-semibold">Restantes du mois</div>
        <div className="text-2xl font-bold text-amber-700 mt-1">{remaining.length}</div>
        <div className="text-xs text-amber-700 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges effectuées du mois', 'done', done)}
        className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left hover:bg-emerald-100"
      >
        <div className="text-xs text-emerald-800 font-semibold">Effectuées du mois</div>
        <div className="text-2xl font-bold text-emerald-700 mt-1">{done.length}</div>
        <div className="text-xs text-emerald-700 mt-2">Clique pour voir les sites</div>
      </button>
    </div>
  );
};

export default DashboardKpiGrid;
