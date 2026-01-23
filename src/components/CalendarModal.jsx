import React from 'react';
import { Calendar, X } from 'lucide-react';

const CalendarModal = (props) => {
  const {
    showCalendar,
    isTechnician,
    setShowCalendar,
    currentMonth,
    setCurrentMonth,
    isAdmin,
    calendarSendTechUserId,
    setCalendarSendTechUserId,
    users,
    usersBusy,
    usersError,
    refreshUsers,
    handleSendCalendarMonthPlanning,
    canExportExcel,
    handleExportCalendarMonthExcel,
    exportBusy,
    basePlanBusy,
    basePlanErrors,
    basePlanPreview,
    basePlanTargetMonth,
    basePlanBaseRows,
    basePlanProgress,
    handleImportBasePlanExcel,
    generateBasePlanPreview,
    exportBasePlanPreviewExcel,
    saveBasePlanToDb,
    deleteBasePlanFromDb,
    getEventsForDay,
    getDaysUntil,
    selectedDate,
    setSelectedDate,
    setSelectedDayEvents,
    setShowDayDetailsModal
  } = props;

  if (!showCalendar || isTechnician) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-0">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-none sm:max-w-none sm:max-h-[100vh] sm:h-[100vh]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b border-gray-200 bg-white text-gray-900 shadow-sm">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={24} className="text-blue-600" />
            Calendrier des Vidanges
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCalendar(false)} className="hover:bg-gray-100 p-2 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row h-full min-h-0">
            <div className="lg:w-[280px] w-full flex-shrink-0 bg-slate-900 text-slate-100 border-b border-slate-800 lg:border-b-0 lg:border-r lg:border-slate-800 overflow-y-auto">
              <div className="p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Mois</div>
              <div className="grid grid-cols-3 gap-2 items-center mb-3">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="bg-slate-800 text-white px-2 py-2 rounded-lg hover:bg-slate-700 w-full text-sm font-semibold"
                >
                  ←
                </button>
                <div className="text-sm font-bold text-white text-center capitalize">
                  {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="bg-slate-800 text-white px-2 py-2 rounded-lg hover:bg-slate-700 w-full text-sm font-semibold"
                >
                  →
                </button>
              </div>

              {isAdmin && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3">
                  <div className="text-xs font-semibold text-slate-200 mb-1">Technicien</div>
                  <select
                    value={calendarSendTechUserId}
                    onChange={(e) => setCalendarSendTechUserId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 w-full"
                    disabled={usersBusy}
                  >
                    <option value="">-- Technicien --</option>
                    {(Array.isArray(users) ? users : [])
                      .filter((u) => u && u.role === 'technician')
                      .slice()
                      .sort((a, b) => String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || '')))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.technicianName || u.email}
                        </option>
                      ))}
                  </select>

                  {usersBusy && <div className="mt-1 text-xs text-slate-200/80">Chargement des techniciens…</div>}
                  {!usersBusy && usersError && <div className="mt-1 text-xs text-rose-300">{usersError}</div>}
                  {!usersBusy &&
                    !usersError &&
                    (Array.isArray(users) ? users : []).filter((u) => u && u.role === 'technician').length === 0 && (
                      <div className="mt-1 text-xs text-slate-200/80">Aucun technicien chargé.</div>
                    )}

                  {!usersBusy && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await refreshUsers();
                        } catch {
                          // ignore
                        }
                      }}
                      className="mt-2 w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-600 text-sm font-semibold"
                    >
                      Recharger les techniciens
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSendCalendarMonthPlanning}
                    className="mt-2 w-full bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-600 text-sm font-semibold disabled:opacity-60"
                    disabled={!calendarSendTechUserId || usersBusy}
                  >
                    Envoyer planning du mois
                  </button>
                </div>
              )}

              <div className="h-px bg-slate-700/60 my-2" />

              <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
              <div className="flex flex-col">
                {canExportExcel && (
                  <button
                    type="button"
                    onClick={handleExportCalendarMonthExcel}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={exportBusy}
                  >
                    Exporter Excel
                  </button>
                )}
                {isAdmin && (
                  <label
                    className={`text-left px-3 py-2 rounded-lg font-semibold text-sm ${
                      basePlanBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    Importer base (Excel)
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportBasePlanExcel}
                      className="hidden"
                      disabled={basePlanBusy}
                    />
                  </label>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={generateBasePlanPreview}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy || basePlanBaseRows.length === 0}
                  >
                    Générer planning mois suivant
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={exportBasePlanPreviewExcel}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy || basePlanPreview.length === 0}
                  >
                    Exporter planning base
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={saveBasePlanToDb}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy || basePlanPreview.length === 0}
                  >
                    Enregistrer (DB)
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={deleteBasePlanFromDb}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm disabled:opacity-60"
                    disabled={basePlanBusy}
                  >
                    Supprimer (DB)
                  </button>
                )}
              </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-6 space-y-3">
              {isAdmin && (basePlanBusy || basePlanErrors.length > 0 || basePlanPreview.length > 0) && (
                <div className="mt-0 space-y-2">
                  {basePlanBusy && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${basePlanProgress}%` }} />
                    </div>
                  )}
                  {basePlanTargetMonth && (
                    <div className="text-xs text-gray-700">
                      Mois cible: <strong>{basePlanTargetMonth}</strong> | Base: <strong>{basePlanBaseRows.length}</strong> | Planning:{' '}
                      <strong>{basePlanPreview.length}</strong>
                    </div>
                  )}
                  {basePlanErrors.length > 0 && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 max-h-32 overflow-auto">
                      {basePlanErrors.slice(0, 20).map((m, idx) => (
                        <div key={idx}>{m}</div>
                      ))}
                      {basePlanErrors.length > 20 && <div>… ({basePlanErrors.length - 20} autres)</div>}
                    </div>
                  )}
                  {basePlanPreview.length > 0 && (
                    <div className="border rounded-lg overflow-auto max-h-64">
                      <table className="min-w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="text-left">
                            <th className="p-2 border-b">Date</th>
                            <th className="p-2 border-b">Technicien</th>
                            <th className="p-2 border-b">Site</th>
                            <th className="p-2 border-b">Type</th>
                            <th className="p-2 border-b">EPV</th>
                            <th className="p-2 border-b">PairGroup</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const items = Array.isArray(basePlanPreview) ? basePlanPreview.slice(0, 80) : [];
                            const groups = new Map();
                            for (const it of items) {
                              const g = String(it?.pairGroup || '').trim();
                              const key = `${it.plannedDate}||${it.technician}||${g || it.siteCode || it.siteName || ''}`;
                              if (!groups.has(key)) groups.set(key, []);
                              groups.get(key).push(it);
                            }
                            const out = [];
                            for (const arr of groups.values()) {
                              const sorted = arr
                                .slice()
                                .sort((a, b) => Number(a?.importOrder ?? 0) - Number(b?.importOrder ?? 0));
                              const first = sorted[0] || {};
                              const second = sorted[1] || null;
                              const hasTwo = sorted.length === 2;
                              out.push({
                                plannedDate: first.plannedDate,
                                technician: first.technician,
                                siteCode: hasTwo ? `${first.siteCode || ''}\n${second?.siteCode || ''}`.trim() : first.siteCode || '',
                                siteName: hasTwo ? `${first.siteName || ''}\n${second?.siteName || ''}`.trim() : first.siteName || '',
                                maintenanceType:
                                  hasTwo && first.recommendedMaintenanceType !== second?.recommendedMaintenanceType
                                    ? `${first.recommendedMaintenanceType || ''} + ${second?.recommendedMaintenanceType || ''}`.trim()
                                    : first.recommendedMaintenanceType || '',
                                epvSlot: first.epvSlot,
                                pairGroup: first.pairGroup || ''
                              });
                            }
                            out.sort((a, b) => {
                              const d = String(a.plannedDate || '').localeCompare(String(b.plannedDate || ''));
                              if (d !== 0) return d;
                              return String(a.technician || '').localeCompare(String(b.technician || ''));
                            });
                            return out.map((it, idx) => (
                              <tr key={`${it.siteCode}-${it.plannedDate}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-2 border-b whitespace-nowrap">{it.plannedDate}</td>
                                <td className="p-2 border-b">{it.technician}</td>
                                <td className="p-2 border-b whitespace-pre-line leading-tight break-words">{it.siteName || it.siteCode}</td>
                                <td className="p-2 border-b">{it.maintenanceType}</td>
                                <td className="p-2 border-b">{it.epvSlot}</td>
                                <td className="p-2 border-b">{it.pairGroup || ''}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                      {basePlanPreview.length > 80 && (
                        <div className="text-xs text-gray-600 p-2">
                          Affichage limité aux 80 premières lignes (total: {basePlanPreview.length}).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                    <div key={day} className="text-center font-bold text-gray-700 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
                    const days = [];

                    for (let i = 0; i < startDay; i++) {
                      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 rounded"></div>);
                    }

                    for (let day = 1; day <= lastDay.getDate(); day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const eventsForDay = getEventsForDay(dateStr);

                      const isToday = new Date().toISOString().split('T')[0] === dateStr;
                      const isSelected = selectedDate === dateStr;
                      const dow = new Date(`${dateStr}T00:00:00`).getDay();
                      const isWeekend = dow === 0 || dow === 6;

                      if (isWeekend) {
                        days.push(
                          <div
                            key={day}
                            className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full bg-slate-200/70 border-gray-300`}
                          />
                        );
                        continue;
                      }

                      days.push(
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const events = getEventsForDay(dateStr);
                            setSelectedDate(dateStr);
                            setSelectedDayEvents(events);
                            setShowDayDetailsModal(true);
                          }}
                          className={`h-16 sm:h-20 md:h-24 border-2 rounded p-1 overflow-hidden text-left w-full hover:bg-gray-50 ${
                            isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                          } ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
                        >
                          <div className="text-sm font-semibold text-gray-700">{day}</div>
                          {eventsForDay.length > 0 && (
                            <div className="text-xs space-y-1 mt-1">
                              {eventsForDay.slice(0, 2).map((ev) => {
                                const daysUntil = getDaysUntil(dateStr);
                                const color = daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500';
                                const st = String(ev?.intervention?.status || '');
                                const dot =
                                  st === 'done'
                                    ? 'bg-green-200'
                                    : st === 'sent'
                                      ? 'bg-blue-200'
                                      : st === 'planned'
                                        ? 'bg-amber-200'
                                        : 'bg-gray-200';
                                const moved = ev?.originalDate && String(ev.originalDate) !== String(ev.date);
                                return (
                                  <div key={`${ev.site.id}-${ev.type}`} className={`${color} text-white px-1 rounded flex items-start gap-1`}>
                                    <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                                    <span className="min-w-0 flex-1 whitespace-pre-line leading-tight break-words">{ev.site.nameSite}</span>
                                    {moved && <span className="ml-auto text-[10px] font-bold opacity-90">↔</span>}
                                  </div>
                                );
                              })}
                              {eventsForDay.length > 2 && <div className="text-gray-600 text-center">+{eventsForDay.length - 2}</div>}
                            </div>
                          )}
                        </button>
                      );
                    }

                    return days;
                  })()}
                </div>
              </div>

              <div className="mt-6 flex gap-4 justify-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Urgent (≤3j)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span>Bientôt (≤7j)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>OK (&gt;7j)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-white" />
      </div>
    </div>
  );
};

export default CalendarModal;
