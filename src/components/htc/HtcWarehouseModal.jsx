import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Package, ClipboardList, FileText, Boxes, Plus, Trash2, Check, Ban,
  Printer, RotateCcw, RefreshCw, AlertTriangle, Search, Warehouse, Store, Upload
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import { toastAlert as alert } from '../../utils/feedback';
import * as XLSX from 'xlsx';

const LOCATION_LABEL = { entrepot: 'Entrepôt', magasin: 'Magasin (Buffer)' };
const TYPE_LABEL = { exit: 'Sortie', entry: 'Entrée', return: 'Retour', recovery: 'Récupération' };
const TYPE_BON = { exit: 'BON DE SORTIE', entry: "BON D'ENTRÉE", return: 'BON DE RETOUR', recovery: 'BON DE RÉCUPÉRATION' };
const CONDITION_LABEL = { fonctionnel: 'Fonctionnel', defectueux: 'Défectueux', a_reparer: 'À réparer', hs: 'HS' };
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
  // Colonnes normalisées par type de bon (cahier des charges) :
  //   BE : Date, Désignation, Quantité, Client/Fournisseur, N°SMR, Bénéficiaire
  //   BS : Date, Désignation, Quantité, Demandeur, N°SWO, Destination
  //   BR : Date, Désignation, Quantité, Agent, N°BS, Provenance
  //   RC : Date, Désignation, Quantité, Condition, Site, Ramené par
  const senderLabel = mv.senderType === 'htc' ? 'Client HTC' : mv.senderType === 'supplier' ? 'Fournisseur' : '';
  const senderFull = [senderLabel, mv.requesterName].filter(Boolean).join(' · ') || '—';
  const HEADS = {
    entry: ['Date', 'Désignation', 'Quantité', 'Client / Fournisseur', 'N° SMR', 'Bénéficiaire'],
    exit: ['Date', 'Désignation', 'Quantité', 'Demandeur', 'N° SWO', 'Destination'],
    return: ['Date', 'Désignation', 'Quantité', 'Agent', 'N° BS', 'Provenance'],
    recovery: ['Date', 'Désignation', 'Quantité', 'Condition', 'Site', 'Ramené par']
  };
  const heads = HEADS[mv.type] || ['Date', 'Désignation', 'Quantité', 'Lieu', '', ''];
  const cells = (l) => {
    const base = `<td class="c">${esc(fmtDate(mv.movementDate))}</td><td>${esc(l.itemName)}</td><td class="c">${l.qty}</td>`;
    if (mv.type === 'entry') return `${base}<td>${esc(senderFull)}</td><td class="c">${esc(mv.smrNumber || '—')}</td><td>${esc(mv.beneficiary || '—')}</td>`;
    if (mv.type === 'exit') return `${base}<td>${esc(mv.requesterName || '—')}</td><td class="c">${esc(mv.swoNumber || '—')}</td><td>${esc(mv.siteName || '—')}</td>`;
    if (mv.type === 'return') return `${base}<td>${esc(mv.agentName || mv.requesterName || '—')}</td><td class="c">${esc(mv.returnOfNumber || '—')}</td><td>${esc(mv.provenance || mv.siteName || '—')}</td>`;
    if (mv.type === 'recovery') return `${base}<td class="c">${esc(CONDITION_LABEL[l.condition] || 'Fonctionnel')}</td><td>${esc(mv.siteName || '—')}</td><td>${esc(mv.agentName || mv.requesterName || '—')}</td>`;
    return `${base}<td class="c">${esc(LOCATION_LABEL[l.location] || l.location || '—')}</td><td colspan="2"></td>`;
  };
  const rows = (mv.lines || []).map((l) => `<tr>${cells(l)}</tr>`).join('');
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
    <div><div class="l">${mv.type === 'entry' ? 'Expéditeur' : mv.type === 'return' ? 'Agent' : mv.type === 'recovery' ? 'Ramené par' : 'Demandeur'}</div><div class="v">${esc(mv.type === 'entry' ? senderFull : (mv.agentName || mv.requesterName || '—'))}</div></div>
    <div><div class="l">Fonction</div><div class="v">${esc(REQUESTER_ROLE_LABEL[mv.requesterRole] || mv.requesterRole || '—')}</div></div>
    <div><div class="l">${mv.type === 'entry' ? 'Bénéficiaire' : mv.type === 'recovery' ? 'Site de récupération' : mv.type === 'return' ? 'Provenance' : 'Destination'}</div><div class="v">${esc(mv.type === 'entry' ? (mv.beneficiary || '—') : (mv.provenance || mv.siteName || '—'))}</div></div>
  </div>
  <table>
    <thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${mv.reason ? `<div class="reason"><b>Motif :</b> ${esc(mv.reason)}</div>` : ''}
  ${mv.returnOfNumber ? `<div class="reason"><b>Retour de :</b> ${esc(mv.returnOfNumber)}</div>` : ''}
  <div class="sign">
    <div class="b">${sig}Signature ${mv.type === 'recovery' ? 'de qui ramène' : mv.type === 'return' ? 'de l\u2019agent' : mv.type === 'entry' ? 'du réceptionnaire' : 'du demandeur'}</div>
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
        <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2 sm:items-center">
          <select
            className="w-full sm:flex-1 sm:min-w-0 border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white disabled:opacity-60"
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
          <div className="flex gap-2 items-center">
            <span className="sm:hidden text-[11px] font-bold uppercase tracking-wide text-gray-500">Qté</span>
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
        </div>
      ))}
      <button type="button" onClick={addLine} disabled={disabled}
        className="text-sm text-indigo-700 font-semibold hover:underline inline-flex items-center gap-1 disabled:opacity-40">
        <Plus size={14} /> Ajouter un article
      </button>
    </div>
  );
};

// ---------- Lignes bon de récupération (article existant OU à la volée + condition) ----------
const RecoveryLinesEditor = ({ items, lines, setLines, disabled, inputCls }) => {
  const blank = { mode: 'existing', itemId: '', qty: 1, condition: 'fonctionnel', newName: '', newLocation: 'entrepot' };
  const addLine = () => setLines([...lines, { ...blank }]);
  const setLine = (i, patch) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const rmLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const sub = 'block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5';
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50/60">
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-[11px] font-semibold">
              <button type="button" disabled={disabled} onClick={() => setLine(i, { mode: 'existing' })}
                className={`px-2.5 py-1 ${l.mode !== 'new' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>Article existant</button>
              <button type="button" disabled={disabled} onClick={() => setLine(i, { mode: 'new' })}
                className={`px-2.5 py-1 ${l.mode === 'new' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>Nouvel article</button>
            </div>
            <button type="button" onClick={() => rmLine(i)} disabled={disabled || lines.length <= 1}
              className="ml-auto p-1.5 text-gray-400 hover:text-rose-600 disabled:opacity-40">
              <Trash2 size={15} />
            </button>
          </div>
          {l.mode === 'new' ? (
            <div className="grid sm:grid-cols-[1fr_9.5rem] gap-2 mb-2">
              <div>
                <label className={sub}>Désignation *</label>
                <input className={inputCls} placeholder="Ex. Radiateur 30 KVA Yanmar" value={l.newName} disabled={disabled} onChange={(e) => setLine(i, { newName: e.target.value })} />
              </div>
              <div>
                <label className={sub}>Lieu</label>
                <select className={inputCls} value={l.newLocation} disabled={disabled} onChange={(e) => setLine(i, { newLocation: e.target.value })}>
                  <option value="entrepot">Entrepôt</option>
                  <option value="magasin">Magasin (Buffer)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="mb-2">
              <label className={sub}>Article</label>
              <select className={inputCls} value={l.itemId} disabled={disabled} onChange={(e) => setLine(i, { itemId: e.target.value })}>
                <option value="">— Choisir un article —</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name} · {LOCATION_LABEL[it.location] || it.location}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <div>
              <label className={sub}>Quantité</label>
              <input type="number" min="1" max="10000" className={`${inputCls} text-center`} value={l.qty} disabled={disabled} onChange={(e) => setLine(i, { qty: e.target.value })} />
            </div>
            <div>
              <label className={sub}>Condition</label>
              <select className={inputCls} value={l.condition} disabled={disabled} onChange={(e) => setLine(i, { condition: e.target.value })}>
                {Object.entries(CONDITION_LABEL).map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addLine} disabled={disabled}
        className="text-sm text-indigo-700 font-semibold hover:underline inline-flex items-center gap-1 disabled:opacity-40">
        <Plus size={14} /> Ajouter une ligne
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
  const [stats, setStats] = useState(null);
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

  // Récupération terrain (matériel ramené d'un site, jamais passé par le stock STHIC)
  const [recOpen, setRecOpen] = useState(false);
  const recBlankLine = { mode: 'existing', itemId: '', qty: 1, condition: 'fonctionnel', newName: '', newLocation: 'entrepot' };
  const [recLines, setRecLines] = useState([recBlankLine]);
  const [recSite, setRecSite] = useState('');
  const [recInitial, setRecInitial] = useState(false);
  const [recOrigin, setRecOrigin] = useState('');
  const [recReturner, setRecReturner] = useState('');
  const [recReturnerRole, setRecReturnerRole] = useState('technician');
  const [recDate, setRecDate] = useState('');
  const [recReason, setRecReason] = useState('');
  const [recSigImg, setRecSigImg] = useState('');
  const [recSigName, setRecSigName] = useState('');

  // Import en masse (inventaire initial)
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importDate, setImportDate] = useState('');
  const [importReason, setImportReason] = useState('');
  const [importResult, setImportResult] = useState(null);

  // Retour
  const [retMv, setRetMv] = useState(null);
  const [retLines, setRetLines] = useState({});
  const [retDate, setRetDate] = useState('');
  const [retSigImg, setRetSigImg] = useState('');
  const [retSigName, setRetSigName] = useState('');
  const [retAgent, setRetAgent] = useState('');
  const [retProvenance, setRetProvenance] = useState('');

  // Métadonnées administratives des bons (SMR / SWO / bénéficiaire…)
  const [entrySenderType, setEntrySenderType] = useState('htc');
  const [entrySmr, setEntrySmr] = useState('');
  const [entryBeneficiary, setEntryBeneficiary] = useState('STHIC');
  const [formSwo, setFormSwo] = useState('');
  const [procSwo, setProcSwo] = useState('');

  // Articles
  const [itemForm, setItemForm] = useState({ id: '', name: '', category: 'other', location: 'entrepot', unit: 'pièce', notes: '', initialQty: '' });

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

  const loadStats = useCallback(async () => {
    if (!isManager) return;
    const d = await apiFetchJson('/api/htc/stats');
    setStats(d.stats || null);
  }, [apiFetchJson, isManager]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try { await Promise.all([loadItems(), loadRequests(), loadMovements(), loadStats()]); }
    catch (e) { alert(e.message || 'Erreur de chargement.'); }
    finally { setBusy(false); }
  }, [loadItems, loadRequests, loadMovements, loadStats]);

  useEffect(() => { if (open) { setTab(isManager ? initialTab : (['stock', 'demandes'].includes(initialTab) ? initialTab : 'demandes')); refresh(); } }, [open]); // eslint-disable-line
  useEffect(() => { if (open && isManager) loadMovements().catch(() => {}); }, [mvType, mvLoc, mvFrom, mvTo]); // eslint-disable-line

  const itemsByLoc = useMemo(() => ({
    entrepot: items.filter((i) => i.active && i.location === 'entrepot'),
    magasin: items.filter((i) => i.active && i.location === 'magasin')
  }), [items]);

  // Totaux du tableau de bord HTC (calculés depuis le stock temps réel des articles).
  const dash = useMemo(() => ({
    stockEntrepot: itemsByLoc.entrepot.reduce((s, i) => s + (Number(i.stock) || 0), 0),
    stockMagasin: itemsByLoc.magasin.reduce((s, i) => s + (Number(i.stock) || 0), 0),
    articles: items.filter((i) => i.active).length,
    ruptures: items.filter((i) => i.active && Number(i.stock) <= 0).length
  }), [items, itemsByLoc]);

  const sitesBzv = useMemo(() => (sites || []), [sites]);

  // Libellé clair d'un site : « CBBZ0090 — Ngamakosso Border ».
  const siteLabel = (s) => [s?.idSite, s?.nameSite].filter(Boolean).join(' — ') || s?.name || s?.site_name || s?.idSite || s?.id || '';

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
          siteId: site?.id || '', siteName: site ? siteLabel(site) : '',
          reason: formReason, notes: formNotes, swoNumber: formSwo,
          ...(onBehalf && isManager ? { onBehalf: { role: behalfRole, name: behalfName } } : {})
        })
      });
      setFormOpen(false); setFormLines([{ itemId: '', qty: 1 }]); setFormSite(''); setFormReason(''); setFormNotes(''); setFormSwo('');
      setOnBehalf(false); setBehalfName('');
      await loadRequests();
      alert('Demande envoyée au magasinier.');
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  // FS/tech : « Demander » depuis le stock → pré-remplit la demande avec l'article choisi.
  const requestItem = (it) => {
    setFormLines((prev) => {
      const base = (formOpen ? prev : [{ itemId: '', qty: 1 }]).filter((l) => l.itemId);
      if (base.some((l) => String(l.itemId) === String(it.id))) return base.length ? base : [{ itemId: '', qty: 1 }];
      return [...base, { itemId: it.id, qty: 1 }];
    });
    setFormOpen(true);
    setTab('demandes');
  };

  // Magasinier : raccourci « Entrée » depuis une carte stock → BE pré-rempli.
  const entryItem = (it) => {
    setEntryLines([{ itemId: it.id, qty: 1 }]);
    setEntryOpen(true);
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
          body: JSON.stringify({ action: 'issue', movementDate: procDate || undefined, signatureName: procSigName, signatureImage: procSigImg, swoNumber: procSwo, force })
        });
        if (res?.movement) printBon(res.movement);
      }
      setProcReq(null); setProcReason(''); setProcSigImg(''); setProcSigName(''); setProcDate('');
      await Promise.all([loadRequests(), loadMovements(), loadItems(), loadStats()]);
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
        body: JSON.stringify({
          lines: lines.map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })),
          movementDate: entryDate || undefined, reason: entryReason,
          senderType: entrySenderType, supplierName: entrySupplier,
          smrNumber: entrySmr, beneficiary: entryBeneficiary
        })
      });
      setEntryOpen(false); setEntryLines([{ itemId: '', qty: 1 }]); setEntryDate(''); setEntryReason(''); setEntrySupplier(''); setEntrySmr(''); setEntryBeneficiary('STHIC'); setEntrySenderType('htc');
      await Promise.all([loadMovements(), loadItems(), loadStats()]);
      if (res?.movement && window.confirm(`Bon ${res.movement.number} créé. Imprimer ?`)) printBon(res.movement);
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const submitRecovery = async () => {
    const lines = recLines.filter((l) => (l.mode === 'new' ? l.newName.trim() : l.itemId) && Number(l.qty) >= 1);
    if (!lines.length) return alert('Ajoute au moins une ligne valide.');
    if (!recInitial && !recSite) return alert('Site de récupération requis.');
    if (!recInitial && !recReturner.trim()) return alert('Indique qui ramène le matériel.');
    const site = sitesBzv.find((s) => String(s.id) === String(recSite));
    setBusy(true);
    try {
      const res = await apiFetchJson('/api/htc/recoveries', {
        method: 'POST',
        body: JSON.stringify({
          initial: recInitial,
          siteId: site?.id || '', siteName: recInitial ? (recOrigin.trim() || 'Inventaire initial') : (site ? siteLabel(site) : recSite),
          returnerName: recReturner.trim(), returnerRole: recInitial ? 'warehouse' : recReturnerRole,
          movementDate: recDate || undefined, reason: recReason,
          signatureName: recSigName, signatureImage: recSigImg,
          lines: lines.map((l) => (l.mode === 'new'
            ? { newItem: { name: l.newName.trim(), location: l.newLocation }, qty: Number(l.qty), condition: l.condition }
            : { itemId: l.itemId, qty: Number(l.qty), condition: l.condition }))
        })
      });
      setRecOpen(false);
      setRecLines([{ ...recBlankLine }]); setRecSite(''); setRecInitial(false); setRecOrigin(''); setRecReturner(''); setRecDate(''); setRecReason(''); setRecSigImg(''); setRecSigName('');
      await Promise.all([loadMovements(), loadItems(), loadStats()]);
      if (res?.movement && window.confirm(`Bon de récupération ${res.movement.number} créé. Imprimer ?`)) printBon(res.movement);
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  // Parse « Désignation ; Lieu ; Quantité ; Condition ; Notes » (TAB ou point-virgule)
  const parsedImport = useMemo(() => {
    const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const LOC = { entrepot: 'entrepot', e: 'entrepot', warehouse: 'entrepot', magasin: 'magasin', m: 'magasin', buffer: 'magasin', 'buffer stock': 'magasin', 'magasin buffer': 'magasin', 'magasin buffer stock': 'magasin', 'magasin (buffer)': 'magasin' };
    const COND = { '': 'fonctionnel', fonctionnel: 'fonctionnel', f: 'fonctionnel', ok: 'fonctionnel', defectueux: 'defectueux', def: 'defectueux', 'a reparer': 'a_reparer', a_reparer: 'a_reparer', reparer: 'a_reparer', reparation: 'a_reparer', rep: 'a_reparer', hs: 'hs', 'hors service': 'hs', ko: 'hs' };
    return String(importText || '').split(/\r?\n/).map((raw) => {
      const line = raw.trim();
      if (!line) return null;
      const cells = (line.includes('\t') ? line.split('\t') : line.split(';')).map((c) => c.trim());
      // Ligne d'en-tête ignorée où qu'elle soit (Désignation|Lieu|Quantité…)
      // Test sur texte normalisé : « Désignation » → « designation » (l'accent cassait le match).
      const h0 = norm(cells[0]); const h1 = norm(cells[1]); const h2 = norm(cells[2]);
      if (/^(design|article|nom|name|libelle|materiel|item|ref|reference)\b/.test(h0) && (/lieu|location|emplacement|^loc$|^site$|^zone$/.test(h1) || /quant|qty|qte|nombre/.test(h2))) return null;
      const [name = '', locRaw = '', qtyRaw = '', condRaw = '', notesRaw = ''] = cells;
      const locN = norm(locRaw);
      let location = LOC[locN];
      if (!location) {
        if (/magasin|buffer|boutique|reserve/.test(locN)) location = 'magasin';
        else if (/entrepot|warehouse|depot/.test(locN)) location = 'entrepot';
      }
      const qty = Math.floor(Number(String(qtyRaw).replace(/\s/g, '').replace(',', '.')));
      const condN = norm(condRaw);
      let condition = COND[condN];
      if (condition === undefined) {
        if (/fonc|^ok$|bon etat|bonne|nouv|neuf|^new$/.test(condN)) condition = 'fonctionnel';
        else if (/def|panne|casse/.test(condN)) condition = 'defectueux';
        else if (/rep/.test(condN)) condition = 'a_reparer';
        else if (/hs|hors|ko|inutilisable|mort/.test(condN)) condition = 'hs';
      }
      // « Nouveau/Neuf » n'est pas une condition stock — info conservée dans les notes.
      const isNew = /nouv|neuf|^new$/.test(condN);
      const notes = isNew ? `${condRaw}${notesRaw ? ` — ${notesRaw}` : ''}` : notesRaw;
      const err = !name ? 'Désignation vide'
        : !location ? `Lieu inconnu (« ${locRaw} »)`
        : !Number.isFinite(qty) || qty < 0 ? `Quantité invalide (« ${qtyRaw} »)`
        : !condition ? `Condition inconnue (« ${condRaw} »)` : '';
      return { name, location, qty: Number.isFinite(qty) ? qty : 0, condition: condition || 'fonctionnel', notes, err };
    }).filter(Boolean);
  }, [importText]);

  // Fichier .xlsx/.xls/.csv → converti en lignes « ; » pour le même parseur.
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      const text = rows
        .map((r) => (Array.isArray(r) ? r : []).map((c) => String(c ?? '').trim()).join(';'))
        .filter((l) => l.replace(/;/g, '').trim())
        .join('\n');
      if (!text) return alert('Fichier vide ou illisible.');
      setImportText(text);
      setImportResult(null);
    } catch {
      alert('Impossible de lire ce fichier (formats acceptés : .xlsx, .xls, .csv).');
    }
  };

  const submitImport = async () => {
    const rows = parsedImport.filter((r) => !r.err && r.qty > 0);
    if (!rows.length) return alert('Aucune ligne valide à importer.');
    setBusy(true);
    try {
      const res = await apiFetchJson('/api/htc/import', {
        method: 'POST',
        body: JSON.stringify({
          rows: rows.map((r) => ({ name: r.name, location: r.location, qty: r.qty, condition: r.condition, notes: r.notes })),
          movementDate: importDate || undefined,
          reason: importReason || undefined
        })
      });
      setImportResult(res);
      setImportText('');
      await Promise.all([loadMovements(), loadItems(), loadStats()]);
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
        body: JSON.stringify({ lines, movementDate: retDate || undefined, signatureName: retSigName, signatureImage: retSigImg, agentName: retAgent, provenance: retProvenance })
      });
      setRetMv(null); setRetLines({}); setRetSigImg(''); setRetSigName(''); setRetDate(''); setRetAgent(''); setRetProvenance('');
      await Promise.all([loadMovements(), loadItems(), loadStats()]);
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
        const res = await apiFetchJson('/api/htc/items', { method: 'POST', body: JSON.stringify(itemForm) });
        if (res?.entryNumber) alert(`Article créé — bon d'entrée ${res.entryNumber} émis (${itemForm.initialQty} u. en stock).`);
      }
      setItemForm({ id: '', name: '', category: 'other', location: 'entrepot', unit: 'pièce', notes: '', initialQty: '' });
      await loadItems();
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const cancelMovement = async (mv) => {
    if (!window.confirm(`Annuler le bon ${mv.number} ?`)) return;
    setBusy(true);
    try { await apiFetchJson(`/api/htc/movements/${mv.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'cancel' }) }); await Promise.all([loadMovements(), loadItems(), loadRequests(), loadStats()]); }
    catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  // Réinitialisation TOTALE du module (tests / remise à blanc) — magasinier uniquement.
  const resetModule = async () => {
    if (!window.confirm('Réinitialiser TOUT le module HTC ?\n\nArticles, demandes et tous les bons seront définitivement supprimés.')) return;
    const word = window.prompt('Tapez REINITIALISER pour confirmer la suppression totale :');
    if (String(word || '').trim().toUpperCase() !== 'REINITIALISER') return alert('Annulé — rien n\'a été supprimé.');
    setBusy(true);
    try {
      const res = await apiFetchJson('/api/htc/reset', { method: 'POST', body: JSON.stringify({ confirm: 'REINITIALISER' }) });
      const d = res?.deleted || {};
      alert(`Module réinitialisé.\nArticles : ${d.items ?? 0} · Demandes : ${d.requests ?? 0} · Bons : ${d.movements ?? 0}`);
      setTab('stock');
      await Promise.all([loadMovements(), loadItems(), loadRequests(), loadStats()]);
    } catch (e) { alert(e.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  if (!open) return null;

  const tabs = [
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'demandes', label: `Demandes${isManager && pendingCount ? ` (${pendingCount})` : ''}`, icon: ClipboardList },
    ...(isManager ? [
      { id: 'bons', label: 'Bons', icon: FileText },
      { id: 'articles', label: 'Articles', icon: Package }
    ] : [])
  ];

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1';
  const btnPrimary = 'bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm disabled:opacity-60 inline-flex items-center gap-2';
  const btnGhost = 'border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 font-semibold text-sm disabled:opacity-60 inline-flex items-center gap-2';

  return (
    <div className="fixed inset-0 bg-indigo-900/35 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[96vh] sm:max-w-6xl lg:max-w-7xl 2xl:max-w-[92rem] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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

        {/* Onglets — segmented control (aucune superposition fragile) */}
        <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
          <div className="flex gap-1 bg-gray-200/70 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${
                    active ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-800'
                  }`}>
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* ============ STOCK / TABLEAU DE BORD HTC ============ */}
          {tab === 'stock' && (
            <div>
              {/* Dashboard personnalisé — réservé au magasinier */}
              {isManager && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
                <button onClick={() => setTab('demandes')}
                  className="border border-amber-300 bg-amber-50 rounded-xl p-3 text-left hover:bg-amber-100 transition-colors">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Demandes en attente</div>
                  <div className="text-2xl font-extrabold text-amber-800 mt-1">{stats ? stats.pendingRequests : pendingCount}</div>
                  <div className="text-[10px] text-amber-600">à traiter →</div>
                </button>
                <div className="border border-indigo-200 bg-indigo-50/60 rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">Matériel dehors</div>
                  <div className="text-2xl font-extrabold text-indigo-800 mt-1">{stats?.materialOutUnits ?? '—'}</div>
                  <div className="text-[10px] text-indigo-500">{stats?.openExitVouchers ?? 0} bon(s) de sortie ouvert(s)</div>
                </div>
                <div className="border border-gray-200 bg-white rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Stock Entrepôt</div>
                  <div className="text-2xl font-extrabold text-indigo-800 mt-1">{dash.stockEntrepot}</div>
                  <div className="text-[10px] text-gray-400">pièce(s) · {itemsByLoc.entrepot.length} article(s)</div>
                </div>
                <div className="border border-gray-200 bg-white rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Stock Magasin</div>
                  <div className="text-2xl font-extrabold text-indigo-800 mt-1">{dash.stockMagasin}</div>
                  <div className="text-[10px] text-gray-400">buffer · {itemsByLoc.magasin.length} article(s)</div>
                </div>
                <div className={`border rounded-xl p-3 ${dash.ruptures ? 'border-rose-300 bg-rose-50' : 'border-emerald-200 bg-emerald-50/50'}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wide ${dash.ruptures ? 'text-rose-700' : 'text-emerald-700'}`}>Ruptures</div>
                  <div className={`text-2xl font-extrabold mt-1 ${dash.ruptures ? 'text-rose-700' : 'text-emerald-700'}`}>{dash.ruptures}</div>
                  <div className={`text-[10px] ${dash.ruptures ? 'text-rose-500' : 'text-emerald-600'}`}>article(s) à 0</div>
                </div>
              </div>
              )}
              {isManager && stats && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 mb-4 px-1">
                  <span className="font-semibold text-gray-600">Bons ce mois :</span>
                  <span><b className="text-emerald-700">{stats.monthMovements?.entry ?? 0}</b> entrée(s)</span>
                  <span><b className="text-orange-700">{stats.monthMovements?.exit ?? 0}</b> sortie(s)</span>
                  <span><b className="text-indigo-700">{stats.monthMovements?.return ?? 0}</b> retour(s)</span>
                  <span><b className="text-sky-700">{stats.monthMovements?.recovery ?? 0}</b> récupération(s)</span>
                  <span className="ml-auto">{dash.articles} article(s) au catalogue</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {[['entrepot', Warehouse], ['magasin', Store], ['retour', RotateCcw]].map(([loc, Icon]) => (
                  <button key={loc} onClick={() => setStockLoc(loc)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${
                      stockLoc === loc ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}>
                    <Icon size={15} />
                    {loc === 'retour' ? 'Retour Site' : LOCATION_LABEL[loc]}
                    <span className="text-xs opacity-75">({loc === 'retour' ? items.filter((i) => i.active && Number(i.stockSite) > 0).length : itemsByLoc[loc].length})</span>
                  </button>
                ))}
                {isManager && (
                  <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap gap-2">
                    <button onClick={() => { setImportOpen(true); setImportResult(null); }} className="flex-1 sm:flex-none justify-center border border-indigo-300 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-50 font-semibold text-sm disabled:opacity-60 inline-flex items-center gap-2">
                      <Upload size={15} /> Import inventaire
                    </button>
                    <button onClick={() => setRecOpen(true)} className="flex-1 sm:flex-none justify-center bg-sky-700 text-white px-4 py-2 rounded-lg hover:bg-sky-800 font-semibold text-sm disabled:opacity-60 inline-flex items-center gap-2">
                      <RotateCcw size={15} /> Bon de récupération
                    </button>
                    <button onClick={() => setEntryOpen(true)} className={`${btnPrimary} flex-1 sm:flex-none justify-center`}>
                      <Plus size={15} /> Bon d'entrée
                    </button>
                  </div>
                )}
              </div>

              {stockLoc === 'retour' ? (
                <div>
                  <div className="text-xs text-gray-500 mb-3">Matériel non fonctionnel ramené des sites (défectueux / à réparer / HS) — documenté hors stock disponible.</div>
                  {items.filter((i) => i.active && Number(i.stockSite) > 0).length === 0 ? (
                    <div className="text-center text-gray-400 py-12 text-sm">Aucun retour site enregistré.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                      {items.filter((i) => i.active && Number(i.stockSite) > 0).map((it) => (
                        <div key={it.id} className="border border-stone-300 bg-stone-50 rounded-xl p-3.5">
                          <div className="font-semibold text-sm text-gray-800 leading-snug">{it.name}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{LOCATION_LABEL[it.location] || it.location}{it.notes ? ` · ${it.notes}` : ''}</div>
                          <div className="text-2xl font-extrabold mt-2 text-stone-600">
                            {it.stockSite} <span className="text-xs font-semibold text-gray-400">{it.unit}(s)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : itemsByLoc[stockLoc].length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">
                  {isManager ? "Aucun article dans ce lieu — ajoutez-en via l'onglet Articles." : 'Aucun article disponible dans ce lieu.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
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
                      {Number(it.stockSite) > 0 && (
                        <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Retour site : {it.stockSite} non fonctionnel(s)</div>
                      )}
                      <div className="flex gap-2 mt-2.5">
                        {isManager ? (
                          <button onClick={() => entryItem(it)}
                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1">
                            <Plus size={12} /> Entrée
                          </button>
                        ) : (
                          <button onClick={() => requestItem(it)}
                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-1">
                            <ClipboardList size={12} /> Demander
                          </button>
                        )}
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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
                      <div>
                        <label className={labelCls}>Fonction du demandeur</label>
                        <select className={inputCls} value={behalfRole} onChange={(e) => setBehalfRole(e.target.value)}>
                          <option value="htc_supervisor">Superviseur Zonal HTC</option>
                          <option value="field_supervisor">Field Supervisor</option>
                          <option value="technician">Technicien</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Nom complet du demandeur *</label>
                        <input className={inputCls} placeholder="Nom et prénom" value={behalfName} onChange={(e) => setBehalfName(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div className="mt-1">
                    <div className="hidden sm:grid grid-cols-[1fr_5.5rem_2rem] gap-2 mb-1 px-0.5">
                      <span className={labelCls}>Article</span>
                      <span className={`${labelCls} text-center`}>Quantité</span>
                      <span></span>
                    </div>
                    <LinesEditor items={items.filter((i) => i.active)} lines={formLines} setLines={setFormLines} disabled={busy} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mt-3">
                    <div>
                      <label className={labelCls}>Site de destination</label>
                      <select className={inputCls} value={formSite} onChange={(e) => setFormSite(e.target.value)}>
                        <option value="">— Choisir un site (optionnel) —</option>
                        {sitesBzv.map((s) => <option key={s.id} value={s.id}>{siteLabel(s)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Motif de la demande</label>
                      <input className={inputCls} placeholder="Ex. remplacement batterie défectueuse" value={formReason} onChange={(e) => setFormReason(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>N° SWO (optionnel)</label>
                      <input className={inputCls} placeholder="Ordre de travail / SWO" value={formSwo} onChange={(e) => setFormSwo(e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className={labelCls}>Notes (optionnel)</label>
                    <input className={inputCls} placeholder="Précisions complémentaires…" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                  </div>
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
                      {r.swoNumber ? <div className="text-xs text-gray-500 mt-0.5">N° SWO : <b className="font-mono">{r.swoNumber}</b></div> : null}
                      {r.rejectReason ? <div className="text-xs text-rose-600 mt-1">Refus : {r.rejectReason}</div> : null}
                      {r.status === 'pending' && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {isManager ? (
                            <>
                              <button onClick={() => { setProcReq({ mode: 'issue', request: r }); setProcDate(''); setProcSigImg(''); setProcSigName(''); setProcSwo(r.swoNumber || ''); }}
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
                <div className="flex border border-gray-300 rounded-lg overflow-x-auto max-w-full">
                  {[['all', 'Tous'], ['exit', 'Sorties'], ['entry', 'Entrées'], ['return', 'Retours'], ['recovery', 'Récup.']].map(([v, l]) => (
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
                          : mv.type === 'recovery' ? 'bg-sky-100 text-sky-900 border-sky-200'
                          : 'bg-indigo-100 text-indigo-900 border-indigo-200'}`}>
                          {TYPE_LABEL[mv.type]}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[mv.status] || ''}`}>{STATUS_LABEL[mv.status] || mv.status}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmtDate(mv.movementDate)} · {LOCATION_LABEL[mv.location]}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1.5">
                        {mv.requesterName ? <><b>{mv.requesterName}</b>{mv.siteName ? ` → ${mv.siteName}` : ''} · </> : null}
                        {mv.lines.map((l) => `${l.qty}× ${l.itemName}${l.qtyReturned ? ` (ret. ${l.qtyReturned})` : ''}${mv.type === 'recovery' ? ` [${CONDITION_LABEL[l.condition] || 'Fonctionnel'}]` : ''}`).join(' · ')}
                      </div>
                      {mv.returnOfNumber ? <div className="text-[11px] text-gray-400 mt-0.5">Retour de {mv.returnOfNumber}</div> : null}
                      {(mv.smrNumber || mv.swoNumber || mv.agentName || mv.provenance || mv.beneficiary) && (
                        <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {mv.type === 'entry' && mv.senderType ? <span>Expéditeur : <b>{mv.senderType === 'htc' ? 'Client HTC' : 'Fournisseur'}</b></span> : null}
                          {mv.smrNumber ? <span>N° SMR : <b className="font-mono">{mv.smrNumber}</b></span> : null}
                          {mv.swoNumber ? <span>N° SWO : <b className="font-mono">{mv.swoNumber}</b></span> : null}
                          {mv.beneficiary ? <span>Bénéficiaire : <b>{mv.beneficiary}</b></span> : null}
                          {mv.agentName && mv.type !== 'entry' ? <span>Agent : <b>{mv.agentName}</b></span> : null}
                          {mv.provenance ? <span>Provenance : <b>{mv.provenance}</b></span> : null}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => printBon(mv)} className="text-xs border border-gray-300 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-gray-50 inline-flex items-center gap-1">
                          <Printer size={12} /> Imprimer
                        </button>
                        {mv.type === 'exit' && (mv.status === 'issued' || mv.status === 'partial_return') && (
                          <button onClick={() => { setRetMv(mv); setRetLines({}); setRetDate(''); setRetSigImg(''); setRetSigName(''); setRetAgent(mv.requesterName || ''); setRetProvenance(mv.siteName || ''); }}
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

              {/* Zone dangereuse — réinitialisation complète (magasinier uniquement) */}
              {isManager && (
                <div className="mt-6 border border-rose-200 bg-rose-50/50 rounded-xl p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-rose-700 mb-1">Zone dangereuse</div>
                  <div className="text-xs text-rose-600/90 mb-3">
                    Efface TOUT le module : articles, demandes, bons (entrées, sorties, retours, récupérations)
                    et remet la numérotation à zéro. Réservé à la remise à blanc pour tests.
                  </div>
                  <button onClick={resetModule} disabled={busy}
                    className="text-xs bg-rose-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center gap-2">
                    <Trash2 size={14} /> Tout réinitialiser
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============ ARTICLES ============ */}
          {tab === 'articles' && isManager && (
            <div>
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 mb-4">
                <div className="font-bold text-sm text-indigo-900 mb-1">{itemForm.id ? 'Modifier l’article' : 'Nouvel article'}</div>
                {!itemForm.id && (
                  <div className="text-[11px] text-indigo-700/80 mb-2">
                    Inventaire initial : renseignez <b>Quantité initiale</b> → un <b>Bon d'entrée</b> est émis automatiquement.
                    Plusieurs articles d'un coup → bouton <b>« Import inventaire »</b> (onglet Stock).
                  </div>
                )}
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
                {!itemForm.id && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
                    <div>
                      <label className={labelCls}>Quantité initiale (optionnel)</label>
                      <input type="number" min="0" className={inputCls} placeholder="0" value={itemForm.initialQty} onChange={(e) => setItemForm({ ...itemForm, initialQty: e.target.value })} />
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-3 justify-end">
                  {itemForm.id && <button className={btnGhost} onClick={() => setItemForm({ id: '', name: '', category: 'other', location: 'entrepot', unit: 'pièce', notes: '', initialQty: '' })}>Annuler</button>}
                  <button className={btnPrimary} onClick={saveItem} disabled={busy}>{itemForm.id ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {items.map((it) => (
                  <div key={it.id} className={`flex flex-wrap items-center gap-2 sm:gap-3 border rounded-lg px-3 py-2 text-sm ${it.active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800 break-words">{it.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{LOCATION_LABEL[it.location]} · {it.unit}</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-700 whitespace-nowrap">stock {it.stock ?? 0}</span>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
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
                <label className={labelCls}>N° SWO (ordre de travail)</label>
                <input className={`${inputCls} mb-3`} placeholder="Ex. SWO-2026-045" value={procSwo} onChange={(e) => setProcSwo(e.target.value)} />
                <label className="text-xs font-semibold text-gray-600">Signature du demandeur</label>
                <SignBlock sigImg={procSigImg} setSigImg={setProcSigImg} sigName={procSigName} setSigName={setProcSigName} />
              </>
            ) : (
              <div>
                <label className={labelCls}>Motif du refus *</label>
                <input className={inputCls} placeholder="Ex. stock indisponible, demande hors périmètre…" value={procReason} onChange={(e) => setProcReason(e.target.value)} />
              </div>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
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
            <div className="grid sm:grid-cols-2 gap-2 mt-3 mb-3">
              <div>
                <label className={labelCls}>Agent (qui retourne)</label>
                <input className={inputCls} value={retAgent} onChange={(e) => setRetAgent(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Provenance (Site / Client)</label>
                <input className={inputCls} value={retProvenance} onChange={(e) => setRetProvenance(e.target.value)} />
              </div>
            </div>
            <label className="text-xs font-semibold text-gray-600 block">Date de retour</label>
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

      {/* ====== Dialog bon de récupération (retour terrain, jamais passé par le stock) ====== */}
      {recOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
            <div className="font-bold text-base mb-1">Bon de récupération — matériel ramené d'un site</div>
            <div className="text-xs text-gray-500 mb-3">Matériel n'ayant jamais transité par le stock STHIC. La condition détermine l'entrée en stock.</div>
            <RecoveryLinesEditor items={items.filter((i) => i.active)} lines={recLines} setLines={setRecLines} disabled={busy} inputCls={inputCls} />
            <label className="flex items-center gap-2 text-sm mt-3 font-semibold text-gray-700">
              <input type="checkbox" checked={recInitial} onChange={(e) => setRecInitial(e.target.checked)} />
              Inventaire initial — stock déjà sur place, sans site d'origine
            </label>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              <div>
                <label className={labelCls}>{recInitial ? 'Provenance (optionnel)' : 'Site de récupération *'}</label>
                {recInitial ? (
                  <input className={inputCls} placeholder="Inventaire initial" value={recOrigin} onChange={(e) => setRecOrigin(e.target.value)} />
                ) : (
                  <select className={inputCls} value={recSite} onChange={(e) => setRecSite(e.target.value)}>
                    <option value="">— Choisir un site —</option>
                    {sitesBzv.map((s) => <option key={s.id} value={s.id}>{siteLabel(s)}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls}>Date de récupération</label>
                <input type="date" className={inputCls} value={recDate} onChange={(e) => setRecDate(e.target.value)} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              <div>
                <label className={labelCls}>{recInitial ? 'Constaté par (vous par défaut)' : 'Ramené par *'}</label>
                <input className={inputCls} placeholder={recInitial ? 'Nom du magasinier' : 'Nom de la personne qui ramène'} value={recReturner} onChange={(e) => setRecReturner(e.target.value)} />
              </div>
              {!recInitial && (
                <div>
                  <label className={labelCls}>Fonction</label>
                  <select className={inputCls} value={recReturnerRole} onChange={(e) => setRecReturnerRole(e.target.value)}>
                    <option value="technician">Technicien</option>
                    <option value="field_supervisor">Field Supervisor</option>
                    <option value="htc_supervisor">Superviseur Zonal HTC</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-2">
              <label className={labelCls}>Motif / contexte</label>
              <input className={inputCls} placeholder="Ex. radiateur défectueux remplacé sur site" value={recReason} onChange={(e) => setRecReason(e.target.value)} />
            </div>
            <div className="mt-3">
              <label className={labelCls}>Signature *</label>
              <SignBlock sigImg={recSigImg} setSigImg={setRecSigImg} sigName={recSigName} setSigName={setRecSigName} />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button className={btnGhost} onClick={() => setRecOpen(false)}>Fermer</button>
              <button className="bg-sky-700 text-white px-4 py-2 rounded-lg hover:bg-sky-800 font-semibold text-sm disabled:opacity-60"
                disabled={busy || (!recSigImg && !recSigName.trim())} onClick={submitRecovery}>
                Émettre le bon de récupération
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Dialog import inventaire initial ====== */}
      {importOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
            <div className="font-bold text-base mb-1">Import inventaire initial</div>
            <div className="text-xs text-gray-500 mb-3">
              Collez votre tableau depuis Excel — une ligne par article, colonnes séparées par TAB ou « ; » :<br />
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">Désignation ; Lieu ; Quantité ; Condition ; Notes</code>
              <span className="block mt-1">
                Lieu : <b>entrepot</b> | <b>magasin</b> (variantes tolérées : « Magasin Buffer Stock », « Entrepôt »…)
                · Condition : fonctionnel | defectueux | a_reparer | hs — vide ou « Nouveau » = fonctionnel
              </span>
            </div>
            {importResult ? (
              <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-4">
                <div className="font-bold text-sm text-emerald-900 mb-2">Import terminé ✓</div>
                <div className="text-xs text-emerald-800 space-y-1">
                  <div>Articles créés au catalogue : <b>{importResult.itemsCreated}</b> · existants mis à jour : <b>{importResult.itemsMatched}</b></div>
                  {importResult.entry && <div>Bon d'entrée : <b className="font-mono">{importResult.entry.number}</b> ({importResult.entry.lines.length} ligne(s))</div>}
                  {importResult.recovery && <div>Bon de récupération : <b className="font-mono">{importResult.recovery.number}</b> ({importResult.recovery.lines.length} ligne(s))</div>}
                </div>
                <div className="flex gap-2 mt-3 justify-end">
                  {importResult.entry && <button className={btnGhost} onClick={() => printBon(importResult.entry)}>Imprimer le BE</button>}
                  {importResult.recovery && <button className={btnGhost} onClick={() => printBon(importResult.recovery)}>Imprimer le RC</button>}
                  <button className={btnPrimary} onClick={() => { setImportOpen(false); setImportResult(null); }}>Fermer</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <label className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm inline-flex items-center gap-2 cursor-pointer">
                    <Upload size={15} /> Choisir un fichier
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                  </label>
                  <span className="text-[11px] text-gray-400">.xlsx · .xls · .csv — 1ʳᵉ feuille utilisée</span>
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">…ou collez le tableau ci-dessous</div>
                <textarea
                  className={`${inputCls} font-mono text-xs h-40`}
                  placeholder={'Batterie Leoch 12V 100AH;entrepot;6\nGave Switch 125A;Magasin Buffer Stock;2;Nouveau\nRadiateur 30 KVA Yanmar;magasin;1;defectueux;remplacé CBBZ0090'}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                {parsedImport.length > 0 && (
                  <div className="mt-3 border border-gray-200 rounded-lg overflow-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-left text-gray-500">
                          <th className="px-2 py-1.5">Désignation</th><th className="px-2 py-1.5">Lieu</th>
                          <th className="px-2 py-1.5">Qté</th><th className="px-2 py-1.5">Condition</th><th className="px-2 py-1.5">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedImport.map((r, i) => (
                          <tr key={i} className={r.err ? 'bg-rose-50 text-rose-700' : 'text-gray-700'}>
                            <td className="px-2 py-1">{r.name || '—'}</td>
                            <td className="px-2 py-1">{LOCATION_LABEL[r.location] || '—'}</td>
                            <td className="px-2 py-1">{r.qty}</td>
                            <td className="px-2 py-1">{CONDITION_LABEL[r.condition]}</td>
                            <td className="px-2 py-1">{r.err || '✓'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  <div>
                    <label className={labelCls}>Date d'inventaire</label>
                    <input type="date" className={inputCls} value={importDate} onChange={(e) => setImportDate(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Motif</label>
                    <input className={inputCls} placeholder="Inventaire initial — migration" value={importReason} onChange={(e) => setImportReason(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4 justify-end">
                  <button className={btnGhost} onClick={() => { setImportOpen(false); setImportText(''); }}>Fermer</button>
                  <button className={btnPrimary}
                    disabled={busy || !parsedImport.length || parsedImport.some((r) => r.err) || !parsedImport.some((r) => r.qty > 0)}
                    onClick={submitImport}>
                    Importer ({parsedImport.filter((r) => !r.err && r.qty > 0).length} ligne(s))
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ====== Dialog bon d'entrée ====== */}
      {entryOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
            <div className="font-bold text-base mb-3">Bon d'entrée — réception matériel</div>
            <div className="hidden sm:grid grid-cols-[1fr_5.5rem_2rem] gap-2 mb-1 px-0.5">
              <span className={labelCls}>Article</span>
              <span className={`${labelCls} text-center`}>Quantité</span>
              <span></span>
            </div>
            <LinesEditor items={items.filter((i) => i.active)} lines={entryLines} setLines={setEntryLines} disabled={busy} />
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              <div>
                <label className={labelCls}>Expéditeur *</label>
                <select className={inputCls} value={entrySenderType} onChange={(e) => setEntrySenderType(e.target.value)}>
                  <option value="htc">Client HTC</option>
                  <option value="supplier">Fournisseur divers</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Nom de l'expéditeur</label>
                <input className={inputCls} placeholder={entrySenderType === 'htc' ? 'Ex. HTC Congo — warehouse' : 'Ex. Nom du fournisseur'} value={entrySupplier} onChange={(e) => setEntrySupplier(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>N° SMR (bon de sortie de l'expéditeur)</label>
                <input className={inputCls} placeholder="Ex. SMR-2026-078" value={entrySmr} onChange={(e) => setEntrySmr(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Bénéficiaire</label>
                <input className={inputCls} value={entryBeneficiary} onChange={(e) => setEntryBeneficiary(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Date d'entrée</label>
                <input type="date" className={inputCls} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
            </div>
            <div className="mt-2">
              <label className={labelCls}>Motif / référence</label>
              <input className={inputCls} placeholder="BL, livraison HTC…" value={entryReason} onChange={(e) => setEntryReason(e.target.value)} />
            </div>
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
