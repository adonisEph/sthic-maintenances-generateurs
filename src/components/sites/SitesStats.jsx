import React from 'react';
import { AlertCircle, Calendar, Activity, CheckCircle } from 'lucide-react';

const SitesStats = ({
  onSetNextTicket,
  canSetNextTicket,
  sitesCount,
  urgentSitesCount,
  retiredSitesCount,
  ticketNumber,
  ticketZone
}) => {
  const ticketPrefix = (() => {
    const z = String(ticketZone || '').trim().toUpperCase();
    if (z === 'UPCN') return 'N';
    if (z === 'PNR/KOUILOU') return 'P';
    return 'T';
  })();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0" size={28} />
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Total Sites</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{sitesCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={28} />
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Vidanges Urgentes</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{urgentSitesCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Activity className="text-gray-600 flex-shrink-0" size={28} />
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Sites Retirés</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{retiredSitesCount}</p>
          </div>
        </div>
      </div>

      {canSetNextTicket && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600 flex-shrink-0" size={28} />
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Prochain Ticket</p>
              <p className="text-base sm:text-lg font-bold text-gray-800">
                {ticketPrefix}{String(ticketNumber).padStart(5, '0')}
                <button
                  type="button"
                  onClick={onSetNextTicket}
                  className="mt-2 bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 text-xs font-semibold"
                >
                  Définir
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SitesStats;
