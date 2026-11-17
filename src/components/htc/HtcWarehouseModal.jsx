import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Package, ClipboardList, FileText, Boxes, Plus, Trash2, Check, Ban,
  Printer, RotateCcw, RefreshCw, AlertTriangle, Search, Warehouse, Store
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import { toastAlert as alert } from '../../utils/feedback';

const LOCATION_LABEL = { entrepot: 'Entrepôt', magasin: 'Magasin (Buffer)' };
const TYPE_LABEL = { exit: 'Sortie', entry: 'Entrée', return: 'Retour' };
const TYPE_BON = { exit: 'BON DE SORTIE', entry: "BON D'ENTRÉE", return: 'BON DE RETOUR' };
const STATUS_LABEL = {
  pending: 'En attente', issued: 'Traitée', rejected: 'Refusée', cancelled: 'Annulée',
  partial_return: 'Retour partiel', returned: 'Retournée'
};
const STATUS_CLS = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  issued: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-900 border-rose-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  partial_return: 'bg-amber-100 text-amber-900 border-amber-200',
  returned: 'bg-emerald-100 text-emerald-900 border-emerald-200'
};
const REQUESTER_ROLE_LABEL = {
  field_supervisor: 'Field Supervisor', technician: 'Technicien',
  htc_supervisor: 'Superviseur Zonal HTC', manager: 'Manager', warehouse: 'Magasinier', admin: 'Admin'
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('fr-FR');
};

function printBon(mv) {
  const typeLabel = TYPE_BON[mv.type] || 'BON';
  const rows = (mv.lines || []).map((l, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td>${esc(l.itemName)}</td>
      <td class="c">${esc(LOCATION_LABEL[l.location] || l.location || '—')}</td>
      <td class="c">${l.qty}</td>
      ${mv.type === 'exit' ? `<td class="c">${l.qtyReturned || 0}</td>` : ''}
    </tr>`).join('');
  const sig = mv.signatureImage
    ? `<img src="${mv.signatureImage}" alt="signature" style="max-height:52px;max-width:180px"/>`
    : (mv.signatureName ? `<div class="signame">${esc(mv.signatureName)}</div>` : '—');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(mv.number)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;padding:22px;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .top{display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #1e3a5f;padding-bottom:10px}
  .top img{height:44px;width:auto}
  .top .t{flex:1}
  .top .t .doc{font-size:19px;font-weight:800;color:#1e3a5f;letter-spacing:.3px}
  .top .t .sub{font-size:10.5px;color:#64748b;margin-top:2px}
  .num{text-align:right}
  .num .n{font-size:16px;font-weight:800;color:#b45309;font-family:Consolas,monospace}
  .num .d{font-size:10.5px;color:#64748b}
  .meta{display:grid;grid-template-columns:repeat(4,1fr);border:1.2px solid #475569;margin-top:14px}
  .meta>div{padding:6px 9px;border-right:1px solid #94a3b8}
  .meta>div:last-child{border-right:none}
  .meta .l{font-size:8.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#64748b}
  .meta .v{font-size:11.5px;font-weight:700;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-top:14px;border:1.2px solid #475569}
  th{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#1e293b;background:#eef2f7;text-align:left;padding:6px 9px;border-bottom:1.2px solid #475569}
  td{padding:6px 9px;font-size:11px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  td.n{width:26px;text-align:center;color:#64748b}
  td.c{text-align:center}
  .reason{margin-top:12px;font-size:10.5px}
  .reason b{color:#1e293b}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:26px}
  .sign .b{border-top:1.2px solid #475569;padding-top:6px;font-size:9.5px;color:#475569;text-align:center;min-height:70px}
  .sign .b .signame{font-family:'Segoe Script','Brush Script MT',cursive;font-size:15px;color:#0f172a;margin-bottom:4px}
  .foot{margin-top:18px;font-size:8.5px;color:#94a3b8;text-align:center}
</style></head><body>
  <div class="top">
    <img src="${location.origin}/Logo_sthic.png" alt="STHIC"/>
    <div class="t"><div class="doc">${esc(typeLabel)} — MATÉRIEL HTC</div><div class="sub">STHIC · Magasin &amp; Stocks HTC · Zone BZV/POOL</div></div>
    <div class="num"><div class="n">${esc(mv.number)}</div><div class="d">Date : ${esc(fmtDate(mv.movementDate))}</div></div>
  </div>
  <div class="meta">
    <div><div class="l">Lieu</div><div class="v">${esc(LOCATION_LABEL[mv.location] || mv.location)}</div></div>
    <div><div class="l">Demandeur</div><div class="v">${esc(mv.requesterName || '—')}</div></div>
    <div><div class="l">Fonction</div><div class="v">${esc(REQUESTER_ROLE_LABEL[mv.requesterRole] || mv.requesterRole || '—')}</div></div>
    <div><div class="l">Destination</div><div class="v">${esc(mv.siteName || '—')}</div></div>
  </div>
  <table>
    <thead><tr><th class="n">#</th><th>Désignation</th><th>Lieu</th><th>Qté</th>${mv.type === 'exit' ? '<th>Retourné</th>' : ''}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${mv.reason ? `<div class="reason"><b>Motif :</b> ${esc(mv.reason)}</div>` : ''}
  ${mv.returnOfNumber ? `<div class="reason"><b>Retour de :</b> ${esc(mv.returnOfNumber)}</div>` : ''}
  <div class="sign">
    <div class="b">${sig}Signature du demandeur</div>
    <div class="b"><div class="signame">${esc(mv.createdByName || '')}</div>Signature du magasinier</div>
  </div>
  <div class="foot">Document généré le ${esc(new Date().toLocaleDateString('fr-FR'))} · STHIC — Gestion Maintenance &amp; Vidanges</div>
</body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => { try { iframe.contentWindow.print(); } finally { setTimeout(() => iframe.remove(), 800); } }, 250);
}

// ---------- Lignes multi-articles (demande / entrée) ----------
const LinesEditor = ({ items, lines, setLines, disabled }) => {
  const addLine = () => setLines([...lines, { itemId: '', qty: 1 }]);
  const setLine = (i, patch) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const rmLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  return (
    <div>
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2 mb-2 items-center">
          <select
            className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white disabled:opacity-60"
            value={l.itemId}
            disabled={disabled}
            onChange={(e) => setLine(i, { itemId: e.target.value })}
          >
            <option value="">— Choisir un article —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} · {LOCATION_LABEL[it.location] || it.location}{it.stock != null ? ` · stock ${it.stock}` : ''}
              </option>
            ))}
          </select>
          <input
            type="number" min="1" max="10000" value={l.qty} disabled={disabled}
            onChange={(e) => setLine(i, { qty: e.target.value })}
            className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
          />
          <button type="button" onClick={() => rmLine(i)} disabled={disabled || lines.length <= 1}
            className="p-2 text-gray-400 hover:text-rose-600 disabled:opacity-40">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addLine} disabled={disabled}
        className="text-sm text-indigo-700 font-semibold hover:underline inline-flex items-center gap-1 disabled:opacity-40">
        <Plus size={14} /> Ajouter un article
      </button>
    </div>
  );
};

const SignBlock = ({ sigImg, setSigImg, sigName, setSigName }) => (
  <div>
    <SignaturePad onChange={setSigImg} />
    <div className="mt-2">
      <input
        type="text" value={sigName} onChange={(e) => setSigName(e.target.value)}
        placeholder="…ou tapez le nom du signataire"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
      {sigImg && <div className="text-[11px] text-emerald-700 mt-1">Signature dessinée enregistrée ✓</div>}
    </div>
  </div>
);

// ============================== MODAL ==============================
const HtcWarehouseModal = ({ open, onClose, apiFetchJson, isManager, sites = [], initialTab = 'stock' }) => {
  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [movements, setMovements] = useState([]);
  const [busy, setBusy] = useState(false);
  const [stockLoc, setStockLoc] = useState('entrepot');

  // Filtres bons
  const [mvType, setMvType] = useState('all');
  const [mvLoc, setMvLoc] = useState('all');
  const [mvQ, setMvQ] = useState('');
  const [mvFrom, setMvFrom] = useState('');
  const [mvTo, setMvTo] = useState('');

  // Nouvelle demande / entrée
  const [formOpen, setFormOpen] = useState(false);
  const [formLines, setFormLines] = useState([{ itemId: '', qty: 1 }]);
  const [formSite, setFormSite] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [onBehalf, setOnBehalf] = useState(false);
  const [behalfRole, setBehalfRole] = useState('htc_supervisor');
  const [behalfName, setBehalfName] = useState('');

  // Entrée directe
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryLines, setEntryLines] = useState([{ itemId: '', qty: 1 }]);
  const [entryDate, setEntryDate] = useState('');
  const [entryReason, setEntryReason] = useState('');
  const [entrySupplier, setEntrySupplier] = useState('');

  // Traitement demande
  const [procReq, setProcReq] = useState(null); // {mode:'issue'|'reject', request}
  const [procDate, setProcDate] = useState('');
  const [procReason, setProcReason] = useState('');
  const [procSigImg, setProcSigImg] = useState('');
  const [procSigName, setProcSigName] = useState('');

  // Retour
  const [retMv, setRetMv] = useState(null);
  const [retLines, setRetLines] = useState({});
  const [retDate, setRetDate] = useState('');
  const [retSigImg, setRetSigImg] = useState('');
  const [retSigName, setRetSigName] = useState('');

  // Articles
  const [itemForm, setItemForm] = useState({ id: '', name: '', category: 'other', location: 'entrepot', unit: 'pièce', notes: '' });

  const loadItems = useCallback(async () => {
    const d = await apiFetchJson('/api/htc/items?all=1');
    setItems(d.items || []);
  }, [apiFetchJson]);

  const loadRequests = useCallback(async () => {
    const d = await apiFetchJson('/api/htc/requests');
    setRequests(d.requests || []);
    setPendingCount(Number(d.pendingCount || 0));
  }, [apiFetchJson]);

  const loadMovements = useCallback(async () => {
    if (!isManager) return;
    const p = new URLSearchParams();
    if (mvType !== 'all') p.set('type', mvType);
    if (mvLoc !== 'all') p.set('location', mvLoc);
    if (mvQ) p.set('q', mvQ);
    if (mvFrom) p.set('from', mvFrom);
    if (mvTo) p.set('to', mvTo);
    const d = await apiFetchJson(`/api/htc/movements?${p.toString()}`);
    setMovements(d.movements || []);
  }, [apiFetchJson, isManager, mvType, mvLoc, mvQ, mvFrom, mvTo]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try { await Promise.all([loadItems(), loadRequests(), loadMovements()]); }
    catch (e) { alert(e.message || 'Erreur de chargement.'); }
    finally { setBusy(false); }
  }, [loadItems, loadRequests, loadMovements]);

  useEffect(() => { if (open) { setTab(isManager ? initialTab : 'demandes'); refresh(); } }, [open]); // eslint-disable-line
  useEffect(() => { if (open && isManager) loadMovements().catch(() => {}); }, [mvType, mvLoc, mvFrom, mvTo]); // eslint-disable-line

  const itemsByLoc = useMemo(() => ({
    entrepot: items.filter((i) => i.active && i.location === 'entrepot'),
    magasin: items.filter((i) => i.active && i.location === 'magasin')
  }), [items]);

  const sitesBzv = useMemo(() => (sites || []), [sites]);

  const submitRequest = async () => {
    const lines = formLines.filter((l) => l.itemId && Number(l.qty) >= 1);
    if (!lines.length) return alert('Ajoute au moins un article.');
    const site = sitesBzv.find((s) => String(s.id) === String(formSite));
    setBusy(true);
    try {
      await apiFetchJson('/api/htc/requests', {
        method: 'POST',
        body: JSON.stringify({
          lines: lines.map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })),
          siteId: site?.id || '', siteName: site?.name || site?.site_name || '',
          reason: formReason, notes: formNotes,
          ...(onBehalf && isManager ? { onBehalf: { role: behalfRole, name: behalfName } } : {})
        })
      });
      setFormOpen(false); setFormLines([{ itemId: '', qty: 1 }]); setFormSite(''); setFormReason(''); setFormNotes('');
      setOnBehalf(false); setBehalfName('');
      await loadRequests();
      alert('Demande envoyée au magasinier.');
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const cancelRequest = async (r) => {
    if (!window.confirm(`Annuler la demande ${r.requestNumber} ?`)) return;
    setBusy(true);
    try { await apiFetchJson(`/api/htc/requests/${r.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'cancel' }) }); await loadRequests(); }
    catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const processRequest = async (force = false) => {
    if (!procReq) return;
    setBusy(true);
    try {
      if (procReq.mode === 'reject') {
        if (!procReason.trim()) { alert('Motif de refus requis.'); setBusy(false); return; }
        await apiFetchJson(`/api/htc/requests/${procReq.request.id}/process`, {
          method: 'POST', body: JSON.stringify({ action: 'reject', rejectReason: procReason })
        });
      } else {
        const res = await apiFetchJson(`/api/htc/requests/${procReq.request.id}/process`, {
          method: 'POST',
          body: JSON.stringify({ action: 'issue', movementDate: procDate || undefined, signatureName: procSigName, signatureImage: procSigImg, force })
        });
        if (res?.movement) printBon(res.movement);
      }
      setProcReq(null); setProcReason(''); setProcSigImg(''); setProcSigName(''); setProcDate('');
      await Promise.all([loadRequests(), loadMovements(), loadItems()]);
    } catch (e) {
      if (e?.data?.shortage && !force) {
        const msg = (e.data.shortages || []).map((s) => `• ${s.itemName} : demandé ${s.requested}, dispo ${s.available}`).join('\n');
        if (window.confirm(`Stock insuffisant :\n${msg}\n\nForcer la sortie quand même ?`)) {
          setBusy(false);
          return processRequest(true);
        }
      } else alert(e.message || 'Erreur.');
    } finally { setBusy(false); }
  };

  const submitEntry = async () => {
    const lines = entryLines.filter((l) => l.itemId && Number(l.qty) >= 1);
    if (!lines.length) return alert('Ajoute au moins un article.');
    setBusy(true);
    try {
      const res = await apiFetchJson('/api/htc/movements', {
        method: 'POST',
        body: JSON.stringify({ lines: lines.map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })), movementDate: entryDate || undefined, reason: entryReason, supplierName: entrySupplier })
      });
      setEntryOpen(false); setEntryLines([{ itemId: '', qty: 1 }]); setEntryDate(''); setEntryReason(''); setEntrySupplier('');
      await Promise.all([loadMovements(), loadItems()]);
      if (res?.movement && window.confirm(`Bon ${res.movement.number} créé. Imprimer ?`)) printBon(res.movement);
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const submitReturn = async () => {
    if (!retMv) return;
    const lines = Object.entries(retLines).filter(([, q]) => Number(q) >= 1).map(([lineId, q]) => ({ lineId, qty: Number(q) }));
    if (!lines.length) return alert('Sélectionne au moins une ligne à retourner.');
    setBusy(true);
    try {
      const res = await apiFetchJson(`/api/htc/movements/${retMv.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ lines, movementDate: retDate || undefined, signatureName: retSigName, signatureImage: retSigImg })
      });
      setRetMv(null); setRetLines({}); setRetSigImg(''); setRetSigName(''); setRetDate('');
      await Promise.all([loadMovements(), loadItems()]);
      if (res?.movement && window.confirm(`Bon de retour ${res.movement.number} créé. Imprimer ?`)) printBon(res.movement);
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) return alert('Désignation requise.');
    setBusy(true);
    try {
      if (itemForm.id) {
        await apiFetchJson(`/api/htc/items/${itemForm.id}`, { method: 'PATCH', body: JSON.stringify(itemForm) });
      } else {
        await apiFetchJson('/api/htc/items', { method: 'POST', body: JSON.stringify(itemForm) });
      }
      setItemForm({ id: '', name: '', category: 'other', location: 'entrepot', unit: 'pièce', notes: '' });
      await loadItems();
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const cancelMovement = async (mv) => {
    if (!window.confirm(`Annuler le bon ${mv.number} ?`)) return;
    setBusy(true);
    try { await apiFetchJson(`/api/htc/movements/${mv.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'cancel' }) }); await Promise.all([loadMovements(), loadItems(), loadRequests()]); }
    catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  if (!open) return null;

  const tabs = [
    ...(isManager ? [{ id: 'stock', label: 'Stock', icon: Boxes }] : []),
    { id: 'demandes', label: `Demandes${isManager && pendingCount ? ` (${pendingCount})` : ''}`, icon: ClipboardList },
    ...(isManager ? [
      { id: 'bons', label: 'Bons', icon: FileText },
      { id: 'articles', label: 'Articles', icon: Package }
    ] : [])
  ];

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full';
  const btnPrimary = 'bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm disabled:opacity-60 inline-flex items-center gap-2';
  const btnGhost = 'border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 font-semibold text-sm disabled:opacity-60 inline-flex items-center gap-2';

  return (
    <div className="fixed inset-0 bg-indigo-900/35 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-5xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-800 text-white">
          <Warehouse size={20} />
          <div className="flex-1">
            <div className="font-bold text-base">Magasin &amp; Stocks HTC</div>
            <div className="text-[11px] text-white/75">Matériel client HTC · Entrepôt &amp; Buffer Stock · BZV/POOL</div>
          </div>
          <button onClick={refresh} disabled={busy} className="hover:bg-white/10 p-1.5 rounded" title="Rafraîchir">
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded"><X size={18} /></button>
        </div>

        {/* Onglets */}
        <div className="flex border-b bg-gray-50 px-2 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
                  tab === t.id ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* ============ STOCK ============ */}
          {tab === 'stock' && isManager && (
            <div>
              <div className="flex gap-2 mb-4">
                {['entrepot', 'magasin'].map((loc) => (
                  <button key={loc} onClick={() => setStockLoc(loc)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${
                      stockLoc === loc ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {loc === 'entrepot' ? <Warehouse size={15} /> : <Store size={15} />}
                    {LOCATION_LABEL[loc]}
                    <span className="text-xs opacity-75">({itemsByLoc[loc].length})</span>
                  </button>
                ))}
                <button onClick={() => setEntryOpen(true)} className={`${btnPrimary} ml-auto`}>
                  <Plus size={15} /> Bon d'entrée
                </button>
              </div>
              {itemsByLoc[stockLoc].length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">Aucun article dans ce lieu — ajoutez-en via l'onglet Articles.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {itemsByLoc[stockLoc].map((it) => (
                    <div key={it.id} className={`border rounded-xl p-3.5 ${it.stock <= 0 ? 'border-rose-300 bg-rose-50/40' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm text-gray-800 leading-snug">{it.name}</div>
                        {it.stock <= 0 && <AlertTriangle size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{it.category !== 'other' ? it.category : ''}{it.notes ? ` · ${it.notes}` : ''}</div>
                      <div className={`text-2xl font-extrabold mt-2 ${it.stock <= 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
                        {it.stock ?? 0} <span className="text-xs font-semibold text-gray-400">{it.unit}(s)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ DEMANDES ============ */}
          {tab === 'demandes' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-700">
                  {isManager ? `Demandes (${pendingCount} en attente)` : 'Mes demandes de matériel'}
                </div>
                <button onClick={() => setFormOpen(true)} className={btnPrimary}><Plus size={15} /> Nouvelle demande</button>
              </div>

              {formOpen && (
                <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 mb-4">
                  <div className="font-bold text-sm text-indigo-900 mb-3">Nouvelle demande de matériel</div>
                  {isManager && (
                    <label className="flex items-center gap-2 text-sm mb-3">
                      <input type="checkbox" checked={onBehalf} onChange={(e) => setOnBehalf(e.target.checked)} />
                      <span>Encoder pour un tiers (ex. Superviseur Zonal HTC sans compte)</span>
                    </label>
                  )}
                  {onBehalf && isManager && (
                    <div className="grid sm:grid-cols-2 gap-2 mb-3">
                      <select className={inputCls} value={behalfRole} onChange={(e) => setBehalfRole(e.target.value)}>
                        <option value="htc_supervisor">Superviseur Zonal HTC</option>
                        <option value="field_supervisor">Field Supervisor</option>
                        <option value="technician">Technicien</option>
                      </select>
                      <input className={inputCls} placeholder="Nom complet du demandeur *" value={behalfName} onChange={(e) => setBehalfName(e.target.value)} />
                    </div>
                  )}
                  <LinesEditor items={items.filter((i) => i.active)} lines={formLines} setLines={setFormLines} disabled={busy} />
                  <div className="grid sm:grid-cols-2 gap-2 mt-3">
                    <select className={inputCls} value={formSite} onChange={(e) => setFormSite(e.target.value)}>
                      <option value="">— Site de destination (optionnel) —</option>
                      {sitesBzv.map((s) => <option key={s.id} value={s.id}>{s.name || s.site_name || s.id}</option>)}
                    </select>
                    <input className={inputCls} placeholder="Motif de la demande" value={formReason} onChange={(e) => setFormReason(e.target.value)} />
                  </div>
                  <input className={`${inputCls} mt-2`} placeholder="Notes (optionnel)" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                  <div className="flex gap-2 mt-3 justify-end">
                    <button className={btnGhost} onClick={() => setFormOpen(false)}>Annuler</button>
                    <button className={btnPrimary} onClick={submitRequest} disabled={busy || (onBehalf && !behalfName.trim())}>Envoyer</button>
                  </div>
                </div>
              )}

              {requests.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">Aucune demande.</div>
              ) : (
                <div className="space-y-2">
                  {requests.map((r) => (
                    <div key={r.id} className="border border-gray-200 rounded-xl p-3.5 bg-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-indigo-800">{r.requestNumber}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[r.status] || STATUS_CLS.pending}`}>{STATUS_LABEL[r.status] || r.status}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmtDate(r.createdAt)}</span>
                      </div>
                      <div className="text-sm mt-1.5 text-gray-700">
                        <b>{r.requesterName}</b> <span className="text-gray-400">({REQUESTER_ROLE_LABEL[r.requesterRole] || r.requesterRole})</span>
                        {r.siteName ? <> → <b>{r.siteName}</b></> : null}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {r.lines.map((l) => `${l.qty}× ${l.itemName}`).join(' · ')}
                      </div>
                      {r.reason ? <div className="text-xs text-gray-500 mt-1">Motif : {r.reason}</div> : null}
                      {r.rejectReason ? <div className="text-xs text-rose-600 mt-1">Refus : {r.rejectReason}</div> : null}
                      {r.status === 'pending' && (
                        <div className="flex gap-2 mt-2.5">
                          {isManager ? (
                            <>
                              <button onClick={() => { setProcReq({ mode: 'issue', request: r }); setProcDate(''); setProcSigImg(''); setProcSigName(''); }}
                                className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-emerald-700 inline-flex items-center gap-1">
                                <Check size={13} /> Valider → bon de sortie
                              </button>
                              <button onClick={() => { setProcReq({ mode: 'reject', request: r }); setProcReason(''); }}
                                className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-rose-700 inline-flex items-center gap-1">
                                <Ban size={13} /> Refuser
                              </button>
                            </>
                          ) : (
                            <button onClick={() => cancelRequest(r)} className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50">
                              Annuler ma demande
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ BONS ============ */}
          {tab === 'bons' && isManager && (
            <div>
              <div className="flex flex-wrap gap-2 mb-3 items-center">
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  {[['all', 'Tous'], ['exit', 'Sorties'], ['entry', 'Entrées'], ['return', 'Retours']].map(([v, l]) => (
                    <button key={v} onClick={() => setMvType(v)}
                      className={`px-3 py-1.5 text-xs font-semibold ${mvType === v ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" value={mvLoc} onChange={(e) => setMvLoc(e.target.value)}>
                  <option value="all">Tous lieux</option>
                  <option value="entrepot">Entrepôt</option>
                  <option value="magasin">Magasin</option>
                </select>
                <input type="date" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" value={mvFrom} onChange={(e) => setMvFrom(e.target.value)} />
                <input type="date" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" value={mvTo} onChange={(e) => setMvTo(e.target.value)} />
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 text-xs w-full" placeholder="N°, demandeur, site…"
                    value={mvQ} onChange={(e) => setMvQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadMovements()} />
                </div>
              </div>

              {movements.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">Aucun bon.</div>
              ) : (
                <div className="space-y-2">
                  {movements.map((mv) => (
                    <div key={mv.id} className={`border rounded-xl p-3.5 ${mv.status === 'cancelled' ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-indigo-800">{mv.number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          mv.type === 'exit' ? 'bg-orange-100 text-orange-900 border-orange-200'
                          : mv.type === 'entry' ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                          : 'bg-indigo-100 text-indigo-900 border-indigo-200'}`}>
                          {TYPE_LABEL[mv.type]}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[mv.status] || ''}`}>{STATUS_LABEL[mv.status] || mv.status}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmtDate(mv.movementDate)} · {LOCATION_LABEL[mv.location]}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1.5">
                        {mv.requesterName ? <><b>{mv.requesterName}</b>{mv.siteName ? ` → ${mv.siteName}` : ''} · </> : null}
                        {mv.lines.map((l) => `${l.qty}× ${l.itemName}${l.qtyReturned ? ` (ret. ${l.qtyReturned})` : ''}`).join(' · ')}
                      </div>
                      {mv.returnOfNumber ? <div className="text-[11px] text-gray-400 mt-0.5">Retour de {mv.returnOfNumber}</div> : null}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => printBon(mv)} className="text-xs border border-gray-300 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-gray-50 inline-flex items-center gap-1">
                          <Printer size={12} /> Imprimer
                        </button>
                        {mv.type === 'exit' && (mv.status === 'issued' || mv.status === 'partial_return') && (
                          <button onClick={() => { setRetMv(mv); setRetLines({}); setRetDate(''); setRetSigImg(''); setRetSigName(''); }}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 inline-flex items-center gap-1">
                            <RotateCcw size={12} /> Retour
                          </button>
                        )}
                        {mv.status !== 'cancelled' && (
                          <button onClick={() => cancelMovement(mv)} className="text-xs text-rose-600 border border-rose-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-rose-50">
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ ARTICLES ============ */}
          {tab === 'articles' && isManager && (
            <div>
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 mb-4">
                <div className="font-bold text-sm text-indigo-900 mb-3">{itemForm.id ? 'Modifier l’article' : 'Nouvel article'}</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Désignation *" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
                  <select className={inputCls} value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}>
                    <option value="entrepot">Entrepôt</option>
                    <option value="magasin">Magasin (Buffer)</option>
                  </select>
                  <select className={inputCls} value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>
                    <option value="other">Autre</option>
                    <option value="battery_backup">Batterie Backup</option>
                    <option value="generator">Générateur</option>
                    <option value="rectifier">Redresseur</option>
                    <option value="gave_switch">Gave Switch</option>
                    <option value="ge_battery">Batterie GE 12V</option>
                    <option value="radiator">Radiateur</option>
                  </select>
                  <input className={inputCls} placeholder="Unité (pièce…)" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-3`} placeholder="Notes (marque, référence…)" value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} />
                </div>
                <div className="flex gap-2 mt-3 justify-end">
                  {itemForm.id && <button className={btnGhost} onClick={() => setItemForm({ id: '', name: '', category: 'other', location: 'entrepot', unit: 'pièce', notes: '' })}>Annuler</button>}
                  <button className={btnPrimary} onClick={saveItem} disabled={busy}>{itemForm.id ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {items.map((it) => (
                  <div key={it.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2 text-sm ${it.active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-800">{it.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{LOCATION_LABEL[it.location]} · {it.unit}</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-700">stock {it.stock ?? 0}</span>
                    <button className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50"
                      onClick={() => setItemForm({ id: it.id, name: it.name, category: it.category, location: it.location, unit: it.unit, notes: it.notes || '' })}>
                      Modifier
                    </button>
                    {it.active ? (
                      <button className="text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded hover:bg-rose-50"
                        onClick={async () => { if (window.confirm(`Désactiver « ${it.name} » ?`)) { await apiFetchJson(`/api/htc/items/${it.id}`, { method: 'DELETE' }).catch((e) => alert(e.message)); loadItems(); } }}>
                        Désactiver
                      </button>
                    ) : (
                      <button className="text-xs text-emerald-700 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-50"
                        onClick={async () => { await apiFetchJson(`/api/htc/items/${it.id}`, { method: 'PATCH', body: JSON.stringify({ active: true }) }).catch((e) => alert(e.message)); loadItems(); }}>
                        Réactiver
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====== Dialog traitement demande (valider/refuser) ====== */}
      {procReq && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="font-bold text-base mb-2">
              {procReq.mode === 'issue' ? `Valider → Bon de sortie` : `Refuser la demande`}
            </div>
            <div className="text-xs text-gray-500 mb-3">
              {procReq.request.requestNumber} · {procReq.request.requesterName} · {procReq.request.lines.map((l) => `${l.qty}× ${l.itemName}`).join(' · ')}
            </div>
            {procReq.mode === 'issue' ? (
              <>
                <label className="text-xs font-semibold text-gray-600">Date de sortie</label>
                <input type="date" className={`${inputCls} mb-3`} value={procDate} onChange={(e) => setProcDate(e.target.value)} />
                <label className="text-xs font-semibold text-gray-600">Signature du demandeur</label>
                <SignBlock sigImg={procSigImg} setSigImg={setProcSigImg} sigName={procSigName} setSigName={setProcSigName} />
              </>
            ) : (
              <input className={inputCls} placeholder="Motif du refus *" value={procReason} onChange={(e) => setProcReason(e.target.value)} />
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button className={btnGhost} onClick={() => setProcReq(null)}>Fermer</button>
              <button
                className={procReq.mode === 'issue' ? 'bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-semibold text-sm disabled:opacity-60' : 'bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 font-semibold text-sm disabled:opacity-60'}
                disabled={busy || (procReq.mode === 'issue' && !procSigImg && !procSigName.trim())}
                onClick={() => processRequest(false)}>
                {procReq.mode === 'issue' ? 'Émettre le bon' : 'Refuser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Dialog retour ====== */}
      {retMv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="font-bold text-base mb-1">Retour matériel — {retMv.number}</div>
            <div className="text-xs text-gray-500 mb-3">Quantités retournées par ligne :</div>
            {retMv.lines.map((l) => {
              const remaining = l.qty - (l.qtyReturned || 0);
              if (remaining <= 0) return null;
              return (
                <div key={l.id} className="flex items-center gap-2 mb-2 text-sm">
                  <input type="checkbox" checked={Number(retLines[l.id] || 0) > 0}
                    onChange={(e) => setRetLines({ ...retLines, [l.id]: e.target.checked ? remaining : 0 })} />
                  <span className="flex-1">{l.itemName} <span className="text-gray-400">(reste {remaining})</span></span>
                  <input type="number" min="0" max={remaining} className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center"
                    value={retLines[l.id] ?? 0}
                    onChange={(e) => setRetLines({ ...retLines, [l.id]: Math.min(remaining, Math.max(0, Number(e.target.value) || 0)) })} />
                </div>
              );
            })}
            <label className="text-xs font-semibold text-gray-600 block mt-3">Date de retour</label>
            <input type="date" className={`${inputCls} mb-3`} value={retDate} onChange={(e) => setRetDate(e.target.value)} />
            <label className="text-xs font-semibold text-gray-600 block">Signature</label>
            <SignBlock sigImg={retSigImg} setSigImg={setRetSigImg} sigName={retSigName} setSigName={setRetSigName} />
            <div className="flex gap-2 mt-4 justify-end">
              <button className={btnGhost} onClick={() => setRetMv(null)}>Fermer</button>
              <button className={btnPrimary} disabled={busy || (!retSigImg && !retSigName.trim()) || !Object.values(retLines).some((q) => Number(q) >= 1)} onClick={submitReturn}>
                Émettre le bon de retour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Dialog bon d'entrée ====== */}
      {entryOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="font-bold text-base mb-3">Bon d'entrée — réception matériel</div>
            <LinesEditor items={items.filter((i) => i.active)} lines={entryLines} setLines={setEntryLines} disabled={busy} />
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              <input type="date" className={inputCls} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              <input className={inputCls} placeholder="Fournisseur / source" value={entrySupplier} onChange={(e) => setEntrySupplier(e.target.value)} />
            </div>
            <input className={`${inputCls} mt-2`} placeholder="Motif / référence (BL, livraison HTC…)" value={entryReason} onChange={(e) => setEntryReason(e.target.value)} />
            <div className="flex gap-2 mt-3 justify-end">
              <button className={btnGhost} onClick={() => setEntryOpen(false)}>Fermer</button>
              <button className={btnPrimary} disabled={busy} onClick={submitEntry}>Émettre le bon d'entrée</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HtcWarehouseModal;
