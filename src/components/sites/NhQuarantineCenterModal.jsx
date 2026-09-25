import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, CheckCircle, History, RefreshCw, Wrench, ShieldOff, GitBranch } from 'lucide-react';
import { formatDate } from '../../utils/calculations';
import { startOperation, toast } from '../../utils/feedback';

const REASON_LABELS = {
  nh_below_dv: 'NH2 A < NH1 DV (rebase possible)',
  parasite_high: 'Valeur parasitée (> 24 H/J implicite)',
  date_before_dv: 'Date relevé < Date vidange',
  future_date: 'Date relevé dans le futur',
  date_regression: 'Date relevé < dernier relevé connu',
  decrease: 'Compteur < dernier relevé connu',
  retired_site: 'Relevé sur site retiré (remise en cohérence requise)',
  stored_incoherent: 'État stocké incohérent'
};

const SOURCE_LABELS = {
  auto: 'Auto',
  manual: 'Manuel',
  rms: 'RMS',
  vidange: 'Vidange',
  edit: 'Édition',
  scan: 'Scan',
  quarantine: 'Quarantaine'
};

const TREATMENT_LABELS = {
  correct: 'Correction relevé',
  rebase: 'Rebase compteur',
  fix_nh1dv: 'Réparation NH1 DV',
  dismiss: 'Classé sans suite'
};

const STATUS_LABELS = {
  pending: 'En attente',
  treated: 'Traitée',
  dismissed: 'Classée',
  superseded: 'Remplacée'
};

const NhQuarantineCenterModal = ({ open, onClose, apiFetchJson, onRefresh, canFixNh1Dv }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState({});
  const [results, setResults] = useState({});
  const [history, setHistory] = useState({});
  const [tab, setTab] = useState('pending');
  const [filters, setFilters] = useState({ site: '', source: '', from: '', to: '' });

  const pendingItems = useMemo(
    () => (Array.isArray(items) ? items.filter((i) => i.status === 'pending') : []),
    [items]
  );
  const historyItems = useMemo(
    () => (Array.isArray(items) ? items.filter((i) => i.status !== 'pending') : []),
    [items]
  );

  const load = async (overrideFilters) => {
    const f = overrideFilters || filters;
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      params.set('status', tab === 'pending' ? 'pending' : 'all');
      if (f.site.trim()) params.set('site', f.site.trim());
      if (f.source) params.set('source', f.source);
      if (f.from) params.set('from', f.from);
      if (f.to) params.set('to', f.to);
      const res = await apiFetchJson(`/api/nh-quarantine?${params.toString()}`, { method: 'GET' });
      setUnavailable(Boolean(res?.unavailable));
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(list);
      // Pré-remplir le régime des entrées parasitées avec la suggestion.
      setForms((prev) => {
        const next = { ...prev };
        for (const it of list) {
          if (it?.reason === 'parasite_high' && !(next[it.id]?.regime)) {
            const s = suggestedRegime(it);
            next[it.id] = { ...(next[it.id] || { nh2A: '', dateA: '', nh1DV: '', dateDV: '', regime: '' }), regime: s != null ? String(s) : '' };
          }
        }
        return next;
      });
    } catch (e) {
      setLoadError(e?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  if (!open) return null;

  const getForm = (id) => forms[id] || { nh2A: '', dateA: '', nh1DV: '', dateDV: '', regime: '' };
  const setForm = (id, patch) =>
    setForms((prev) => ({ ...prev, [id]: { ...(prev[id] || { nh2A: '', dateA: '', nh1DV: '', dateDV: '', regime: '' }), ...patch } }));

  const treat = async (entry, action, extra = {}) => {
    setBusy((prev) => ({ ...prev, [entry.id]: true }));
    setResults((prev) => ({ ...prev, [entry.id]: null }));
    const ACTION_LABELS = {
      correct: 'Correction du relevé',
      rebase: 'Rebase du compteur',
      fix_nh1dv: 'Réparation NH1 DV',
      dismiss: 'Classement sans suite'
    };
    const op = startOperation(`${ACTION_LABELS[action] || 'Traitement'} — ${entry.siteName || entry.idSite}…`);
    try {
      await apiFetchJson(`/api/nh-quarantine/${entry.id}/treat`, {
        method: 'POST',
        body: JSON.stringify({ action, ...extra })
      });
      setItems((prev) => prev.filter((i) => i.id !== entry.id));
      op.dismiss();
      toast.success(`${ACTION_LABELS[action] || 'Traitement'} effectué — ${entry.siteName || entry.idSite}`);
      await onRefresh?.();
    } catch (e) {
      op.dismiss();
      setResults((prev) => ({ ...prev, [entry.id]: { error: e?.message || 'Erreur serveur.' } }));
    } finally {
      setBusy((prev) => ({ ...prev, [entry.id]: false }));
    }
  };

  const saneRegime = (r) => Number.isFinite(Number(r)) && Number(r) >= 1 && Number(r) <= 24;

  // Régime suggéré : implicite sur l'état pré-parasite (prev_*), sinon régime
  // stocké sain. Le traitant peut l'ajuster avant d'appliquer (hybride B→C).
  const suggestedRegime = (entry) => {
    const nh2p = Number(entry?.prevNh2A);
    const nh1p = Number(entry?.prevNh1DV);
    const d1 = String(entry?.prevDateDV || '').slice(0, 10);
    const d2 = String(entry?.prevDateA || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d1) && /^\d{4}-\d{2}-\d{2}$/.test(d2)) {
      const dd = Math.floor((Date.parse(`${d2}T00:00:00Z`) - Date.parse(`${d1}T00:00:00Z`)) / 86400000);
      const dv = nh2p - nh1p;
      if (dd > 0 && Number.isFinite(dv)) {
        const r = Math.round(dv / dd);
        if (saneRegime(r)) return r;
      }
    }
    const rs = Number(entry?.siteRegime);
    return saneRegime(rs) ? Math.round(rs) : null;
  };

  // Valeur logique pour une entrée parasitée :
  // nh2_a corrigé = nh1_dv + regime × jours(date_dv → aujourd'hui) ;
  // date_a du site inchangée.
  const autoCorrectValue = (entry, regime) => {
    const nh1 = Number(entry?.prevNh1DV);
    const r = Number(regime);
    const dDv = String(entry?.prevDateDV || '').slice(0, 10);
    if (!Number.isFinite(nh1) || !saneRegime(r)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dDv)) return null;
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Brazzaville',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const days = Math.floor((Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${dDv}T00:00:00Z`)) / 86400000);
    if (!Number.isFinite(days) || days < 0) return null;
    return { nh2A: nh1 + Math.round(r) * days, regime: Math.round(r), days };
  };

  // "Corriger auto" : le régime choisi (champ) prime ; à défaut le serveur
  // dérive l'historique. La valeur logique est chargée dans le formulaire.
  const handleAutoCorrect = (entry) => {
    const dDv = String(entry?.prevDateDV || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dDv)) {
      setResults((prev) => ({ ...prev, [entry.id]: { error: 'Correction auto impossible : date_dv manquante.' } }));
      return;
    }
    const f = getForm(entry.id);
    const chosen = Number(String(f.regime ?? '').trim());
    const regime = saneRegime(chosen) ? Math.round(chosen) : suggestedRegime(entry);
    const v = autoCorrectValue(entry, regime);
    if (v) setForm(entry.id, { nh2A: String(v.nh2A), regime: String(v.regime) });
    // Sans régime résoluble côté client, le serveur tente l'historique nh_readings.
    treat(entry, 'correct', v ? { autoCorrect: true, regime: v.regime } : { autoCorrect: true });
  };

  const handleCorrect = (entry) => {
    const f = getForm(entry.id);
    const nh2A = Number(String(f.nh2A || '').trim());
    const dateA = String(f.dateA || '').slice(0, 10);
    if (!Number.isFinite(nh2A) || nh2A < 0) {
      setResults((prev) => ({ ...prev, [entry.id]: { error: 'NH2 A corrigé invalide.' } }));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateA)) {
      setResults((prev) => ({ ...prev, [entry.id]: { error: 'Date A invalide.' } }));
      return;
    }
    treat(entry, 'correct', { nh2A, dateA });
  };

  const handleRebase = (entry) => {
    const f = getForm(entry.id);
    const nh2A = f.nh2A !== '' ? Number(String(f.nh2A).trim()) : entry.proposedNh2A;
    const dateA = String(f.dateA || entry.proposedDateA || '').slice(0, 10);
    const ok = window.confirm(
      `Confirmer le rebase (compteur/deepsea/générateur changé) ?\n\n` +
      `Site: ${entry.siteName || entry.idSite}\n` +
      `Nouvelle base NH1 DV: ${nh2A ?? '?'} (remplace ${entry.prevNh1DV ?? '?'})\n` +
      `La surveillance Diff NHs repart de 0.`
    );
    if (!ok) return;
    treat(entry, 'rebase', { nh2A, dateA: dateA || undefined });
  };

  const handleFixNh1Dv = (entry) => {
    const f = getForm(entry.id);
    const nh1DV = Number(String(f.nh1DV || '').trim());
    const dateDV = String(f.dateDV || '').slice(0, 10);
    if (!Number.isFinite(nh1DV) || nh1DV < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateDV)) {
      setResults((prev) => ({ ...prev, [entry.id]: { error: 'NH1 DV / Date DV corrigés invalides.' } }));
      return;
    }
    const nh2Raw = String(f.nh2A || '').trim();
    const extra = {};
    if (nh2Raw !== '') extra.nh2A = Number(nh2Raw);
    if (String(f.dateA || '').trim()) extra.dateA = String(f.dateA).slice(0, 10);
    if (String(f.regime || '').trim()) extra.regime = Number(f.regime);
    const ok = window.confirm(
      `Réparer NH1 DV ?\n\nSite: ${entry.siteName || entry.idSite}\n` +
      `NH1 DV: ${entry.prevNh1DV ?? '?'} → ${nh1DV}\nDate DV: → ${dateDV}\n\n` +
      (extra.nh2A != null
        ? `NH2 A sera remplacé par ${extra.nh2A} (date ${extra.dateA || 'aujourd\'hui'}).`
        : `NH2 A sera automatiquement remis en cohérence : NH1 DV + régime × jours depuis la vidange (date A = aujourd'hui).`)
    );
    if (!ok) return;
    treat(entry, 'fix_nh1dv', { nh1DV, dateDV, ...extra });
  };

  const handleDismiss = (entry) => {
    const ok = window.confirm(`Classer sans suite l'entrée quarantaine de ${entry.siteName || entry.idSite} ?`);
    if (!ok) return;
    treat(entry, 'dismiss');
  };

  const toggleHistory = async (entry) => {
    if (history[entry.id]?.open) {
      setHistory((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], open: false } }));
      return;
    }
    setHistory((prev) => ({ ...prev, [entry.id]: { open: true, loading: true, items: [] } }));
    try {
      const res = await apiFetchJson(`/api/sites/${entry.siteId}/nh-readings`, { method: 'GET' });
      setHistory((prev) => ({ ...prev, [entry.id]: { open: true, loading: false, items: res?.items || [] } }));
    } catch {
      setHistory((prev) => ({ ...prev, [entry.id]: { open: true, loading: false, items: [] } }));
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-1 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden max-h-[95vh] sm:max-h-[92vh] flex flex-col">
        <div className="bg-amber-600 text-white px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle size={22} className="flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-base">Centre de quarantaine NH</div>
              <div className="text-xs text-amber-100 truncate">
                {tab === 'pending'
                  ? `${pendingItems.length} entrée(s) en attente — Auto / Manuel / RMS`
                  : `${historyItems.length} traitement(s) — historique des remises en cohérence`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} className="hover:bg-amber-700 p-1.5 rounded" title="Rafraîchir">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="hover:bg-amber-700 p-1.5 rounded">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Onglets + filtres */}
        <div className="border-b border-gray-200 bg-gray-50 px-3 sm:px-4 pt-3 flex-shrink-0">
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setTab('pending')}
              className={`px-3 sm:px-4 py-1.5 rounded-t-lg text-xs sm:text-sm font-semibold ${
                tab === 'pending' ? 'bg-white text-amber-700 border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              En attente ({pendingItems.length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-3 sm:px-4 py-1.5 rounded-t-lg text-xs sm:text-sm font-semibold ${
                tab === 'history' ? 'bg-white text-amber-700 border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Historique
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2 pb-2.5">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] text-gray-500 block mb-0.5">Site (ID ou nom)</label>
              <input
                type="text"
                value={filters.site}
                onChange={(e) => setFilters((p) => ({ ...p, site: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="CBKL0047, Kouilou…"
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full bg-white"
              />
            </div>
            <div className="w-28">
              <label className="text-[10px] text-gray-500 block mb-0.5">Mode</label>
              <select
                value={filters.source}
                onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full bg-white"
              >
                <option value="">Tous</option>
                <option value="auto">Auto</option>
                <option value="manual">Manuel</option>
                <option value="rms">RMS</option>
                <option value="vidange">Vidange</option>
                <option value="scan">Scan</option>
                <option value="quarantine">Quarantaine</option>
              </select>
            </div>
            <div className="w-32">
              <label className="text-[10px] text-gray-500 block mb-0.5">Reçu du</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full bg-white"
              />
            </div>
            <div className="w-32">
              <label className="text-[10px] text-gray-500 block mb-0.5">au</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-full bg-white"
              />
            </div>
            <button
              onClick={load}
              className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-700 flex-shrink-0"
            >
              Rechercher
            </button>
            <button
              onClick={() => { const empty = { site: '', source: '', from: '', to: '' }; setFilters(empty); load(empty); }}
              className="text-gray-500 hover:text-gray-800 px-2 py-1.5 text-xs flex-shrink-0"
              title="Réinitialiser les filtres"
            >
              Réinit.
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 sm:p-4 flex-1">
          {tab === 'pending' && (
            <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Chaque valeur incohérente rejetée par les MAJ Auto / Manuel / RMS est persistée ici avec
              la valeur proposée et l'état du site. Traitez-les une par une : correction, rebase
              (compteur/deepsea/générateur changé), réparation NH1 DV (managers) ou classement.
            </div>
          )}

          {loadError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{loadError}</div>
          )}

          {unavailable && (
            <div className="text-xs text-red-800 bg-red-50 border border-red-300 rounded-lg px-3 py-2 mb-3 font-semibold">
              ⚠️ Stockage quarantaine indisponible (table absente ou schéma incomplet). Les incohérences
              signalées par les imports ne sont PAS persistées tant que ce problème n'est pas résolu.
            </div>
          )}

          {tab === 'pending' && !loading && pendingItems.length === 0 && (
            <div className="text-center text-gray-500 py-8">Aucune entrée en quarantaine.</div>
          )}
          {tab === 'history' && !loading && historyItems.length === 0 && (
            <div className="text-center text-gray-500 py-8">Aucun traitement trouvé pour ces critères.</div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {historyItems.map((entry) => {
                return (
                  <div key={entry.id} className="border border-gray-200 rounded-lg px-3 py-2 bg-white flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="min-w-[150px]">
                      <span className="font-bold text-sm text-gray-900">{entry.idSite || entry.siteId}</span>
                      {entry.siteName && <span className="text-xs text-gray-500 ml-1.5 truncate">{entry.siteName}</span>}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-white font-semibold uppercase">
                      {SOURCE_LABELS[entry.source] || entry.source}
                    </span>
                    <span className="text-[11px] text-amber-700 font-semibold">
                      {REASON_LABELS[entry.reason] || entry.reason}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      entry.status === 'treated' ? 'bg-emerald-100 text-emerald-800' :
                      entry.status === 'dismissed' ? 'bg-gray-200 text-gray-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {entry.status === 'treated'
                        ? (TREATMENT_LABELS[entry.treatment] || 'Traitée')
                        : (STATUS_LABELS[entry.status] || entry.status)}
                    </span>
                    <span className="text-[11px] text-gray-600">
                      Rejeté: <span className="font-semibold">{entry.proposedNh2A ?? '-'}H</span>
                      {entry.proposedDateA ? ` (${formatDate(entry.proposedDateA)})` : ''}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Reçu: {entry.createdAt ? `${formatDate(String(entry.createdAt).slice(0, 10))} ${String(entry.createdAt).slice(11, 16)}` : '-'}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Traité: {entry.treatedAt ? `${formatDate(String(entry.treatedAt).slice(0, 10))} ${String(entry.treatedAt).slice(11, 16)}` : '-'}
                      {entry.treatedByEmail ? ` par ${entry.treatedByEmail}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'pending' && (
          <div className="grid gap-3 xl:grid-cols-2">
          {pendingItems.map((entry) => {
            const f = getForm(entry.id);
            const result = results[entry.id];
            const isBusy = busy[entry.id];
            const hist = history[entry.id];
            const isBelowDv = entry.reason === 'nh_below_dv';

            return (
              <div key={entry.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{entry.idSite || entry.siteId}</span>
                      {entry.siteName && <span className="text-xs text-gray-600 truncate">{entry.siteName}</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-white font-semibold uppercase">
                        {SOURCE_LABELS[entry.source] || entry.source}
                      </span>
                    </div>
                    <div className="text-xs text-amber-700 font-semibold mt-0.5">
                      {REASON_LABELS[entry.reason] || entry.reason}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {entry.technician ? `Technicien: ${entry.technician} • ` : ''}
                      {entry.createdAt ? `Reçu le ${formatDate(String(entry.createdAt).slice(0, 10))}` : ''}
                      {entry.createdByEmail ? ` par ${entry.createdByEmail}` : ''}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                  <div className="bg-white rounded px-2 py-1 border border-gray-200">
                    <div className="text-gray-500">NH1 DV</div>
                    <div className="font-semibold text-gray-800">{entry.prevNh1DV ?? '-'}</div>
                    <div className="text-[10px] text-gray-400">{entry.prevDateDV ? formatDate(entry.prevDateDV) : ''}</div>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-gray-200">
                    <div className="text-gray-500">NH2 A actuel</div>
                    <div className="font-semibold text-gray-800">{entry.prevNh2A ?? '-'}</div>
                    <div className="text-[10px] text-gray-400">{entry.prevDateA ? formatDate(entry.prevDateA) : ''}</div>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-red-200 col-span-2">
                    <div className="text-gray-500">Valeur rejetée</div>
                    <div className="font-semibold text-red-600">{entry.proposedNh2A ?? '-'}</div>
                    <div className="text-[10px] text-gray-400">{entry.proposedDateA ? formatDate(entry.proposedDateA) : ''}</div>
                  </div>
                </div>

                {entry.detail?.impliedRegime != null && (
                  <div className="text-[11px] text-gray-500 mb-2">
                    Régime implicite : {entry.detail.impliedRegime} H/J sur {entry.detail.days ?? '?'} jour(s)
                  </div>
                )}

                {entry.reason === 'parasite_high' && (() => {
                  const chosen = Number(String(getForm(entry.id).regime ?? '').trim());
                  const regime = saneRegime(chosen) ? Math.round(chosen) : suggestedRegime(entry);
                  const v = autoCorrectValue(entry, regime);
                  const hasDateDv = /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.prevDateDV || '').slice(0, 10));
                  return (
                    <div className="text-[11px] bg-indigo-50 border border-indigo-200 rounded px-2 py-1.5 mb-2 text-indigo-800">
                      {v ? (
                        <>
                          Valeur logique suggérée : <span className="font-bold">{v.nh2A} H</span>
                          <span className="text-indigo-600"> = {entry.prevNh1DV} (NH1 DV) + {v.regime} H/J × {v.days} j depuis la vidange</span>
                        </>
                      ) : !hasDateDv ? (
                        <span className="text-gray-600">Correction auto indisponible : date_dv manquante.</span>
                      ) : (
                        <span className="text-indigo-700">
                          Régime non suggérable (état stocké corrompu) — saisissez le régime (1–24) dans le champ, ou cliquez "Corriger auto" : le serveur tentera de le déduire de l'historique des relevés.
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">NH2 A corrigé</label>
                      <input
                        type="number"
                        value={f.nh2A}
                        onChange={(e) => setForm(entry.id, { nh2A: e.target.value })}
                        placeholder={entry.proposedNh2A != null ? String(entry.proposedNh2A) : 'Valeur'}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full"
                        disabled={isBusy}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Date A</label>
                      <input
                        type="date"
                        value={f.dateA}
                        onChange={(e) => setForm(entry.id, { dateA: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full"
                        disabled={isBusy}
                      />
                    </div>
                    {entry.reason === 'parasite_high' && (
                      <div className="w-20 flex-shrink-0">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Régime H/J</label>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          value={f.regime}
                          onChange={(e) => setForm(entry.id, { regime: e.target.value })}
                          placeholder={(() => { const s = suggestedRegime(entry); return s != null ? String(s) : '?'; })()}
                          className="border border-indigo-300 rounded-lg px-2 py-1.5 text-sm w-full"
                          disabled={isBusy}
                        />
                      </div>
                    )}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {entry.reason === 'parasite_high' && /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.prevDateDV || '').slice(0, 10)) ? (
                        <button
                          onClick={() => handleAutoCorrect(entry)}
                          disabled={isBusy}
                          className="bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50"
                          title="Applique la valeur logique : NH1 DV + régime × jours (calculée côté serveur)"
                        >
                          Corriger auto
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleCorrect(entry)}
                        disabled={isBusy}
                        className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-900 disabled:opacity-50"
                        title="Appliquer une valeur corrigée"
                      >
                        Corriger
                      </button>
                      {isBelowDv && (
                        <button
                          onClick={() => handleRebase(entry)}
                          disabled={isBusy}
                          className="bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-800 disabled:opacity-50 flex items-center gap-1"
                          title="Compteur/deepsea/générateur changé : la valeur devient la nouvelle base NH1 DV"
                        >
                          <GitBranch size={13} /> Rebase
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(entry)}
                        disabled={isBusy}
                        className="bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-400 disabled:opacity-50"
                        title="Classer sans suite"
                      >
                        <ShieldOff size={13} />
                      </button>
                    </div>
                  </div>

                  {canFixNh1Dv && (
                    <div className="flex flex-col sm:flex-row gap-2 items-end border-t border-dashed border-gray-300 pt-2">
                      <div className="text-[10px] text-gray-500 w-full sm:w-auto sm:pr-2 flex items-center gap-1">
                        <Wrench size={11} /> Réparer baseline
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 block mb-0.5">NH1 DV corrigé</label>
                        <input
                          type="number"
                          value={f.nh1DV}
                          onChange={(e) => setForm(entry.id, { nh1DV: e.target.value })}
                          placeholder={entry.prevNh1DV != null ? String(entry.prevNh1DV) : 'NH1 DV'}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full"
                          disabled={isBusy}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Date DV</label>
                        <input
                          type="date"
                          value={f.dateDV}
                          onChange={(e) => setForm(entry.id, { dateDV: e.target.value })}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full"
                          disabled={isBusy}
                        />
                      </div>
                      <button
                        onClick={() => handleFixNh1Dv(entry)}
                        disabled={isBusy}
                        className="bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-800 disabled:opacity-50 flex-shrink-0"
                      >
                        Réparer NH1
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => toggleHistory(entry)}
                    className="self-start text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <History size={12} /> {hist?.open ? 'Masquer' : 'Historique NH'}
                  </button>
                  {hist?.open && (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto">
                      {hist.loading && <div className="text-xs text-gray-400">Chargement…</div>}
                      {!hist.loading && (hist.items || []).length === 0 && (
                        <div className="text-xs text-gray-400">Aucun relevé enregistré.</div>
                      )}
                      {(hist.items || []).map((h) => (
                        <div key={h.id} className="text-[11px] text-gray-600 py-0.5 border-b last:border-b-0 border-gray-100 flex gap-2 flex-wrap">
                          <span className="font-mono">{h.readingDate ? formatDate(h.readingDate) : '-'}</span>
                          <span className="font-semibold">{h.nhValue ?? '-'}H</span>
                          {h.isReset && <span className="text-indigo-600 font-semibold">RESET</span>}
                          {h.source && <span className="text-gray-400">[{h.source}]</span>}
                          <span className="text-gray-400">{h.createdByEmail || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {result?.error && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1.5">
                    {result.error}
                  </div>
                )}
              </div>
            );
          })}
          </div>
          )}
        </div>

        <div className="border-t bg-white p-3 flex justify-between items-center flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <CheckCircle size={13} className="text-green-600" />
            {tab === 'pending' ? `${pendingItems.length} en attente` : `${historyItems.length} traitement(s)`}
          </div>
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default NhQuarantineCenterModal;
