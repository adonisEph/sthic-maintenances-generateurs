import React from 'react';
import { Calendar, X } from 'lucide-react';

const TechnicianCalendarModal = ({
  open,
  isTechnician,
  techCalendarMonth,
  setTechCalendarMonth,
  techSelectedDate,
  setTechSelectedDate,
  techSelectedDayEvents,
  setTechSelectedDayEvents,
  showTechDayDetailsModal,
  setShowTechDayDetailsModal,
  getTechCalendarEventsForDay,
  techCalendarPmTypeLabel,
  formatDate,
  getDaysUntil,
  onClose
}) => {
  if (!open || !isTechnician) return null;

  return (
    <>
      <div className="fixed inset-0 bg-indigo-950/60 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-6xl sm:max-h-[90vh]">
          <div className="flex items-start justify-between gap-3 px-3 py-3 sm:p-4 border-b border-indigo-900/60 bg-indigo-800 text-white">
            <div className="min-w-0 flex items-center gap-2">
              <Calendar size={24} className="flex-shrink-0" />
              <h2 className="text-base sm:text-xl font-bold min-w-0">
                <span className="min-w-0 truncate">Calendrier</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={onClose} className="hover:bg-white/10 p-2 rounded">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-xs font-semibold text-gray-700">Mois</label>
                <input
                  type="month"
                  value={techCalendarMonth}
                  onChange={(e) => {
                    const next = String(e.target.value || '').trim();
                    setTechCalendarMonth(next);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>
              <div className="text-xs text-white/90 bg-white/10 border border-white/10 rounded-lg px-3 py-2">
                Lecture seule
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div key={day} className="text-center font-bold text-gray-700 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const m = String(techCalendarMonth || '').trim();
                const mm = m.match(/^(\d{4})-(\d{2})$/);
                const year = mm ? Number(mm[1]) : new Date().getFullYear();
                const month = mm ? Number(mm[2]) - 1 : new Date().getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
                const days = [];

                for (let i = 0; i < startDay; i++) {
                  days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 rounded" />);
                }

                const pad2 = (n) => String(n).padStart(2, '0');
                const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                const todayStr = ymd(new Date());

                for (let day = 1; day <= lastDay.getDate(); day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dow = new Date(`${dateStr}T00:00:00`).getDay();
                  const isWeekend = dow === 0 || dow === 6;

                  if (isWeekend) {
                    days.push(
                      <div
                        key={day}
                        className="h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full bg-slate-200/70 border-gray-300"
                      />
                    );
                    continue;
                  }

                  const eventsForDay = getTechCalendarEventsForDay(dateStr);
                  const isToday = todayStr === dateStr;
                  const isSelected = techSelectedDate === dateStr;

                  days.push(
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const ev = getTechCalendarEventsForDay(dateStr);
                        setTechSelectedDate(dateStr);
                        setTechSelectedDayEvents(ev);
                        setShowTechDayDetailsModal(true);
                      }}
                      className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full hover:bg-gray-50 ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
                    >
                      <div className="text-sm font-semibold text-gray-700">{day}</div>
                      {eventsForDay.length > 0 && (
                        <div className="text-xs space-y-1 mt-1">
                          {eventsForDay.slice(0, 2).map((ev) => {
                            const daysUntil = getDaysUntil(dateStr);
                            const color = daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                            const ticket = String(ev?.item?.pmNumber || '').trim();
                            const typeLabel = techCalendarPmTypeLabel(ev?.item);
                            return (
                              <div
                                key={`${ev?.site?.id || ev?.item?.id}`}
                                className={`${color} text-white px-1 rounded flex items-start gap-1`}
                              >
                                <span className="min-w-0 flex-1 whitespace-pre-line leading-tight break-words">
                                  {ev?.site?.nameSite || ev?.item?.siteId || '-'}
                                </span>
                                <span className="ml-auto text-[10px] font-bold opacity-90">
                                  {typeLabel}{ticket ? `:${ticket}` : ''}
                                  {ev?.matchInfo?.label
                                    ? ` • ${ev.matchInfo.label === 'PM Simple' ? 'PM' : ev.matchInfo.label === 'PM et Vidange' ? 'PM+V' : 'V'}`
                                    : ''}
                                </span>
                              </div>
                            );
                          })}
                          {eventsForDay.length > 2 && (
                            <div className="text-gray-600 text-center">+{eventsForDay.length - 2}</div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                }

                return days;
              })()}
            </div>
          </div>

          <div className="p-3 border-t bg-white" />
        </div>
      </div>

      {showTechDayDetailsModal && open && isTechnician && (
        <div className="fixed inset-0 bg-indigo-950/60 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-3xl sm:max-h-[90vh] w-full h-[100svh] max-h-[100svh] max-w-none overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-indigo-900/60 bg-indigo-800 text-white">
              <div className="font-bold">Détails du {techSelectedDate ? formatDate(techSelectedDate) : ''}</div>
              <button
                onClick={() => {
                  setShowTechDayDetailsModal(false);
                }}
                className="hover:bg-white/10 p-2 rounded"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {techSelectedDayEvents.length === 0 ? (
                <div className="text-gray-600">Aucune activité planifiée ce jour.</div>
              ) : (
                <div className="space-y-2">
                  {techSelectedDayEvents.map((evt) => {
                    const it = evt?.item;
                    const site = evt?.site;
                    const matchInfo = evt?.matchInfo;
                    const statusColor =
                      it?.status === 'done'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : it?.status === 'sent'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200';
                    const ticket = String(it?.pmNumber || '').trim();
                    const typeLabel = techCalendarPmTypeLabel(it);
                    return (
                      <div
                        key={String(it?.id || `${site?.id}-${it?.plannedDate}-${it?.maintenanceType}`)}
                        className="border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 whitespace-pre-line leading-tight break-words">
                              {site?.nameSite || it?.siteId || '-'}
                            </div>
                            {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                            <div className="text-xs text-gray-600">
                              {typeLabel} • {formatDate(it?.plannedDate)} • {String(it?.technicianName || '')}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="text-xs px-2 py-1 rounded border font-semibold bg-slate-50 text-slate-800 border-slate-200">
                                {typeLabel}{ticket ? `: ${ticket}` : ''}
                              </span>
                              {matchInfo?.label && (
                                <span
                                  className={`text-xs px-2 py-1 rounded border font-semibold ${matchInfo.kind === 'PM' || matchInfo.kind === 'PM_SIMPLE' ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                                >
                                  {matchInfo.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>
                              {String(it?.status || '')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-white flex justify-end">
              <button
                onClick={() => setShowTechDayDetailsModal(false)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TechnicianCalendarModal;
