import React from 'react';
import { Activity, X, RotateCcw } from 'lucide-react';

const TodayPlannedActivitiesModal = ({
  open,
  onClose,
  busy,
  todayActivities,
  onRefresh
}) => {
  if (!open) return null;

  const today = String(todayActivities?.today || '').slice(0, 10);
  const pmToday = Array.isArray(todayActivities?.pmItems) ? todayActivities.pmItems : [];
  const intToday = Array.isArray(todayActivities?.interventions) ? todayActivities.interventions : [];

  const bySiteKey = new Map();

  const siteKeyForPm = (it) => {
    const sid = String(it?.siteCode || '').trim();
    if (sid) return `code:${sid}`;
    const sn = String(it?.siteName || '').trim();
    if (sn) return `name:${sn}`;
    const id = String(it?.siteId || '').trim();
    return id ? `id:${id}` : '';
  };

  const siteKeyForInt = (it) => {
    const sid = String(it?.siteCode || '').trim();
    if (sid) return `code:${sid}`;
    const sn = String(it?.siteName || '').trim();
    if (sn) return `name:${sn}`;
    const id = String(it?.siteId || '').trim();
    return id ? `id:${id}` : '';
  };

  const ensureRow = (k) => {
    if (!k) return null;
    if (!bySiteKey.has(k)) {
      bySiteKey.set(k, {
        key: k,
        siteName: '',
        siteCode: '',
        zone: '',
        pm: null,
        intervention: null
      });
    }
    return bySiteKey.get(k);
  };

  for (const it of pmToday) {
    const k = siteKeyForPm(it);
    const row = ensureRow(k);
    if (!row) continue;
    row.pm = it;
    row.siteName = String(it?.siteName || row.siteName || '').trim();
    row.siteCode = String(it?.siteCode || row.siteCode || '').trim();
    row.zone = String(it?.zone || row.zone || '').trim();
  }

  for (const it of intToday) {
    const k = siteKeyForInt(it);
    const row = ensureRow(k);
    if (!row) continue;
    row.intervention = it;
    row.siteName = String(it?.siteName || row.siteName || '').trim();
    row.siteCode = String(it?.siteCode || row.siteCode || '').trim();
    row.zone = String(it?.zone || row.zone || '').trim();
  }

  const rows = Array.from(bySiteKey.values()).sort((a, b) => {
    const sa = String(a.siteName || a.siteCode || a.key);
    const sb = String(b.siteName || b.siteCode || b.key);
    return sa.localeCompare(sb);
  });

  const computeLabel = (r) => {
    const hasPm = Boolean(r?.pm);
    const hasVid = Boolean(r?.intervention);
    if (hasPm && hasVid) return 'PM+Vidange';
    if (hasPm) return 'PM Simple';
    if (hasVid) return 'Vidange Simple';
    return '-';
  };

  const normalizeState = (v) => {
    const s = String(v || '').trim();
    return s || '-';
  };

  const siteLabel = (r) => {
    const name = String(r?.siteName || '').trim();
    const code = String(r?.siteCode || '').trim();
    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;
    const rawId = String(r?.pm?.siteId || r?.intervention?.siteId || '').trim();
    return rawId || '-';
  };

  const assignedToLabel = (r) => {
    if (r?.pm) return String(r.pm?.assignedTo || '').trim() || '-';
    if (r?.intervention) return String(r.intervention?.technicianName || '').trim() || '-';
    return '-';
  };

  const stateLabel = (r) => {
    if (r?.pm) return normalizeState(r.pm?.state);
    if (r?.intervention) return normalizeState(r.intervention?.status);
    return '-';
  };

  const badgeClass = (txt) => {
    if (txt === 'PM+Vidange') return 'bg-indigo-50 text-indigo-900 border-indigo-200';
    if (txt === 'PM Simple') return 'bg-sky-50 text-sky-900 border-sky-200';
    if (txt === 'Vidange Simple') return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    return 'bg-slate-50 text-slate-800 border-slate-200';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-0 sm:p-4">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-6xl sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-3 py-3 sm:p-4 border-b bg-indigo-800 text-white">
          <div className="min-w-0 flex items-center gap-2">
            <Activity size={24} className="flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold truncate">Activités planifiées du jour</div>
              <div className="text-xs text-white/80">Date: {today || '-'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (typeof onRefresh === 'function') onRefresh();
              }}
              className="hover:bg-white/10 px-3 py-2 rounded flex items-center gap-2 text-sm font-semibold disabled:opacity-60"
              disabled={busy || typeof onRefresh !== 'function'}
              title="Rafraîchir"
            >
              <RotateCcw size={16} />
              Rafraîchir
            </button>
            <button onClick={onClose} className="hover:bg-white/10 p-2 rounded" title="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {busy && <div className="text-sm text-slate-600">Chargement…</div>}

          {!busy && rows.length === 0 && (
            <div className="text-sm text-slate-600">Aucune activité planifiée trouvée pour aujourd'hui.</div>
          )}

          {rows.length > 0 && (
            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-left text-xs text-slate-700 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Short Description</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Assigné à</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">État</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const label = computeLabel(r);
                    const pmShort = String(r?.pm?.shortDescription || '').trim();
                    const content = pmShort ? pmShort : label;
                    return (
                      <tr
                        key={r.key}
                        className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}
                      >
                        <td className="px-3 py-2 text-slate-900 max-w-[360px] truncate" title={siteLabel(r)}>
                          {siteLabel(r)}
                        </td>
                        <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{String(r.zone || '').trim() || '-'}</td>
                        <td className="px-3 py-2 text-slate-900">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs px-2 py-1 rounded border font-semibold whitespace-nowrap ${badgeClass(label)}`}>
                              {label}
                            </span>
                            <span className="min-w-0 truncate" title={content}>
                              {content}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-900 max-w-[240px] truncate" title={assignedToLabel(r)}>
                          {assignedToLabel(r)}
                        </td>
                        <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{stateLabel(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-white" />
      </div>
    </div>
  );
};

export default TodayPlannedActivitiesModal;
