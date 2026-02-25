import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle, X } from 'lucide-react';

const NotificationsModal = ({
  open,
  onClose,
  apiFetchJson,
  onMarkedRead,
  initialUnreadOnly = true
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(Boolean(initialUnreadOnly));
  const [items, setItems] = useState([]);
  const autoMarkedRef = useRef(false);

  const unreadIds = useMemo(() => {
    return (Array.isArray(items) ? items : [])
      .filter((n) => !n?.readAt)
      .map((n) => String(n?.id || '').trim())
      .filter(Boolean);
  }, [items]);

  const load = async () => {
    if (typeof apiFetchJson !== 'function') return;
    setBusy(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (unreadOnly) qs.set('unreadOnly', '1');
      qs.set('limit', '80');
      const res = await apiFetchJson(`/api/notifications?${qs.toString()}`, { method: 'GET' });
      setItems(Array.isArray(res?.notifications) ? res.notifications : []);
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement des notifications.');
    } finally {
      setBusy(false);
    }
  };

  const markAllAsRead = async () => {
    if (typeof apiFetchJson !== 'function') return;
    const ids = unreadIds;
    if (ids.length === 0) return;

    setBusy(true);
    setError('');
    try {
      await apiFetchJson('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
      if (typeof onMarkedRead === 'function') {
        await onMarkedRead();
      }
      await load();
    } catch (e) {
      setError(e?.message || 'Erreur lors du marquage en lu.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    autoMarkedRef.current = false;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unreadOnly]);

  useEffect(() => {
    if (!open) return;
    if (autoMarkedRef.current) return;
    if (busy) return;
    if (unreadIds.length === 0) return;

    autoMarkedRef.current = true;
    markAllAsRead();
    setUnreadOnly(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy, unreadIds.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-slate-800 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell size={22} />
            Notifications
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="hover:bg-slate-900 p-2 rounded"
              disabled={busy}
              title="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(Boolean(e.target.checked))}
              />
              Non lues uniquement
            </label>

            <div className="sm:ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 font-semibold text-sm"
                disabled={busy}
              >
                Rafraîchir
              </button>
              <button
                type="button"
                onClick={markAllAsRead}
                className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 font-semibold text-sm inline-flex items-center gap-2"
                disabled={busy || unreadIds.length === 0}
              >
                <CheckCircle size={16} />
                Tout marquer comme lu
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">
              {error}
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              {busy && items.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">Chargement…</div>
              ) : items.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">Aucune notification.</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {items.map((n) => {
                    const isUnread = !n?.readAt;
                    const created = n?.createdAt ? String(n.createdAt).replace('T', ' ').slice(0, 16) : '';
                    return (
                      <li key={n?.id} className={`p-3 ${isUnread ? 'bg-red-50' : 'bg-white'}`}>
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-1 w-2.5 h-2.5 rounded-full ${isUnread ? 'bg-red-600' : 'bg-gray-300'}`}
                            title={isUnread ? 'Non lue' : 'Lue'}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                              <div className="font-semibold text-gray-900 truncate">{String(n?.title || '')}</div>
                              <div className="text-xs text-gray-500 whitespace-nowrap">{created}</div>
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">
                              {String(n?.body || '')}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-2">
                              {String(n?.kind || '')}
                              {n?.refId ? ` • ref: ${String(n.refId)}` : ''}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-white flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold"
            disabled={busy}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
