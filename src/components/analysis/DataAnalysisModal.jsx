import React, { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp, RefreshCw, AlertTriangle, BarChart3, PlusCircle, Trash2, Database, Calendar, Pencil } from 'lucide-react';

const ZONES = ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
const MONTH_OPTIONS = [6, 12, 24];

const monthLabel = (ym) => {
  try {
    return new Date(`${ym}-02T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return ym;
  }
};

const currentYm = () => new Date().toISOString().slice(0, 7);

// Registre des analyses par croisement — extensible.
const FEATURES = [
  { id: 'vidanges-trend', label: 'Tendance des vidanges / Campagnes' }
];

const FILTER_MODES = [
  { id: 'preset', label: 'Derniers mois' },
  { id: 'single', label: 'Mois précis' },
  { id: 'range', label: 'Entre 2 mois' }
];

const DataAnalysisModal = ({ open, onClose, apiFetchJson, isSuperAdmin, userZone }) => {
  const [feature, setFeature] = useState('vidanges-trend');
  const [filterMode, setFilterMode] = useState('preset');
  const [monthsCount, setMonthsCount] = useState(12);
  const [singleMonth, setSingleMonth] = useState(currentYm().slice(0, 7));
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [zone, setZone] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState({ months: [], totals: null, manualEntries: [] });
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualForm, setManualForm] = useState({ month: '', zone: 'BZV/POOL', planned: '', done: '', note: '' });

  const effZone = isSuperAdmin ? zone : String(userZone || '');

  const buildParams = () => {
    const params = new URLSearchParams();
    if (filterMode === 'single' && singleMonth) {
      params.set('month', singleMonth);
    } else if (filterMode === 'range' && rangeFrom && rangeTo) {
      params.set('from', rangeFrom);
      params.set('to', rangeTo);
    } else {
      params.set('months', String(monthsCount));
    }
    if (isSuperAdmin && zone && zone !== 'ALL') params.set('zone', zone);
    return params;
  };

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiFetchJson(`/api/analytics/vidanges-trend?${buildParams().toString()}`, { method: 'GET' });
      setData({
        months: Array.isArray(res?.months) ? res.months : [],
        totals: res?.totals || null,
        manualEntries: Array.isArray(res?.manualEntries) ? res.manualEntries : []
      });
    } catch (e) {
      setLoadError(e?.message || 'Erreur de chargement.');
      setData({ months: [], totals: null, manualEntries: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filterMode, monthsCount, singleMonth, rangeFrom, rangeTo, zone, feature]);

  const submitManual = async () => {
    if (!manualForm.month) { alert('Choisissez le mois.'); return; }
    // Champ vide = inchangé sur une entrée existante ; chaque métrique se
    // CRUD indépendamment (ex. modifier uniquement « Effectuées »).
    const hasP = manualForm.planned !== '';
    const hasD = manualForm.done !== '';
    if (!hasP && !hasD) { alert('Saisir « Planifiés » et/ou « Effectuées » (champ vide = inchangé).'); return; }
    setManualBusy(true);
    try {
      const body = { month: manualForm.month, zone: manualForm.zone, note: manualForm.note };
      if (hasP) body.plannedFullpmwo = Number(manualForm.planned) || 0;
      if (hasD) body.doneVidanges = Number(manualForm.done) || 0;
      await apiFetchJson('/api/analytics/vidanges-trend', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setManualForm({ month: '', zone: 'BZV/POOL', planned: '', done: '', note: '' });
      setManualFormOpen(false);
      await load();
    } catch (e) {
      alert(e?.message || 'Erreur lors de la saisie.');
    } finally {
      setManualBusy(false);
    }
  };

  // Ouvre le formulaire pour éditer une saisie existante — les valeurs
  // actuelles apparaissent en placeholder ; les champs restent VIDES pour
  // que seule la métrique saisie soit modifiée (vide = inchangé).
  const editManual = (e) => {
    setManualForm({
      month: e.month || '',
      zone: e.zone || 'BZV/POOL',
      planned: '',
      done: '',
      note: e.note || ''
    });
    setManualFormOpen(true);
  };

  // CRUD par campagne : ouvre le formulaire pour la saisie existante du
  // mois (de préférence celle de la zone filtrée), sinon vierge.
  const editMonthManual = (m) => {
    const entries = data.manualEntries.filter((e) => e.month === m.month);
    const existing =
      entries.find((e) => zone !== 'ALL' && e.zone === zone) || entries[0] || null;
    setManualForm({
      month: m.month,
      zone: existing?.zone || (zone !== 'ALL' ? zone : 'BZV/POOL'),
      planned: '',
      done: '',
      note: existing?.note || ''
    });
    setManualFormOpen(true);
  };

  // Saisie existante correspondant au couple (mois, zone) du formulaire —
  // permet le mode édition + la suppression directe dans le formulaire.
  const currentManualEntry = data.manualEntries.find(
    (e) => e.month === manualForm.month && e.zone === manualForm.zone
  );

  const deleteManual = async (id) => {
    if (!window.confirm('Supprimer cette saisie historique ?')) return;
    try {
      await apiFetchJson(`/api/analytics/vidanges-trend?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e?.message || 'Erreur lors de la suppression.');
    }
  };

  const maxVal = useMemo(
    () => Math.max(1, ...data.months.map((m) => Math.max(Number(m.planned) || 0, Number(m.done) || 0))),
    [data.months]
  );
  const totals = data.totals || { planned: 0, done: 0, delta: 0, coverage: null, depassementMonths: 0, manualDone: 0, manualPlanned: 0, manualPlannedUsed: 0 };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[97vw] max-w-[1600px] h-[94vh] flex flex-col">
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

        {/* Feature tabs */}
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
        <div className="px-5 py-3 flex items-center gap-x-4 gap-y-2 flex-wrap border-b border-gray-100">
          <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
            {FILTER_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFilterMode(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filterMode === m.id ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {filterMode === 'preset' && (
            <label className="text-xs text-gray-600 font-semibold flex items-center gap-1.5">
              Période :
              <select
                value={monthsCount}
                onChange={(e) => setMonthsCount(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
              >
                {MONTH_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} derniers mois bouclés</option>
                ))}
              </select>
            </label>
          )}
          {filterMode === 'single' && (
            <label className="text-xs text-gray-600 font-semibold flex items-center gap-1.5">
              <Calendar size={13} /> Campagne :
              <input
                type="month"
                value={singleMonth}
                max={currentYm()}
                onChange={(e) => setSingleMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
              />
            </label>
          )}
          {filterMode === 'range' && (
            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
              <Calendar size={13} />
              <input
                type="month"
                value={rangeFrom}
                max={currentYm()}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
              />
              →
              <input
                type="month"
                value={rangeTo}
                max={currentYm()}
                onChange={(e) => setRangeTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
              />
            </div>
          )}

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

          <div className="ml-auto flex items-center gap-2">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setManualFormOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-amber-950 text-xs font-bold hover:bg-amber-400"
              >
                <PlusCircle size={14} />
                Données historiques
              </button>
            )}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-semibold hover:bg-gray-700 disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Manual insert form (SuperAdmin) */}
        {isSuperAdmin && manualFormOpen && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
            <div className="text-xs font-bold text-amber-900 mb-2">
              Saisie historique — données hors application (une ligne par mois + zone · champ vide = inchangé · 0 = remise à zéro · 0 partout = suppression)
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="text-[11px] font-semibold text-amber-900 flex flex-col gap-1">
                Mois (campagne)
                <input
                  type="month"
                  value={manualForm.month}
                  max={currentYm()}
                  onChange={(e) => setManualForm((f) => ({ ...f, month: e.target.value }))}
                  className="border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                />
              </label>
              <label className="text-[11px] font-semibold text-amber-900 flex flex-col gap-1">
                Zone
                <select
                  value={manualForm.zone}
                  onChange={(e) => setManualForm((f) => ({ ...f, zone: e.target.value }))}
                  className="border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-amber-900 flex flex-col gap-1">
                Planifiés FullPMWO
                <input
                  type="number" min="0"
                  placeholder={currentManualEntry ? `Actuel : ${currentManualEntry.planned}` : '0'}
                  value={manualForm.planned}
                  onChange={(e) => setManualForm((f) => ({ ...f, planned: e.target.value }))}
                  className="border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-white w-32"
                />
              </label>
              <label className="text-[11px] font-semibold text-amber-900 flex flex-col gap-1">
                Vidanges effectuées
                <input
                  type="number" min="0"
                  placeholder={currentManualEntry ? `Actuel : ${currentManualEntry.done}` : '0'}
                  value={manualForm.done}
                  onChange={(e) => setManualForm((f) => ({ ...f, done: e.target.value }))}
                  className="border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-white w-36"
                />
              </label>
              <label className="text-[11px] font-semibold text-amber-900 flex flex-col gap-1 flex-1 min-w-40">
                Note (optionnel)
                <input
                  type="text" placeholder="ex : rapport papier T1 2025"
                  value={manualForm.note}
                  onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
                  className="border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                />
              </label>
              <button
                type="button"
                onClick={submitManual}
                disabled={manualBusy}
                className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 disabled:opacity-60"
              >
                {manualBusy ? 'Enregistrement…' : currentManualEntry ? 'Mettre à jour' : 'Enregistrer'}
              </button>
              {currentManualEntry && (
                <button
                  type="button"
                  onClick={async () => { await deleteManual(currentManualEntry.id); setManualFormOpen(false); }}
                  disabled={manualBusy}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 disabled:opacity-60 flex items-center gap-1"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setManualFormOpen(false);
                  setManualForm({ month: '', zone: 'BZV/POOL', planned: '', done: '', note: '' });
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {feature === 'vidanges-trend' && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                Croisement <span className="font-semibold">PM × Vidanges</span> : sites planifiés
                avec ticket <span className="font-semibold">FullPMWO</span> vs fiches
                <span className="font-semibold"> « Effectuée »</span> — par mois de campagne
                (clé : date planifiée). Planifiés = tickets applicatifs (+ saisies
                historiques pour les mois d'avant févr. 2026) ; Effectuées = fiches
                applicatives + vidanges historiques saisies.
              </div>

              {loadError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                  <AlertTriangle size={15} /> {loadError}
                </div>
              )}

              {/* Summary chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div
                  className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2"
                  title={totals.manualPlannedUsed > 0
                    ? `dont ${totals.planned - totals.manualPlannedUsed} tickets applicatifs + ${totals.manualPlannedUsed} saisies historiques (avant févr. 2026)`
                    : 'Comptage strictement applicatif — sites avec ticket FullPMWO'}
                >
                  <div className="text-[10px] font-semibold text-indigo-900">Planifiés (ticket FullPMWO)</div>
                  <div className="text-xl font-bold text-indigo-800">{totals.planned}</div>
                </div>
                <div
                  className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2"
                  title={totals.manualDone > 0
                    ? `dont ${totals.done - totals.manualDone} fiches applicatives + ${totals.manualDone} vidanges historiques saisies`
                    : 'Fiches « Effectuée » de l\'application'}
                >
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

              {/* Table — conteneur scrollable, en-tête figée */}
              <div className="border border-gray-200 rounded-lg overflow-auto" style={{ maxHeight: '58vh' }}>
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-600 shadow-[0_1px_0_0_#e5e7eb]">
                      <th className="px-3 py-2 whitespace-nowrap w-36">Campagne</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Planifiés<br /><span className="normal-case font-normal">(ticket FullPMWO)</span></th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Effectuées<br /><span className="normal-case font-normal">(fiches + historique)</span></th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Écart</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Couverture</th>
                      <th className="px-3 py-2 w-72">Comparaison</th>
                      {isSuperAdmin && <th className="px-2 py-2 w-10" title="Saisie manuelle" />}
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
                        <td
                          className="px-3 py-2 font-semibold text-gray-800 capitalize whitespace-nowrap"
                          title={(() => {
                            const parts = [];
                            if (m.manualPlanned > 0) {
                              parts.push(m.plannedFromManual
                                ? `Planifiés : ${m.manualPlanned} saisies historiques (avant l'application)`
                                : `${m.manualPlanned} planifiés saisis non comptés — tickets applicatifs seuls`);
                            }
                            if (m.manualDone > 0) {
                              parts.push(`Effectuées : ${m.manualDone} vidanges historiques saisies (incluses)`);
                            }
                            return parts.length ? `Données hors application — ${parts.join(' · ')}` : undefined;
                          })()}
                        >
                          {monthLabel(m.month)}
                          {m.depassement && (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 align-middle">
                              DÉPASSEMENT
                            </span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-right font-semibold text-indigo-800 whitespace-nowrap"
                          title={m.plannedFromManual
                            ? `${m.planned} planifiés issus des saisies historiques (avant l'application)`
                            : m.manualPlanned > 0
                              ? `${m.manualPlanned} planifiés saisis non comptés — tickets applicatifs seuls`
                              : undefined}
                        >
                          {m.planned}
                          <span className="block text-[10px] font-normal text-gray-400">{m.plannedSites} sites</span>
                        </td>
                        <td
                          className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap"
                          title={m.manualDone > 0
                            ? `dont ${m.done - m.manualDone} fiches applicatives + ${m.manualDone} vidanges historiques saisies`
                            : undefined}
                        >
                          {m.done}
                          <span className="block text-[10px] font-normal text-gray-400">{m.doneSites} sites</span>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${m.delta > 0 ? 'text-amber-700' : 'text-gray-600'}`}>
                          {m.delta > 0 ? '+' : ''}{m.delta}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
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
                        {isSuperAdmin && (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => editMonthManual(m)}
                              className="p-1 rounded text-gray-300 hover:text-amber-600 hover:bg-amber-50"
                              title={`Saisir/ajuster les données historiques de ${monthLabel(m.month)}`}
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-indigo-500" /> Planifiés</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-emerald-500" /> Effectuées</span>
                <span className="flex items-center gap-1"><TrendingUp size={11} /> Dépassement = effectuées &gt; planifiées</span>
                <span className="text-gray-400">Planifiés = tickets applicatifs (+ saisies historiques avant févr. 2026) · Effectuées = fiches applicatives + saisies historiques · survol = décomposition</span>
              </div>

              {/* Manual entries list */}
              {data.manualEntries.length > 0 && (
                <div className="mt-5 border border-amber-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 text-xs font-bold text-amber-900 flex items-center gap-2">
                    <Database size={13} /> Saisies manuelles historiques ({data.manualEntries.length})
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-amber-50/50 text-left text-[10px] uppercase tracking-wide text-amber-800">
                        <th className="px-3 py-1.5">Mois</th>
                        <th className="px-3 py-1.5">Zone</th>
                        <th className="px-3 py-1.5 text-right">Planifiés</th>
                        <th className="px-3 py-1.5 text-right">Effectuées</th>
                        <th className="px-3 py-1.5">Note</th>
                        <th className="px-3 py-1.5">Saisi par</th>
                        {isSuperAdmin && <th className="px-3 py-1.5 w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {data.manualEntries.map((e) => (
                        <tr key={e.id} className="border-t border-amber-100">
                          <td className="px-3 py-1.5 font-semibold capitalize">{monthLabel(e.month)}</td>
                          <td className="px-3 py-1.5">{e.zone}</td>
                          <td className="px-3 py-1.5 text-right">{e.planned}</td>
                          <td className="px-3 py-1.5 text-right">{e.done}</td>
                          <td className="px-3 py-1.5 text-gray-500">{e.note || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-400">{e.createdByEmail || '—'}</td>
                          {isSuperAdmin && (
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => editManual(e)}
                                className="p-1 rounded hover:bg-amber-100 text-amber-700"
                                title="Modifier"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteManual(e.id)}
                                className="p-1 rounded hover:bg-rose-100 text-rose-600"
                                title="Supprimer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataAnalysisModal;
