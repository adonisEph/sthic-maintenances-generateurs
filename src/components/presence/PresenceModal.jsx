import React from 'react';
import { Activity, X } from 'lucide-react';

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
  if (!open) return null;

  const auditList = Array.isArray(auditLogs) ? auditLogs : [];
  const sessionList = Array.isArray(presenceSessions) ? presenceSessions : [];
  const userList = Array.isArray(users) ? users : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-indigo-700 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity size={22} />
            Présence & activité
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-indigo-800 p-2 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <button
                type="button"
                onClick={onSelectSessions}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  presenceTab === 'sessions'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Sessions
              </button>
              <button
                type="button"
                onClick={onSelectHistory}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  presenceTab === 'history'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Historique
              </button>
            </div>
          )}

          {presenceTab === 'history' && isAdmin ? (
            <div>
              <div className="text-xs text-gray-600 mb-3">
                Historique des connexions et actions (audit). Filtre par date/utilisateur/recherche.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Utilisateur</label>
                  <select
                    value={auditUserId}
                    onChange={(e) => onAuditUserIdChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                  <label className="block text-xs text-gray-600 mb-1">Du</label>
                  <input
                    type="date"
                    value={auditFrom}
                    onChange={(e) => onAuditFromChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Au</label>
                  <input
                    type="date"
                    value={auditTo}
                    onChange={(e) => onAuditToChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Recherche</label>
                  <input
                    type="text"
                    value={auditQuery}
                    onChange={(e) => onAuditQueryChange(e.target.value)}
                    placeholder="email, action, path…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {auditError && <div className="text-sm text-red-600 mb-3">{auditError}</div>}

              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <button
                  type="button"
                  onClick={onSearchAudit}
                  disabled={auditBusy}
                  className="bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 font-semibold disabled:bg-gray-400"
                >
                  {auditBusy ? 'Chargement…' : 'Rechercher'}
                </button>
                <button
                  type="button"
                  onClick={onExportAuditExcel}
                  disabled={auditBusy || auditList.length === 0 || exportBusy}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold disabled:bg-gray-400"
                >
                  Export Excel
                </button>
              </div>

              {auditList.length === 0 ? (
                <div className="text-gray-600">Aucun log.</div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-auto max-h-[55vh]">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="text-left">
                        <th className="p-2 border-b">Date</th>
                        <th className="p-2 border-b">Email</th>
                        <th className="p-2 border-b">Rôle</th>
                        <th className="p-2 border-b">Action</th>
                        <th className="p-2 border-b">Méthode</th>
                        <th className="p-2 border-b">Chemin</th>
                        <th className="p-2 border-b">Status</th>
                        <th className="p-2 border-b">Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditList.slice(0, 500).map((l) => (
                        <tr key={l.id} className="odd:bg-white even:bg-gray-50">
                          <td className="p-2 border-b whitespace-nowrap">
                            {l.createdAtMs ? new Date(Number(l.createdAtMs)).toLocaleString('fr-FR') : l.createdAt || ''}
                          </td>
                          <td className="p-2 border-b">{l.email || '—'}</td>
                          <td className="p-2 border-b whitespace-nowrap">{l.role || '-'}</td>
                          <td className="p-2 border-b whitespace-nowrap">{l.action || '-'}</td>
                          <td className="p-2 border-b whitespace-nowrap">{l.method || ''}</td>
                          <td className="p-2 border-b">
                            {(() => {
                              const p = String(l.path || '');
                              if (!p) return '';
                              if (p === '/api/meta/version') return 'Vérification version (heartbeat)';
                              const method = String(l.method || '').trim();
                              const query = String(l.query || '');
                              return `${method ? `${method} ` : ''}${p}${query || ''}`;
                            })()}
                          </td>
                          <td className="p-2 border-b whitespace-nowrap">{l.status ?? ''}</td>
                          <td className="p-2 border-b">{l.metadata ? JSON.stringify(l.metadata) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditList.length > 500 ? (
                    <div className="text-xs text-gray-500 p-2">
                      Affichage limité à 500 lignes (export disponible sur l’ensemble chargé).
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-xs text-gray-600 mb-3">
                Sessions actives (tous rôles, multi-appareils). Actualisation automatique.
              </div>
              {sessionList.length === 0 ? (
                <div className="text-gray-600">Aucun utilisateur actif détecté.</div>
              ) : (
                <div className="space-y-2">
                  {sessionList.map((s) => {
                    const lastSeenMs = Number(s.lastSeenMs);
                    const secondsAgo = Number.isFinite(lastSeenMs)
                      ? Math.max(0, Math.round((Date.now() - lastSeenMs) / 1000))
                      : null;
                    const isActive = secondsAgo !== null && secondsAgo <= 8;
                    return (
                      <div
                        key={s.id || `${s.userId || ''}|${s.tabId || ''}|${s.email || ''}`}
                        className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{s.email || 'Utilisateur'}</div>
                          <div className="text-xs text-gray-600">Rôle: {s.role || '-'}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            Activité: <span className="font-semibold text-gray-800">{s.activity || '-'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-xs px-2 py-1 rounded inline-block ${
                              isActive ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {isActive ? 'Actif' : 'Inactif'}
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            {secondsAgo === null ? '-' : `Vu il y a ${secondsAgo}s`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className={`relative p-4 border-t bg-white ${
            isAdmin ? 'flex flex-col sm:flex-row sm:justify-end gap-2' : 'flex justify-end'
          }`}
        >
          <button
            onClick={onClose}
            className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${
              isAdmin ? 'w-full sm:w-auto' : ''
            }`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresenceModal;
