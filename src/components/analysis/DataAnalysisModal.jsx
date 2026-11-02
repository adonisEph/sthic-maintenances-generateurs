import React, { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';

const ZONES = ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
const MONTH_OPTIONS = [6, 12, 24];

const monthLabel = (ym) => {
  try {
    return new Date(`${ym}-02T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return ym;
  }
};

// Registre des analyses par croisement — extensible : chaque entrée =
// une fonctionnalité de la rubrique "Analyse des données".
const FEATURES = [
  { id: 'vidanges-trend', label: 'Tendance des vidanges / Campagnes' }
];

const DataAnalysisModal = ({ open, onClose, apiFetchJson, isSuperAdmin, userZone }) => {
  const [feature, setFeature] = useState('vidanges-trend');
  const [monthsCount, setMonthsCount] = useState(12);
  const [zone, setZone] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState({ months: [], totals: null });

  const effZone = isSuperAdmin ? zone : String(userZone || '');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ months: String(monthsCount) });
      if (isSuperAdmin && zone && zone !== 'ALL') params.set('zone', zone);
      const res = await apiFetchJson(`/api/analytics/vidanges-trend?${params.toString()}`, { method: 'GET' });
      setData({
        months: Array.isArray(res?.months) ? res.months : [],
        totals: res?.totals || null
      });
    } catch (e) {
      setLoadError(e?.message || 'Erreur de chargement.');
      setData({ months: [], totals: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, monthsCount, zone, feature]);

  const maxVal = useMemo(
    () => Math.max(1, ...data.months.map((m) => Math.max(Number(m.planned) || 0, Number(m.done) || 0))),
    [data.months]
  );
  const totals = data.totals || { planned: 0, done: 0, delta: 0, coverage: null, depassementMonths: 0 };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-indigo-700" />
            <div>
              <div className="text-base font-bold text-gray-900">Analyse des données</div>
              <div className="text-xs text-gray-500">Croisements entre workflows PM, vidanges, etc.</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Feature tabs (extensible) */}
        <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
          {FEATURES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFeature(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                feature === f.id
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-gray-100">
          <label className="text-xs text-gray-600 font-semibold flex items-center gap-1.5">
            Campagnes :
            <select
              value={monthsCount}
              onChange={(e) => setMonthsCount(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
            >
              {MONTH_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} derniers mois</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600 font-semibold flex items-center gap-1.5">
            Zone :
            {isSuperAdmin ? (
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
              >
                <option value="ALL">Toutes zones</option>
                {ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            ) : (
              <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-700">{effZone || '—'}</span>
            )}
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-semibold hover:bg-gray-700 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {feature === 'vidanges-trend' && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                Croisement <span className="font-semibold">PM × Vidanges</span> : sites planifiés
                avec ticket <span className="font-semibold">FullPMWO</span> vs fiches
                <span className="font-semibold"> « Effectuée »</span> — par mois de campagne
                (clé : date planifiée de la fiche).
              </div>

              {loadError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                  <AlertTriangle size={15} /> {loadError}
                </div>
              )}

              {/* Summary chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
                  <div className="text-[10px] font-semibold text-indigo-900">Planifiés (ticket FullPMWO)</div>
                  <div className="text-xl font-bold text-indigo-800">{totals.planned}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <div className="text-[10px] font-semibold text-emerald-900">Vidanges effectuées</div>
                  <div className="text-xl font-bold text-emerald-800">{totals.done}</div>
                </div>
                <div className={`rounded-lg border px-3 py-2 ${totals.delta > 0 ? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'}`}>
                  <div className={`text-[10px] font-semibold ${totals.delta > 0 ? 'text-amber-900' : 'text-sky-900'}`}>Écart (eff. − plan.)</div>
                  <div className={`text-xl font-bold ${totals.delta > 0 ? 'text-amber-800' : 'text-sky-800'}`}>
                    {totals.delta > 0 ? '+' : ''}{totals.delta}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                  <div className="text-[10px] font-semibold text-gray-600">Couverture globale</div>
                  <div className="text-xl font-bold text-gray-800">
                    {totals.coverage == null ? '—' : `${totals.coverage}%`}
                  </div>
                </div>
              </div>

              {totals.depassementMonths > 0 && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle size={15} />
                  {totals.depassementMonths} campagne(s) en dépassement — vidanges effectuées &gt; planifiées.
                </div>
              )}

              {/* Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">Campagne</th>
                      <th className="px-3 py-2 text-right">Planifiés<br /><span className="normal-case font-normal">(ticket FullPMWO)</span></th>
                      <th className="px-3 py-2 text-right">Effectuées<br /><span className="normal-case font-normal">(fiches)</span></th>
                      <th className="px-3 py-2 text-right">Écart</th>
                      <th className="px-3 py-2 text-right">Couverture</th>
                      <th className="px-3 py-2 w-56">Comparaison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && data.months.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Chargement…</td></tr>
                    )}
                    {!loading && data.months.length === 0 && !loadError && (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Aucune donnée sur la période.</td></tr>
                    )}
                    {data.months.map((m) => (
                      <tr key={m.month} className={`border-t border-gray-100 ${m.depassement ? 'bg-amber-50/60' : ''}`}>
                        <td className="px-3 py-2 font-semibold text-gray-800 capitalize">
                          {monthLabel(m.month)}
                          {m.depassement && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 align-middle">
                              DÉPASSEMENT
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-indigo-800">
                          {m.planned}
                          <span className="block text-[10px] font-normal text-gray-400">{m.plannedSites} sites</span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                          {m.done}
                          <span className="block text-[10px] font-normal text-gray-400">{m.doneSites} sites</span>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${m.delta > 0 ? 'text-amber-700' : 'text-gray-600'}`}>
                          {m.delta > 0 ? '+' : ''}{m.delta}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {m.coverage == null ? '—' : `${m.coverage}%`}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 rounded bg-indigo-500" style={{ width: `${Math.max(2, (m.planned / maxVal) * 100)}%` }} />
                              <span className="text-[10px] text-indigo-700 font-semibold">{m.planned}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className={`h-2 rounded ${m.depassement ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(2, (m.done / maxVal) * 100)}%` }} />
                              <span className="text-[10px] text-emerald-700 font-semibold">{m.done}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-indigo-500" /> Planifiés</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-emerald-500" /> Effectuées</span>
                <span className="flex items-center gap-1"><TrendingUp size={11} /> Dépassement = effectuées &gt; planifiées (anomalie)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataAnalysisModal;
