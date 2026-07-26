import React, { useMemo, useState, useCallback } from 'react';
import { X, Package, ArrowDownCircle, ArrowUpCircle, Trash2, RotateCcw, Filter } from 'lucide-react';

const ITEM_LABELS = {
  air_filter: 'Filtre à air GE',
  ventilation_belt: 'Courroie de ventilation GE',
  coolant_5l: 'Liquide de refroidissement 5L'
};

const ITEM_COLORS = {
  air_filter: 'bg-sky-100 text-sky-900 border-sky-200',
  ventilation_belt: 'bg-purple-100 text-purple-900 border-purple-200',
  coolant_5l: 'bg-teal-100 text-teal-900 border-teal-200'
};

const StockConsumablesModal = ({
  open,
  onClose,
  busy,
  onRefresh,
  movements,
  stock,
  sites,
  scopeZone,
  canManage,
  canAllZones,
  onCreateMovement,
  onDeleteMovement,
  formatDate
}) => {
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('entry');
  const [formItem, setFormItem] = useState('air_filter');
  const [formQty, setFormQty] = useState(1);
  const [formSite, setFormSite] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formZone, setFormZone] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [filterType, setFilterType] = useState('');
  const [saving, setSaving] = useState(false);

  const sitesArr = Array.isArray(sites) ? sites : [];

  const filteredMovements = useMemo(() => {
    const arr = Array.isArray(movements) ? movements : [];
    return arr.filter((m) => {
      if (filterItem && m.itemType !== filterItem) return false;
      if (filterType && m.movementType !== filterType) return false;
      return true;
    });
  }, [movements, filterItem, filterType]);

  const handleSubmit = async () => {
    if (formQty < 1) {
      alert('Quantité invalide.');
      return;
    }
    if (formType === 'exit' && !formSite) {
      alert('Sélectionnez un site pour la sortie.');
      return;
    }

    const site = sitesArr.find((s) => String(s?.id) === String(formSite));
    const payload = {
      itemType: formItem,
      movementType: formType,
      quantity: formQty,
      siteId: formType === 'exit' ? String(formSite) : null,
      siteName: formType === 'exit' ? (site?.nameSite || '') : null,
      notes: formNotes || null
    };
    if (canAllZones && formZone) {
      payload.zone = formZone;
    }

    setSaving(true);
    try {
      await onCreateMovement(payload);
      setShowForm(false);
      setFormQty(1);
      setFormSite('');
      setFormNotes('');
    } catch (e) {
      alert(e?.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce mouvement de stock ?')) return;
    try {
      await onDeleteMovement(id);
    } catch (e) {
      alert(e?.message || 'Erreur lors de la suppression.');
    }
  };

  if (!open) return null;

  const stockEntries = Object.entries(stock || {});
  const fmtDate = typeof formatDate === 'function' ? formatDate : (d) => String(d || '');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-0 sm:p-4">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-[1100px] sm:max-h-[92vh]">
        <div className="flex items-start justify-between gap-3 px-3 py-3 sm:p-4 border-b bg-slate-800 text-white">
          <div className="min-w-0 flex items-center gap-2">
            <Package size={22} className="flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold break-words whitespace-normal">
                Stocks consommables GE
              </div>
              <div className="text-xs text-white/80">
                {scopeZone ? `Zone: ${scopeZone}` : 'Toutes zones'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {typeof onRefresh === 'function' && (
              <button
                type="button"
                onClick={() => { if (!busy) onRefresh(); }}
                disabled={Boolean(busy)}
                className="hover:bg-white/10 px-3 py-2 rounded flex items-center gap-2 text-sm font-semibold disabled:opacity-60"
                title="Rafraîchir"
              >
                <RotateCcw size={16} />
                Rafraîchir
              </button>
            )}
            <button onClick={onClose} className="hover:bg-white/10 p-2 rounded" title="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {busy && <div className="text-sm text-slate-600 mb-3">Chargement…</div>}

          {/* Stock summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {stockEntries.map(([type, qty]) => (
              <div key={type} className={`border rounded-lg p-4 ${ITEM_COLORS[type] || 'bg-gray-100 border-gray-200'}`}>
                <div className="text-sm font-semibold mb-1">{ITEM_LABELS[type] || type}</div>
                <div className="text-2xl font-bold">{qty}</div>
                <div className="text-xs mt-1">en stock{scopeZone ? ` (${scopeZone})` : ''}</div>
              </div>
            ))}
          </div>

          {/* Action button */}
          {canManage && (
            <div className="mb-4">
              {!showForm ? (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold flex items-center gap-2"
                >
                  <Package size={18} />
                  Nouveau mouvement
                </button>
              ) : (
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="font-bold text-gray-800 mb-3">Nouveau mouvement de stock</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="entry">Entrée</option>
                        <option value="exit">Sortie</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Consommable</label>
                      <select
                        value={formItem}
                        onChange={(e) => setFormItem(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        {Object.entries(ITEM_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Quantité</label>
                      <input
                        type="number"
                        min="1"
                        value={formQty}
                        onChange={(e) => setFormQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    {canAllZones && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Zone</label>
                        <select
                          value={formZone}
                          onChange={(e) => setFormZone(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Ma zone</option>
                          <option value="BZV/POOL">BZV/POOL</option>
                          <option value="PNR/KOUILOU">PNR/KOUILOU</option>
                          <option value="UPCN">UPCN</option>
                        </select>
                      </div>
                    )}
                    {formType === 'exit' && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Site</label>
                        <select
                          value={formSite}
                          onChange={(e) => setFormSite(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">— Sélectionner —</option>
                          {sitesArr
                            .filter((s) => !scopeZone || String(s?.zone || '').trim() === scopeZone)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nameSite} ({s.idSite})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Notes (optionnel)</label>
                      <input
                        type="text"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Commentaire..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={saving}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-60"
                    >
                      {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setFormQty(1); setFormSite(''); setFormNotes(''); }}
                      className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Consommable</label>
              <select
                value={filterItem}
                onChange={(e) => setFilterItem(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {Object.entries(ITEM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Mouvement</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                <option value="entry">Entrées</option>
                <option value="exit">Sorties</option>
              </select>
            </div>
          </div>

          {/* Movements table */}
          <div className="text-xs text-slate-600 mb-3">
            Total: {filteredMovements.length} mouvement(s)
          </div>

          {filteredMovements.length === 0 ? (
            <div className="text-sm text-slate-600">Aucun mouvement trouvé.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 border-b">Date</th>
                    <th className="text-left p-3 border-b">Type</th>
                    <th className="text-left p-3 border-b">Consommable</th>
                    <th className="text-left p-3 border-b">Qté</th>
                    <th className="text-left p-3 border-b">Zone</th>
                    <th className="text-left p-3 border-b">Site</th>
                    <th className="text-left p-3 border-b">Notes</th>
                    <th className="text-left p-3 border-b">Par</th>
                    {canManage && <th className="text-left p-3 border-b"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => (
                    <tr key={m.id} className="odd:bg-white even:bg-slate-50">
                      <td className="p-3 border-b font-mono text-xs">{m.createdAt ? fmtDate(String(m.createdAt).slice(0, 10)) : '-'}</td>
                      <td className="p-3 border-b">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold ${m.movementType === 'entry' ? 'bg-emerald-100 text-emerald-900 border-emerald-200' : 'bg-orange-100 text-orange-900 border-orange-200'}`}>
                          {m.movementType === 'entry' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                          {m.movementType === 'entry' ? 'Entrée' : 'Sortie'}
                        </span>
                      </td>
                      <td className="p-3 border-b">{ITEM_LABELS[m.itemType] || m.itemType}</td>
                      <td className="p-3 border-b font-bold">{m.quantity}</td>
                      <td className="p-3 border-b text-xs">{m.zone || '-'}</td>
                      <td className="p-3 border-b">
                        {m.siteName ? (
                          <div>
                            <div className="font-semibold text-slate-900">{m.siteName}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-3 border-b text-xs text-slate-600">{m.notes || '-'}</td>
                      <td className="p-3 border-b text-xs">{m.createdBy || '-'}</td>
                      {canManage && (
                        <td className="p-3 border-b">
                          <button
                            type="button"
                            onClick={() => handleDelete(m.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockConsumablesModal;
