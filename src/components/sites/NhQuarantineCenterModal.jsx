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
  stored_incoherent: 'État stocké incohérent'
};

const SOURCE_LABELS = {
  auto: 'Auto',
  manual: 'Manuel',
  rms: 'RMS',
  scan: 'Scan',
  quarantine: 'Quarantaine'
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

  const pendingItems = useMemo(
    () => (Array.isArray(items) ? items.filter((i) => i.status === 'pending') : []),
    [items]
  );

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiFetchJson('/api/nh-quarantine?status=pending', { method: 'GET' });
      setUnavailable(Boolean(res?.unavailable));
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      setLoadError(e?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const getForm = (id) => forms[id] || { nh2A: '', dateA: '', nh1DV: '', dateDV: '' };
  const setForm = (id, patch) =>
    setForms((prev) => ({ ...prev, [id]: { ...(prev[id] || { nh2A: '', dateA: '', nh1DV: '', dateDV: '' }), ...patch } }));

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
    const ok = window.confirm(
      `Réparer NH1 DV ?\n\nSite: ${entry.siteName || entry.idSite}\nNH1 DV: ${entry.prevNh1DV ?? '?'} → ${nh1DV}\nDate DV: → ${dateDV}`
    );
    if (!ok) return;
    treat(entry, 'fix_nh1dv', { nh1DV, dateDV });
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
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} className="flex-shrink-0" />
            <div>
              <div className="font-bold text-base">Centre de quarantaine NH</div>
              <div className="text-xs text-amber-100">
                {pendingItems.length} entrée(s) en attente — Auto / Manuel / RMS
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

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Chaque valeur incohérente rejetée par les MAJ Auto / Manuel / RMS est persistée ici avec
            la valeur proposée et l'état du site. Traitez-les une par une : correction, rebase
            (compteur/deepsea/générateur changé), réparation NH1 DV (managers) ou classement.
          </div>

          {loadError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{loadError}</div>
          )}

          {unavailable && (
            <div className="text-xs text-red-800 bg-red-50 border border-red-300 rounded-lg px-3 py-2 font-semibold">
              ⚠️ Stockage quarantaine indisponible (table absente ou schéma incomplet). Les incohérences
              signalées par les imports ne sont PAS persistées tant que ce problème n'est pas résolu.
            </div>
          )}

          {!loading && pendingItems.length === 0 && (
            <div className="text-center text-gray-500 py-8">Aucune entrée en quarantaine.</div>
          )}

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
                    <div className="flex gap-1.5 flex-shrink-0">
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

        <div className="border-t bg-white p-3 flex justify-between items-center flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <CheckCircle size={13} className="text-green-600" /> {pendingItems.length} en attente
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
