import React, { useMemo, useState } from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';

const AirFilterHistoryModal = ({
  open,
  onClose,
  busy,
  onRefresh,
  ficheHistory,
  sites,
  formatDate
}) => {
  if (!open) return null;

  const list = Array.isArray(ficheHistory) ? ficheHistory : [];
  const sitesArr = Array.isArray(sites) ? sites : [];

  const siteById = useMemo(() => {
    return new Map(sitesArr.filter(Boolean).map((s) => [String(s.id), s]));
  }, [sitesArr]);

  const toCampaignMonth = (f) => {
    const pd = f?.plannedDate ? String(f.plannedDate).slice(0, 10) : '';
    const dg = f?.dateGenerated ? String(f.dateGenerated).slice(0, 10) : '';
    const d = pd || dg;
    return d ? String(d).slice(0, 7) : '';
  };

  const campaignOptions = useMemo(() => {
    const set = new Set();
    for (const f of list) {
      if (!f) continue;
      const m = toCampaignMonth(f);
      if (m) set.add(m);
    }
    return Array.from(set).sort().reverse();
  }, [list]);

  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterTech, setFilterTech] = useState('');

  const normalize = (v) =>
    String(v || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filtered = useMemo(() => {
    const camp = String(filterCampaign || '').trim();
    const siteNeedle = normalize(filterSite);
    const techNeedle = normalize(filterTech);

    return list
      .filter(Boolean)
      .filter((f) => {
        const st = String(f.status || '').trim().toLowerCase();
        if (st.includes('annul')) return false;
        return true;
      })
      .filter((f) => {
        if (!camp) return true;
        return toCampaignMonth(f) === camp;
      })
      .filter((f) => {
        if (!siteNeedle) return true;
        const sid = String(f.siteId || '').trim();
        const site = siteById.get(sid) || null;
        const s1 = normalize(f.siteName);
        const s2 = normalize(site?.nameSite);
        const s3 = normalize(site?.idSite);
        return s1.includes(siteNeedle) || s2.includes(siteNeedle) || s3.includes(siteNeedle) || normalize(sid).includes(siteNeedle);
      })
      .filter((f) => {
        if (!techNeedle) return true;
        return normalize(f.technician).includes(techNeedle);
      });
  }, [list, filterCampaign, filterSite, filterTech, siteById]);

  const controlledRows = useMemo(() => {
    return filtered
      .filter((f) => f.warehouseAirFilterOk === true || f.warehouseAirFilterOk === false)
      .map((f) => {
        const sid = String(f.siteId || '').trim();
        const site = siteById.get(sid) || null;
        const campaignMonth = toCampaignMonth(f);
        const planned = f?.plannedDate ? String(f.plannedDate).slice(0, 10) : '';
        const generated = f?.dateGenerated ? String(f.dateGenerated).slice(0, 10) : '';
        const checkedAt = f?.warehouseCheckedAt ? String(f.warehouseCheckedAt) : '';
        return {
          id: String(f.id || ''),
          campaignMonth,
          siteName: String(f.siteName || site?.nameSite || '').trim(),
          idSite: site?.idSite != null ? String(site.idSite).trim() : '',
          technician: String(f.technician || '').trim(),
          epvType: String(f.epvType || '').trim().toUpperCase(),
          plannedDate: planned,
          dateGenerated: generated,
          status: f.warehouseAirFilterOk === true ? 'Sorti' : 'Non sorti',
          ticketNumber: String(f.ticketNumber || '').trim(),
          checkedBy: String(f.warehouseCheckedBy || '').trim(),
          checkedAt
        };
      })
      .sort((a, b) => {
        const aa = String(a.checkedAt || a.dateGenerated || '');
        const bb = String(b.checkedAt || b.dateGenerated || '');
        return bb.localeCompare(aa);
      });
  }, [filtered, siteById]);

  const notControlledRows = useMemo(() => {
    return filtered
      .filter((f) => f.warehouseAirFilterOk === null)
      .map((f) => {
        const sid = String(f.siteId || '').trim();
        const site = siteById.get(sid) || null;
        const campaignMonth = toCampaignMonth(f);
        const planned = f?.plannedDate ? String(f.plannedDate).slice(0, 10) : '';
        const generated = f?.dateGenerated ? String(f.dateGenerated).slice(0, 10) : '';
        return {
          id: String(f.id || ''),
          campaignMonth,
          siteName: String(f.siteName || site?.nameSite || '').trim(),
          idSite: site?.idSite != null ? String(site.idSite).trim() : '',
          technician: String(f.technician || '').trim(),
          epvType: String(f.epvType || '').trim().toUpperCase(),
          plannedDate: planned,
          dateGenerated: generated,
          ticketNumber: String(f.ticketNumber || '').trim()
        };
      })
      .sort((a, b) => String(b.dateGenerated || '').localeCompare(String(a.dateGenerated || '')));
  }, [filtered, siteById]);

  const fmtDate = (d) => (typeof formatDate === 'function' ? formatDate(d) : String(d || ''));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-0 sm:p-4">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-[1100px] sm:max-h-[92vh]">
        <div className="flex items-start justify-between gap-3 px-3 py-3 sm:p-4 border-b bg-slate-800 text-white">
          <div className="min-w-0 flex items-center gap-2">
            <Filter size={22} className="flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold break-words whitespace-normal">
                Historique filtre à air GE
              </div>
              <div className="text-xs text-white/80">Contrôlés + Non contrôlés</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {typeof onRefresh === 'function' && (
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  onRefresh();
                }}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Campagne (mois)</label>
              <select
                value={filterCampaign}
                onChange={(e) => setFilterCampaign(String(e.target.value || ''))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Toutes</option>
                {campaignOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Site (nom / ID / code)</label>
              <input
                value={filterSite}
                onChange={(e) => setFilterSite(String(e.target.value || ''))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: MAYA / 1234 / site..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Technicien</label>
              <input
                value={filterTech}
                onChange={(e) => setFilterTech(String(e.target.value || ''))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Nom technicien"
              />
            </div>
          </div>

          <div className="text-xs text-slate-600 mb-5">
            Total filtré: {filtered.length} • Contrôlés: {controlledRows.length} • Non contrôlés: {notControlledRows.length}
          </div>

          <div className="mb-8">
            <div className="text-sm font-bold text-slate-800 mb-2">Contrôles (Sorti / Non sorti)</div>
            {controlledRows.length === 0 ? (
              <div className="text-sm text-slate-600">Aucun contrôle trouvé.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 border-b">Campagne</th>
                      <th className="text-left p-3 border-b">Site</th>
                      <th className="text-left p-3 border-b">Passage</th>
                      <th className="text-left p-3 border-b">Statut</th>
                      <th className="text-left p-3 border-b">Technicien</th>
                      <th className="text-left p-3 border-b">Ticket</th>
                      <th className="text-left p-3 border-b">Contrôlé le</th>
                      <th className="text-left p-3 border-b">Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controlledRows.map((r) => (
                      <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                        <td className="p-3 border-b font-mono">{r.campaignMonth || '-'}</td>
                        <td className="p-3 border-b">
                          <div className="font-semibold text-slate-900">{r.siteName || '-'}</div>
                          <div className="text-xs text-slate-600">ID Site: <span className="font-mono font-semibold">{r.idSite || '-'}</span></div>
                        </td>
                        <td className="p-3 border-b font-mono">{r.epvType || '-'}</td>
                        <td className="p-3 border-b">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full border text-[11px] font-bold ${r.status === 'Sorti' ? 'bg-emerald-100 text-emerald-900 border-emerald-200' : 'bg-red-100 text-red-900 border-red-200'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 border-b">{r.technician || '-'}</td>
                        <td className="p-3 border-b font-mono">{r.ticketNumber || '-'}</td>
                        <td className="p-3 border-b">{r.checkedAt ? fmtDate(String(r.checkedAt).slice(0, 10)) : (r.dateGenerated ? fmtDate(r.dateGenerated) : '-')}</td>
                        <td className="p-3 border-b">{r.checkedBy || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-bold text-slate-800 mb-2">Fiches non contrôlées (filtre non renseigné)</div>
            {notControlledRows.length === 0 ? (
              <div className="text-sm text-slate-600">Aucune fiche non contrôlée trouvée.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 border-b">Campagne</th>
                      <th className="text-left p-3 border-b">Site</th>
                      <th className="text-left p-3 border-b">Passage</th>
                      <th className="text-left p-3 border-b">Technicien</th>
                      <th className="text-left p-3 border-b">Ticket</th>
                      <th className="text-left p-3 border-b">Créée le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notControlledRows.map((r) => (
                      <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                        <td className="p-3 border-b font-mono">{r.campaignMonth || '-'}</td>
                        <td className="p-3 border-b">
                          <div className="font-semibold text-slate-900">{r.siteName || '-'}</div>
                          <div className="text-xs text-slate-600">ID Site: <span className="font-mono font-semibold">{r.idSite || '-'}</span></div>
                        </td>
                        <td className="p-3 border-b font-mono">{r.epvType || '-'}</td>
                        <td className="p-3 border-b">{r.technician || '-'}</td>
                        <td className="p-3 border-b font-mono">{r.ticketNumber || '-'}</td>
                        <td className="p-3 border-b">{r.dateGenerated ? fmtDate(r.dateGenerated) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AirFilterHistoryModal;
