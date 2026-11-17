import React, { useCallback, useEffect, useState } from 'react';
import { Warehouse, Store, ClipboardList, FileText, Boxes, RefreshCw, AlertTriangle, ArrowRight, PackageCheck, PackageMinus, PackagePlus } from 'lucide-react';
import { toastAlert as alert } from '../../utils/feedback';

const LOCATION_LABEL = { entrepot: 'Entrepôt', magasin: 'Magasin (Buffer)' };
const STATUS_LABEL = { pending: 'En attente', issued: 'Traitée', rejected: 'Refusée', partial_return: 'Retour partiel', returned: 'Retournée', cancelled: 'Annulée' };
const STATUS_CLS = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  issued: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-900 border-rose-200',
  partial_return: 'bg-amber-100 text-amber-900 border-amber-200',
  returned: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};
const TYPE_LABEL = { exit: 'Sortie', entry: 'Entrée', return: 'Retour' };
const TYPE_CLS = {
  exit: 'bg-orange-100 text-orange-900 border-orange-200',
  entry: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  return: 'bg-indigo-100 text-indigo-900 border-indigo-200'
};
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('fr-FR');
};

// Tableau de bord plein écran « Magasin & Stocks HTC » du magasinier.
const HtcDashboard = ({ apiFetchJson, onOpenModule }) => {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [movements, setMovements] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [s, i, r, m] = await Promise.all([
        apiFetchJson('/api/htc/stats'),
        apiFetchJson('/api/htc/items?all=1'),
        apiFetchJson('/api/htc/requests'),
        apiFetchJson('/api/htc/movements')
      ]);
      setStats(s.stats || null);
      setItems(i.items || []);
      setRequests((r.requests || []).filter((x) => x.status === 'pending'));
      setMovements((m.movements || []).slice(0, 8));
    } catch (e) {
      alert(e.message || 'Erreur de chargement.');
    } finally { setBusy(false); }
  }, [apiFetchJson]);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  const active = items.filter((i) => i.active);
  const stockByLoc = {
    entrepot: active.filter((i) => i.location === 'entrepot').reduce((s, i) => s + (Number(i.stock) || 0), 0),
    magasin: active.filter((i) => i.location === 'magasin').reduce((s, i) => s + (Number(i.stock) || 0), 0)
  };
  const ruptures = active.filter((i) => Number(i.stock) <= 0);

  const kpi = (label, value, sub, cls, Icon) => (
    <div className={`border rounded-xl p-4 ${cls}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</div>
        <Icon size={16} className="opacity-60" />
      </div>
      <div className="text-3xl font-extrabold mt-1.5">{value}</div>
      <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="font-bold text-base text-indigo-950">Magasin &amp; Stocks HTC</div>
          <div className="text-[11px] text-gray-500">Matériel client HTC · Entrepôt &amp; Buffer Stock · BZV/POOL</div>
        </div>
        <button onClick={refresh} disabled={busy} className="ml-auto hover:bg-gray-100 p-2 rounded-lg border border-gray-200" title="Rafraîchir">
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {kpi('Demandes en attente', stats?.pendingRequests ?? '—', 'à traiter', 'border-amber-300 bg-amber-50 text-amber-900', ClipboardList)}
        {kpi('Matériel dehors', stats?.materialOutUnits ?? '—', `${stats?.openExitVouchers ?? 0} bon(s) ouvert(s)`, 'border-orange-200 bg-orange-50 text-orange-900', PackageMinus)}
        {kpi('Stock Entrepôt', stockByLoc.entrepot, `${active.filter((i) => i.location === 'entrepot').length} article(s)`, 'border-indigo-200 bg-indigo-50/60 text-indigo-900', Warehouse)}
        {kpi('Stock Magasin', stockByLoc.magasin, `${active.filter((i) => i.location === 'magasin').length} article(s)`, 'border-sky-200 bg-sky-50/70 text-sky-900', Store)}
        {kpi('Ruptures', ruptures.length, 'article(s) à 0', ruptures.length ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50/60 text-emerald-800', AlertTriangle)}
      </div>

      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 mb-5 px-1">
          <span className="font-semibold text-gray-600">Bons ce mois :</span>
          <span className="inline-flex items-center gap-1"><PackagePlus size={13} className="text-emerald-600" /><b className="text-emerald-700">{stats.monthMovements?.entry ?? 0}</b> entrée(s)</span>
          <span className="inline-flex items-center gap-1"><PackageMinus size={13} className="text-orange-600" /><b className="text-orange-700">{stats.monthMovements?.exit ?? 0}</b> sortie(s)</span>
          <span className="inline-flex items-center gap-1"><PackageCheck size={13} className="text-indigo-600" /><b className="text-indigo-700">{stats.monthMovements?.return ?? 0}</b> retour(s)</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Demandes en attente */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">Demandes à traiter</span>
            <button onClick={() => onOpenModule('demandes')} className="text-[11px] font-semibold text-amber-800 hover:underline inline-flex items-center gap-1">
              Traiter <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {requests.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-xs">Aucune demande en attente.</div>
            ) : requests.slice(0, 8).map((r) => (
              <button key={r.id} onClick={() => onOpenModule('demandes')} className="w-full text-left px-4 py-2.5 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-indigo-800">{r.requestNumber}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_CLS[r.status] || ''}`}>{STATUS_LABEL[r.status] || r.status}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{fmtDate(r.createdAt)}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  <b>{r.requesterName}</b>{r.siteName ? ` → ${r.siteName}` : ''} · {r.lines.map((l) => `${l.qty}× ${l.itemName}`).join(' · ')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Derniers bons */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50/70 border-b border-indigo-200">
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Derniers bons</span>
            <button onClick={() => onOpenModule('bons')} className="text-[11px] font-semibold text-indigo-800 hover:underline inline-flex items-center gap-1">
              Registre <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {movements.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-xs">Aucun mouvement enregistré.</div>
            ) : movements.map((mv) => (
              <button key={mv.id} onClick={() => onOpenModule('bons')} className="w-full text-left px-4 py-2.5 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-indigo-800">{mv.number}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TYPE_CLS[mv.type] || ''}`}>{TYPE_LABEL[mv.type]}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{fmtDate(mv.movementDate)} · {LOCATION_LABEL[mv.location] || mv.location}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {mv.requesterName ? <><b>{mv.requesterName}</b> · </> : null}{mv.lines.map((l) => `${l.qty}× ${l.itemName}`).join(' · ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={() => onOpenModule('stock')}
        className="mt-4 w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-indigo-700 inline-flex items-center justify-center gap-2">
        <Boxes size={16} /> Ouvrir Magasin &amp; Stocks HTC
      </button>
    </div>
  );
};

export default HtcDashboard;
