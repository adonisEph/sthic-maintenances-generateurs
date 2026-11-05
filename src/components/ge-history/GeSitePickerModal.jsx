import React, { useMemo, useState } from 'react';
import { X, Search, History } from 'lucide-react';

const GeSitePickerModal = ({ sites, onSelect, onClose }) => {
  const [q, setQ] = useState('');

  const norm = (v) => String(v || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const list = useMemo(() => {
    const nq = norm(q);
    const rows = Array.isArray(sites) ? sites : [];
    if (!nq) return rows;
    return rows.filter((s) =>
      norm(s.nameSite).includes(nq) || norm(s.idSite).includes(nq) || norm(s.technician).includes(nq)
    );
  }, [sites, q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-3 bg-indigo-950 text-white">
          <History size={18} className="text-sky-300" />
          <div className="font-bold flex-1">Fiche GE d'un site</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={17} /></button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-300">
            <Search size={16} className="text-gray-400" />
            <input
              autoFocus
              className="flex-1 outline-none text-sm"
              placeholder="Rechercher par nom de site, ID ou technicien…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="text-[11px] text-gray-500 mt-1.5">{list.length} site(s)</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Aucun site trouvé.</div>
          ) : (
            list.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className="w-full text-left px-5 py-2.5 hover:bg-indigo-50 border-b border-gray-100 flex items-center gap-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-800 truncate">{s.nameSite}</div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {s.idSite} · {s.zone || 'BZV/POOL'} · {s.generateur || '-'} {s.capacite || ''}
                  </div>
                </div>
                {s.retired && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">RETIRÉ</span>}
                <History size={15} className="text-indigo-400 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GeSitePickerModal;
