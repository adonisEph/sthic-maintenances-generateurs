import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';

const KIND_STYLES = {
  running: { icon: Loader2, border: 'border-sky-500/40', iconCls: 'text-sky-400', spin: true },
  success: { icon: CheckCircle, border: 'border-emerald-500/40', iconCls: 'text-emerald-400' },
  error: { icon: XCircle, border: 'border-rose-500/40', iconCls: 'text-rose-400' },
  warning: { icon: AlertTriangle, border: 'border-amber-500/40', iconCls: 'text-amber-400' },
  info: { icon: Info, border: 'border-white/15', iconCls: 'text-slate-300' }
};

const TOAST_KEYFRAMES = `
@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }
`;

const ToastStack = ({ toasts, onDismiss }) => {
  const list = Array.isArray(toasts) ? toasts : [];
  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 sm:w-[24rem] pointer-events-none">
      <style>{TOAST_KEYFRAMES}</style>
      {list.map((t) => {
        const style = KIND_STYLES[t?.kind] || KIND_STYLES.info;
        const Icon = style.icon;
        const progress = typeof t?.progress === 'number' ? Math.max(0, Math.min(100, t.progress)) : null;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto bg-slate-900/95 backdrop-blur text-white border ${style.border} rounded-lg shadow-xl px-3 py-2.5 flex items-start gap-2.5 animate-[toast-in_150ms_ease-out]`}
            role={t.kind === 'error' ? 'alert' : 'status'}
          >
            <Icon size={18} className={`${style.iconCls} mt-0.5 shrink-0 ${style.spin ? 'animate-spin' : ''}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold whitespace-pre-line break-words">{t.title}</div>
              {t.detail ? <div className="text-xs text-white/75 mt-0.5 whitespace-pre-line break-words">{t.detail}</div> : null}
              {t.kind === 'running' && (
                progress != null ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded overflow-hidden">
                      <div className="h-full bg-sky-400 rounded transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="text-[11px] text-white/70 font-semibold">{Math.round(progress)}%</div>
                  </div>
                ) : (
                  <div className="mt-1.5 h-1.5 bg-white/10 rounded overflow-hidden">
                    <div className="h-full w-1/3 bg-sky-400 rounded animate-[toast-slide_1.1s_ease-in-out_infinite]" />
                  </div>
                )
              )}
            </div>
            {t.kind !== 'running' && (
              <button
                type="button"
                onClick={() => onDismiss?.(t.id)}
                className="shrink-0 p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fermer la notification"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ToastStack;
