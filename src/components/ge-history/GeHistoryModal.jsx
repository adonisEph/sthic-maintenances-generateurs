import React, { useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, AlertTriangle, Printer, Pencil, Trash2, PlusCircle, Wrench, Check, History } from 'lucide-react';
import { formatDate } from '../../utils/calculations';

const fmtNH = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('fr-FR').replace(/ | /g, ' ');
};

const fmtDay = (d) => {
  const s = String(d || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '-';
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;
};

const KIND_META = {
  vidange: { label: 'Vidange', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  curatif: { label: 'Curatif', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  pose: { label: 'Pose GE', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  depose: { label: 'Dépose GE', cls: 'bg-gray-200 text-gray-700 border-gray-300' }
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const GeHistoryModal = ({ site, onClose, apiFetchJson, canManage, onDataChanged }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [depIdx, setDepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ eventDate: '', woNumber: '', description: '', runHours: '', kind: 'curatif' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ eventDate: '', woNumber: '', description: '', runHours: '' });
  const [showReplace, setShowReplace] = useState(false);
  const [replaceForm, setReplaceForm] = useState({ groupe: '', kva: '', serie: '', installedAt: '', note: '' });
  const [editDep, setEditDep] = useState(false);
  const [depForm, setDepForm] = useState({ groupe: '', kva: '', serie: '', installedAt: '', removedAt: '', note: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetchJson(`/api/sites/${encodeURIComponent(site.id)}/ge-history`, { method: 'GET' });
      setData(res);
    } catch (e) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [site?.id]);

  const deployments = useMemo(() => {
    const list = Array.isArray(data?.deployments) ? data.deployments : [];
    return [...list].sort((a, b) => (a.active === b.active ? (b.index - a.index) : a.active ? -1 : 1));
  }, [data]);

  const dep = deployments[Math.min(depIdx, Math.max(0, deployments.length - 1))] || null;
  const siteInfo = data?.site || site || {};

  const maxRows = dep ? Math.max(dep.journal.length, dep.readings.length) : 0;

  const printFiche = () => {
    if (!dep) return;
    const period = dep.installedAt
      ? `Posé le ${formatDate(dep.installedAt)}${dep.removedAt ? ` · Déposé le ${formatDate(dep.removedAt)}` : ' · En service'}`
      : 'Période complète';
    const rows = Array.from({ length: maxRows }, (_, i) => {
      const r = dep.readings[i];
      const j = dep.journal[i];
      return `<tr>
        <td class="nh">${r !== undefined ? esc(fmtNH(r)) : ''}</td>
        <td>${j ? esc(fmtDay(j.date)) : ''}</td>
        <td>${j ? esc(j.wo || '') : ''}</td>
        <td class="tx">${j ? esc(j.description) : ''}</td>
        <td class="nh">${j && j.runHours !== null && j.runHours !== undefined ? esc(fmtNH(j.runHours)) : ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche suivie maintenance G.E. — ${esc(siteInfo.nameSite)}</title>
<style>
  body{font-family:Arial,sans-serif;color:#111;padding:16px}
  h1{font-size:16px;margin:0 0 2px}
  .meta{color:#555;font-size:11px;margin-bottom:10px}
  table.hd{border-collapse:collapse;margin-bottom:10px;width:100%}
  table.hd td{border:1px solid #333;padding:4px 8px;font-size:11px}
  table.hd .lbl{background:#eef;font-weight:bold;font-size:9px;text-transform:uppercase;letter-spacing:.4px}
  table.j{border-collapse:collapse;width:100%}
  table.j th,table.j td{border:1px solid #666;padding:3px 6px;font-size:10.5px;vertical-align:top}
  table.j th{background:#ddd;font-size:9px;text-transform:uppercase;letter-spacing:.4px}
  td.nh{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  td.tx{min-width:220px}
  .foot{margin-top:10px;font-size:9.5px;color:#555}
</style></head><body>
<h1>FICHE SUIVIE MAINTENANCE G.E.</h1>
<div class="meta">${esc(period)} — générée le ${esc(new Date().toLocaleString('fr-FR'))}</div>
<table class="hd"><tr>
  <td><div class="lbl">Site</div>${esc(siteInfo.nameSite)}</td>
  <td><div class="lbl">ID</div>${esc(siteInfo.idSite || '-')}</td>
  <td><div class="lbl">Zone</div>${esc(siteInfo.zone || '-')}</td>
  <td><div class="lbl">Groupe</div>${esc(dep.groupe || '-')}</td>
  <td><div class="lbl">P. KVA</div>${esc(dep.kva || '-')}</td>
  <td><div class="lbl">Série</div>${esc(dep.serie || '-')}</td>
  <td><div class="lbl">Statut</div>${dep.active ? 'ACTIF' : 'ARCHIVÉ'}</td>
</tr></table>
<table class="j"><thead><tr><th>N. Heures</th><th>Date</th><th>N°</th><th>Tx. Exécut.</th><th>N. Heures</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#777">Aucun travail enregistré</td></tr>'}</tbody></table>
<div class="foot">Journal recomposé à la demande · ${dep.journal.length} travaux · ${dep.readings.length} relevés de compteur</div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { /* ignore */ }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
    };
  };

  const submitAdd = async () => {
    if (!addForm.eventDate || !addForm.description.trim()) {
      alert('Date et description requises.');
      return;
    }
    setBusy(true);
    try {
      await apiFetchJson('/api/ge-history/events', {
        method: 'POST',
        body: JSON.stringify({
          siteId: site.id,
          events: [{
            eventDate: addForm.eventDate,
            woNumber: addForm.woNumber,
            description: addForm.description.trim(),
            runHours: addForm.runHours === '' ? null : Number(addForm.runHours),
            kind: addForm.kind,
            source: 'manual'
          }]
        })
      });
      setAddForm({ eventDate: '', woNumber: '', description: '', runHours: '', kind: 'curatif' });
      setShowAdd(false);
      await load();
      if (addForm.kind === 'pose' || addForm.kind === 'depose') onDataChanged?.();
    } catch (e) {
      alert(e?.message || 'Erreur enregistrement.');
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (row) => {
    setBusy(true);
    try {
      await apiFetchJson(`/api/ge-history/events/${encodeURIComponent(row.eventId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          eventDate: editForm.eventDate,
          woNumber: editForm.woNumber,
          description: editForm.description,
          runHours: editForm.runHours === '' ? null : Number(editForm.runHours)
        })
      });
      setEditId(null);
      await load();
    } catch (e) {
      alert(e?.message || 'Erreur modification.');
    } finally {
      setBusy(false);
    }
  };

  const removeEvent = async (row) => {
    if (!window.confirm(`Supprimer ce travail ?\n\n${fmtDay(row.date)} — ${row.description}`)) return;
    setBusy(true);
    try {
      await apiFetchJson(`/api/ge-history/events/${encodeURIComponent(row.eventId)}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e?.message || 'Erreur suppression.');
    } finally {
      setBusy(false);
    }
  };

  const submitReplace = async () => {
    if (!window.confirm('Confirmer le remplacement du GE ?\n\nLa fiche actuelle sera archivée et une nouvelle fiche s\'ouvrira.')) return;
    setBusy(true);
    try {
      await apiFetchJson(`/api/sites/${encodeURIComponent(site.id)}/ge-deployments`, {
        method: 'POST',
        body: JSON.stringify({
          groupe: replaceForm.groupe,
          kva: replaceForm.kva,
          serie: replaceForm.serie,
          installedAt: replaceForm.installedAt || undefined,
          note: replaceForm.note
        })
      });
      setShowReplace(false);
      setDepIdx(0);
      await load();
      onDataChanged?.();
    } catch (e) {
      alert(e?.message || 'Erreur remplacement.');
    } finally {
      setBusy(false);
    }
  };

  const submitDepPatch = async () => {
    if (!dep?.id) return;
    setBusy(true);
    try {
      await apiFetchJson(`/api/sites/${encodeURIComponent(site.id)}/ge-deployments`, {
        method: 'PATCH',
        body: JSON.stringify({
          deploymentId: dep.id,
          groupe: depForm.groupe,
          kva: depForm.kva,
          serie: depForm.serie,
          installedAt: depForm.installedAt || undefined,
          removedAt: depForm.removedAt || undefined,
          note: depForm.note
        })
      });
      setEditDep(false);
      await load();
    } catch (e) {
      alert(e?.message || 'Erreur correction.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';
  const btnCls = 'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-slate-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '97vw', maxWidth: '97vw', height: '94vh', maxHeight: '94vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-indigo-950 text-white">
          <History size={20} className="text-sky-300" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-base sm:text-lg truncate">Historique GE — {siteInfo.nameSite || site?.nameSite}</div>
            <div className="text-[11px] text-indigo-200 truncate">
              {siteInfo.idSite || site?.idSite} · {siteInfo.zone || site?.zone} · Technicien : {siteInfo.technician || site?.technician || '-'}
            </div>
          </div>
          <button
            onClick={printFiche}
            disabled={!dep || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-sm font-semibold"
            title="Imprimer la fiche affichée"
          >
            <Printer size={15} /> Imprimer la fiche
          </button>
          <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50" title="Rafraîchir">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" title="Fermer">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        <div className="px-4 sm:px-6 pt-3 flex items-end gap-2 flex-wrap">
          {deployments.map((d, i) => {
            const label = d.active ? `GE actif — ${[d.groupe, d.kva].filter(Boolean).join(' ') || 'GE'}` : `GE #${d.index} archivé — ${[d.groupe, d.kva].filter(Boolean).join(' ') || 'GE'}`;
            return (
              <button
                key={d.id || `v${d.index}`}
                onClick={() => { setDepIdx(i); setEditId(null); }}
                className={`px-3 py-1.5 rounded-t-lg text-xs sm:text-sm font-semibold border border-b-0 transition-colors ${
                  i === depIdx
                    ? 'bg-white text-indigo-900 border-gray-300'
                    : 'bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-300/70'
                }`}
              >
                {label}
                <span className="ml-1.5 text-[10px] opacity-70">({d.journal.length})</span>
              </button>
            );
          })}
          {!deployments.length && !loading && (
            <div className="text-sm text-gray-500 pb-2">Aucun déploiement GE.</div>
          )}
        </div>

        <div className="mx-4 sm:mx-6 bg-white border border-gray-300 rounded-b-xl rounded-tr-xl shadow-sm flex-1 min-h-0 flex flex-col">
          {dep && (
            <div className="px-4 pt-3 pb-2 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">Fiche suivie maintenance G.E.</span>
                <span><span className="text-gray-500 text-xs">Groupe </span><b>{dep.groupe || '-'}</b></span>
                <span><span className="text-gray-500 text-xs">P. KVA </span><b>{dep.kva || '-'}</b></span>
                <span><span className="text-gray-500 text-xs">Série </span><b>{dep.serie || '-'}</b></span>
                <span className="text-gray-600 text-xs">
                  {dep.installedAt ? `Posé le ${formatDate(dep.installedAt)}` : 'Pose : —'}
                  {dep.removedAt ? ` → Déposé le ${formatDate(dep.removedAt)}` : ' → En service'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dep.active ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                  {dep.active ? 'ACTIF' : 'ARCHIVÉ'}
                </span>
                {dep.virtual && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded" title="Aucun déploiement enregistré — fiche déduite des données du site">
                    Signalétique déduite du site
                  </span>
                )}
                {canManage && (
                  <span className="ml-auto flex items-center gap-1.5">
                    {!dep.virtual && dep.id && (
                      <button
                        className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Corriger la signalétique / les dates"
                        onClick={() => {
                          setDepForm({
                            groupe: dep.groupe, kva: dep.kva, serie: dep.serie,
                            installedAt: dep.installedAt || '', removedAt: dep.removedAt || '', note: ''
                          });
                          setEditDep(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      className={`${btnCls} bg-sky-100 text-sky-700 hover:bg-sky-200 inline-flex items-center gap-1`}
                      onClick={() => setShowAdd((v) => !v)}
                    >
                      <PlusCircle size={14} /> Ajouter un travail
                    </button>
                    <button
                      className={`${btnCls} bg-amber-100 text-amber-800 hover:bg-amber-200 inline-flex items-center gap-1`}
                      onClick={() => {
                        setReplaceForm({
                          groupe: siteInfo.generateur || dep.groupe || '',
                          kva: siteInfo.capacite || dep.kva || '',
                          serie: '', installedAt: '', note: ''
                        });
                        setShowReplace(true);
                      }}
                    >
                      <Wrench size={14} /> Remplacer le GE
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {editDep && dep && (
            <div className="mx-4 mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <div className="text-xs font-bold text-indigo-800 mb-2">Corriger la signalétique du déploiement</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input className={inputCls} placeholder="Groupe (ex. PRAMAC)" value={depForm.groupe} onChange={(e) => setDepForm({ ...depForm, groupe: e.target.value })} />
                <input className={inputCls} placeholder="P. KVA (ex. 45 KVA)" value={depForm.kva} onChange={(e) => setDepForm({ ...depForm, kva: e.target.value })} />
                <input className={inputCls} placeholder="Série" value={depForm.serie} onChange={(e) => setDepForm({ ...depForm, serie: e.target.value })} />
                <input className={inputCls} type="date" title="Date de pose" value={depForm.installedAt} onChange={(e) => setDepForm({ ...depForm, installedAt: e.target.value })} />
                <input className={inputCls} type="date" title="Date de dépose" value={depForm.removedAt} onChange={(e) => setDepForm({ ...depForm, removedAt: e.target.value })} />
              </div>
              <div className="mt-2 flex gap-2 justify-end">
                <button className={`${btnCls} bg-gray-200 text-gray-700 hover:bg-gray-300`} onClick={() => setEditDep(false)}>Annuler</button>
                <button className={`${btnCls} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50`} disabled={busy} onClick={submitDepPatch}>Enregistrer</button>
              </div>
            </div>
          )}

          {showReplace && (
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3">
              <div className="text-xs font-bold text-amber-800 mb-2">Remplacer le GE — la fiche actuelle sera archivée, une nouvelle s'ouvre</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input className={inputCls} placeholder="Groupe nouveau GE" value={replaceForm.groupe} onChange={(e) => setReplaceForm({ ...replaceForm, groupe: e.target.value })} />
                <input className={inputCls} placeholder="P. KVA" value={replaceForm.kva} onChange={(e) => setReplaceForm({ ...replaceForm, kva: e.target.value })} />
                <input className={inputCls} placeholder="Série" value={replaceForm.serie} onChange={(e) => setReplaceForm({ ...replaceForm, serie: e.target.value })} />
                <input className={inputCls} type="date" title="Date de pose du nouveau GE" value={replaceForm.installedAt} onChange={(e) => setReplaceForm({ ...replaceForm, installedAt: e.target.value })} />
                <input className={inputCls} placeholder="Note (optionnel)" value={replaceForm.note} onChange={(e) => setReplaceForm({ ...replaceForm, note: e.target.value })} />
              </div>
              <div className="mt-2 flex gap-2 justify-end">
                <button className={`${btnCls} bg-gray-200 text-gray-700 hover:bg-gray-300`} onClick={() => setShowReplace(false)}>Annuler</button>
                <button className={`${btnCls} bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50`} disabled={busy} onClick={submitReplace}>Confirmer le remplacement</button>
              </div>
            </div>
          )}

          {showAdd && (
            <div className="mx-4 mt-3 bg-sky-50 border border-sky-200 rounded-lg p-3">
              <div className="text-xs font-bold text-sky-800 mb-2">Ajouter un travail sur cette fiche</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input className={inputCls} type="date" title="Date de réalisation" value={addForm.eventDate} onChange={(e) => setAddForm({ ...addForm, eventDate: e.target.value })} />
                <input className={inputCls} placeholder="N° WO (ex. 260324)" value={addForm.woNumber} onChange={(e) => setAddForm({ ...addForm, woNumber: e.target.value })} />
                <input className={`${inputCls} sm:col-span-2`} placeholder="Description du travail" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
                <div className="flex gap-2">
                  <input className={inputCls} type="number" min="0" placeholder="N. Heures" value={addForm.runHours} onChange={(e) => setAddForm({ ...addForm, runHours: e.target.value })} />
                  <select className={inputCls} value={addForm.kind} onChange={(e) => setAddForm({ ...addForm, kind: e.target.value })} title="Type de travail">
                    <option value="curatif">Curatif</option>
                    <option value="vidange">Vidange</option>
                    <option value="pose">Pose GE</option>
                    <option value="depose">Dépose GE</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 flex gap-2 justify-end">
                <button className={`${btnCls} bg-gray-200 text-gray-700 hover:bg-gray-300`} onClick={() => setShowAdd(false)}>Annuler</button>
                <button className={`${btnCls} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`} disabled={busy} onClick={submitAdd}>Enregistrer</button>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto px-4 pb-4 pt-2">
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Reconstitution de la fiche…</div>
            ) : !dep ? (
              <div className="py-16 text-center text-gray-400 text-sm">Aucune fiche GE pour ce site.</div>
            ) : maxRows === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">Aucun travail ni relevé enregistré sur ce GE.</div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-indigo-100 text-indigo-900">
                    <th className="border border-indigo-200 px-2 py-2 text-right w-24 text-[10px] uppercase tracking-wide">N. Heures</th>
                    <th className="border border-indigo-200 px-2 py-2 text-left w-24 text-[10px] uppercase tracking-wide">Date</th>
                    <th className="border border-indigo-200 px-2 py-2 text-left w-24 text-[10px] uppercase tracking-wide">N°</th>
                    <th className="border border-indigo-200 px-2 py-2 text-left text-[10px] uppercase tracking-wide">Tx. Exécut.</th>
                    <th className="border border-indigo-200 px-2 py-2 text-right w-24 text-[10px] uppercase tracking-wide">N. Heures</th>
                    {canManage && <th className="border border-indigo-200 px-2 py-2 w-16 text-[10px] uppercase tracking-wide">Act.</th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRows }, (_, i) => {
                    const reading = dep.readings[i];
                    const row = dep.journal[i];
                    const km = row ? (KIND_META[row.kind] || KIND_META.curatif) : null;
                    const editing = row && editId === row.eventId;
                    return (
                      <tr key={i} className={`${row?.kind === 'pose' ? 'bg-amber-50' : row?.kind === 'depose' ? 'bg-gray-100' : i % 2 ? 'bg-slate-50/60' : 'bg-white'}`}>
                        <td className="border border-gray-200 px-2 py-1.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">{reading !== undefined ? fmtNH(reading) : ''}</td>
                        {editing ? (
                          <>
                            <td className="border border-gray-200 px-1 py-1"><input type="date" className="border border-gray-300 rounded px-1 py-0.5 text-xs w-full" value={editForm.eventDate} onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })} /></td>
                            <td className="border border-gray-200 px-1 py-1"><input className="border border-gray-300 rounded px-1 py-0.5 text-xs w-full" value={editForm.woNumber} onChange={(e) => setEditForm({ ...editForm, woNumber: e.target.value })} /></td>
                            <td className="border border-gray-200 px-1 py-1"><input className="border border-gray-300 rounded px-1 py-0.5 text-xs w-full" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></td>
                            <td className="border border-gray-200 px-1 py-1"><input type="number" className="border border-gray-300 rounded px-1 py-0.5 text-xs w-full text-right" value={editForm.runHours} onChange={(e) => setEditForm({ ...editForm, runHours: e.target.value })} /></td>
                            <td className="border border-gray-200 px-1 py-1 text-center whitespace-nowrap">
                              <button className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" disabled={busy} onClick={() => submitEdit(row)} title="Enregistrer"><Check size={14} /></button>
                              <button className="p-1 text-gray-400 hover:bg-gray-100 rounded" onClick={() => setEditId(null)} title="Annuler"><X size={14} /></button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="border border-gray-200 px-2 py-1.5 whitespace-nowrap text-xs">{row ? fmtDay(row.date) : ''}</td>
                            <td className="border border-gray-200 px-2 py-1.5 whitespace-nowrap text-xs font-mono" title={row?.ticket || ''}>{row?.wo || ''}</td>
                            <td className="border border-gray-200 px-2 py-1.5 text-xs">
                              {row && (
                                <span className="inline-flex items-start gap-1.5">
                                  <span className={`mt-px inline-block shrink-0 px-1.5 py-px rounded-full border text-[9px] font-bold uppercase tracking-wide ${km.cls}`}>{km.label}</span>
                                  <span>{row.description}</span>
                                </span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-2 py-1.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">{row && row.runHours !== null && row.runHours !== undefined ? fmtNH(row.runHours) : ''}</td>
                            {canManage && (
                              <td className="border border-gray-200 px-1 py-1 text-center whitespace-nowrap">
                                {row?.editable ? (
                                  <>
                                    <button
                                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                      title="Modifier ce travail"
                                      onClick={() => {
                                        setEditId(row.eventId);
                                        setEditForm({ eventDate: row.date, woNumber: row.wo, description: row.description, runHours: row.runHours ?? '' });
                                      }}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer" disabled={busy} onClick={() => removeEvent(row)}>
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                ) : null}
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {dep && (
            <div className="px-4 py-2 border-t border-gray-200 text-[11px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>{dep.journal.length} travaux</span>
              <span>{dep.readings.length} relevés de compteur</span>
              <span>Fiche recomposée à la demande — aucune copie stockée</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeHistoryModal;
