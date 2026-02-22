import React from 'react';
import { CheckCircle } from 'lucide-react';
import { formatDate, getDaysUntil, getUrgencyClass } from '../utils/calculations';

const SiteCard = ({ site, canWriteSites, onUpdate, onEdit, onDelete }) => {
  const daysUntil = getDaysUntil(site.epv1);
  const urgencyClass = getUrgencyClass(daysUntil, site.retired);

  const badgeColor = site.retired
    ? 'bg-gray-500'
    : daysUntil !== null && daysUntil <= 3
      ? 'bg-red-600'
      : daysUntil !== null && daysUntil <= 7
        ? 'bg-orange-600'
        : 'bg-green-600';

  return (
    <div className={`bg-white rounded-xl shadow-md border-l-4 ${urgencyClass} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-gray-800 truncate">{site.nameSite}</h3>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono border border-gray-200">{site.idSite}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {site.technician} | {site.generateur} | {site.capacite}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`${badgeColor} text-white text-xs px-2 py-1 rounded-lg font-semibold`}>
              {site.retired ? 'RETIRÉ' : 'ACTIF'}
            </span>
            {!site.retired && daysUntil !== null && (
              <div className="text-sm font-bold text-gray-900">
                {daysUntil < 0 ? `Retard ${Math.abs(daysUntil)}j` : daysUntil === 0 ? 'AUJOURD\'HUI' : `${daysUntil}j`}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
          <div className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-100">
            <div className="text-[11px] sm:text-xs text-gray-600">NH updaté</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-blue-600">{Number.isFinite(Number(site.nhEstimated)) ? `${site.nhEstimated}H` : '-'}</span>
              {daysUntil < 0 && !site.retired && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-[10px] sm:text-xs font-medium rounded-full">
                  En retard
                </span>
              )}
              {site.status === 'done' && <CheckCircle className="text-green-500" size={16} />}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-100">
            <div className="text-[11px] sm:text-xs text-gray-600">Diff updatée</div>
            <div className="text-base sm:text-lg font-bold text-blue-600">{site.diffEstimated}H</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-100">
            <div className="text-[11px] sm:text-xs text-gray-600">Date updatée</div>
            <div className="text-sm sm:text-lg font-bold text-blue-600 truncate">{formatDate(site.dateA)}</div>
          </div>
        </div>

        <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg border border-gray-200 p-1.5 sm:p-2 text-center">
            <div className="text-[10px] text-gray-500">EPV1</div>
            <div className="text-[11px] sm:text-xs font-semibold text-gray-800 truncate">{formatDate(site.epv1)}</div>
            {!site.retired && getDaysUntil(site.epv1) !== null && (
              <div className="text-[10px] text-gray-500">{getDaysUntil(site.epv1)}j</div>
            )}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-1.5 sm:p-2 text-center">
            <div className="text-[10px] text-gray-500">EPV2</div>
            <div className="text-[11px] sm:text-xs font-semibold text-gray-800 truncate">{formatDate(site.epv2)}</div>
            {!site.retired && getDaysUntil(site.epv2) !== null && (
              <div className="text-[10px] text-gray-500">{getDaysUntil(site.epv2)}j</div>
            )}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-1.5 sm:p-2 text-center">
            <div className="text-[10px] text-gray-500">EPV3</div>
            <div className="text-[11px] sm:text-xs font-semibold text-gray-800 truncate">{formatDate(site.epv3)}</div>
            {!site.retired && getDaysUntil(site.epv3) !== null && (
              <div className="text-[10px] text-gray-500">{getDaysUntil(site.epv3)}j</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {canWriteSites && (
            <button
              onClick={onUpdate}
              className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
            >
              MAJ
            </button>
          )}
          {canWriteSites && (
            <button
              onClick={onEdit}
              className="bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold"
            >
              Modifier
            </button>
          )}
          {canWriteSites && (
            <button
              onClick={onDelete}
              className="bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-semibold"
            >
              Suppr.
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteCard;
