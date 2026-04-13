import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';

const norm = (v) => String(v || '').trim().toLowerCase();

const TechnicianNhSiteUpdateModal = ({
  open,
  sites,
  today,
  onClose,
  apiFetchJson,
  loadData,
  loadInterventions,
  bumpInterventionsUiRev
}) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nhValue: '', readingDate: '' });
  const [error, setError] = useState('');

  const selectedSite = useMemo(() => {
    const id = String(selectedId || '').trim();
    if (!id) return null;
    return (Array.isArray(sites) ? sites : []).find((s) => s && String(s.id) === id) || null;
  }, [selectedId, sites]);

  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const arr = Array.isArray(sites) ? sites : [];
    const out = arr
      .filter(Boolean)
      .filter((s) => {
        const a = norm(s.idSite);
        const b = norm(s.nameSite);
        return (a && a.includes(q)) || (b && b.includes(q));
      })
      .slice(0, 50);
    return out;
  }, [query, sites]);

  if (!open) return null;

  const closeAndReset = () => {
    setQuery('');
    setSelectedId('');
    setEditing(false);
    setForm({ nhValue: '', readingDate: '' });
    setError('');
    onClose?.();
  };

  const onPick = (site) => {
    if (!site?.id) return;
    setSelectedId(String(site.id));
    setEditing(false);
    setForm({ nhValue: '', readingDate: String(today || '') });
    setError('');
  };

  const onStartEdit = () => {
    if (!selectedSite?.id) {
      setError('Veuillez sélectionner un site.');
      return;
    }
    setEditing(true);
    setError('');
    setForm((prev) => ({
      nhValue: String(prev?.nhValue || ''),
      readingDate: String(prev?.readingDate || today || '')
    }));
  };

  const onConfirm = async () => {
    setError('');
    if (!selectedSite?.id) {
      setError('Site introuvable.');
      return;
    }
    const readingDate = String(form?.readingDate || '').trim();
    const nhValue = Number(String(form?.nhValue || '').trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
      setError('Date invalide.');
      return;
    }
    if (!Number.isFinite(nhValue) || nhValue < 0) {
      setError('Veuillez saisir un NH valide.');
      return;
    }

    try {
      const ok = window.confirm(
        `Confirmer la mise à jour NH ?\n\nSite: ${selectedSite?.nameSite || ''}\nID: ${selectedSite?.idSite || ''}\nDate: ${readingDate}\nNH2 A: ${nhValue}`
      );
      if (!ok) return;

      const data = await apiFetchJson(`/api/sites/${String(selectedSite.id)}/nh`, {
        method: 'POST',
        body: JSON.stringify({ readingDate, nhValue, reset: false })
      });

      await loadData?.();
      await loadInterventions?.();
      if (typeof bumpInterventionsUiRev === 'function') bumpInterventionsUiRev();

      if (data?.isReset) {
        alert('⚠️ Reset détecté (compteur revenu à 0 ou inférieur). Historique enregistré et calculs recalculés.');
      } else {
        alert('✅ NH mis à jour.');
      }

      setEditing(false);
      setForm({ nhValue: '', readingDate });
    } catch (e) {
      setError(e?.message || 'Erreur serveur.');
    }
  };

  const diff = (() => {
    const v = selectedSite?.diffNHs;
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-800 text-white">
          <div className="font-bold">Mettre à jour NH d'un site</div>
          <div className="flex items-center gap-3">
            <button onClick={closeAndReset} className="hover:bg-slate-900 p-2 rounded">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Rechercher un site (ID site ou nom)</label>
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
              <Search size={16} className="text-gray-500" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setError('');
                }}
                placeholder="Ex: CBPN0001 ou NGAMAKOSSO"
                className="w-full outline-none text-sm"
              />
            </div>
            {query && results.length > 0 && (
              <div className="mt-2 border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                {results.map((s) => (
                  <button
                    key={String(s.id)}
                    type="button"
                    onClick={() => onPick(s)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-b-0 ${
                      String(selectedId) === String(s.id) ? 'bg-slate-100' : ''
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{s.nameSite || '-'}</div>
                    <div className="text-xs text-gray-600">ID: {s.idSite || '-'} • Technicien: {String(s.technician || '').trim() || '-'}</div>
                  </button>
                ))}
              </div>
            )}
            {query && results.length === 0 && (
              <div className="mt-2 text-xs text-gray-500">Aucun résultat.</div>
            )}
          </div>

          {selectedSite && (
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 truncate">{selectedSite.nameSite || ''}</div>
                  <div className="text-xs text-gray-600">ID: {selectedSite.idSite || ''}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600">Diff NHs</div>
                  <div className="text-3xl font-extrabold text-slate-900">{diff == null ? '-' : `${diff}H`}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1">Régime</label>
                  <div className="bg-white border rounded-lg px-3 py-2 text-sm font-semibold">{Number.isFinite(Number(selectedSite.regime)) ? `${Number(selectedSite.regime)}H/J` : '-'}</div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1">Date DV</label>
                  <div className="bg-white border rounded-lg px-3 py-2 text-sm font-semibold">{selectedSite.dateDV || '-'}</div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1">NH1 DV</label>
                  <div className="bg-white border rounded-lg px-3 py-2 text-sm font-semibold">{selectedSite.nh1DV ?? '-'}</div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1">NH2 A</label>
                  <div className="bg-white border rounded-lg px-3 py-2 text-sm font-semibold">{selectedSite.nh2A ?? '-'}</div>
                </div>
              </div>

              <div className="mt-3">
                {!editing ? (
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-900 font-semibold text-sm"
                  >
                    Mettre à jour NH
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">Date du relevé</label>
                        <input
                          type="date"
                          value={form?.readingDate || ''}
                          onChange={(e) => {
                            setForm((p) => ({ ...(p || {}), readingDate: e.target.value }));
                            setError('');
                          }}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">NH2 A relevé (DEEPSEA)</label>
                        <input
                          type="number"
                          value={form?.nhValue || ''}
                          onChange={(e) => {
                            setForm((p) => ({ ...(p || {}), nhValue: e.target.value }));
                            setError('');
                          }}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onConfirm}
                        className="bg-green-700 text-white px-3 py-2 rounded-lg hover:bg-green-800 font-semibold text-sm"
                      >
                        Confirmer la mise à jour
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          setError('');
                        }}
                        className="bg-gray-300 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-400 font-semibold text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white flex justify-end">
          <button
            onClick={closeAndReset}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default TechnicianNhSiteUpdateModal;
