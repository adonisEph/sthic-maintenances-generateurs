import React, { useMemo, useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDate } from '../../utils/calculations';

const normIdSite = (v) =>
  String(v || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const QuarantineTreatmentModal = ({
  sites,
  allSites,
  apiFetchJson,
  onRefresh,
  onClose
}) => {
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState({});
  const [results, setResults] = useState({});

  const siteMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(allSites) ? allSites : []).forEach((s) => {
      const key = normIdSite(s?.idSite);
      if (key) map.set(key, s);
    });
    return map;
  }, [allSites]);

  const quarantinedList = Array.isArray(sites) ? sites : [];

  const getForm = (idx) => forms[idx] || { nh2A: '', dateA: '' };
  const setForm = (idx, patch) => {
    setForms((prev) => ({ ...prev, [idx]: { ...(prev[idx] || { nh2A: '', dateA: '' }), ...patch } }));
  };

  const handleSubmit = async (idx, sample) => {
    const form = getForm(idx);
    const nh2A = Number(String(form.nh2A || '').trim());
    const dateA = String(form.dateA || '').slice(0, 10);

    if (!Number.isFinite(nh2A) || nh2A < 0) {
      setResults((prev) => ({ ...prev, [idx]: { error: 'NH2 A invalide.' } }));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateA)) {
      setResults((prev) => ({ ...prev, [idx]: { error: 'Date A invalide.' } }));
      return;
    }

    const matchedSite = siteMap.get(normIdSite(sample?.idSite));
    if (!matchedSite) {
      setResults((prev) => ({ ...prev, [idx]: { error: 'Site introuvable dans la base.' } }));
      return;
    }

    setBusy((prev) => ({ ...prev, [idx]: true }));
    try {
      await apiFetchJson(`/api/sites/${matchedSite.id}/nh`, {
        method: 'POST',
        body: JSON.stringify({
          readingDate: dateA,
          nhValue: nh2A,
          reset: false,
          assumeEffectiveNh: true,
          allowDecrease: true
        })
      });
      setResults((prev) => ({ ...prev, [idx]: { success: true } }));
      await onRefresh();
    } catch (e) {
      setResults((prev) => ({ ...prev, [idx]: { error: e?.message || 'Erreur serveur.' } }));
    } finally {
      setBusy((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const treatedCount = Object.values(results).filter((r) => r?.success).length;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} className="flex-shrink-0" />
            <div>
              <div className="font-bold text-base">Sites en quarantaine — Traitement manuel</div>
              <div className="text-xs text-amber-100">
                {quarantinedList.length} site(s) signalé(s) • {treatedCount} traité(s)
              </div>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-amber-700 p-1.5 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Ces sites ont été mis en quarantaine car leur NH2 A est incohérent par rapport au NH1 DV.
            Saisissez manuellement la valeur correcte de NH2 A pour chaque site.
          </div>

          {quarantinedList.length === 0 && (
            <div className="text-center text-gray-500 py-8">Aucun site en quarantaine.</div>
          )}

          {quarantinedList.map((sample, idx) => {
            const matchedSite = siteMap.get(normIdSite(sample?.idSite));
            const form = getForm(idx);
            const result = results[idx];
            const isBusy = busy[idx];

            const reasonLabel = sample?.reason === 'nh2a_below_nh1dv'
              ? 'NH2 A < NH1 DV'
              : sample?.reason === 'nh2a_abnormally_high'
                ? 'NH2 A anormalement > NH1 DV'
                : String(sample?.reason || 'Incohérence');

            return (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{sample?.idSite || '?'}</span>
                      {matchedSite && (
                        <span className="text-xs text-gray-600 truncate">{matchedSite.nameSite}</span>
                      )}
                    </div>
                    <div className="text-xs text-amber-700 font-semibold mt-0.5">{reasonLabel}</div>
                  </div>
                  {result?.success && (
                    <span className="flex items-center gap-1 text-xs text-green-700 font-semibold flex-shrink-0">
                      <CheckCircle size={14} /> Traité
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="bg-white rounded px-2 py-1 border border-gray-200">
                    <div className="text-gray-500">NH1 DV actuel</div>
                    <div className="font-semibold text-gray-800">{sample?.prevNh1DV ?? '-'}</div>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-gray-200">
                    <div className="text-gray-500">NH2 A importé</div>
                    <div className="font-semibold text-red-600">{sample?.nh2A ?? '-'}</div>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-gray-200">
                    <div className="text-gray-500">Date A importé</div>
                    <div className="font-semibold text-gray-800">{sample?.dateA ? formatDate(sample.dateA) : '-'}</div>
                  </div>
                </div>

                {result?.success ? (
                  <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
                    NH2 A mis à jour avec succès.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">NH2 A corrigé</label>
                      <input
                        type="number"
                        value={form.nh2A}
                        onChange={(e) => setForm(idx, { nh2A: e.target.value })}
                        placeholder="Valeur correcte"
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full"
                        disabled={isBusy}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">Date A</label>
                      <input
                        type="date"
                        value={form.dateA}
                        onChange={(e) => setForm(idx, { dateA: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full"
                        disabled={isBusy}
                      />
                    </div>
                    <button
                      onClick={() => handleSubmit(idx, sample)}
                      disabled={isBusy || !form.nh2A || !form.dateA}
                      className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-900 disabled:opacity-50 flex-shrink-0"
                    >
                      {isBusy ? '…' : 'Corriger'}
                    </button>
                  </div>
                )}

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
          <div className="text-xs text-gray-500">
            {treatedCount} / {quarantinedList.length} traité(s)
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

export default QuarantineTreatmentModal;
