import React, { useState, useMemo } from 'react';
import { Activity, X, Search, Calendar, Download, Clock, User, Filter, Wifi, FileText } from 'lucide-react';

const PresenceModal = ({
  open,
  isAdmin,
  presenceTab,
  onSelectSessions,
  onSelectHistory,
  users,
  auditUserId,
  onAuditUserIdChange,
  auditFrom,
  onAuditFromChange,
  auditTo,
  onAuditToChange,
  auditQuery,
  onAuditQueryChange,
  auditError,
  auditBusy,
  auditLogs,
  onSearchAudit,
  onExportAuditExcel,
  exportBusy,
  presenceSessions,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('audit');

  const auditList = Array.isArray(auditLogs) ? auditLogs : [];
  const userList = Array.isArray(users) ? users : [];
  const sessionsList = Array.isArray(presenceSessions) ? presenceSessions : [];

  const auditStats = useMemo(() => {
    const total = auditList.length;
    const uniqueUsers = new Set(auditList.map((l) => String(l?.email || '').trim()).filter(Boolean)).size;
    const errors = auditList.filter((l) => Number(l?.status) >= 400).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = auditList.filter((l) => {
      const d = l?.createdAtMs ? new Date(Number(l.createdAtMs)).toISOString().slice(0, 10) : String(l?.createdAt || '').slice(0, 10);
      return d === today;
    }).length;
    return { total, uniqueUsers, errors, todayCount };
  }, [auditList]);

  const sessionStats = useMemo(() => {
    const total = sessionsList.length;
    const byActivity = {};
    sessionsList.forEach((s) => {
      const a = String(s?.activity || 'Inconnu');
      byActivity[a] = (byActivity[a] || 0) + 1;
    });
    return { total, byActivity };
  }, [sessionsList]);

  if (!open) return null;

  const formatPath = (l) => {
    const p = String(l.path || '');
    if (!p) return '';
    if (p === '/api/meta/version') return 'Vérification version (heartbeat)';
    const method = String(l.method || '').trim();
    const query = String(l.query || '');
    return `${method ? `${method} ` : ''}${p}${query || ''}`;
  };

  const statusColor = (status) => {
    const s = Number(status);
    if (s >= 500) return 'bg-red-100 text-red-700 border-red-200';
    if (s >= 400) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (s >= 300) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (s >= 200) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-indigo-700 via-sky-700 to-teal-700 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Centre de Présence & Activité</h2>
              <p className="text-sm text-white/80">
                {isAdmin
                  ? `${auditStats.total} logs d'audit • ${sessionStats.total} session${sessionStats.total > 1 ? 's' : ''} active${sessionStats.total > 1 ? 's' : ''}`
                  : 'Suivi des connexions et activités'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/15 p-2 rounded-lg transition-colors self-end sm:self-auto">
            <X size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 border-b bg-slate-50">
          <button
            onClick={() => { setActiveTab('audit'); onSelectHistory(); }}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} />
            Historique & Audit
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'audit' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
              {auditStats.total}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('sessions'); onSelectSessions(); }}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wifi size={16} />
            Sessions actives
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'sessions' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
              {sessionStats.total}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Tab: Historique & Audit */}
          {activeTab === 'audit' && (
            <div className="p-6">
              {isAdmin ? (
                <>
                  {/* Stats cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center">
                      <div className="text-2xl font-bold text-indigo-700">{auditStats.total}</div>
                      <div className="text-xs font-medium text-indigo-600">Total logs</div>
                    </div>
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-center">
                      <div className="text-2xl font-bold text-sky-700">{auditStats.uniqueUsers}</div>
                      <div className="text-xs font-medium text-sky-600">Utilisateurs uniques</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                      <div className="text-2xl font-bold text-emerald-700">{auditStats.todayCount}</div>
                      <div className="text-xs font-medium text-emerald-600">Activités aujourd'hui</div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center">
                      <div className="text-2xl font-bold text-red-700">{auditStats.errors}</div>
                      <div className="text-xs font-medium text-red-600">Erreurs (4xx/5xx)</div>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="bg-slate-50 rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Filter size={16} className="text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">Filtres</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                          <User size={12} className="text-gray-400" />
                          Utilisateur
                        </label>
                        <select
                          value={auditUserId}
                          onChange={(e) => onAuditUserIdChange(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">Tous</option>
                          {userList.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                          <Calendar size={12} className="text-gray-400" />
                          Du
                        </label>
                        <input
                          type="date"
                          value={auditFrom}
                          onChange={(e) => onAuditFromChange(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                          <Calendar size={12} className="text-gray-400" />
                          Au
                        </label>
                        <input
                          type="date"
                          value={auditTo}
                          onChange={(e) => onAuditToChange(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                          <Search size={12} className="text-gray-400" />
                          Recherche
                        </label>
                        <input
                          type="text"
                          value={auditQuery}
                          onChange={(e) => onAuditQueryChange(e.target.value)}
                          placeholder="email, action, chemin…"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {auditError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mt-3 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{auditError}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        type="button"
                        onClick={onSearchAudit}
                        disabled={auditBusy}
                        className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <Search size={16} />
                        {auditBusy ? 'Chargement…' : 'Rechercher'}
                      </button>
                      <button
                        type="button"
                        onClick={onExportAuditExcel}
                        disabled={auditBusy || auditList.length === 0 || exportBusy}
                        className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-semibold text-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <Download size={16} />
                        Export Excel
                      </button>
                    </div>
                  </div>

                  {/* Audit table */}
                  {auditList.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <FileText size={40} className="mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Aucun log trouvé. Utilisez les filtres ci-dessus puis cliquez sur Rechercher.</p>
                    </div>
                  ) : (
                    <div className="overflow-auto rounded-lg border border-gray-200" style={{ maxHeight: 'calc(95vh - 480px)' }}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-gray-600 z-10">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Email</th>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Rôle</th>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Action</th>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Méthode</th>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Chemin</th>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Metadata</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {auditList.slice(0, 500).map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                                <div className="flex items-center gap-1.5">
                                  <Clock size={12} className="text-gray-400 shrink-0" />
                                  {l.createdAtMs ? new Date(Number(l.createdAtMs)).toLocaleString('fr-FR') : l.createdAt || ''}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className="font-medium text-gray-800">{l.email || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className="text-gray-600">{l.role || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className="text-gray-700">{l.action || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className="font-mono text-gray-500">{l.method || ''}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="font-mono text-gray-600 text-[11px]">{formatPath(l)}</span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(l.status)}`}>
                                  {l.status ?? ''}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="font-mono text-gray-400 text-[11px] break-all">
                                  {l.metadata ? JSON.stringify(l.metadata) : ''}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {auditList.length > 500 && (
                        <div className="text-xs text-gray-500 p-3 bg-slate-50 border-t border-gray-200">
                          Affichage limité à 500 lignes (export disponible sur l'ensemble chargé).
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-400 py-12">
                  <Activity size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Accès interdit. Réservé aux administrateurs et managers.</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Sessions actives */}
          {activeTab === 'sessions' && (
            <div className="p-6">
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{sessionStats.total}</div>
                  <div className="text-xs font-medium text-emerald-600">Sessions actives</div>
                </div>
                {Object.entries(sessionStats.byActivity).slice(0, 3).map(([activity, count]) => (
                  <div key={activity} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-sky-700">{count}</div>
                    <div className="text-xs font-medium text-sky-600 truncate">{activity}</div>
                  </div>
                ))}
              </div>

              {sessionsList.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Wifi size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Aucune session active actuellement.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Utilisateur</th>
                        <th className="text-left px-4 py-3 font-semibold">Activité</th>
                        <th className="text-left px-4 py-3 font-semibold">Dernier ping</th>
                        <th className="text-left px-4 py-3 font-semibold">Tab ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sessionsList.map((s, i) => (
                        <tr key={s?.id || i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              <span className="font-medium text-gray-800">{s?.email || s?.userEmail || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-600">{s?.activity || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-500 text-xs">
                              {s?.lastPingAt ? new Date(Number(s.lastPingAt)).toLocaleString('fr-FR') : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-gray-400 text-xs">{s?.tabId || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PresenceModal;
