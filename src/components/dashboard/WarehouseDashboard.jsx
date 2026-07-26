import React, { useMemo } from 'react';
import {
  Package,
  ClipboardList,
  CheckCircle2,
  Clock,
  Filter,
  Droplet,
  Fan,
  Wrench,
  AlertTriangle,
  TrendingDown,
  ArrowRightCircle
} from 'lucide-react';

const CONSUMABLE_ICONS = {
  air_filter: Fan,
  coolant_5l: Droplet,
  ventilation_belt: Wrench
};

const CONSUMABLE_LABELS = {
  air_filter: 'Filtre à air',
  coolant_5l: 'Liquide 5L',
  ventilation_belt: 'Courroie vent.'
};

const CONSUMABLE_COLORS = {
  air_filter: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', icon: 'text-sky-600', bar: 'bg-sky-500' },
  coolant_5l: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', icon: 'text-teal-600', bar: 'bg-teal-500' },
  ventilation_belt: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', icon: 'text-purple-600', bar: 'bg-purple-500' }
};

const WarehouseDashboard = ({
  ficheHistory,
  stockSummary,
  stockMovements,
  warehouseProcessCount,
  warehouseReturnsCount,
  onOpenWarehouseProcess,
  onOpenStockConsumables,
  onOpenHistory,
  onRefresh
}) => {
  const list = Array.isArray(ficheHistory) ? ficheHistory.filter(Boolean) : [];

  const currentCampaignMonth = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Brazzaville',
        year: 'numeric',
        month: '2-digit'
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      return y && m ? `${y}-${m}` : new Date().toISOString().slice(0, 7);
    } catch {
      return new Date().toISOString().slice(0, 7);
    }
  }, []);

  const toCampaignMonth = (f) => {
    const dg = f?.dateGenerated ? String(f.dateGenerated).slice(0, 10) : '';
    const pd = f?.plannedDate ? String(f.plannedDate).slice(0, 10) : '';
    const d = dg || pd;
    return d ? String(d).slice(0, 7) : '';
  };

  const inCampaign = list.filter((f) => toCampaignMonth(f) === currentCampaignMonth);

  const pending = inCampaign.filter((f) => {
    const flow = String(f?.warehouseFlowStatus || '').trim();
    if (flow) return flow === 'pending' || flow === 'reopened';
    const status = String(f?.status || '').trim();
    return status === 'Envoyée au magasin' || status === 'Contrôle magasin';
  });

  const processed = inCampaign.filter((f) => String(f?.warehouseFlowStatus || '').trim() === 'finalized');

  const consumableStats = useMemo(() => {
    const types = ['air_filter', 'coolant_5l', 'ventilation_belt'];
    const fields = {
      air_filter: 'warehouseAirFilterOk',
      coolant_5l: 'warehouseCoolant5lOk',
      ventilation_belt: 'warehouseVentilationBeltOk'
    };
    return types.map((type) => {
      const field = fields[type];
      const ok = inCampaign.filter((f) => f[field] === true).length;
      const no = inCampaign.filter((f) => f[field] === false).length;
      const unknown = inCampaign.filter((f) => f[field] !== true && f[field] !== false).length;
      const stockQty = Number(stockSummary?.[type] ?? 0);
      return { type, ok, no, unknown, stockQty };
    });
  }, [inCampaign, stockSummary]);

  const recentExits = useMemo(() => {
    const movements = Array.isArray(stockMovements) ? stockMovements : [];
    return movements
      .filter((m) => m && String(m.movementType || '').trim() === 'exit')
      .slice(0, 8);
  }, [stockMovements]);

  const bySite = useMemo(() => {
    const m = new Map();
    for (const f of inCampaign) {
      const sid = String(f?.siteId || '').trim();
      const name = String(f?.siteName || '').trim();
      const key = sid || name || String(f?.id || '');
      const prev = m.get(key) || {
        siteId: sid, siteName: name, total: 0, pending: 0, processed: 0,
        airOk: 0, airNo: 0, coolantOk: 0, beltOk: 0
      };
      prev.total += 1;
      const flow = String(f?.warehouseFlowStatus || '').trim();
      if (flow === 'pending' || flow === 'reopened') prev.pending += 1;
      if (flow === 'finalized') prev.processed += 1;
      if (f.warehouseAirFilterOk === true) prev.airOk += 1;
      else if (f.warehouseAirFilterOk === false) prev.airNo += 1;
      if (f.warehouseCoolant5lOk === true) prev.coolantOk += 1;
      if (f.warehouseVentilationBeltOk === true) prev.beltOk += 1;
      m.set(key, prev);
    }
    return Array.from(m.values()).sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      if (b.total !== a.total) return b.total - a.total;
      return String(a.siteName || a.siteId || '').localeCompare(String(b.siteName || b.siteId || ''));
    });
  }, [inCampaign]);

  const totalStock = consumableStats.reduce((sum, s) => sum + s.stockQty, 0);
  const lowStockItems = consumableStats.filter((s) => s.stockQty <= 2);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-bold text-gray-900">Dashboard Magasin</div>
          <div className="text-xs text-gray-600">Campagne: {currentCampaignMonth}</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Clock size={16} />
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={onOpenWarehouseProcess}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-950 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <ClipboardList size={16} />
            Fiches process
            {warehouseProcessCount > 0 && (
              <span className="ml-1 bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-full text-[11px] font-bold">
                {warehouseProcessCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenStockConsumables}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Package size={16} />
            Stocks consommables
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Filter size={16} />
            Historique consommables
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-600 font-semibold">À traiter</div>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-amber-700 mt-1">{pending.length}</div>
          <div className="text-xs text-gray-500 mt-1">Contrôle en attente</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-600 font-semibold">Traitées</div>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">{processed.length}</div>
          <div className="text-xs text-gray-500 mt-1">Fiches finalisées</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-600 font-semibold">Total stock</div>
            <Package size={16} className="text-indigo-600" />
          </div>
          <div className="text-3xl font-extrabold text-indigo-700 mt-1">{totalStock}</div>
          <div className="text-xs text-gray-500 mt-1">Consommables disponibles</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-600 font-semibold">Retours magasin</div>
            <ArrowRightCircle size={16} className="text-slate-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-700 mt-1">{warehouseReturnsCount}</div>
          <div className="text-xs text-gray-500 mt-1">Fiches retournées</div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold text-amber-900">Stock bas: </span>
            <span className="text-amber-800">
              {lowStockItems.map((s) => `${CONSUMABLE_LABELS[s.type]} (${s.stockQty})`).join(' • ')}
            </span>
          </div>
        </div>
      )}

      {/* Consumables breakdown */}
      <div>
        <div className="text-sm font-bold text-gray-800 mb-2">Consommables GE — Contrôles campagne</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {consumableStats.map((s) => {
            const Icon = CONSUMABLE_ICONS[s.type] || Package;
            const colors = CONSUMABLE_COLORS[s.type] || CONSUMABLE_COLORS.air_filter;
            const total = s.ok + s.no + s.unknown;
            const okPct = total > 0 ? Math.round((s.ok / total) * 100) : 0;
            return (
              <div key={s.type} className={`${colors.bg} ${colors.border} border rounded-xl p-4`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className={colors.icon} />
                    <span className={`text-sm font-bold ${colors.text}`}>{CONSUMABLE_LABELS[s.type]}</span>
                  </div>
                  <span className={`text-xs font-bold ${colors.text} bg-white/60 px-2 py-0.5 rounded-full`}>
                    Stock: {s.stockQty}
                  </span>
                </div>
                <div className="flex items-end gap-4 mb-2">
                  <div>
                    <div className={`text-2xl font-extrabold ${colors.text}`}>{s.ok}</div>
                    <div className="text-[11px] text-gray-600">Sortis</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-red-700">{s.no}</div>
                    <div className="text-[11px] text-gray-600">Indispo</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-gray-500">{s.unknown}</div>
                    <div className="text-[11px] text-gray-600">À vérifier</div>
                  </div>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full ${colors.bar} transition-all`} style={{ width: `${okPct}%` }} />
                </div>
                <div className="text-[11px] text-gray-600 mt-1">{okPct}% sortis</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent exits + By site table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent stock exits */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <TrendingDown size={16} className="text-slate-600" />
              <div className="font-bold text-gray-900 text-sm">Sorties récentes</div>
            </div>
            <div className="p-3 max-h-[320px] overflow-y-auto">
              {recentExits.length === 0 ? (
                <div className="text-sm text-gray-500 py-4 text-center">Aucune sortie récente</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentExits.map((m) => {
                    const Icon = CONSUMABLE_ICONS[m.itemType] || Package;
                    const colors = CONSUMABLE_COLORS[m.itemType] || CONSUMABLE_COLORS.air_filter;
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-sm border-b border-gray-100 pb-2 last:border-0">
                        <div className={`w-8 h-8 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center flex-shrink-0`}>
                          <Icon size={14} className={colors.icon} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-800 truncate">{m.siteName || m.siteId || '-'}</div>
                          <div className="text-[11px] text-gray-500">
                            {CONSUMABLE_LABELS[m.itemType] || m.itemType} • {String(m.createdAt || '').slice(0, 10)}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-red-700 flex-shrink-0">-{m.quantity || 1}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* By site table */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="font-bold text-gray-900 text-sm">Par site (campagne)</div>
              <div className="text-xs text-gray-600">Total: {inCampaign.length}</div>
            </div>
            <div className="overflow-x-auto max-h-[320px]">
              <table className="min-w-full text-sm">
                <thead className="bg-white sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 border-b">Site</th>
                    <th className="px-3 py-2 border-b text-center">À traiter</th>
                    <th className="px-3 py-2 border-b text-center">Traitées</th>
                    <th className="px-3 py-2 border-b text-center" title="Filtre à air">FA</th>
                    <th className="px-3 py-2 border-b text-center" title="Liquide 5L">LR</th>
                    <th className="px-3 py-2 border-b text-center" title="Courroie">CV</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {bySite.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-gray-500 text-center" colSpan={6}>
                        Aucune fiche sur la campagne {currentCampaignMonth}
                      </td>
                    </tr>
                  ) : (
                    bySite.map((r) => (
                      <tr key={`${r.siteId || ''}_${r.siteName || ''}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border-b font-semibold text-gray-900 truncate max-w-[180px]">{r.siteName || r.siteId || '-'}</td>
                        <td className="px-3 py-2 border-b text-center">
                          {r.pending > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">{r.pending}</span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 border-b text-center">
                          {r.processed > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">{r.processed}</span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 border-b text-center">
                          {r.airOk > 0 ? <span className="text-sky-700 font-bold">{r.airOk}</span> : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 border-b text-center">
                          {r.coolantOk > 0 ? <span className="text-teal-700 font-bold">{r.coolantOk}</span> : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 border-b text-center">
                          {r.beltOk > 0 ? <span className="text-purple-700 font-bold">{r.beltOk}</span> : <span className="text-gray-300">-</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Données basées sur ficheHistory et stock_movements. Rafraîchis manuellement si besoin.
      </div>
    </div>
  );
};

export default WarehouseDashboard;
