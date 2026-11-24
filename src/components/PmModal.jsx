import React from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TrendingUp, X, Upload, Download, Trash2, RotateCcw, Activity, Menu, ChevronLeft, ListChecks, BadgeCheck, Clock, UserCheck, Filter, Search, Printer, FileScan } from 'lucide-react';

const STHIC_LOGO_SRC = '/Logo_sthic.png';

const PmModal = (props) => {
  const {
    showPm,
    appVersion,
    canUsePm,
    isViewer,
    isAdmin,
    isManager,
    setShowPm,
    setPmError,
    setPmNotice,
    pmMonth,
    setPmMonth,
    refreshPmAll,
    pmBusy,
    pmReprogExportDate,
    setPmReprogExportDate,
    exportBusy,
    users,
    pmSendTechUserId,
    setPmSendTechUserId,
    pmSendBusy,
    handleSendPmMonthPlanning,
    pmResetBusy,
    handlePmReset,
    handlePmNocImport,
    handlePmClientImport,
    handlePmGlobalImport,
    pmError,
    pmNotice,
    pmNocProgress,
    pmNocStep,
    pmClientProgress,
    pmClientStep,
    pmClientCompare,
    pmGlobalProgress,
    pmGlobalStep,
    pmRetiredSites,
    pmItems,
    pmImports,
    ficheHistory,
    sites,
    loadFicheHistory,
    pmSearch,
    setPmSearch,
    pmFilterFrom,
    setPmFilterFrom,
    pmFilterTo,
    setPmFilterTo,
    pmFilterState,
    setPmFilterState,
    pmFilterType,
    setPmFilterType,
    pmFilterZone,
    setPmFilterZone,
    pmFilterReprog,
    setPmFilterReprog,
    pmDetails,
    setPmDetails,
    pmReprogOpen,
    setPmReprogOpen,
    pmReprogItem,
    setPmReprogItem,
    pmReprogForm,
    setPmReprogForm,
    pmReprogError,
    setPmReprogError,
    pmReprogSaving,
    handlePmOpenReprog,
    handlePmSaveReprog,
    handlePmExportRetiredSitesExcel,
    handlePmExportItemsExcel,
    formatDate,
    authZone,
  } = props;

  const [pmRetiredSitesOpen, setPmRetiredSitesOpen] = React.useState(false);
  const [pmRetiredSitesZoneFilter, setPmRetiredSitesZoneFilter] = React.useState('ALL');
  const [pmRetiredSuccMode, setPmRetiredSuccMode] = React.useState(false);
  const [pmRetiredSuccWindow, setPmRetiredSuccWindow] = React.useState(3);
  const [pmRetiredMatrix, setPmRetiredMatrix] = React.useState(null);
  const [pmRetiredMatrixSearch, setPmRetiredMatrixSearch] = React.useState('');
  const [pmRetiredMatrixSerie, setPmRetiredMatrixSerie] = React.useState([]);
  const [pmRetiredSuccBusy, setPmRetiredSuccBusy] = React.useState(false);
  const [pmPurgeOpen, setPmPurgeOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [pmPurgeBusy, setPmPurgeBusy] = React.useState(false);
  const [pmPurgeGlobal, setPmPurgeGlobal] = React.useState(false);
  const [pmPurgeClient, setPmPurgeClient] = React.useState(true);
  const [pmPurgeDryRun, setPmPurgeDryRun] = React.useState(true);
  const [pmPurgeZones, setPmPurgeZones] = React.useState([]);
  const [pmPurgeResult, setPmPurgeResult] = React.useState(null);
  const [pmFilterPlannedDay, setPmFilterPlannedDay] = React.useState('');
  const [pmFiltersOpen, setPmFiltersOpen] = React.useState(true);
  const [exportCenterOpen, setExportCenterOpen] = React.useState(false);
  const [exportDayState, setExportDayState] = React.useState('all');
  const [exportReprogPeriod, setExportReprogPeriod] = React.useState('month');
  const [exportReprogStatus, setExportReprogStatus] = React.useState('all');
  const [exportTechSearch, setExportTechSearch] = React.useState('');

  const todayStr = (() => {
    try {
      const d = new Date();
      return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  })();

  const pmIsSuperAdmin = Boolean(props?.isSuperAdmin);
  const managerZoneLock = String(props?.managerZoneLock || '').trim();
  const pmTechFilterZone = managerZoneLock || (pmFilterZone && pmFilterZone !== 'all' ? String(pmFilterZone || '').trim() : '');

  React.useEffect(() => {
    if (!pmIsSuperAdmin) return;
    setPmPurgeZones((z) => {
      const cur = Array.isArray(z) ? z : [];
      if (cur.length > 0) return cur;
      return ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
    });
  }, [pmIsSuperAdmin]);

  const pmCallJson = async (url, options) => {
    if (typeof props?.apiFetchJson === 'function') {
      return await props.apiFetchJson(url, options);
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    };
    const res = await fetch(url, {
      method: options?.method || 'GET',
      credentials: 'same-origin',
      headers,
      body: options?.body
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error ? String(data.error) : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  };

  const pmEnsureMonthId = async (yyyymm) => {
    const m = String(yyyymm || '').trim();
    if (!m) throw new Error('Mois requis.');

    const list = await pmCallJson('/api/pm/months', { method: 'GET' });
    const months = Array.isArray(list?.months) ? list.months : [];
    const found = months.find((x) => String(x?.month || '').trim() === m) || null;
    const id = found?.id ? String(found.id) : '';
    if (!id) throw new Error(`Mois introuvable: ${m}`);
    return id;
  };

  const pmTogglePurgeZone = (zone) => {
    const z = String(zone || '').trim();
    if (!z) return;
    setPmPurgeZones((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(z)) return arr.filter((x) => x !== z);
      return [...arr, z];
    });
  };

  const pmRunPurge = async ({ dryRun }) => {
    if (!isAdmin) return;
    const purgeGlobal = Boolean(pmPurgeGlobal);
    const purgeClient = Boolean(pmPurgeClient);
    if (!purgeGlobal && !purgeClient) {
      setPmError('Veuillez sélectionner au moins une option de purge (client/global).');
      return;
    }

    setPmPurgeBusy(true);
    setPmError('');
    setPmNotice('');
    setPmPurgeResult(null);
    try {
      const monthId = await pmEnsureMonthId(pmMonth);
      const body = {
        purgeGlobal,
        purgeClient,
        dryRun: Boolean(dryRun)
      };
      if (pmIsSuperAdmin) {
        body.zones = Array.isArray(pmPurgeZones) ? pmPurgeZones : [];
      }

      const res = await pmCallJson(`/api/pm/months/${monthId}/purge-imports`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setPmPurgeResult(res || null);

      if (Boolean(res?.dryRun)) {
        setPmNotice(
          `🧪 Dry-run purge (${String(res?.month || pmMonth)}): Global plans ${Number(res?.preview?.pmGlobalPlans || 0)} • Global items ${Number(
            res?.preview?.pmGlobalPlanItems || 0
          )} • Client items ${Number(res?.preview?.pmClientItems || 0)} • NOC ${Number(res?.preview?.pmClientNocRows || 0)} • Assign. ${Number(
            res?.preview?.pmClientAssignments || 0
          )}`
        );
        return;
      }

      setPmNotice(
        `✅ Purge effectuée (${String(res?.month || pmMonth)}). Global plans ${Number(res?.deleted?.pmGlobalPlans || 0)} • Global items ${Number(
          res?.deleted?.pmGlobalPlanItems || 0
        )} • Client items ${Number(res?.deleted?.pmClientItems || 0)} • NOC ${Number(res?.deleted?.pmClientNocRows || 0)} • Assign. ${Number(
          res?.deleted?.pmClientAssignments || 0
        )}`
      );
      setPmPurgeOpen(false);
      await refreshPmAll(pmMonth);
    } catch (e) {
      setPmError(e?.message || 'Erreur lors de la purge.');
    } finally {
      setPmPurgeBusy(false);
    }
  };

  const pmSitesByCode = React.useMemo(() => {
    const map = new Map();
    for (const s of Array.isArray(sites) ? sites : []) {
      const code = String(s?.idSite || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
      if (!code) continue;
      map.set(code, s);
    }
    return map;
  }, [sites]);

  const pmNormalizeSiteCode = (v) =>
    String(v || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

  if (!showPm || !canUsePm) return null;

  const pmRetired = pmRetiredSites && typeof pmRetiredSites === 'object' ? pmRetiredSites : null;
  const pmRetiredScopeZones = Array.isArray(pmRetired?.scopeZones) ? pmRetired.scopeZones : [];
  const pmRetiredItemsAll = Array.isArray(pmRetired?.items) ? pmRetired.items : [];

  const pmEffectiveRetiredZoneFilter = pmIsSuperAdmin ? String(pmRetiredSitesZoneFilter || 'ALL') : 'ALL';
  const pmRetiredItems =
    pmEffectiveRetiredZoneFilter && pmEffectiveRetiredZoneFilter !== 'ALL'
      ? pmRetiredItemsAll.filter((it) => String(it?.zone || '').trim() === pmEffectiveRetiredZoneFilter)
      : pmRetiredItemsAll;

  // « Sites retirés successivement » : matrice croisée — tous les sites du parc
  // en lignes, les N derniers mois en colonnes ; cellule = ❌ retiré / ✅ n° PMWO / — absent.
  const loadPmRetiredMatrix = async (win) => {
    setPmRetiredSuccBusy(true);
    try {
      const data = await pmCallJson(`/api/pm/retired-matrix?campaign=${encodeURIComponent(pmRetired?.month || '')}&window=${win}`);
      setPmRetiredMatrix(data && Array.isArray(data.items) ? data : { months: [], monthsExisting: [], monthsMissing: [], items: [] });
    } catch (e) {
      console.error('retired-matrix:', e);
      setPmRetiredMatrix(null);
    } finally {
      setPmRetiredSuccBusy(false);
    }
  };

  const pmMatrixMonths = Array.isArray(pmRetiredMatrix?.months) ? pmRetiredMatrix.months : [];
  const pmMatrixExistingArr = Array.isArray(pmRetiredMatrix?.monthsExisting) ? pmRetiredMatrix.monthsExisting : [];
  const pmMatrixMissingArr = Array.isArray(pmRetiredMatrix?.monthsMissing) ? pmRetiredMatrix.monthsMissing : [];
  const pmMatrixMissingSet = new Set(pmMatrixMissingArr);
  const pmMatrixZoneItems = (Array.isArray(pmRetiredMatrix?.items) ? pmRetiredMatrix.items : [])
    .filter((it) => !pmEffectiveRetiredZoneFilter || pmEffectiveRetiredZoneFilter === 'ALL' || String(it?.zone || '').trim() === pmEffectiveRetiredZoneFilter);
  const pmRetiredSuccCount = pmMatrixZoneItems.filter(
    (it) => pmMatrixExistingArr.length > 0 && pmMatrixExistingArr.every((mo) => it?.cells?.[mo]?.s === 'retired')
  ).length;
  const pmMatrixZones = [...new Set((Array.isArray(pmRetiredMatrix?.items) ? pmRetiredMatrix.items : []).map((it) => String(it?.zone || '').trim()).filter(Boolean))].sort();
  const pmMatrixItems = pmMatrixZoneItems
    .filter((it) => pmRetiredMatrixSerie.length === 0 || pmRetiredMatrixSerie.includes(Number(it?.retiredCount || 0)))
    .filter((it) => {
      const q = String(pmRetiredMatrixSearch || '').trim().toLowerCase();
      if (!q) return true;
      return [it?.siteCode, it?.siteName, it?.technician, it?.zone].some((v) => String(v || '').toLowerCase().includes(q));
    });
  const pmRetiredViewItems = pmRetiredSuccMode ? pmMatrixItems : pmRetiredItems;

  const handleExportRetiredMatrix = async () => {
    const monthCols = pmMatrixMonths;
    const rows = pmMatrixItems.map((it) => {
      const base = {
        Zone: it?.zone || '-',
        Site: it?.siteCode || '-',
        'Site Name': it?.siteName || '-',
        Technicien: it?.technician || '-',
        'Date DV': it?.dateDv || '—',
        'NH1 DV': it?.nh1Dv ?? '—',
        'Date A': it?.dateA || '—',
        'NH2 A': it?.nh2A ?? '—',
        'Diff NHs': it?.diffNhs ?? '—'
      };
      for (const mo of monthCols) {
        const c = it?.cells?.[mo];
        base[mo] = pmMatrixMissingSet.has(mo)
          ? 'aucune campagne'
          : c?.s === 'retired'
            ? 'RETIRÉ'
            : c?.s === 'active'
              ? (c?.ticket ? `PMWO ${c.ticket}` : 'PM réalisée')
              : '—';
      }
      base['Retraits sur la fenêtre'] = `${it?.retiredCount || 0}/${pmMatrixExistingArr.length || monthCols.length}`;
      return base;
    });
    const totalRow = { Zone: '', Site: 'TOTAL', 'Site Name': `${rows.length} site(s)`, Technicien: '', 'Date DV': '', 'NH1 DV': '', 'Date A': '', 'NH2 A': '', 'Diff NHs': `${pmMatrixItems.filter((it) => it?.diffNhs != null && it.diffNhs >= (Number(it?.seuil) || 250)).length} ≥ seuil` };
    for (const mo of monthCols) {
      if (pmMatrixMissingSet.has(mo)) {
        totalRow[mo] = 'aucune campagne';
      } else {
        const ret = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'retired').length;
        const act = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'active').length;
        totalRow[mo] = `${ret} retiré(s) · ${act} PM`;
      }
    }
    totalRow['Retraits sur la fenêtre'] = `${pmMatrixItems.filter((it) => pmMatrixExistingArr.length > 0 && pmMatrixExistingArr.every((mo) => it?.cells?.[mo]?.s === 'retired')).length} complets`;
    rows.push(totalRow);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 34 }, { wch: 22 },
      { wch: 11 }, { wch: 9 }, { wch: 11 }, { wch: 9 }, { wch: 10 },
      ...monthCols.map(() => ({ wch: 18 })),
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, `Successifs ${pmRetiredSuccWindow}m`);
    XLSX.writeFile(wb, `Sites-retirés-successivement_${pmRetired?.month || 'campagne'}_${pmRetiredSuccWindow}mois.xlsx`);
  };

  const pmEscapeHtml = (s) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Impression « intelligente » : reproduit exactement la vue affichée —
  // liste « Tous » ou matrice, avec les filtres zone / série / recherche appliqués.
  // Titre + méta du rapport « sites retirés » — le vrai sujet, dérivé des filtres.
  const retiredReportInfo = () => {
    const n = pmMatrixExistingArr.length;
    let reportTitle;
    if (!pmRetiredSuccMode) {
      reportTitle = `Sites retirés de la campagne ${pmRetired?.month || ''}`;
    } else {
      const sel = [...pmRetiredMatrixSerie].sort((a, b) => a - b);
      const winTxt = `${pmRetiredSuccWindow} mois (jusqu'à ${pmRetired?.month || ''})`;
      if (sel.length === 0) {
        reportTitle = `Matrice des retraits PM — parc complet sur ${winTxt}`;
      } else if (sel.length === 1) {
        reportTitle = sel[0] === n && n > 0
          ? `Sites retirés ${n} mois de suite — jusqu'à ${pmRetired?.month || ''}`
          : `Sites avec ${sel[0]} retrait(s) sur ${n} mois — jusqu'à ${pmRetired?.month || ''}`;
      } else {
        const contiguous = sel.every((v, idx) => idx === 0 || v === sel[idx - 1] + 1);
        reportTitle = contiguous
          ? `Sites avec ${sel[0]} à ${sel[sel.length - 1]} retraits sur ${pmRetiredSuccWindow} mois — jusqu'à ${pmRetired?.month || ''}`
          : `Sites avec ${sel.join(', ')} retraits sur ${pmRetiredSuccWindow} mois — jusqu'à ${pmRetired?.month || ''}`;
      }
    }
    const metaParts = [];
    const z = pmEffectiveRetiredZoneFilter;
    if (z && z !== 'ALL') metaParts.push(`Zone : ${z}`);
    if (pmRetiredSuccMode && String(pmRetiredMatrixSearch || '').trim()) {
      metaParts.push(`Recherche : « ${pmRetiredMatrixSearch.trim()} »`);
    }
    metaParts.push(`${pmRetiredSuccMode ? pmMatrixItems.length : pmRetiredItems.length} ligne(s)`);
    metaParts.push(`généré le ${new Date().toLocaleDateString('fr-FR')}`);
    return { reportTitle, meta: metaParts.join(' · ') };
  };

  // Document du rapport « sites retirés » — mutualisé impression + PDF « scan ».
  // Le HTML est reconstruit à la volée depuis les listes FILTRÉES affichées à l'écran.
  const buildRetiredReportHtml = () => {
    const { reportTitle, meta } = retiredReportInfo();

    let tableHtml;
    if (pmRetiredSuccMode) {
      const headCells = pmMatrixMonths
        .map((mo) => `<th>${pmEscapeHtml(mo)}${pmMatrixMissingSet.has(mo) ? ' *' : ''}</th>`)
        .join('');
      const rows = pmMatrixItems.map((it) => {
        const tds = pmMatrixMonths.map((mo) => {
          if (pmMatrixMissingSet.has(mo)) return '<td class="c mut">—</td>';
          const c = it?.cells?.[mo];
          if (c?.s === 'retired') return '<td class="c bad">✗</td>';
          if (c?.s === 'active') return `<td class="c ok">✓${c?.ticket ? `<div class="t">${pmEscapeHtml(c.ticket)}</div>` : ''}</td>`;
          return '<td class="c mut">—</td>';
        }).join('');
        const over = it?.diffNhs != null && it.diffNhs >= (Number(it?.seuil) || 250);
        const nh = `<td class="c">${pmEscapeHtml(it?.dateDv || '—')}</td><td class="c">${it?.nh1Dv ?? '—'}</td><td class="c">${pmEscapeHtml(it?.dateA || '—')}</td><td class="c">${it?.nh2A ?? '—'}</td><td class="c${over ? ' warn' : ''}">${it?.diffNhs ?? '—'}</td>`;
        return `<tr><td class="l"><b>${pmEscapeHtml(it?.siteCode || '-')}</b> · ${pmEscapeHtml(it?.siteName || '-')}</td><td class="l">${pmEscapeHtml(it?.zone || '-')}</td><td class="l">${pmEscapeHtml(it?.technician || '-')}</td>${nh}${tds}<td class="c"><b>${it?.retiredCount || 0}/${pmMatrixExistingArr.length || pmMatrixMonths.length}</b></td></tr>`;
      }).join('');
      const footCells = pmMatrixMonths.map((mo) => {
        if (pmMatrixMissingSet.has(mo)) return '<td class="c mut">—</td>';
        const ret = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'retired').length;
        const act = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'active').length;
        return `<td class="c"><b>✗ ${ret}</b><div class="t">✓ ${act}</div></td>`;
      }).join('');
      const fullCount = pmMatrixItems.filter((it) => pmMatrixExistingArr.length > 0 && pmMatrixExistingArr.every((mo) => it?.cells?.[mo]?.s === 'retired')).length;
      const overSeuilCount = pmMatrixItems.filter((it) => it?.diffNhs != null && it.diffNhs >= (Number(it?.seuil) || 250)).length;
      tableHtml = `<table><thead><tr><th class="l">Site</th><th class="l">Zone</th><th class="l">Technicien</th><th class="c">Date DV</th><th class="c">NH1 DV</th><th class="c">Date A</th><th class="c">NH2 A</th><th class="c">Diff NHs</th>${headCells}<th>Série</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="tot"><td class="l"><b>TOTAL · ${pmMatrixItems.length} site(s)</b></td><td></td><td></td><td colspan="4"></td><td class="c"><b>${overSeuilCount} ≥ seuil</b></td>${footCells}<td class="c"><b>${fullCount} complets</b></td></tr></tfoot></table>`;
    } else {
      const rows = pmRetiredItems.map((it) =>
        `<tr><td class="l">${pmEscapeHtml(it?.zone || '-')}</td><td class="l"><b>${pmEscapeHtml(it?.siteCode || '-')}</b></td><td class="l">${pmEscapeHtml(it?.siteName || '-')}</td><td class="l">${pmEscapeHtml(it?.technician || '-')}</td><td class="l">${pmEscapeHtml(it?.maintenanceType || 'FullPMWO')}</td></tr>`
      ).join('');
      tableHtml = `<table><thead><tr><th class="l">Zone</th><th class="l">Site</th><th class="l">Site Name</th><th class="l">Technicien</th><th class="l">Type</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="tot"><td class="l" colspan="5"><b>TOTAL · ${pmRetiredItems.length} site(s) retiré(s)</b></td></tr></tfoot></table>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sites retirés ${pmEscapeHtml(pmRetired?.month || '')}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; margin: 12px; }
  h1 { font-size: 14px; margin: 0 0 2px; }
  .meta { color: #555; margin-bottom: 6px; }
  .legend { font-size: 9px; color: #555; margin-bottom: 6px; }
  /* border-collapse: separate + border-spacing:0 — rendu identique au collapse
     réel (bordures simples) MAIS correctement positionné par html2canvas
     (le mode collapse décale le texte des cellules dans le PDF « scan »). */
  table { border-collapse: separate; border-spacing: 0; width: 100%; border-right: 1px solid #ccc; border-bottom: 1px solid #ccc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th, td { border-left: 1px solid #ccc; border-top: 1px solid #ccc; padding: 3px 5px; vertical-align: middle; }
  th { background: #f5f0f8; font-size: 9px; text-align: center; }
  th.l, td.l { text-align: left; }
  td.c { text-align: center; }
  .bad { background: #fde2e2; color: #b91c1c; font-weight: bold; }
  .ok { background: #e6f7ee; color: #047857; font-weight: bold; }
  .mut { color: #bbb; }
  .warn { color: #b91c1c; font-weight: bold; }
  .t { font-size: 8px; font-family: monospace; font-weight: normal; }
  tfoot td { background: #f5f0f8; border-top: 2px solid #999; font-size: 9px; }
  tr { page-break-inside: avoid; }
  @page { size: landscape; margin: 8mm; }
</style></head><body>
<h1>${pmEscapeHtml(reportTitle)}</h1>
<div class="meta">${pmEscapeHtml(meta)}</div>
${pmRetiredSuccMode ? '<div class="legend">✗ = PM non réalisée (retiré) · ✓ = PM réalisée (n° PMWO) · — = hors campagne · * = mois sans campagne · Diff NHs <span class="warn">rouge</span> = ≥ seuil du site</div>' : ''}
${tableHtml}
</body></html>`;

    return html;
  };

  const handlePrintRetired = () => {
    const html = buildRetiredReportHtml();
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
      try { iframe.contentWindow.print(); } finally { setTimeout(() => iframe.remove(), 800); }
    }, 250);
  };

  // PDF « scan » : même rapport que l'impression (mêmes données filtrées) mais
  // dessiné en TABLEAU PDF NATIF via autoTable — en-têtes exactement alignés et
  // répétés sur chaque page, texte sélectionnable. Aperçu en nouvel onglet.
  const handleScanPdfRetired = async () => {
    const { reportTitle, meta } = retiredReportInfo();
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(reportTitle, margin, margin + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    pdf.text(meta, margin, margin + 9);
    pdf.setTextColor(20, 20, 20);

    const headFill = [245, 240, 248];
    const cellStyle = { fontSize: 7, cellPadding: 1.2, valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] };

    if (pmRetiredSuccMode) {
      pdf.setFontSize(7);
      pdf.setTextColor(90, 90, 90);
      pdf.text('X = PM non réalisée (retiré) · n° PMWO = PM réalisée · - = hors campagne · * = mois sans campagne · Diff NHs rouge = ≥ seuil du site', margin, margin + 13);
      pdf.setTextColor(20, 20, 20);
      const n = pmMatrixExistingArr.length;
      const head = ['Site', 'Zone', 'Technicien', 'Date DV', 'NH1 DV', 'Date A', 'NH2 A', 'Diff NHs',
        ...pmMatrixMonths.map((mo) => `${mo}${pmMatrixMissingSet.has(mo) ? ' *' : ''}`), 'Série'];
      const body = pmMatrixItems.map((it) => [
        `${it?.siteCode || '-'} · ${it?.siteName || '-'}`,
        it?.zone || '-', it?.technician || '-',
        it?.dateDv || '-', it?.nh1Dv ?? '-', it?.dateA || '-', it?.nh2A ?? '-', it?.diffNhs ?? '-',
        ...pmMatrixMonths.map((mo) => {
          if (pmMatrixMissingSet.has(mo)) return '-';
          const c = it?.cells?.[mo];
          if (c?.s === 'retired') return 'X';
          if (c?.s === 'active') return c?.ticket ? `PMWO ${c.ticket}` : 'OK';
          return '-';
        }),
        `${it?.retiredCount || 0}/${n || pmMatrixMonths.length}`
      ]);
      const fullCount = pmMatrixItems.filter((it) => n > 0 && pmMatrixExistingArr.every((mo) => it?.cells?.[mo]?.s === 'retired')).length;
      const overSeuilCount = pmMatrixItems.filter((it) => it?.diffNhs != null && it.diffNhs >= (Number(it?.seuil) || 250)).length;
      const foot = [[
        { content: `TOTAL · ${pmMatrixItems.length} site(s)`, colSpan: 3, styles: { halign: 'left', fontStyle: 'bold' } },
        { content: '', colSpan: 4 },
        { content: `${overSeuilCount} ≥ seuil`, styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
        ...pmMatrixMonths.map((mo) => {
          if (pmMatrixMissingSet.has(mo)) return { content: '-', styles: { textColor: [180, 180, 180] } };
          const ret = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'retired').length;
          const act = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'active').length;
          return { content: `X:${ret}\nPM:${act}`, styles: { fontStyle: 'bold' } };
        }),
        { content: `${fullCount} compl.`, styles: { fontStyle: 'bold' } }
      ]];
      autoTable(pdf, {
        startY: margin + 16,
        head: [head], body, foot,
        styles: { ...cellStyle, halign: 'center' },
        headStyles: { fillColor: headFill, textColor: [30, 30, 30], fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: headFill, textColor: [30, 30, 30] },
        columnStyles: {
          0: { halign: 'left', cellWidth: 56 },
          1: { halign: 'left', cellWidth: 18 },
          2: { halign: 'left', cellWidth: 20 },
          4: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
          [8 + pmMatrixMonths.length]: { fontStyle: 'bold' }
        },
        didParseCell: (d) => {
          if (d.section !== 'body') return;
          const ci = d.column.index;
          const it = pmMatrixItems[d.row.index];
          // Diff NHs ≥ seuil du site → rouge gras.
          if (ci === 7 && it?.diffNhs != null && it.diffNhs >= (Number(it?.seuil) || 250)) {
            d.cell.styles.textColor = [185, 28, 28];
            d.cell.styles.fontStyle = 'bold';
            return;
          }
          if (ci < 8 || ci >= 8 + pmMatrixMonths.length) return;
          const mo = pmMatrixMonths[ci - 8];
          const c = it?.cells?.[mo];
          if (pmMatrixMissingSet.has(mo) || !c || c.s === 'none') {
            d.cell.styles.textColor = [185, 185, 185];
          } else if (c.s === 'retired') {
            d.cell.styles.fillColor = [253, 226, 226];
            d.cell.styles.textColor = [185, 28, 28];
            d.cell.styles.fontStyle = 'bold';
          } else if (c.s === 'active') {
            d.cell.styles.fillColor = [230, 247, 238];
            d.cell.styles.textColor = [4, 120, 87];
            d.cell.styles.fontStyle = 'bold';
          }
        }
      });
    } else {
      const head = ['Zone', 'Site', 'Site Name', 'Technicien', 'Type'];
      const body = pmRetiredItems.map((it) => [
        it?.zone || '-', it?.siteCode || '-', it?.siteName || '-',
        it?.technician || '-', it?.maintenanceType || 'FullPMWO'
      ]);
      const foot = [[{ content: `TOTAL · ${pmRetiredItems.length} site(s) retiré(s)`, colSpan: 5, styles: { halign: 'left', fontStyle: 'bold' } }]];
      autoTable(pdf, {
        startY: margin + 14,
        head: [head], body, foot,
        styles: { ...cellStyle, halign: 'left' },
        headStyles: { fillColor: headFill, textColor: [30, 30, 30], fontStyle: 'bold', halign: 'left' },
        footStyles: { fillColor: headFill, textColor: [30, 30, 30] },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 }, 3: { cellWidth: 50 }, 4: { cellWidth: 45 } }
      });
    }

    const slug = pmRetiredSuccMode
      ? `matrice-retraits-${pmRetired?.month || 'pm'}-${pmRetiredSuccWindow}m`
      : `sites-retires-${pmRetired?.month || 'pm'}`;
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) { setTimeout(() => URL.revokeObjectURL(url), 120000); return; }
    URL.revokeObjectURL(url);
    pdf.save(`${slug}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-indigo-950/60 flex items-center justify-center z-50 p-0 sm:p-0">
      <div className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-none sm:max-w-none sm:max-h-[100vh] sm:h-[100vh]">
        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row h-full min-h-0">
            {sidebarOpen && (
              <div className="lg:w-72 w-full flex-shrink-0 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 text-white border-indigo-900/60 border-b-4 border-b-sky-400/30 lg:border-b-0 lg:border-r-4 lg:border-r-sky-400/30 overflow-y-auto">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-900/60">
                  <Activity size={20} className="text-slate-100/90" />
                  <div className="text-lg font-bold text-slate-100 leading-tight">Navigation</div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="ml-auto p-2 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                    title="Masquer le menu"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Période</div>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-white/90 mb-1">Mois</label>
                      <input
                        type="month"
                        value={pmMonth}
                        onChange={async (e) => {
                          const next = String(e.target.value || '').trim();
                          setPmMonth(next);
                          await refreshPmAll(next);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                        disabled={pmBusy}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await refreshPmAll(pmMonth);
                      }}
                      className="w-full bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold"
                      disabled={pmBusy}
                    >
                      Rafraîchir
                    </button>

                  </div>
                </div>

                {(isAdmin || isManager) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Technicien</div>
                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-white/90 mb-1">Destinataire</label>
                        <select
                          value={pmSendTechUserId}
                          onChange={(e) => setPmSendTechUserId(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                          disabled={pmBusy || pmSendBusy}
                        >
                          <option value="">-- Technicien --</option>
                          {(Array.isArray(users) ? users : [])
                            .filter((u) => u && u.role === 'technician')
                            .filter((u) => (pmTechFilterZone ? String(u?.zone || '').trim() === String(pmTechFilterZone || '').trim() : true))
                            .slice()
                            .sort((a, b) => String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || '')))
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.technicianName || u.email}
                              </option>
                            ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendPmMonthPlanning}
                        className="w-full bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                        disabled={!pmSendTechUserId || pmBusy || pmSendBusy}
                      >
                        Envoyer planning PM
                      </button>

                      {(Array.isArray(users) ? users : [])
                        .filter((u) => u && u.role === 'technician')
                        .filter((u) => (pmTechFilterZone ? String(u?.zone || '').trim() === String(pmTechFilterZone || '').trim() : true)).length === 0 && (
                        <div className="text-xs text-white/70">
                          Aucun technicien trouvé.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(isAdmin || isManager) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white/90 mb-2">Actions</div>
                    <div className="flex flex-col">
                      <label
                        className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                          pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                        }`}
                      >
                        <Upload size={16} />
                        Import NOC
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handlePmNocImport}
                          className="hidden"
                          disabled={pmBusy}
                        />
                      </label>

                      {(Number(pmNocProgress || 0) > 0 || String(pmNocStep || '').trim()) && (
                        <div className="mx-3 mt-2 mb-3">
                          {String(pmNocStep || '').trim() && <div className="text-[11px] text-white/80 mb-1">{pmNocStep}</div>}
                          <div className="w-full h-2 rounded bg-white/15 overflow-hidden">
                            <div
                              className="h-2 bg-sky-400"
                              style={{ width: `${Math.max(0, Math.min(100, Number(pmNocProgress || 0)))}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-white/70 mt-1">{Math.max(0, Math.min(100, Number(pmNocProgress || 0)))}%</div>
                        </div>
                      )}

                      {/* Imports retour client + planning global : strictement SuperAdmin */}
                      {pmIsSuperAdmin && (
                        <>
                          <label
                            className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                              pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                            }`}
                          >
                            <Upload size={16} />
                            Import retour client
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={handlePmClientImport}
                              className="hidden"
                              disabled={pmBusy}
                            />
                          </label>

                          <label
                            className={`text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors focus-within:ring-2 focus-within:ring-sky-400/70 focus-within:ring-offset-2 focus-within:ring-offset-indigo-950 ${
                              pmBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                            }`}
                          >
                            <Upload size={16} />
                            Import planning PM global
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={handlePmGlobalImport}
                              className="hidden"
                              disabled={pmBusy}
                            />
                          </label>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPmPurgeOpen((v) => !v)}
                            className="text-left px-3 py-2 rounded-lg hover:bg-white/10 font-semibold text-sm disabled:opacity-60 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                            disabled={pmBusy || pmPurgeBusy}
                          >
                            <Trash2 size={16} />
                            Purge imports (avancé)
                          </button>

                          {pmPurgeOpen && (
                            <div className="mx-3 my-2 p-3 rounded-lg border border-white/10 bg-white/5">
                              <div className="text-xs font-semibold text-white/90 mb-2">Options purge</div>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs text-white/90">
                                  <input
                                    type="checkbox"
                                    checked={pmPurgeClient}
                                    onChange={(e) => setPmPurgeClient(Boolean(e.target.checked))}
                                    disabled={pmBusy || pmPurgeBusy}
                                  />
                                  Purger retour client (pm_items + noc + assignments)
                                </label>
                                <label className="flex items-center gap-2 text-xs text-white/90">
                                  <input
                                    type="checkbox"
                                    checked={pmPurgeGlobal}
                                    onChange={(e) => setPmPurgeGlobal(Boolean(e.target.checked))}
                                    disabled={pmBusy || pmPurgeBusy}
                                  />
                                  Purger planning global (pm_global_plans + items)
                                </label>
                                <label className="flex items-center gap-2 text-xs text-white/90">
                                  <input
                                    type="checkbox"
                                    checked={pmPurgeDryRun}
                                    onChange={(e) => setPmPurgeDryRun(Boolean(e.target.checked))}
                                    disabled={pmBusy || pmPurgeBusy}
                                  />
                                  Mode dry-run (prévisualisation)
                                </label>

                                {pmIsSuperAdmin && (
                                  <div>
                                    <div className="text-[11px] font-semibold text-white/90 mb-1">Zones (super-admin)</div>
                                    <div className="flex flex-col gap-1">
                                      {['BZV/POOL', 'PNR/KOUILOU', 'UPCN'].map((z) => (
                                        <label key={z} className="flex items-center gap-2 text-xs text-white/90">
                                          <input
                                            type="checkbox"
                                            checked={(Array.isArray(pmPurgeZones) ? pmPurgeZones : []).includes(z)}
                                            onChange={() => pmTogglePurgeZone(z)}
                                            disabled={pmBusy || pmPurgeBusy}
                                          />
                                          {z}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {pmPurgeResult?.preview && (
                                  <div className="text-[11px] text-white/80">
                                    Aperçu: plans global {Number(pmPurgeResult?.preview?.pmGlobalPlans || 0)} • items global {Number(
                                      pmPurgeResult?.preview?.pmGlobalPlanItems || 0
                                    )} • items client {Number(pmPurgeResult?.preview?.pmClientItems || 0)} • noc {Number(
                                      pmPurgeResult?.preview?.pmClientNocRows || 0
                                    )} • assign. {Number(pmPurgeResult?.preview?.pmClientAssignments || 0)}
                                  </div>
                                )}

                                <div className="flex flex-col gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!pmPurgeDryRun) {
                                        const ok = window.confirm(
                                          `Confirmer la purge ?\n\nMois: ${pmMonth}\n\nCette action supprimera des données en base.`
                                        );
                                        if (!ok) return;
                                      }
                                      await pmRunPurge({ dryRun: pmPurgeDryRun });
                                    }}
                                    className="w-full bg-rose-600 text-white px-3 py-2 rounded-lg hover:bg-rose-700 text-sm font-semibold disabled:bg-white/10 disabled:text-white/60"
                                    disabled={pmBusy || pmPurgeBusy}
                                  >
                                    {pmPurgeDryRun ? 'Lancer dry-run' : 'Purger maintenant'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await pmRunPurge({ dryRun: true });
                                    }}
                                    className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                                    disabled={pmBusy || pmPurgeBusy}
                                  >
                                    Prévisualiser (dry-run)
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePmReset('imports')}
                            className="text-left px-3 py-2 rounded-lg hover:bg-white/10 font-semibold text-sm disabled:opacity-60 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                            disabled={pmBusy || pmResetBusy}
                          >
                            <Trash2 size={16} />
                            Suppr. imports
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePmReset('all')}
                            className="text-left px-3 py-2 rounded-lg hover:bg-white/10 font-semibold text-sm disabled:opacity-60 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                            disabled={pmBusy || pmResetBusy}
                          >
                            <RotateCcw size={16} />
                            Reset mois
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="bg-white border-b border-gray-200 shadow-sm px-4 py-3 sticky top-0 z-20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {!sidebarOpen && (
                      <button
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        title="Afficher le menu"
                      >
                        <Menu size={20} className="text-gray-700" />
                      </button>
                    )}
                    <Activity className="text-blue-600" size={24} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-xl sm:text-2xl font-bold text-gray-800">Maintenances planifiées (PM)</div>
                        {isViewer && (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                            Lecture seule
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">Version {appVersion} - Suivi H24/7j avec Fiches</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowPm(false);
                      setPmError('');
                      setPmNotice('');
                    }}
                    className="p-2 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <X size={20} className="text-gray-700" />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6">
              <div className="text-sm text-gray-700 mb-4">
                Tickets du mois: <span className="font-semibold">{Array.isArray(pmItems) ? pmItems.length : 0}</span>
              </div>

              {pmError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {pmError}
                </div>
              )}

              {pmNotice && !pmError && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-3 rounded-lg text-sm">
                  {pmNotice}
                </div>
              )}

              {pmClientProgress > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-700 mb-1">Import retour client: {pmClientStep || '…'}</div>
                  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2" style={{ width: `${pmClientProgress}%` }} />
                  </div>
                </div>
              )}

              {pmGlobalProgress > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-700 mb-1">Import planning PM global: {pmGlobalStep || '…'}</div>
                  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2" style={{ width: `${pmGlobalProgress}%` }} />
                  </div>

                </div>
              )}

              {pmRetired && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <TrendingUp size={16} className="text-fuchsia-700" />
                      Sites retirés pour la campagne ({pmRetired.month})
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!pmIsSuperAdmin) {
                          setPmRetiredSitesZoneFilter('ALL');
                        }
                        setPmRetiredSitesOpen(true);
                      }}
                      className="text-xs font-semibold px-2 py-1 rounded border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100 disabled:opacity-60"
                      disabled={pmBusy}
                      title={
                        isAdmin
                          ? 'Voir la liste des sites retirés.'
                          : isManager
                            ? `Voir la liste des sites retirés (${String(authZone || '').trim() || 'zone'}).`
                            : 'Voir la liste des sites retirés.'
                      }
                    >
                      Détails ({Number(pmRetired.total || 0)})
                    </button>
                  </div>
                </div>
              )}

              {pmRetired && pmRetiredSitesOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-1 sm:p-2">
                  <div className="bg-white rounded-lg shadow-xl w-[98vw] max-w-[98vw] overflow-hidden flex flex-col h-[96vh] max-h-[96vh]">
                    <div className="flex justify-between items-center p-4 border-b bg-fuchsia-800 text-white">
                      <div className="font-bold">Sites retirés pour la campagne ({pmRetired.month})</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (typeof handlePmExportRetiredSitesExcel !== 'function') return;
                            const filter = String(pmRetiredSitesZoneFilter || 'ALL');
                            const zone = filter && filter !== 'ALL' ? filter : '';
                            if (pmRetiredSuccMode) {
                              await handleExportRetiredMatrix();
                            } else {
                              await handlePmExportRetiredSitesExcel({
                                month: pmRetired.month,
                                zone,
                                items: pmRetiredViewItems
                              });
                            }
                          }}
                          className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                          disabled={pmBusy || (pmRetiredSuccMode ? pmMatrixItems.length === 0 : pmRetiredItems.length === 0)}
                          title={pmRetiredSuccMode ? 'Exporter la matrice filtrée (zone, série, recherche)' : 'Exporter la liste (filtre zone)'}
                        >
                          <Download size={16} />
                          Exporter xlsx
                        </button>
                        <button
                          type="button"
                          onClick={handlePrintRetired}
                          className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                          disabled={pmBusy || (pmRetiredSuccMode ? pmMatrixItems.length === 0 : pmRetiredItems.length === 0)}
                          title={pmRetiredSuccMode ? 'Imprimer la matrice filtrée (zone, série, recherche)' : 'Imprimer la liste filtrée'}
                        >
                          <Printer size={16} />
                          Imprimer
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPmRetiredSuccBusy(true); handleScanPdfRetired().catch(() => alert('Erreur lors de la génération du PDF.')).finally(() => setPmRetiredSuccBusy(false)); }}
                          className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                          disabled={pmBusy || pmRetiredSuccBusy || (pmRetiredSuccMode ? pmMatrixItems.length === 0 : pmRetiredItems.length === 0)}
                          title={pmRetiredSuccMode ? 'PDF « scan » de la matrice filtrée (zone, série, recherche)' : 'PDF « scan » de la liste filtrée'}
                        >
                          <FileScan size={16} />
                          SCAN PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setPmRetiredSitesOpen(false)}
                          className="hover:bg-fuchsia-900 p-2 rounded"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    {pmIsSuperAdmin && pmRetiredScopeZones.length > 0 && (
                      <div className="p-3 border-b bg-fuchsia-50 flex flex-wrap gap-2 items-center">
                        <div className="text-xs font-semibold text-fuchsia-900 mr-1">Filtre zone:</div>
                        <button
                          type="button"
                          onClick={() => setPmRetiredSitesZoneFilter('ALL')}
                          className={`text-xs font-semibold px-2 py-1 rounded border ${
                            pmRetiredSitesZoneFilter === 'ALL'
                              ? 'border-fuchsia-300 bg-white text-fuchsia-900'
                              : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100'
                          }`}
                        >
                          Toutes ({Number(pmRetired.total || 0)})
                        </button>
                        {pmRetiredScopeZones.map((z) => (
                          <button
                            key={z}
                            type="button"
                            onClick={() => setPmRetiredSitesZoneFilter(z)}
                            className={`text-xs font-semibold px-2 py-1 rounded border ${
                              pmRetiredSitesZoneFilter === z
                                ? 'border-fuchsia-300 bg-white text-fuchsia-900'
                                : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100'
                            }`}
                          >
                            {z} ({Number(pmRetired?.byZone?.[z] || 0)})
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="px-4 py-2 border-b bg-white flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-fuchsia-900">Vue :</span>
                      <div className="inline-flex rounded-lg border border-fuchsia-200 overflow-hidden text-xs font-semibold">
                        <button type="button" onClick={() => setPmRetiredSuccMode(false)}
                          className={`px-3 py-1.5 ${!pmRetiredSuccMode ? 'bg-fuchsia-700 text-white' : 'bg-white text-fuchsia-900 hover:bg-fuchsia-50'}`}>
                          Tous ({pmRetiredItems.length})
                        </button>
                        <button type="button"
                          onClick={() => { setPmRetiredSuccMode(true); if (pmRetiredMatrix === null && !pmRetiredSuccBusy) loadPmRetiredMatrix(pmRetiredSuccWindow); }}
                          className={`px-3 py-1.5 border-l border-fuchsia-200 ${pmRetiredSuccMode ? 'bg-fuchsia-700 text-white' : 'bg-white text-fuchsia-900 hover:bg-fuchsia-50'}`}>
                          Retirés successivement
                        </button>
                      </div>
                      {pmRetiredSuccMode && (
                        <>
                          <span className="text-xs font-semibold text-fuchsia-900 ml-2">sur</span>
                          <div className="inline-flex rounded-lg border border-fuchsia-200 overflow-hidden text-xs font-semibold">
                            {[3, 4, 5, 6].map((w) => (
                              <button key={w} type="button"
                                onClick={() => { setPmRetiredSuccWindow(w); setPmRetiredMatrixSerie([]); loadPmRetiredMatrix(w); }}
                                className={`px-3 py-1.5 ${pmRetiredSuccWindow === w ? 'bg-violet-600 text-white' : 'bg-white text-violet-800 hover:bg-violet-50'} ${w > 3 ? 'border-l border-fuchsia-200' : ''}`}>
                                {w} mois
                              </button>
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">
                            {pmRetiredSuccBusy
                              ? 'Analyse des campagnes…'
                              : pmRetiredMatrix === null
                                ? ''
                                : `${pmRetiredSuccCount} site(s) retiré(s) tous les mois · ${pmMatrixZoneItems.length} sites du parc`}
                          </span>
                          {pmIsSuperAdmin && pmMatrixZones.length > 1 && (
                            <select
                              value={pmRetiredSitesZoneFilter}
                              onChange={(e) => setPmRetiredSitesZoneFilter(e.target.value)}
                              className="text-xs border border-fuchsia-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                              title="Filtrer par zone"
                            >
                              <option value="ALL">Zone : toutes</option>
                              {pmMatrixZones.map((z) => <option key={z} value={z}>{z}</option>)}
                            </select>
                          )}
                          <div className="inline-flex items-center gap-1 flex-wrap" title="Filtrer par nombre de retraits sur la fenêtre — sélection multiple possible">
                            <span className="text-xs font-semibold text-fuchsia-900">Série :</span>
                            <button
                              type="button"
                              onClick={() => setPmRetiredMatrixSerie([])}
                              className={`px-2 py-1 rounded border text-[11px] font-semibold ${pmRetiredMatrixSerie.length === 0 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-violet-800 border-violet-200 hover:bg-violet-50'}`}
                            >
                              Toutes
                            </button>
                            {Array.from({ length: pmMatrixExistingArr.length + 1 }, (_, i) => {
                              const sel = pmRetiredMatrixSerie.includes(i);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setPmRetiredMatrixSerie((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)))}
                                  className={`px-2 py-1 rounded border text-[11px] font-semibold ${sel ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-violet-800 border-violet-200 hover:bg-violet-50'}`}
                                >
                                  {i}/{pmMatrixExistingArr.length || pmMatrixMonths.length}{i === pmMatrixExistingArr.length ? ' ✓' : ''}
                                </button>
                              );
                            })}
                          </div>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={pmRetiredMatrixSearch}
                              onChange={(e) => setPmRetiredMatrixSearch(e.target.value)}
                              placeholder="Filtrer (site, nom, technicien)…"
                              className="pl-7 pr-6 py-1.5 text-xs border border-fuchsia-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                            />
                            {pmRetiredMatrixSearch && (
                              <button type="button" onClick={() => setPmRetiredMatrixSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {pmRetiredSuccMode && !pmRetiredSuccBusy && pmRetiredMatrix !== null && (
                      <div className="px-4 py-1.5 border-b bg-white flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">❌ = PM non réalisée (retiré)</span>
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">✅ = PM réalisée, n° PMWO affiché</span>
                        <span className="text-[11px] text-gray-500">— = hors campagne / pas de donnée</span>
                        {pmMatrixMissingArr.length > 0 && (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            ⚠ Pas de campagne pour : {pmMatrixMissingArr.join(', ')} — la série complète est impossible sur ces mois.
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-4 overflow-auto">
                      {!pmRetiredSuccMode ? (
                        <table className="min-w-[980px] w-full text-sm">
                          <thead className="bg-fuchsia-50 sticky top-0 z-10">
                            <tr className="text-left text-xs text-fuchsia-900 border-b border-fuchsia-200">
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Site Name</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Technicien</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pmRetiredItems.length === 0 ? (
                              <tr>
                                <td className="px-4 py-4 text-gray-600" colSpan={5}>
                                  Aucun site.
                                </td>
                              </tr>
                            ) : (
                              pmRetiredItems.map((it, idx) => (
                                <tr
                                  key={`${it?.siteCode || 'site'}-${idx}`}
                                  className={`border-b border-fuchsia-100 hover:bg-fuchsia-50/60 ${idx % 2 === 1 ? 'bg-white' : 'bg-fuchsia-50/40'}`}
                                >
                                  <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.zone || '-'}</td>
                                  <td className="px-3 py-2 text-slate-900 whitespace-nowrap font-semibold">{it?.siteCode || '-'}</td>
                                  <td className="px-3 py-2 text-slate-900 max-w-[360px] whitespace-pre-line leading-tight break-words">{it?.siteName || '-'}</td>
                                  <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.technician || '-'}</td>
                                  <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.maintenanceType || 'FullPMWO'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          {pmRetiredItems.length > 0 && (
                            <tfoot>
                              <tr className="border-t-2 border-fuchsia-300">
                                <td colSpan={5} className="px-3 py-2 sticky bottom-0 bg-fuchsia-100 font-bold text-fuchsia-950">
                                  TOTAL · {pmRetiredItems.length} site(s) retiré(s)
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      ) : (
                        <table className="border-collapse text-xs w-auto min-w-full">
                          <thead className="sticky top-0 z-20">
                            <tr className="text-left text-[11px] text-fuchsia-900 border-b border-fuchsia-200">
                              <th className="px-2 py-2 font-semibold whitespace-nowrap sticky left-0 bg-fuchsia-50 z-10 min-w-[150px]">Site</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap bg-fuchsia-50">Zone</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap bg-fuchsia-50">Technicien</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap bg-amber-50" title="Date de la dernière vidange">Date DV</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap text-right bg-amber-50" title="Compteur horaire à la dernière vidange">NH1 DV</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap bg-amber-50" title="Date du dernier relevé">Date A</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap text-right bg-amber-50" title="Compteur horaire actuel">NH2 A</th>
                              <th className="px-2 py-2 font-semibold whitespace-nowrap text-right bg-amber-50" title="NH2 A − NH1 DV — rouge si ≥ seuil du site">Diff NHs</th>
                              {pmMatrixMonths.map((mo) => (
                                <th key={mo} className={`px-2 py-2 font-semibold whitespace-nowrap text-center min-w-[110px] ${pmMatrixMissingSet.has(mo) ? 'bg-gray-100 text-gray-400' : 'bg-fuchsia-50'}`}>
                                  {mo}{pmMatrixMissingSet.has(mo) ? ' *' : ''}
                                </th>
                              ))}
                              <th className="px-2 py-2 font-semibold whitespace-nowrap text-center bg-violet-50">Série</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pmRetiredSuccBusy ? (
                              <tr><td className="px-4 py-6 text-gray-500" colSpan={pmMatrixMonths.length + 9}>Analyse des campagnes…</td></tr>
                            ) : pmRetiredMatrix === null ? (
                              <tr><td className="px-4 py-6 text-gray-500" colSpan={pmMatrixMonths.length + 9}>Erreur de chargement — réessayez.</td></tr>
                            ) : pmMatrixItems.length === 0 ? (
                              <tr><td className="px-4 py-6 text-gray-500" colSpan={pmMatrixMonths.length + 9}>Aucun site.</td></tr>
                            ) : (
                              pmMatrixItems.map((it, idx) => {
                                const fullSeries = pmMatrixExistingArr.length > 0 && pmMatrixExistingArr.every((mo) => it?.cells?.[mo]?.s === 'retired');
                                return (
                                  <tr
                                    key={`${it?.zone || ''}|${it?.siteCode || idx}`}
                                    className={`border-b border-fuchsia-100 ${fullSeries ? 'bg-rose-50 hover:bg-rose-100/70' : idx % 2 === 1 ? 'bg-white hover:bg-fuchsia-50/60' : 'bg-fuchsia-50/40 hover:bg-fuchsia-50/60'}`}
                                  >
                                    <td className={`px-2 py-1.5 whitespace-nowrap sticky left-0 z-10 ${fullSeries ? 'bg-rose-50' : idx % 2 === 1 ? 'bg-white' : 'bg-fuchsia-50/40'}`}>
                                      <div className="max-w-[180px] truncate" title={`${it?.siteCode || ''} · ${it?.siteName || ''}`}>
                                        <span className="font-semibold text-slate-900">{it?.siteCode || '-'}</span>
                                        <span className="text-slate-500"> · {it?.siteName || '-'}</span>
                                        {it?.siteRetired && <span className="ml-1 text-[9px] font-bold text-rose-700 bg-rose-100 border border-rose-200 rounded px-1 py-px align-middle">hors campagne</span>}
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{it?.zone || '-'}</td>
                                    <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{it?.technician || '-'}</td>
                                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap bg-amber-50/30">{it?.dateDv || '—'}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-700 font-mono bg-amber-50/30">{it?.nh1Dv ?? '—'}</td>
                                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap bg-amber-50/30">{it?.dateA || '—'}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-700 font-mono bg-amber-50/30">{it?.nh2A ?? '—'}</td>
                                    <td className={`px-2 py-1.5 text-right font-mono whitespace-nowrap bg-amber-50/30 ${it?.diffNhs != null && it.diffNhs >= (Number(it?.seuil) || 250) ? 'font-bold text-rose-700' : 'text-slate-700'}`}
                                      title={it?.diffNhs != null ? `Seuil : ${Number(it?.seuil) || 250}` : ''}>{it?.diffNhs ?? '—'}</td>
                                    {pmMatrixMonths.map((mo) => {
                                      const c = it?.cells?.[mo];
                                      if (pmMatrixMissingSet.has(mo)) {
                                        return <td key={mo} className="px-2 py-1.5 text-center text-gray-300 bg-gray-50/50">—</td>;
                                      }
                                      if (c?.s === 'retired') {
                                        return <td key={mo} className="px-2 py-1.5 text-center bg-rose-100/70" title="PM non réalisée — site retiré">❌</td>;
                                      }
                                      if (c?.s === 'active') {
                                        return (
                                          <td key={mo} className="px-2 py-1.5 text-center bg-emerald-50/80" title={c?.ticket ? `PMWO ${c.ticket}` : 'PM réalisée'}>
                                            <div className="leading-tight">✅</div>
                                            {c?.ticket && <div className="text-[9px] font-mono text-emerald-800 leading-tight">{c.ticket}</div>}
                                          </td>
                                        );
                                      }
                                      return <td key={mo} className="px-2 py-1.5 text-center text-gray-300">—</td>;
                                    })}
                                    <td className={`px-2 py-1.5 text-center font-bold whitespace-nowrap ${fullSeries ? 'text-rose-700 bg-rose-100/60' : 'text-slate-600'}`}>
                                      {it?.retiredCount || 0}/{pmMatrixExistingArr.length || pmMatrixMonths.length}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          {!pmRetiredSuccBusy && pmRetiredMatrix !== null && pmMatrixItems.length > 0 && (
                            <tfoot>
                              <tr className="border-t-2 border-fuchsia-300">
                                <td className="px-2 py-1.5 sticky left-0 bottom-0 bg-fuchsia-100 font-bold text-fuchsia-950 whitespace-nowrap">
                                  TOTAL · {pmMatrixItems.length} site(s)
                                </td>
                                <td className="sticky bottom-0 bg-fuchsia-100"></td>
                                <td className="sticky bottom-0 bg-fuchsia-100"></td>
                                <td className="sticky bottom-0 bg-fuchsia-100" colSpan={4}></td>
                                <td className="px-2 py-1.5 sticky bottom-0 bg-fuchsia-100 text-right font-bold text-rose-700 whitespace-nowrap">
                                  {pmMatrixItems.filter((it) => it?.diffNhs != null && it.diffNhs >= (Number(it?.seuil) || 250)).length} ≥ seuil
                                </td>
                                {pmMatrixMonths.map((mo) => {
                                  if (pmMatrixMissingSet.has(mo)) {
                                    return <td key={mo} className="px-2 py-1.5 sticky bottom-0 bg-fuchsia-100 text-center text-gray-400">—</td>;
                                  }
                                  const ret = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'retired').length;
                                  const act = pmMatrixItems.filter((it) => it?.cells?.[mo]?.s === 'active').length;
                                  return (
                                    <td key={mo} className="px-2 py-1.5 sticky bottom-0 bg-fuchsia-100 text-center whitespace-nowrap leading-tight">
                                      <div className="text-rose-700 font-bold">❌ {ret}</div>
                                      <div className="text-emerald-700 font-semibold text-[10px]">✅ {act}</div>
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1.5 sticky bottom-0 bg-fuchsia-100 text-center font-bold text-fuchsia-950 whitespace-nowrap">
                                  {pmMatrixItems.filter((it) => pmMatrixExistingArr.length > 0 && pmMatrixExistingArr.every((mo) => it?.cells?.[mo]?.s === 'retired')).length} complets
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}



              {(() => {
            const items = Array.isArray(pmItems) ? pmItems : [];
            const imports = Array.isArray(pmImports) ? pmImports : [];

            const norm = (s) =>
              String(s || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const normalizeFilterState = (state) => {
              const raw = String(state || '').trim();
              if (!raw) return 'all';
              const v = norm(raw);
              if (!v || v === 'all') return 'all';
              const tokens = new Set(v.split(' ').filter(Boolean));
              if (v === 'closed' || v === 'closed complete' || tokens.has('closed')) return 'closed';
              if (v === 'awaiting' || v === 'awaiting closure' || tokens.has('awaiting')) return 'awaiting';
              if (tokens.has('wip') || v.includes('work in progress') || v.includes('in progress') || (tokens.has('work') && tokens.has('progress'))) return 'wip';
              if (v === 'assigned' || tokens.has('assigned')) return 'assigned';
              return 'all';
            };

            const effectivePmFilterState = normalizeFilterState(pmFilterState);
            const bucketForState = (state) => {
              const v = norm(state);
              if (!v) return 'assigned';
              const tokens = new Set(v.split(' ').filter(Boolean));
              if (v === 'closed complete' || v === 'closed' || v.includes('closed')) return 'closed';
              if (v === 'awaiting closure' || v === 'awaiting' || v.includes('awaiting')) return 'awaiting';
              if (
                tokens.has('wip') ||
                v.includes('work in progress') ||
                v.includes('in progress') ||
                (tokens.has('work') && tokens.has('progress'))
              )
                return 'wip';
              if (v === 'assigned' || v.includes('assigned')) return 'assigned';
              return 'assigned';
            };

            const normalizeYmd = (ymd) => {
              if (!ymd) return '';
              return String(ymd).slice(0, 10);
            };

            const stateLabel = (state) => {
              const raw = String(state || '').trim();
              const v = norm(raw);
              if (v === 'closed complete' || v === 'closed') return 'Closed Complete';
              if (v === 'work in progress' || v.includes('work in progress') || v.includes('in progress') || v === 'wip' || v.startsWith('wip ')) return 'Work in progress';
              if (v === 'awaiting closure' || v === 'awaiting') return 'Awaiting Closure';
              if (v === 'assigned') return 'Assigned';
              return raw || 'Assigned';
            };

            const uniqueSorted = (vals) => {
              const set = new Set(vals.map((v) => String(v || '').trim()).filter(Boolean));
              return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
            };

            const typeOptions = uniqueSorted(items.map((it) => it?.maintenanceType));
            const zoneOptions = uniqueSorted(items.map((it) => it?.zone));

            const search = String(pmSearch || '').trim().toLowerCase();
            const dateFrom = normalizeYmd(pmFilterFrom);
            const dateTo = normalizeYmd(pmFilterTo);
            const plannedDay = normalizeYmd(pmFilterPlannedDay);
            const reprogFilter = String(pmFilterReprog || 'all');

            const normReprogStatus = (s) => {
              const v = String(s || '').trim().toLowerCase();
              if (!v) return '';
              if (v === 'approved') return 'APPROVED';
              if (v === 'rejected') return 'REJECTED';
              if (v === 'pending') return 'PENDING';
              if (v === 'approved' || v === 'ok' || v === 'yes' || v === 'oui' || v === 'validee' || v === 'validée' || v === 'approuvee' || v === 'approuvée') {
                return 'APPROVED';
              }
              if (v === 'rejected' || v === 'ko' || v === 'no' || v === 'non' || v === 'rejete' || v === 'rejeté' || v === 'rejetee' || v === 'rejetée' || v === 'refusee' || v === 'refusée') {
                return 'REJECTED';
              }
              if (v === 'pending' || v === 'attente' || v === 'en attente' || v === 'waiting') return 'PENDING';
              return '';
            };

            const effectiveReprogStatus = (it) => {
              const explicit = normReprogStatus(it?.reprogrammationStatus);
              if (explicit) return explicit;
              const hasDate = !!String(it?.reprogrammationDate || '').trim();
              const hasReason = !!String(it?.reprogrammationReason || '').trim();
              if (hasDate) return 'APPROVED';
              if (hasReason) return 'PENDING';
              return '';
            };

            const baseFiltered = items.filter((it) => {
              if (pmFilterType && pmFilterType !== 'all') {
                if (String(it?.maintenanceType || '').trim() !== String(pmFilterType)) return false;
              }
              if (pmFilterZone && pmFilterZone !== 'all') {
                if (String(it?.zone || '').trim() !== String(pmFilterZone)) return false;
              }
              if (plannedDay) {
                const sched = normalizeYmd(it?.scheduledWoDate);
                if (sched === plannedDay) return true;
                const closedDay = normalizeYmd(it?.closedAt);
                const isAnticipatedFullPmwo =
                  String(it?.maintenanceType || '').trim().toUpperCase() === 'FULLPMWO' &&
                  closedDay &&
                  sched &&
                  closedDay < sched &&
                  (bucketForState(it?.state) === 'closed' || bucketForState(it?.state) === 'awaiting');
                if (isAnticipatedFullPmwo && closedDay === plannedDay) return true;
                return false;
              } else {
                const sched = normalizeYmd(it?.scheduledWoDate);
                const closedDay = normalizeYmd(it?.closedAt);
                const isAnticipatedFullPmwo =
                  String(it?.maintenanceType || '').trim().toUpperCase() === 'FULLPMWO' &&
                  closedDay &&
                  sched &&
                  closedDay < sched &&
                  (bucketForState(it?.state) === 'closed' || bucketForState(it?.state) === 'awaiting');

                const schedInRange =
                  (!dateFrom || (sched && sched >= dateFrom)) &&
                  (!dateTo || (sched && sched <= dateTo));
                const closedInRange =
                  isAnticipatedFullPmwo &&
                  (!dateFrom || (closedDay && closedDay >= dateFrom)) &&
                  (!dateTo || (closedDay && closedDay <= dateTo));

                if (!schedInRange && !closedInRange) return false;
              }
              if (reprogFilter && reprogFilter !== 'all') {
                const st = effectiveReprogStatus(it);
                if (reprogFilter === 'any' && !st) return false;
                if (reprogFilter === 'approved' && st !== 'APPROVED') return false;
                if (reprogFilter === 'rejected' && st !== 'REJECTED') return false;
                if (reprogFilter === 'pending' && st !== 'PENDING') return false;
              }
              if (search) {
                const hay = [
                  it?.number,
                  it?.siteName,
                  it?.siteCode,
                  it?.region,
                  it?.zone,
                  it?.maintenanceType,
                  it?.assignedTo,
                  it?.shortDescription,
                  it?.reprogrammationReason,
                  it?.reprogrammationStatus
                ]
                  .map((v) => String(v || '').toLowerCase())
                  .join(' ');
                if (!hay.includes(search)) return false;
              }
              return true;
            });

            const tableFiltered = baseFiltered.filter((it) => {
              if (effectivePmFilterState && effectivePmFilterState !== 'all') {
                if (bucketForState(it?.state) !== effectivePmFilterState) return false;
              }
              return true;
            });

            const badgeForBucket = (bucket) => {
              if (bucket === 'closed') return { cls: 'bg-sky-50 text-sky-800 border-sky-200' };
              if (bucket === 'wip') return { cls: 'bg-blue-50 text-blue-800 border-blue-200' };
              if (bucket === 'awaiting') return { cls: 'bg-amber-50 text-amber-800 border-amber-200' };
              return { cls: 'bg-slate-50 text-slate-800 border-slate-200' };
            };

            const counts = {
              total: baseFiltered.length,
              closed: 0,
              wip: 0,
              awaiting: 0,
              assigned: 0,
              reprog: 0
            };
            for (const it of baseFiltered) {
              const b = bucketForState(it?.state);
              if (b === 'closed') counts.closed += 1;
              else if (b === 'wip') counts.wip += 1;
              else if (b === 'awaiting') counts.awaiting += 1;
              else counts.assigned += 1;

              if (effectiveReprogStatus(it)) counts.reprog += 1;
            }

            const cards = [
              {
                key: 'total',
                title: 'Total',
                value: Number(counts.total || 0),
                className: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
                titleClassName: 'text-indigo-900',
                valueClassName: 'text-indigo-900',
                hintClassName: 'text-indigo-800',
                Icon: ListChecks,
                iconClassName: 'text-indigo-700',
                onClick: () => {
                  setPmFilterState('all');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Total', items: baseFiltered.slice() });
                }
              },
              {
                key: 'closed',
                title: 'Closed Complete',
                value: Number(counts.closed || 0),
                className: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
                titleClassName: 'text-indigo-900',
                valueClassName: 'text-indigo-900',
                hintClassName: 'text-indigo-800',
                Icon: BadgeCheck,
                iconClassName: 'text-indigo-700',
                onClick: () => {
                  setPmFilterState('closed');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Closed Complete', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'closed') });
                }
              },
              {
                key: 'wip',
                title: 'Work in progress',
                value: Number(counts.wip || 0),
                className: 'bg-sky-50 border-sky-200 hover:bg-sky-100',
                titleClassName: 'text-sky-900',
                valueClassName: 'text-sky-900',
                hintClassName: 'text-sky-800',
                Icon: Activity,
                iconClassName: 'text-sky-700',
                onClick: () => {
                  setPmFilterState('wip');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Work in progress', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'wip') });
                }
              },
              {
                key: 'awaiting',
                title: 'Awaiting Closure',
                value: Number(counts.awaiting || 0),
                className: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
                titleClassName: 'text-amber-900',
                valueClassName: 'text-amber-900',
                hintClassName: 'text-amber-800',
                Icon: Clock,
                iconClassName: 'text-amber-700',
                onClick: () => {
                  setPmFilterState('awaiting');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Awaiting Closure', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'awaiting') });
                }
              },
              {
                key: 'assigned',
                title: 'Assigned',
                value: Number(counts.assigned || 0),
                className: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
                titleClassName: 'text-violet-900',
                valueClassName: 'text-violet-900',
                hintClassName: 'text-violet-800',
                Icon: UserCheck,
                iconClassName: 'text-violet-700',
                onClick: () => {
                  setPmFilterState('assigned');
                  setPmFilterReprog('all');
                  setPmDetails({ open: true, title: 'Assigned', items: baseFiltered.filter((it) => bucketForState(it?.state) === 'assigned') });
                }
              },
              {
                key: 'reprog',
                title: 'Reprogrammation',
                value: Number(counts.reprog || 0),
                className: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
                titleClassName: 'text-slate-900',
                valueClassName: 'text-slate-900',
                hintClassName: 'text-slate-700',
                Icon: RotateCcw,
                iconClassName: 'text-slate-700',
                onClick: () => {
                  setPmFilterState('all');
                  setPmFilterReprog('any');
                  setPmDetails({ open: true, title: 'Reprogrammation', items: baseFiltered.filter((it) => effectiveReprogStatus(it)) });
                }
              }
            ];

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                  {cards.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={c.onClick}
                      className={`${c.className} border rounded-xl p-3 text-left`}
                      disabled={pmBusy}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className={`text-[11px] font-semibold ${c.titleClassName || 'text-gray-700'}`}>{c.title}</div>
                        {c.Icon ? <c.Icon size={18} className={`${c.iconClassName || 'text-slate-600'} flex-shrink-0`} /> : null}
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${c.valueClassName || 'text-gray-900'}`}>{c.value}</div>
                      <div className={`text-[11px] mt-2 ${c.hintClassName || 'text-gray-600'}`}>Clique pour voir les sites</div>
                    </button>
                  ))}
                </div>

                {pmDetails?.open && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
                      <div className="flex justify-between items-center p-4 border-b bg-indigo-800 text-white">
                        <div className="font-bold">Détails PM — {pmDetails?.title || ''}</div>
                        <button
                          type="button"
                          onClick={() => setPmDetails({ open: false, title: '', items: [] })}
                          className="hover:bg-indigo-900 p-2 rounded"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="p-4 overflow-auto">
                        <table className="min-w-[1100px] w-full text-sm">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr className="text-left text-xs text-slate-800 border-b border-slate-300">
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Ticket</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">État</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Date planifiée</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Assigné à</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Statut reprog.</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Date reprog.</th>
                              <th className="px-3 py-2 font-semibold whitespace-nowrap">Raison</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Array.isArray(pmDetails?.items) ? pmDetails.items : []).length === 0 ? (
                              <tr>
                                <td className="px-4 py-4 text-gray-600" colSpan={10}>
                                  Aucun élément.
                                </td>
                              </tr>
                            ) : (
                              (Array.isArray(pmDetails?.items) ? pmDetails.items : []).map((it, idx) => {
                                const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                                const reprogStatus = effectiveReprogStatus(it);
                                const reprog = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
                                const reason = String(it?.reprogrammationReason || '').trim();
                                const siteCode = pmNormalizeSiteCode(it?.siteCode);
                                const localSite = siteCode ? pmSitesByCode.get(siteCode) : null;
                                const siteName = String(it?.siteName || localSite?.nameSite || '').trim();
                                const siteLabel = [siteName, siteCode].filter(Boolean).join('\n');
                                const st = stateLabel(it?.state);
                                return (
                                  <tr key={it?.id || it?.number || idx} className={`border-b border-slate-200 hover:bg-slate-100/60 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">{it?.number || '-'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{st || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{sched || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 max-w-[260px] whitespace-pre-line leading-tight break-words" title={siteLabel || ''}>{siteLabel || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.zone || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.maintenanceType || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 max-w-[200px] truncate" title={String(it?.assignedTo || '')}>{it?.assignedTo || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprogStatus || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprog || '-'}</td>
                                    <td className="px-3 py-2 text-slate-900 max-w-[260px] truncate" title={reason || ''}>{reason || '-'}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPmFiltersOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
                    disabled={pmBusy}
                  >
                    <div className="flex items-center gap-2">
                      <Filter size={18} className="text-slate-700" />
                      <span className="text-sm font-bold text-slate-900">Filtres</span>
                    </div>
                    <span className="text-xs text-slate-700">{pmFiltersOpen ? '▲ Masquer' : '▼ Afficher'}</span>
                  </button>

                  {pmFiltersOpen && (
                  <div className="p-4 bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                    <div>
                      <label htmlFor="pm_filter_state" className="block text-xs font-semibold text-gray-700 mb-1">État</label>
                      <select
                        id="pm_filter_state"
                        name="pmFilterState"
                        value={effectivePmFilterState}
                        onChange={(e) => setPmFilterState(normalizeFilterState(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Tous</option>
                        <option value="closed">Closed Complete</option>
                        <option value="wip">Work in progress</option>
                        <option value="awaiting">Awaiting Closure</option>
                        <option value="assigned">Assigned</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="pm_filter_type" className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                      <select
                        id="pm_filter_type"
                        name="pmFilterType"
                        value={pmFilterType}
                        onChange={(e) => setPmFilterType(String(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Tous</option>
                        {typeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="pm_filter_zone" className="block text-xs font-semibold text-gray-700 mb-1">Zone</label>
                      <select
                        id="pm_filter_zone"
                        name="pmFilterZone"
                        value={pmFilterZone}
                        onChange={(e) => setPmFilterZone(String(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Toutes</option>
                        {zoneOptions.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="pm_filter_search" className="block text-xs font-semibold text-gray-700 mb-1">Recherche</label>
                      <input
                        id="pm_filter_search"
                        name="pmSearch"
                        value={pmSearch}
                        onChange={(e) => setPmSearch(e.target.value)}
                        placeholder="Ticket, site, zone, technicien…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      />
                    </div>

                    <div>
                      <label htmlFor="pm_filter_from" className="block text-xs font-semibold text-gray-700 mb-1">Du</label>
                      <input
                        id="pm_filter_from"
                        name="pmFilterFrom"
                        type="date"
                        value={pmFilterFrom}
                        onChange={(e) => setPmFilterFrom(String(e.target.value || ''))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      />
                    </div>

                    <div>
                      <label htmlFor="pm_filter_to" className="block text-xs font-semibold text-gray-700 mb-1">Au</label>
                      <input
                        id="pm_filter_to"
                        name="pmFilterTo"
                        type="date"
                        value={pmFilterTo}
                        onChange={(e) => setPmFilterTo(String(e.target.value || ''))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      />
                    </div>

                    <div>
                      <label htmlFor="pm_filter_reprog" className="block text-xs font-semibold text-gray-700 mb-1">Reprogrammation</label>
                      <select
                        id="pm_filter_reprog"
                        name="pmFilterReprog"
                        value={pmFilterReprog}
                        onChange={(e) => setPmFilterReprog(String(e.target.value || 'all'))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                      >
                        <option value="all">Toutes</option>
                        <option value="any">Toute reprogrammation</option>
                        <option value="pending">En attente</option>
                        <option value="approved">Approuvée</option>
                        <option value="rejected">Rejetée</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="pm_filter_planned_day" className="block text-xs font-semibold text-gray-700 mb-1 whitespace-nowrap">Planifiée/Anticipée</label>
                      <input
                        id="pm_filter_planned_day"
                        name="pmFilterPlannedDay"
                        type="date"
                        value={pmFilterPlannedDay}
                        onChange={(e) => {
                          const d = String(e.target.value || '').slice(0, 10);
                          setPmFilterPlannedDay(d);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        disabled={pmBusy}
                        title="Choisir un jour (Scheduled WO Date)"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3">
                    <div className="text-xs text-gray-600">
                      {(() => {
                        const nocCount = (Array.isArray(items) ? items : []).filter((it) => String(it?.createdSource || '') === 'noc').length;
                        return (
                          <>
                            Affichés: <span className="font-semibold text-gray-900">{tableFiltered.length}</span> / {items.length}
                            {nocCount > 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                NOC: {nocCount}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPmFilterState('all');
                        setPmFilterType('all');
                        setPmFilterZone('all');
                        setPmSearch('');
                        setPmFilterPlannedDay('');
                        setPmFilterFrom('');
                        setPmFilterTo('');
                        setPmFilterReprog('all');
                      }}
                      className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                      disabled={pmBusy}
                    >
                      Réinitialiser filtres
                    </button>
                  </div>
                  </div>
                  )}
                </div>

                {/* Centre d'exports Excel */}
                <div className="mb-5 bg-white border border-indigo-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExportCenterOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-200 hover:bg-indigo-100 transition-colors"
                    disabled={pmBusy}
                  >
                    <div className="flex items-center gap-2">
                      <Download size={18} className="text-indigo-700" />
                      <span className="text-sm font-bold text-indigo-900">Centre d'exports Excel</span>
                    </div>
                    <span className="text-xs text-indigo-700">{exportCenterOpen ? '▲ Masquer' : '▼ Afficher'}</span>
                  </button>

                  {exportCenterOpen && (
                    <div className="p-4 space-y-4">
                      {/* Ligne 1: Exports rapides basés sur les filtres actuels */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof handlePmExportItemsExcel !== 'function') return;
                            handlePmExportItemsExcel({
                              items: baseFiltered,
                              fileBaseName: `PM_filtres_${pmMonth}_${new Date().toISOString().split('T')[0]}`,
                              sheetName: `PM-${pmMonth}`
                            });
                          }}
                          className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60"
                          disabled={pmBusy || exportBusy || baseFiltered.length === 0}
                          title="Exporter toutes les maintenances correspondant aux filtres actuels"
                        >
                          <Download size={16} />
                          Exporter filtre actuel ({baseFiltered.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (typeof handlePmExportItemsExcel !== 'function') return;
                            const zoneItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
                              if (String(it?.maintenanceType || '').trim().toUpperCase() !== 'FULLPMWO') return false;
                              const m = String(it?.scheduledWoDate || '').slice(0, 7);
                              return m === pmMonth;
                            });
                            handlePmExportItemsExcel({
                              items: zoneItems,
                              fileBaseName: `PM_mois_${pmMonth}_toutes_zones_${new Date().toISOString().split('T')[0]}`,
                              sheetName: `PM-${pmMonth}`
                            });
                          }}
                          className="flex items-center gap-2 bg-sky-600 text-white px-3 py-2.5 rounded-lg hover:bg-sky-700 text-sm font-semibold disabled:opacity-60"
                          disabled={pmBusy || exportBusy}
                          title="Exporter toutes les maintenances FullPMWO du mois (toutes zones)"
                        >
                          <Download size={16} />
                          Export mois par zone (toutes)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (typeof handlePmExportItemsExcel !== 'function') return;
                            const dayItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
                              const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                              return sched === todayStr;
                            });
                            handlePmExportItemsExcel({
                              items: dayItems,
                              fileBaseName: `PM_jour_${todayStr}`,
                              sheetName: `PM-JOUR`
                            });
                          }}
                          className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-semibold disabled:opacity-60"
                          disabled={pmBusy || exportBusy}
                          title="Exporter les PM planifiées du jour"
                        >
                          <Download size={16} />
                          Export PM du jour
                        </button>
                      </div>

                      {/* Ligne 2: Export PM du jour par état */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="text-xs font-bold text-slate-700 mb-2">PM du jour par état</div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col">
                            <label className="text-[11px] font-semibold text-gray-600 mb-1">État</label>
                            <select
                              value={exportDayState}
                              onChange={(e) => setExportDayState(String(e.target.value || 'all'))}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              disabled={pmBusy}
                            >
                              <option value="all">Tous</option>
                              <option value="closed">Closed Complete</option>
                              <option value="awaiting">Awaiting Closure</option>
                              <option value="assigned">Assigned</option>
                              <option value="wip">Work in progress</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof handlePmExportItemsExcel !== 'function') return;
                              const dayItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
                                const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                                if (sched !== todayStr) return false;
                                if (exportDayState === 'all') return true;
                                return bucketForState(it?.state) === exportDayState;
                              });
                              handlePmExportItemsExcel({
                                items: dayItems,
                                fileBaseName: `PM_jour_${todayStr}_${exportDayState}`,
                                sheetName: `PM-JOUR-${exportDayState}`
                              });
                            }}
                            className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 text-sm font-semibold disabled:opacity-60"
                            disabled={pmBusy || exportBusy}
                          >
                            <Download size={14} className="inline mr-1" />
                            Exporter
                          </button>
                        </div>
                      </div>

                      {/* Ligne 3: Export maintenances planifiées Du/Au */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="text-xs font-bold text-slate-700 mb-2">Maintenances planifiées (période)</div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col">
                            <label className="text-[11px] font-semibold text-gray-600 mb-1">Du</label>
                            <input
                              type="date"
                              value={pmFilterFrom}
                              onChange={(e) => setPmFilterFrom(String(e.target.value || ''))}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              disabled={pmBusy}
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[11px] font-semibold text-gray-600 mb-1">Au</label>
                            <input
                              type="date"
                              value={pmFilterTo}
                              onChange={(e) => setPmFilterTo(String(e.target.value || ''))}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              disabled={pmBusy}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof handlePmExportItemsExcel !== 'function') return;
                              const dFrom = String(pmFilterFrom || '').slice(0, 10);
                              const dTo = String(pmFilterTo || '').slice(0, 10);
                              const periodItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
                                const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                                if (!sched) return false;
                                if (dFrom && sched < dFrom) return false;
                                if (dTo && sched > dTo) return false;
                                return true;
                              });
                              handlePmExportItemsExcel({
                                items: periodItems,
                                fileBaseName: `PM_periode_${dFrom || 'start'}_${dTo || 'end'}`,
                                sheetName: 'PM-Periode'
                              });
                            }}
                            className="bg-sky-600 text-white px-3 py-2 rounded-lg hover:bg-sky-700 text-sm font-semibold disabled:opacity-60"
                            disabled={pmBusy || exportBusy || (!pmFilterFrom && !pmFilterTo)}
                          >
                            <Download size={14} className="inline mr-1" />
                            Exporter période
                          </button>
                        </div>
                      </div>

                      {/* Ligne 4: Export reprogrammées par période + statut */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="text-xs font-bold text-slate-700 mb-2">Maintenances reprogrammées</div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col">
                            <label className="text-[11px] font-semibold text-gray-600 mb-1">Période</label>
                            <select
                              value={exportReprogPeriod}
                              onChange={(e) => setExportReprogPeriod(String(e.target.value || 'month'))}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              disabled={pmBusy}
                            >
                              <option value="day">Jour</option>
                              <option value="week">Semaine</option>
                              <option value="month">Mois</option>
                            </select>
                          </div>
                          {exportReprogPeriod === 'day' && (
                            <div className="flex flex-col">
                              <label className="text-[11px] font-semibold text-gray-600 mb-1">Date</label>
                              <input
                                type="date"
                                value={pmReprogExportDate}
                                onChange={(e) => setPmReprogExportDate(String(e.target.value || ''))}
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                                disabled={pmBusy}
                              />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <label className="text-[11px] font-semibold text-gray-600 mb-1">Statut</label>
                            <select
                              value={exportReprogStatus}
                              onChange={(e) => setExportReprogStatus(String(e.target.value || 'all'))}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              disabled={pmBusy}
                            >
                              <option value="all">Toutes</option>
                              <option value="any">Toute reprogrammation</option>
                              <option value="pending">En attente</option>
                              <option value="approved">Approuvée</option>
                              <option value="rejected">Rejetée</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof handlePmExportItemsExcel !== 'function') return;
                              const now = new Date();
                              const dayOfWeek = now.getDay();
                              const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                              const weekStart = new Date(now);
                              weekStart.setDate(now.getDate() + mondayOffset);
                              const weekEnd = new Date(weekStart);
                              weekEnd.setDate(weekStart.getDate() + 6);
                              const weekStartStr = weekStart.toISOString().slice(0, 10);
                              const weekEndStr = weekEnd.toISOString().slice(0, 10);
                              const monthStr = String(todayStr || '').slice(0, 7);

                              const reprogItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
                                const rStatus = effectiveReprogStatus(it);
                                if (exportReprogStatus === 'any' && !rStatus) return false;
                                if (exportReprogStatus === 'approved' && rStatus !== 'APPROVED') return false;
                                if (exportReprogStatus === 'rejected' && rStatus !== 'REJECTED') return false;
                                if (exportReprogStatus === 'pending' && rStatus !== 'PENDING') return false;
                                if (exportReprogStatus === 'all' && !rStatus) return false;

                                const reprogDate = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
                                if (exportReprogPeriod === 'day') {
                                  const day = String(pmReprogExportDate || todayStr || '').slice(0, 10);
                                  return reprogDate === day;
                                }
                                if (exportReprogPeriod === 'week') {
                                  return reprogDate >= weekStartStr && reprogDate <= weekEndStr;
                                }
                                return reprogDate.slice(0, 7) === monthStr;
                              });

                              const periodLabel = exportReprogPeriod === 'day'
                                ? String(pmReprogExportDate || todayStr || '').slice(0, 10)
                                : exportReprogPeriod === 'week'
                                  ? `semaine_${weekStartStr}_${weekEndStr}`
                                  : monthStr;

                              handlePmExportItemsExcel({
                                items: reprogItems,
                                fileBaseName: `PM_reprog_${periodLabel}_${exportReprogStatus}`,
                                sheetName: `REPROG-${periodLabel}`
                              });
                            }}
                            className="bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 text-sm font-semibold disabled:opacity-60"
                            disabled={pmBusy || exportBusy}
                          >
                            <Download size={14} className="inline mr-1" />
                            Exporter reprog.
                          </button>
                        </div>
                      </div>

                      {/* Ligne 5: Export par technicien */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="text-xs font-bold text-slate-700 mb-2">Export par technicien</div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col flex-1 min-w-[200px]">
                            <label className="text-[11px] font-semibold text-gray-600 mb-1">Rechercher technicien (nom)</label>
                            <input
                              type="text"
                              value={exportTechSearch}
                              onChange={(e) => setExportTechSearch(String(e.target.value || ''))}
                              placeholder="Nom du technicien…"
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              disabled={pmBusy}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof handlePmExportItemsExcel !== 'function') return;
                              const q = String(exportTechSearch || '').trim().toLowerCase();
                              if (!q) return;
                              const techItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
                                const assigned = String(it?.assignedTo || '').trim().toLowerCase();
                                return assigned.includes(q);
                              });
                              handlePmExportItemsExcel({
                                items: techItems,
                                fileBaseName: `PM_tech_${exportTechSearch.replace(/[^a-zA-Z0-9]/g, '_')}_${pmMonth}`,
                                sheetName: `PM-Tech`
                              });
                            }}
                            className="bg-violet-600 text-white px-3 py-2 rounded-lg hover:bg-violet-700 text-sm font-semibold disabled:opacity-60"
                            disabled={pmBusy || exportBusy || !exportTechSearch.trim()}
                          >
                            <Download size={14} className="inline mr-1" />
                            Exporter technicien
                          </button>
                        </div>
                      </div>

                      {/* Ligne 6: Export par zone */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="text-xs font-bold text-slate-700 mb-2">Export par zone</div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col">
                            <label className="text-[11px] font-semibold text-gray-600 mb-1">Zone</label>
                            <select
                              value={pmFilterZone}
                              onChange={(e) => setPmFilterZone(String(e.target.value || 'all'))}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              disabled={pmBusy}
                            >
                              <option value="all">Toutes</option>
                              {zoneOptions.map((z) => (
                                <option key={z} value={z}>{z}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof handlePmExportItemsExcel !== 'function') return;
                              const z = String(pmFilterZone || 'all');
                              const zoneItems = (Array.isArray(pmItems) ? pmItems : []).filter((it) => {
                                if (z === 'all') return true;
                                return String(it?.zone || '').trim() === z;
                              });
                              handlePmExportItemsExcel({
                                items: zoneItems,
                                fileBaseName: `PM_zone_${z === 'all' ? 'toutes' : z.replace(/[^a-zA-Z0-9]/g, '_')}_${pmMonth}`,
                                sheetName: `PM-Zone`
                              });
                            }}
                            className="bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 text-sm font-semibold disabled:opacity-60"
                            disabled={pmBusy || exportBusy}
                          >
                            <Download size={14} className="inline mr-1" />
                            Exporter zone
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-800">Tickets</div>
                    <div className="text-xs text-gray-600">Tri: date planifiée puis ticket</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-[1100px] w-full text-sm">
                      <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr className="text-left text-xs text-slate-800 border-b border-slate-300">
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Ticket</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">État</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Date planifiée</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Type</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Assigné à</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Clôture</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Statut reprog.</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Date reprog.</th>
                          <th className="px-3 py-2 font-semibold whitespace-nowrap">Raison</th>
                          {(isAdmin || isManager) && <th className="px-3 py-2 font-semibold whitespace-nowrap">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {tableFiltered.length === 0 ? (
                          <tr>
                            <td className="px-4 py-4 text-gray-600" colSpan={isAdmin ? 12 : 11}>
                              Aucun ticket pour ces filtres.
                            </td>
                          </tr>
                        ) : (
                          tableFiltered.map((it, idx) => {
                            const bucket = bucketForState(it?.state);
                            const badge = badgeForBucket(bucket);
                            const sched = it?.scheduledWoDate ? String(it.scheduledWoDate).slice(0, 10) : '';
                            const closed = it?.closedAt ? String(it.closedAt).slice(0, 10) : '';
                            const reprogStatus = effectiveReprogStatus(it);
                            const reprog = it?.reprogrammationDate ? String(it.reprogrammationDate).slice(0, 10) : '';
                            const reason = String(it?.reprogrammationReason || '').trim();
                            const siteCode = pmNormalizeSiteCode(it?.siteCode);
                            const localSite = siteCode ? pmSitesByCode.get(siteCode) : null;
                            const siteName = String(it?.siteName || localSite?.nameSite || '').trim();
                            const siteLabel = [siteName, siteCode].filter(Boolean).join('\n');
                            const st = stateLabel(it?.state);
                            const isAnticipated = String(it?.maintenanceType || '').trim().toUpperCase() === 'FULLPMWO' &&
                              sched && closed && closed < sched &&
                              (bucket === 'closed' || bucket === 'awaiting');
                            return (
                              <tr key={it?.id || it?.number} className={`border-b border-slate-200 hover:bg-slate-100/60 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}>
                                <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">{it?.number || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`inline-flex items-center border px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                                    {st}
                                  </span>
                                  {isAnticipated && (
                                    <span className="ml-1 inline-flex items-center border px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border-emerald-200">
                                      Anticipée
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{sched || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[260px] whitespace-pre-line leading-tight break-words" title={siteLabel || ''}>{siteLabel || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.zone || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{it?.maintenanceType || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[200px] truncate" title={String(it?.assignedTo || '')}>{it?.assignedTo || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{closed || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprogStatus || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{reprog || '-'}</td>
                                <td className="px-3 py-2 text-slate-900 max-w-[260px] truncate" title={reason || ''}>{reason || '-'}</td>
                                {(isAdmin || isManager) && (
                                  <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handlePmOpenReprog(it)}
                                      className="bg-indigo-700 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-800 text-xs font-semibold"
                                      disabled={pmBusy}
                                    >
                                      Reprogrammer
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {pmReprogOpen && pmReprogItem && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
                      <div className="flex justify-between items-center p-4 border-b bg-indigo-800 text-white">
                        <div className="font-bold">Reprogrammation (PM)</div>
                        <button
                          onClick={() => {
                            setPmReprogOpen(false);
                            setPmReprogItem(null);
                            setPmReprogForm({ date: '', status: '', reason: '' });
                            setPmReprogError('');
                          }}
                          className="hover:bg-indigo-900 p-2 rounded"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-gray-900">Ticket: {pmReprogItem?.number || '-'}</div>
                          <div className="text-xs text-gray-600">Site: {pmReprogItem?.siteName || '-'} {pmReprogItem?.siteCode ? `(${pmReprogItem.siteCode})` : ''}</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Date de reprogrammation</label>
                            <input
                              type="date"
                              value={pmReprogForm.date}
                              onChange={(e) => {
                                setPmReprogForm((prev) => ({ ...(prev || {}), date: e.target.value }));
                                setPmReprogError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Statut</label>
                            <select
                              value={pmReprogForm.status}
                              onChange={(e) => {
                                setPmReprogForm((prev) => ({ ...(prev || {}), status: e.target.value }));
                                setPmReprogError('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                            >
                              <option value="">(auto)</option>
                              <option value="PENDING">En attente</option>
                              <option value="APPROVED">Approuvée</option>
                              <option value="REJECTED">Rejetée</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-xs text-gray-600 mb-1">Raison / commentaires</label>
                          <textarea
                            value={pmReprogForm.reason}
                            onChange={(e) => {
                              setPmReprogForm((prev) => ({ ...(prev || {}), reason: e.target.value }));
                              setPmReprogError('');
                            }}
                            rows={3}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Ex: demande client / indisponibilité site / pièces…"
                          />
                        </div>

                        {pmReprogError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                            {pmReprogError}
                          </div>
                        )}
                      </div>

                      <div className="p-4 border-t bg-white flex flex-col sm:flex-row sm:justify-end gap-2">
                        <button
                          onClick={() => {
                            setPmReprogOpen(false);
                            setPmReprogItem(null);
                            setPmReprogForm({ date: '', status: '', reason: '' });
                            setPmReprogError('');
                          }}
                          className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
                          disabled={pmReprogSaving}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handlePmSaveReprog}
                          className="bg-indigo-800 text-white px-4 py-2 rounded-lg hover:bg-indigo-900 font-semibold"
                          disabled={pmReprogSaving}
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-800">Historique des imports</div>
                    <div className="text-xs text-gray-600">{imports.length} import(s)</div>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-[820px] w-full text-sm">
                      <thead className="bg-white sticky top-0">
                        <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Fichier</th>
                          <th className="px-4 py-2">Lignes</th>
                          <th className="px-4 py-2">Par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imports.length === 0 ? (
                          <tr>
                            <td className="px-4 py-4 text-gray-600" colSpan={5}>
                              Aucun import enregistré pour ce mois.
                            </td>
                          </tr>
                        ) : (
                          imports.map((imp) => {
                            const kind = String(imp?.kind || '').toLowerCase();
                            const kindBadge =
                              kind === 'planning' || kind === 'client'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : kind === 'noc'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : 'bg-gray-50 text-gray-800 border-gray-200';
                            return (
                              <tr key={imp?.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-800">{imp?.importedAt ? String(imp.importedAt).replace('T', ' ').slice(0, 19) : '-'}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex items-center border px-2 py-0.5 rounded-full text-xs font-semibold ${kindBadge}`}>
                                    {kind || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-800">{imp?.filename || '-'}</td>
                                <td className="px-4 py-2 text-gray-800">{Number(imp?.rowCount || 0)}</td>
                                <td className="px-4 py-2 text-gray-800">{imp?.createdByEmail || '-'}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
            </div>
          </div>
        </div>
        </div>

      </div>
    </div>
  );
};

export default PmModal;
