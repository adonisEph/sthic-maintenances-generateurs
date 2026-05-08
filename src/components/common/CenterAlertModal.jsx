import React from 'react';

const CenterAlertModal = ({
  open,
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel = 'OK',
  onSecondary,
  busy = false
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-900 text-white">
          <div className="text-lg font-bold">{String(title || '')}</div>
        </div>
        <div className="p-4">
          <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{String(message || '')}</div>
        </div>
        <div className="p-4 border-t bg-white flex flex-col sm:flex-row sm:justify-end gap-2">
          {primaryLabel && (
            <button
              type="button"
              onClick={onPrimary}
              disabled={busy}
              className="bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 font-semibold disabled:bg-indigo-300"
            >
              {String(primaryLabel)}
            </button>
          )}
          <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold disabled:bg-gray-100"
          >
            {String(secondaryLabel || 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CenterAlertModal;
