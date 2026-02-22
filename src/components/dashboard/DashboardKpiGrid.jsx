import React from 'react';
import { ShieldCheck, ShieldAlert, CalendarCheck2, CalendarClock, CheckCircle2 } from 'lucide-react';

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
        className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-left hover:bg-sky-100"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-sky-900 font-semibold">Dans délai contractuel</div>
          <ShieldCheck size={18} className="text-sky-700 flex-shrink-0" />
        </div>
        <div className="text-2xl font-bold text-sky-800 mt-1">{ok.length}</div>
        <div className="text-xs text-sky-800 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges effectuées en dépassement du délai contractuel', 'contract_over', over)}
        className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-left hover:bg-rose-100"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-rose-900 font-semibold">Hors délai contractuel</div>
          <ShieldAlert size={18} className="text-rose-700 flex-shrink-0" />
        </div>
        <div className="text-2xl font-bold text-rose-800 mt-1">{over.length}</div>
        <div className="text-xs text-rose-800 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges planifiées du mois', 'planned', planned)}
        className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-left hover:bg-indigo-100"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-indigo-900 font-semibold">Planifiées du mois</div>
          <CalendarCheck2 size={18} className="text-indigo-700 flex-shrink-0" />
        </div>
        <div className="text-2xl font-bold text-indigo-800 mt-1">{planned.length}</div>
        <div className="text-xs text-indigo-800 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges restantes du mois', 'remaining', remaining)}
        className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left hover:bg-amber-100"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-amber-900 font-semibold">Restantes du mois</div>
          <CalendarClock size={18} className="text-amber-700 flex-shrink-0" />
        </div>
        <div className="text-2xl font-bold text-amber-800 mt-1">{remaining.length}</div>
        <div className="text-xs text-amber-800 mt-2">Clique pour voir les sites</div>
      </button>

      <button
        type="button"
        onClick={() => onOpenDetails('Vidanges effectuées du mois', 'done', done)}
        className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-left hover:bg-teal-100"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-teal-900 font-semibold">Effectuées du mois</div>
          <CheckCircle2 size={18} className="text-teal-700 flex-shrink-0" />
        </div>
        <div className="text-2xl font-bold text-teal-800 mt-1">{done.length}</div>
        <div className="text-xs text-teal-800 mt-2">Clique pour voir les sites</div>
      </button>
    </div>
  );
};

export default DashboardKpiGrid;
