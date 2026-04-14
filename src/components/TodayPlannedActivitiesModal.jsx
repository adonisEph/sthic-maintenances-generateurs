import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, X, RotateCcw, Download, Copy } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

const TodayPlannedActivitiesModal = ({
  open,
  onClose,
  busy,
  todayActivities,
  onRefresh,
  isSuperAdmin,
  pmItemsMonth,
  ficheHistory,
  sites,
  onRefreshFicheHistory,
  formatDate
}) => {
  if (!open) return null;

  const pad2 = (n) => String(n).padStart(2, '0');
  const toYmdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addDaysYmdLocal = (ymd, days) => {
    const src = String(ymd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(src)) return '';
    const [y, m, dd] = src.split('-').map((x) => parseInt(x, 10));
    const d = new Date(y, (m || 1) - 1, dd || 1);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Number(days || 0));
    return toYmdLocal(d);
  };

  const today = String(todayActivities?.today || '').slice(0, 10);
  const pmToday = Array.isArray(todayActivities?.pmItems) ? todayActivities.pmItems : [];
  const intToday = Array.isArray(todayActivities?.interventions) ? todayActivities.interventions : [];

  const campaignMonth = String(today || '').slice(0, 7);

  const [selectedDate, setSelectedDate] = useState(today || '');

  const cardsRef = useRef(null);
  const captureRef = useRef(null);
  const [copyBusy, setCopyBusy] = useState(false);

  useEffect(() => {
    const d = String(today || '').slice(0, 10);
    if (!d) return;
    setSelectedDate((prev) => {
      const p = String(prev || '').slice(0, 10);
      return p ? p : d;
    });
  }, [today]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const next = addDaysYmdLocal(today, 1);
    if (!next) return;
    setSelectedDate(next);
  }, [isSuperAdmin, today, open]);

  const tomorrowYmd = useMemo(() => {
    return addDaysYmdLocal(today, 1);
  }, [today]);

  useEffect(() => {
    const d = String(selectedDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (isSuperAdmin) {
      if (typeof onRefreshFicheHistory !== 'function') return;
      if (busy || copyBusy) return;
      onRefreshFicheHistory();
      return;
    }
    if (typeof onRefresh !== 'function') return;
    if (busy) return;
    onRefresh(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, isSuperAdmin, onRefreshFicheHistory, copyBusy]);

  const planningLabel = useMemo(() => {
    const d = String(tomorrowYmd || selectedDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return '';
    const dow = dt.getDay();
    const fr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dow] || '';
    const fmt = typeof formatDate === 'function' ? formatDate(d) : d;
    return `Planning vidanges de (${fr} - ${fmt})`;
  }, [tomorrowYmd, selectedDate, formatDate]);

  const superAdminCards = useMemo(() => {
    if (!isSuperAdmin) return [];
    const list = Array.isArray(ficheHistory) ? ficheHistory : [];
    const ymdToday = String(today || '').slice(0, 10);
    const sitesArr = Array.isArray(sites) ? sites : [];
    const siteById = new Map(sitesArr.filter(Boolean).map((s) => [String(s.id), s]));

    const out = list
      .filter(Boolean)
      .filter((f) => String(f.status || '').trim() === 'En attente')
      .filter((f) => String(f.dateGenerated || '').slice(0, 10) === ymdToday)
      .filter((f) => {
        const dt = new Date(String(f.dateGenerated || ''));
        if (Number.isNaN(dt.getTime())) return false;
        const h = dt.getHours();
        return h >= 15 && h <= 18;
      })
      .map((f) => {
        const site = siteById.get(String(f.siteId || '')) || null;
        return {
          id: String(f.id || ''),
          ticketNumber: String(f.ticketNumber || '').trim(),
          technician: String(f.technician || '').trim(),
          siteName: String(f.siteName || '').trim(),
          epvType: String(f.epvType || '').trim(),
          plannedDate: String(f.plannedDate || '').slice(0, 10),
          idSite: site?.idSite != null ? String(site.idSite).trim() : '',
          generateur: site?.generateur != null ? String(site.generateur).trim() : '',
          capacite: site?.capacite != null ? String(site.capacite).trim() : '',
          diffNHs: site?.diffNHs != null ? String(site.diffNHs).trim() : '',
          dateGenerated: String(f.dateGenerated || '')
        };
      })
      .sort((a, b) => String(a.siteName || '').localeCompare(String(b.siteName || '')));

    return out;
  }, [isSuperAdmin, ficheHistory, today, sites]);

  const isoWeekKey = (ymd) => {
    const s = String(ymd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    if (Number.isNaN(dt.getTime())) return '';
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
    return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const isFicheCompleted = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (!s) return false;
    return (
      s.includes('complete') ||
      s.includes('compl') ||
      s.includes('réalis') ||
      s === 'done' ||
      s === 'closed complete'
    );
  };

  const completedEpvInCampaign = useMemo(() => {
    const list = Array.isArray(ficheHistory) ? ficheHistory : [];
    const map = new Map();
    if (!campaignMonth) return map;

    for (const f of list) {
      if (!f) continue;
      const sid = String(f.siteId || '').trim();
      const epv = String(f.epvType || '').trim().toUpperCase();
      const p = String(f.plannedDate || '').slice(0, 10);
      if (!sid || !epv || !/^EPV[123]$/.test(epv)) continue;
      if (String(p).slice(0, 7) !== campaignMonth) continue;
      if (!isFicheCompleted(f.status)) continue;
      if (!map.has(sid)) map.set(sid, new Set());
      map.get(sid).add(epv);
    }
    return map;
  }, [ficheHistory, campaignMonth]);

  const pmMonthItems = useMemo(() => (Array.isArray(pmItemsMonth) ? pmItemsMonth : []), [pmItemsMonth]);

  const pmTicketsBySiteInIsoWeek = useMemo(() => {
    const bySite = new Map();
    for (const p of pmMonthItems) {
      if (!p) continue;
      const code = String(p.siteCode || '').trim();
      if (!code) continue;
      const date = String(p.scheduledWoDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (campaignMonth && date.slice(0, 7) !== campaignMonth) continue;

      const wk = isoWeekKey(date);
      if (!wk) continue;

      const mt = String(p.maintenanceType || '').toLowerCase();
      const sd = String(p.shortDescription || '').toLowerCase();

      const isFull = mt.includes('fullpmwo') || sd.includes('full');
      const isDg = mt.includes('dg') || sd.includes('dg');

      if (!isFull && !isDg) continue;

      if (!bySite.has(code)) bySite.set(code, new Map());
      const byWeek = bySite.get(code);
      if (!byWeek.has(wk)) byWeek.set(wk, { fullPmwo: '', dgService: '' });
      const rec = byWeek.get(wk);

      const ticket = String(p.number || '').trim();
      if (!ticket) continue;

      if (isFull && !rec.fullPmwo) rec.fullPmwo = ticket;
      if (isDg && !rec.dgService) rec.dgService = ticket;
    }
    return bySite;
  }, [pmMonthItems, campaignMonth]);

  const getExtraTicketForCard = (c) => {
    const code = String(c?.idSite || '').trim();
    if (!code) return '';
    const wk = isoWeekKey(c?.plannedDate || tomorrowYmd || selectedDate);
    if (!wk) return '';
    const byWeek = pmTicketsBySiteInIsoWeek.get(code);
    const rec = byWeek ? byWeek.get(wk) : null;

    const sid = String(c?.siteId || '').trim();
    const done = sid ? completedEpvInCampaign.get(sid) : null;
    const epv = String(c?.epvType || '').trim().toUpperCase();
    const epv1Done = Boolean(done && done.has('EPV1'));

    if (epv === 'EPV1' && !epv1Done) return String(rec?.fullPmwo || '').trim();
    if ((epv === 'EPV2' || epv === 'EPV3') && epv1Done) return String(rec?.dgService || '').trim();
    return '';
  };

  const getTagForCard = (c) => {
    const sid = String(c?.siteId || '').trim();
    const done = sid ? completedEpvInCampaign.get(sid) : null;
    const epv = String(c?.epvType || '').trim().toUpperCase();
    const epv1Done = Boolean(done && done.has('EPV1'));

    if (epv === 'EPV1') {
      const code = String(c?.idSite || '').trim();
      const wk = isoWeekKey(c?.plannedDate || tomorrowYmd || selectedDate);
      const byWeek = code ? pmTicketsBySiteInIsoWeek.get(code) : null;
      const rec = byWeek && wk ? byWeek.get(wk) : null;
      if (rec?.fullPmwo) return 'PM+Vidanges';
      return 'Vidange Simple';
    }

    if ((epv === 'EPV2' || epv === 'EPV3') && epv1Done) return 'Vidange Simple';
    return '';
  };

  const diffNhBadge = (v) => {
    const raw = String(v ?? '').trim();
    if (!raw) return { label: '-', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    const n = parseFloat(raw.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (Number.isNaN(n)) return { label: raw, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (n <= 250) return { label: `${Math.round(n)} H`, cls: 'bg-orange-100 text-orange-900 border-orange-200' };
    return { label: `${Math.round(n)} H`, cls: 'bg-red-100 text-red-900 border-red-200' };
  };

  const copyCardsImage = async () => {
    const el = captureRef.current || cardsRef.current;
    if (!el) return;
    if (copyBusy) return;
    try {
      setCopyBusy(true);

      const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const scale = Math.max(2, Math.min(4, 2 * dpr));
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (doc) => {
          const root = doc.body;
          if (root) root.style.overflow = 'visible';

          const capture = doc.querySelector('[data-capture-root="1"]');
          if (capture) {
            capture.style.overflow = 'visible';
            capture.style.maxHeight = 'none';
            capture.style.height = 'auto';
            capture.style.maxWidth = 'none';
            capture.style.boxSizing = 'border-box';
            capture.style.width = '1800px';
          }

          const scrollArea = doc.querySelector('[data-capture-scroll="1"]');
          if (scrollArea) {
            scrollArea.style.overflow = 'visible';
            scrollArea.style.maxHeight = 'none';
            scrollArea.style.height = 'auto';
          }

          const style = doc.createElement('style');
          style.textContent = `
            [data-capture-root="1"] { font-size: 19px; line-height: 1.25; }
            [data-capture-root="1"] .text-xs { font-size: 14px !important; line-height: 1.25 !important; }
            [data-capture-root="1"] .text-sm { font-size: 17px !important; line-height: 1.25 !important; }
            [data-capture-root="1"] .text-base { font-size: 19px !important; line-height: 1.25 !important; }
            [data-capture-root="1"] .text-xl { font-size: 24px !important; line-height: 1.2 !important; }
          `;
          doc.head.appendChild(style);
        }
      });

      const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (!blob) throw new Error('Capture image impossible.');

      const nav = typeof navigator !== 'undefined' ? navigator : null;
      const canWrite = Boolean(nav?.clipboard && typeof nav.clipboard.write === 'function' && typeof window !== 'undefined' && window.ClipboardItem);
      if (canWrite) {
        await nav.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        alert('✅ Image copiée dans le presse-papiers.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planning-vidanges-${String(selectedDate || today || '').slice(0, 10) || 'date'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      alert('✅ Image téléchargée (presse-papiers non disponible).');
    } catch (e) {
      alert(e?.message || "Erreur lors de la copie de l'image.");
    } finally {
      setCopyBusy(false);
    }
  };

  const [filterLabel, setFilterLabel] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterAssignedZone, setFilterAssignedZone] = useState('all');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');

  const bySiteKey = new Map();

  const siteKeyForPm = (it) => {
    const sid = String(it?.siteCode || '').trim();
    if (sid) return `code:${sid}`;
    const sn = String(it?.siteName || '').trim();
    if (sn) return `name:${sn}`;
    const id = String(it?.siteId || '').trim();
    return id ? `id:${id}` : '';
  };

  const siteKeyForInt = (it) => {
    const sid = String(it?.siteCode || '').trim();
    if (sid) return `code:${sid}`;
    const sn = String(it?.siteName || '').trim();
    if (sn) return `name:${sn}`;
    const id = String(it?.siteId || '').trim();
    return id ? `id:${id}` : '';
  };

  const ensureRow = (k) => {
    if (!k) return null;
    if (!bySiteKey.has(k)) {
      bySiteKey.set(k, {
        key: k,
        siteName: '',
        siteCode: '',
        zone: '',
        pm: null,
        intervention: null
      });
    }
    return bySiteKey.get(k);
  };

  for (const it of pmToday) {
    const k = siteKeyForPm(it);
    const row = ensureRow(k);
    if (!row) continue;
    row.pm = it;
    row.siteName = String(it?.siteName || row.siteName || '').trim();
    row.siteCode = String(it?.siteCode || row.siteCode || '').trim();
    row.zone = String(it?.zone || row.zone || '').trim();
  }

  for (const it of intToday) {
    const k = siteKeyForInt(it);
    const row = ensureRow(k);
    if (!row) continue;
    row.intervention = it;
    row.siteName = String(it?.siteName || row.siteName || '').trim();
    row.siteCode = String(it?.siteCode || row.siteCode || '').trim();
    row.zone = String(it?.zone || row.zone || '').trim();
  }

  const rows = Array.from(bySiteKey.values()).sort((a, b) => {
    const sa = String(a.siteName || a.siteCode || a.key);
    const sb = String(b.siteName || b.siteCode || b.key);
    return sa.localeCompare(sb);
  });

  const computeLabel = (r) => {
    const hasPm = Boolean(r?.pm);
    const hasVid = Boolean(r?.intervention);
    const pmType = String(r?.pm?.maintenanceType || '').trim().toUpperCase();
    const epvType = String(r?.intervention?.epvType || '').trim().toUpperCase();

    const isFullPmWo = pmType === 'FULLPMWO';
    const isDgService = pmType === 'DG SERVICE';
    const epv1PlannedInMonth = Boolean(r?.pm?.epv1PlannedInMonth);

    if (hasPm && hasVid) {
      if (isFullPmWo && epvType === 'EPV1') return 'PM+Vidange';
      if (isFullPmWo) return 'PM Simple';
      if (isDgService) {
        const epv1DoneInMonth = Boolean(r?.intervention?.epv1DoneInMonth);
        const epv2DoneInMonth = Boolean(r?.intervention?.epv2DoneInMonth);

        if (epvType === 'EPV3' && epv2DoneInMonth) return 'Vidange Simple 3e passage';
        if (epvType === 'EPV2' && epv1DoneInMonth) return 'Vidange Simple 2e passage';
        return 'Vidange Simple';
      }
      return 'PM Simple';
    }

    if (hasPm) {
      if (isFullPmWo && !epv1PlannedInMonth) return 'PM Simple';
      return 'PM Simple';
    }

    if (hasVid) {
      const epv1DoneInMonth = Boolean(r?.intervention?.epv1DoneInMonth);
      const epv2DoneInMonth = Boolean(r?.intervention?.epv2DoneInMonth);

      if (epvType === 'EPV3' && epv2DoneInMonth) return 'Vidange Simple 3e passage';
      if (epvType === 'EPV2' && epv1DoneInMonth) return 'Vidange Simple 2e passage';
      return 'Vidange Simple';
    }

    return '-';
  };

  const siteCodeLabel = (r) => {
    const code = String(r?.siteCode || '').trim();
    if (code) return code;
    return '-';
  };

  const siteNameLabel = (r) => {
    const name = String(r?.siteName || '').trim();
    if (name) return name;
    return '-';
  };

  const assignedToLabel = (r) => {
    if (r?.pm) return String(r.pm?.assignedTo || '').trim() || '-';
    if (r?.intervention) return String(r.intervention?.technicianName || '').trim() || '-';
    return '-';
  };

  const assignedZoneLabel = (r) => {
    if (r?.pm) return String(r.pm?.assignedToZone || '').trim() || '-';
    if (r?.intervention) return String(r.intervention?.technicianZone || '').trim() || '-';
    return '-';
  };

  const ticketLabel = (r) => {
    const tickets = [];
    const pmTicket = String(r?.pm?.number || '').trim();
    const vidTicket = String(r?.intervention?.ticketNumber || '').trim();
    const isVidange = Boolean(r?.intervention);
    if (pmTicket) tickets.push(pmTicket);
    if (vidTicket && !tickets.includes(vidTicket)) tickets.push(vidTicket);
    if (isVidange && !vidTicket) tickets.push('attente génération fiche');
    return tickets.length > 0 ? tickets.join(' + ') : '-';
  };

  const badgeClass = (txt) => {
    if (txt === 'PM+Vidange') return 'bg-indigo-50 text-indigo-900 border-indigo-200';
    if (txt === 'PM Simple') return 'bg-sky-50 text-sky-900 border-sky-200';
    if (txt.startsWith('Vidange Simple')) return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    return 'bg-slate-50 text-slate-800 border-slate-200';
  };

  const uniqueSorted = (arr) => {
    const set = new Set();
    for (const v of arr) {
      const s = String(v || '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  const rowsFiltered = useMemo(() => {
    const assignedToNeedle = String(filterAssignedTo || '').trim().toLowerCase();
    return rows.filter((r) => {
      const label = computeLabel(r);
      if (filterLabel !== 'all' && label !== filterLabel) return false;

      const z = String(r?.zone || '').trim();
      if (filterZone !== 'all' && z !== filterZone) return false;

      const az = assignedZoneLabel(r);
      if (filterAssignedZone !== 'all' && az !== filterAssignedZone) return false;

      if (assignedToNeedle) {
        const a = assignedToLabel(r).toLowerCase();
        if (!a.includes(assignedToNeedle)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filterLabel, filterZone, filterAssignedZone, filterAssignedTo]);

  const zoneOptions = useMemo(() => uniqueSorted(rows.map((r) => r?.zone)), [rows]);
  const assignedZoneOptions = useMemo(() => uniqueSorted(rows.map((r) => assignedZoneLabel(r))), [rows]);

  const exportExcel = () => {
    const out = rowsFiltered.map((r) => {
      const label = computeLabel(r);
      const pmShort = String(r?.pm?.shortDescription || '').trim();
      const content = pmShort ? pmShort : label;
      return {
        Date: today || '',
        Ticket: ticketLabel(r),
        Site: siteCodeLabel(r),
        'Name Site': siteNameLabel(r),
        Zone: String(r?.zone || '').trim() || '',
        Type: label,
        'Short Description': content,
        'Assigné à': assignedToLabel(r),
        'Zone Technicien': assignedZoneLabel(r)
      };
    });

    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activites');
    XLSX.writeFile(wb, `activites-planifiees-${today || 'date'}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-0 sm:p-4">
      <div
        ref={captureRef}
        data-capture-root="1"
        className="bg-white shadow-xl w-full overflow-hidden flex flex-col h-[100svh] max-w-none max-h-[100svh] rounded-none sm:rounded-lg sm:max-w-[95vw] sm:max-h-[92vh]"
      >
        <div className="flex items-start justify-between gap-3 px-3 py-3 sm:p-4 border-b bg-indigo-800 text-white">
          <div className="min-w-0 flex items-center gap-2">
            <Activity size={24} className="flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold break-words whitespace-normal">
                {isSuperAdmin ? (planningLabel || 'Planning vidanges') : 'Activités planifiées du jour'}
              </div>
              <div className="text-xs text-white/80">Date: {isSuperAdmin ? (tomorrowYmd || selectedDate || '-') : (today || '-')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const d = String(selectedDate || '').slice(0, 10);
                if (isSuperAdmin) {
                  if (typeof onRefreshFicheHistory === 'function') onRefreshFicheHistory();
                } else {
                  if (typeof onRefresh === 'function') onRefresh(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
                }
              }}
              className="hover:bg-white/10 px-3 py-2 rounded flex items-center gap-2 text-sm font-semibold disabled:opacity-60"
              disabled={busy || (isSuperAdmin ? typeof onRefreshFicheHistory !== 'function' : typeof onRefresh !== 'function')}
              title="Rafraîchir"
            >
              <RotateCcw size={16} />
              Rafraîchir
            </button>
            <button
              type="button"
              onClick={isSuperAdmin ? copyCardsImage : exportExcel}
              className="hover:bg-white/10 px-3 py-2 rounded flex items-center gap-2 text-sm font-semibold disabled:opacity-60"
              disabled={busy || (isSuperAdmin ? copyBusy || superAdminCards.length === 0 : rowsFiltered.length === 0)}
              title={isSuperAdmin ? "Copier l'image" : 'Exporter en Excel'}
            >
              {isSuperAdmin ? <Copy size={16} /> : <Download size={16} />}
              {isSuperAdmin ? "Copier l'image" : 'Export Excel'}
            </button>
            <button onClick={onClose} className="hover:bg-white/10 p-2 rounded" title="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div data-capture-scroll="1" className="p-4 sm:p-6 overflow-y-auto flex-1">
          {busy && <div className="text-sm text-slate-600">Chargement…</div>}

          {isSuperAdmin ? (
            <div ref={cardsRef} className="space-y-4">
              {superAdminCards.length === 0 ? (
                <div className="text-sm text-slate-600">
                  Aucune fiche "En attente" trouvée pour aujourd'hui (création entre 15h et 18h).
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {superAdminCards.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 break-words whitespace-normal" title={c.siteName || ''}>
                              {c.siteName || '-'}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              ID Site: <span className="font-mono font-semibold text-slate-800">{c.idSite || '-'}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="inline-flex items-center justify-center text-[11px] font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
                              En attente
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] font-semibold text-slate-500">Ticket</div>
                            <div className="font-mono font-bold text-slate-900 break-all" title={c.ticketNumber || ''}>
                              {c.ticketNumber || '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-slate-500">Technicien</div>
                            <div className="font-semibold text-slate-900 break-words" title={c.technician || ''}>
                              {c.technician || '-'}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[11px] font-semibold text-slate-500">Ticket PM / DG Service</div>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <span className="font-mono font-bold text-slate-900 break-all">{getExtraTicketForCard(c) || '-'}</span>
                              {(() => {
                                const tag = getTagForCard(c);
                                if (!tag) return null;
                                const cls = tag === 'PM+Vidanges'
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                                  : 'bg-slate-100 text-slate-900 border-slate-200';
                                return (
                                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${cls}`}>
                                    {tag}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[11px] font-semibold text-slate-500">Générateur</div>
                            <div className="text-sm text-slate-900">
                              <span className="font-semibold">{c.generateur || '-'}</span>
                              {c.capacite ? (
                                <span className="text-slate-700">
                                  {' '}
                                  • {c.capacite}
                                  {/kva/i.test(String(c.capacite)) ? '' : ' KVA'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[11px] font-semibold text-slate-500">Diff NHs</div>
                            {(() => {
                              const b = diffNhBadge(c.diffNHs);
                              return (
                                <div className="mt-1 flex items-center justify-center">
                                  <span className={`inline-flex items-center justify-center min-w-[110px] px-3 py-1.5 rounded-lg border text-base font-extrabold ${b.cls}`}>
                                    {b.label}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (

            <>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(String(e.target.value || ''))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled={busy}
              />
            </div>
            <div className="text-xs text-slate-600">
              {(() => {
                const pmCount = Array.isArray(pmToday) ? pmToday.length : 0;
                const intCount = Array.isArray(intToday) ? intToday.length : 0;
                return `PM: ${pmCount} • Vidanges: ${intCount}`;
              })()}
            </div>
          </div>

          {!busy && todayActivities && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                <select
                  value={filterLabel}
                  onChange={(e) => setFilterLabel(String(e.target.value || 'all'))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={busy}
                >
                  <option value="all">Tous</option>
                  <option value="PM Simple">PM Simple</option>
                  <option value="Vidange Simple">Vidange Simple</option>
                  <option value="Vidange Simple 2e passage">Vidange Simple 2e passage</option>
                  <option value="Vidange Simple 3e passage">Vidange Simple 3e passage</option>
                  <option value="PM+Vidange">PM+Vidange</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Zone (ticket)</label>
                <select
                  value={filterZone}
                  onChange={(e) => setFilterZone(String(e.target.value || 'all'))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={busy}
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Zone technicien</label>
                <select
                  value={filterAssignedZone}
                  onChange={(e) => setFilterAssignedZone(String(e.target.value || 'all'))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={busy}
                >
                  <option value="all">Toutes</option>
                  {assignedZoneOptions.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Assigné à</label>
                <input
                  value={filterAssignedTo}
                  onChange={(e) => setFilterAssignedTo(String(e.target.value || ''))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Rechercher…"
                  disabled={busy}
                />
              </div>
            </div>
          )}

          {!busy && rowsFiltered.length === 0 && (
            <div className="text-sm text-slate-600">Aucune activité planifiée trouvée pour aujourd'hui.</div>
          )}

          {rowsFiltered.length > 0 && (
            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-left text-xs text-slate-700 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Ticket</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Name Site</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Short Description</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Assigné à</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Zone Technicien</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltered.map((r, idx) => {
                    const label = computeLabel(r);
                    const pmShort = String(r?.pm?.shortDescription || '').trim();
                    const content = pmShort ? pmShort : label;
                    return (
                      <tr
                        key={r.key}
                        className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-white' : 'bg-slate-50'}`}
                      >
                        <td className="px-3 py-2 text-slate-900 whitespace-nowrap" title={ticketLabel(r)}>
                          {ticketLabel(r)}
                        </td>
                        <td className="px-3 py-2 text-slate-900 whitespace-nowrap" title={siteCodeLabel(r)}>
                          {siteCodeLabel(r)}
                        </td>
                        <td className="px-3 py-2 text-slate-900 max-w-[320px] truncate" title={siteNameLabel(r)}>
                          {siteNameLabel(r)}
                        </td>
                        <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{String(r.zone || '').trim() || '-'}</td>
                        <td className="px-3 py-2 text-slate-900">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs px-2 py-1 rounded border font-semibold whitespace-nowrap ${badgeClass(label)}`}>
                              {label}
                            </span>
                            <span className="min-w-0 truncate" title={content}>
                              {content}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-900 max-w-[240px] truncate" title={assignedToLabel(r)}>
                          {assignedToLabel(r)}
                        </td>
                        <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{assignedZoneLabel(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </>
          )}
        </div>

        <div className="p-3 border-t bg-white" />
      </div>
    </div>
  );
};

export default TodayPlannedActivitiesModal;
