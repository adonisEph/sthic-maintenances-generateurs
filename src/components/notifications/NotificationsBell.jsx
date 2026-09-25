import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';

const POLL_MS = 120000; // 2 min — quota Cloudflare : ~720 req/j/session max, et seulement onglet visible.

const formatWhen = (iso) => {
  const d = String(iso || '');
  if (!d) return '';
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`;
};

// Cloche notifications (managers/admin) : vidanges clôturées, etc.
// Lecture = watermark côté serveur (notification_state.last_seen_at).
const NotificationsBell = ({ apiFetchJson, enabled }) => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const busyRef = useRef(false);

  const load = async () => {
    if (!enabled || typeof apiFetchJson !== 'function' || busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await apiFetchJson('/api/notifications', { method: 'GET' });
      setUnavailable(Boolean(res?.unavailable));
      setItems(Array.isArray(res?.items) ? res.items : []);
      setUnread(Number(res?.unreadCount || 0));
    } catch {
      // silencieux — la cloche est informative
    } finally {
      busyRef.current = false;
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetchJson('/api/notifications', { method: 'POST', body: JSON.stringify({ action: 'mark_read' }) });
      setUnread(0);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const iv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
    }, POLL_MS);
    const onFocus = () => load();
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) markAllRead();
        }}
        className="relative p-2 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        title="Notifications"
      >
        <Bell size={18} className="text-slate-100" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-14 left-2 sm:left-4 z-[9999] w-[min(92vw,380px)] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-2.5 flex items-center justify-between">
            <div className="font-bold text-sm flex items-center gap-2">
              <Bell size={15} /> Notifications
              {unread > 0 && <span className="text-[10px] bg-rose-500 rounded-full px-1.5 py-0.5">{unread}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
                title="Marquer tout comme lu"
              >
                <CheckCheck size={13} /> Tout lu
              </button>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-white/10">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {unavailable && (
              <div className="text-xs text-amber-700 bg-amber-50 border-b border-amber-200 px-3 py-2">
                Stockage notifications indisponible (migration non appliquée).
              </div>
            )}
            {items.length === 0 && !unavailable && (
              <div className="text-xs text-gray-500 text-center py-6">Aucune notification.</div>
            )}
            {items.map((n) => (
              <div
                key={String(n.id)}
                className={`px-3 py-2.5 border-b border-gray-100 last:border-b-0 ${n.read ? 'bg-white' : 'bg-indigo-50/60'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-indigo-600'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-900 flex items-center justify-between gap-2">
                      <span className="truncate">{n.title || 'Notification'}</span>
                      <span className="text-[10px] text-gray-400 font-normal flex-shrink-0">{formatWhen(n.createdAt)}</span>
                    </div>
                    {n.body && <div className="text-[11px] text-gray-600 mt-0.5 break-words">{n.body}</div>}
                    {n.zone && <div className="text-[10px] text-gray-400 mt-0.5">{n.zone}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationsBell;
