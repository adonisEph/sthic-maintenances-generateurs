import React from 'react';
import { CheckCircle, CheckCircle2, Download, Trash2, X } from 'lucide-react';
import CompleteInterventionModal from './CompleteInterventionModal';
import NhUpdateModal from './NhUpdateModal';
import { calculateEPVDates, calculateEstimatedNH } from '../../utils/calculations';
import { toastAlert as alert, startOperation } from '../../utils/feedback';

const InterventionsModal = ({
  open,
  isTechnician,
  isAdmin,
  isViewer,
  authUser,
  interventionsUiRev,
  bumpInterventionsUiRev,
  technicianPendingTasksCount,
  interventionsZone,
  setInterventionsZone,
  showZoneFilter,
  technicianUnseenSentCount,
  technicianSeenSentAt,
  setTechnicianSeenSentAt,
  interventions,
  setShowInterventions,
  interventionsBusy,
  interventionsError,
  setInterventionsError,
  users,
  sites,
  filteredSites,
  doneEpvBySiteId,
  currentCampaignMonth,
  interventionsMonth,
  setInterventionsMonth,
  interventionsStatus,
  setInterventionsStatus,
  interventionsTechnicianUserId,
  setInterventionsTechnicianUserId,
  loadInterventions,
  canExportExcel,
  handleExportInterventionsExcel,
  exportBusy,
  planningAssignments,
  setPlanningAssignments,
  getInterventionKey,
  ymdShiftForWorkdays,
  interventionsPrevMonthRetiredSiteIds,
  interventionsPrevMonthKey,
  technicianInterventionsTab,
  setTechnicianInterventionsTab,
  showTechnicianInterventionsFilters,
  setShowTechnicianInterventionsFilters,
  handleCompleteIntervention,
  formatDate,
  completeModalOpen,
  setCompleteModalOpen,
  completeModalSite,
  setCompleteModalSite,
  completeModalIntervention,
  setCompleteModalIntervention,
  completeForm,
  setCompleteForm,
  completeFormError,
  setCompleteFormError,
  nhModalOpen,
  setNhModalOpen,
  nhModalSite,
  setNhModalSite,
  nhModalIntervention,
  setNhModalIntervention,
  nhForm,
  setNhForm,
  nhFormError,
  setNhFormError,
  apiFetchJson,
  loadData,
  onOpenQuarantine
}) => {
  if (!open) return null;

  const [pmAssignments, setPmAssignments] = React.useState([]);
  const [pmBusy, setPmBusy] = React.useState(false);
  const [pmError, setPmError] = React.useState('');
  const [nhQuarantineInfo, setNhQuarantineInfo] = React.useState(null);
  // Console de dispatch (managers/admin) : déclenchement manuel, réassignation,
  // annulation, envoi en masse du mois.
  const [dispatchOpen, setDispatchOpen] = React.useState(false);
  const [dispatchSiteId, setDispatchSiteId] = React.useState('');
  const [dispatchEpvType, setDispatchEpvType] = React.useState('EPV1');
  const [dispatchDate, setDispatchDate] = React.useState('');
  const [dispatchTechUserId, setDispatchTechUserId] = React.useState('');
  const [dispatchBusy, setDispatchBusy] = React.useState(false);
  const [reassignForId, setReassignForId] = React.useState('');
  const [reassignTechUserId, setReassignTechUserId] = React.useState('');
  const [rowBusyId, setRowBusyId] = React.useState('');
  const [sendMonthBusy, setSendMonthBusy] = React.useState(false);
  const [cleanStaleBusy, setCleanStaleBusy] = React.useState(false);
  const [cleanFichesBusy, setCleanFichesBusy] = React.useState(false);

  const normTechName = (v) =>
    String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const role = String(authUser?.role || '').trim();
  const isManager = role === 'manager' || role === 'manager_bzv_pool';
  const isClosedInterventionStatus = (status) => {
    const st = String(status || '').trim().toLowerCase();
    return st === 'done' || st === 'non_fait';
  };
  const authZone = String(authUser?.zone || '').trim();
  const isZonalLocked = role === 'manager' || role === 'field_supervisor';
  const managerZoneLock = (isZonalLocked && authZone) ? authZone : '';

  const zones = ['ALL', 'BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
  const interventionsAll = Array.isArray(interventions) ? interventions : [];
  const zoneActive = managerZoneLock || (showZoneFilter && interventionsZone && interventionsZone !== 'ALL' ? String(interventionsZone) : '');
  const zoneTechFilter = managerZoneLock || (showZoneFilter && interventionsZone && interventionsZone !== 'ALL' ? String(interventionsZone).trim() : '');
  const interventionsScoped = zoneActive
    ? interventionsAll.filter((i) => String(i?.zone || '').trim() === zoneActive)
    : interventionsAll;

  const resolveVidangePlannedDate = (it, site, ymdShiftForWorkdays) => {
    try {
      if (!it || String(it?.kind || '') === 'PM') return String(it?.plannedDate || '').slice(0, 10);
      // Record persisté rendu "tel quel" (orphelin) : sa date stockée fait foi.
      if (it?.isRecord) return String(it?.plannedDate || '').slice(0, 10);
      const t = String(it?.epvType || '').trim().toUpperCase();
      const raw =
        t === 'EPV1'
          ? String(site?.epv1 || '')
          : t === 'EPV2'
            ? String(site?.epv2 || '')
            : t === 'EPV3'
              ? String(site?.epv3 || '')
              : '';
      const src = raw.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(src)) {
        const shifted = typeof ymdShiftForWorkdays === 'function' ? ymdShiftForWorkdays(src) : '';
        return String(shifted || src).slice(0, 10);
      }
      return String(it?.plannedDate || '').slice(0, 10);
    } catch {
      return String(it?.plannedDate || '').slice(0, 10);
    }
  };

  // ——— Référentiel unique : compteurs ET liste partagent les mêmes items ———
  const ymdInTimeZone = (d, timeZone) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };
  const today = ymdInTimeZone(new Date(), 'Africa/Brazzaville');
  const tomorrowD = new Date();
  tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrow = ymdInTimeZone(tomorrowD, 'Africa/Brazzaville');
  const month = String(interventionsMonth || '').trim();

  const siteById = new Map((Array.isArray(sites) ? sites : []).map((s) => [String(s?.id || ''), s]));

  const normalizePmType = (v) =>
    String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

  const isPmDone = (p) => {
    const st = String(p?.pmState || p?.status || '').trim().toUpperCase();
    return (
      st === 'EFFECTUEE' ||
      st === 'DONE' ||
      st === 'CLOSED' ||
      st === 'CLOSED COMPLETE' ||
      st === 'CLOSED_COMPLETE' ||
      st === 'CLOSEDCOMPLETE' ||
      st === 'AWAITING CLOSURE' ||
      st === 'AWAITING_CLOSURE'
    );
  };

  // Matching tolérant : identique à /api/sites et /api/sites/:id/nh
  // (égalité OU contient sur forme normalisée — accents/casse ignorés).
  const techMatchesSite = (siteTechnician) => {
    const key = normTechName(authUser?.technicianName);
    if (!key) return true; // session sans nom → les sites sont déjà scopés côté serveur
    const tech = normTechName(siteTechnician);
    if (!tech) return false;
    return tech === key || tech.includes(key) || key.includes(tech);
  };

  const buildCanonicalItems = () => {
    const norm = (d) => {
      const s = String(d || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
    };

    // Tous les records `interventions` sont des vidanges (les PM viennent de pmAssignments)
    const vidangeRecords = (Array.isArray(interventionsScoped) ? interventionsScoped : []).filter(Boolean);

    const interventionsByKey = new Map(
      vidangeRecords.map((i) => [
        getInterventionKey(i.siteId, String(i?.plannedDate || '').slice(0, 10), i.epvType),
        i
      ])
    );

    // Pool des records OUVERTS par site+epvType : fallback quand la date EPV recalculée
    // a dérivé depuis la génération — on prend le plus proche en date, tous conservés
    // (les non-consommés deviennent des lignes orphelines visibles).
    const pendingBySiteEpv = new Map();
    vidangeRecords
      .filter((i) => !isClosedInterventionStatus(i?.status))
      .forEach((i) => {
        const k = `${String(i?.siteId || '')}|${String(i?.epvType || '')}`;
        const arr = pendingBySiteEpv.get(k) || [];
        arr.push(i);
        pendingBySiteEpv.set(k, arr);
      });
    for (const arr of pendingBySiteEpv.values()) {
      arr.sort((a, b) => String(a?.plannedDate || '').localeCompare(String(b?.plannedDate || '')));
    }

    const ymdMs = (d) => {
      const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
    };

    const usedRecordIds = new Set();
    const pickRecord = (siteId, plannedDate, src, epvType) => {
      let rec =
        interventionsByKey.get(getInterventionKey(siteId, plannedDate, epvType)) ||
        interventionsByKey.get(getInterventionKey(siteId, src, epvType)) ||
        null;
      if (!rec) {
        const pool = (pendingBySiteEpv.get(`${String(siteId)}|${String(epvType)}`) || []).filter(
          (r) => !usedRecordIds.has(String(r?.id))
        );
        if (pool.length) {
          const target = ymdMs(plannedDate);
          let best = pool[0];
          let bestAbs = Infinity;
          for (const r of pool) {
            const t = ymdMs(r?.plannedDate);
            const abs = Number.isFinite(target) && Number.isFinite(t) ? Math.abs(t - target) : 0;
            if (abs < bestAbs) {
              bestAbs = abs;
              best = r;
            }
          }
          rec = best;
        }
      }
      if (rec) usedRecordIds.add(String(rec.id));
      return rec;
    };

    // Filtre technicien (manager/admin) : le serveur ne l'applique que pour le
    // superadmin — on le répercute côté client (user_id OU nom normalisé) pour
    // que la liste ET "Envoyer le mois" respectent la sélection.
    const selectedTech =
      !isTechnician && String(interventionsTechnicianUserId || 'all') !== 'all'
        ? (Array.isArray(users) ? users : []).find(
            (u) => u && String(u.id) === String(interventionsTechnicianUserId)
          ) || null
        : null;
    const selectedTechKey = normTechName(
      selectedTech?.technicianName ?? selectedTech?.technician_name ?? selectedTech?.email
    );
    const matchSelectedTech = (name, uid) => {
      if (!selectedTech) return true;
      if (uid && String(uid) === String(selectedTech.id)) return true;
      const k = normTechName(name);
      return Boolean(
        k &&
          selectedTechKey &&
          (k === selectedTechKey || k.includes(selectedTechKey) || selectedTechKey.includes(k))
      );
    };

    const vidangeEvents = [];
    const add = (site, epvType, rawDate) => {
      if (!site || site.retired) return;
      if (!matchSelectedTech(site?.technician, null)) return;
      const sid = String(site?.id || '').trim();
      try {
        const done = doneEpvBySiteId instanceof Map ? doneEpvBySiteId.get(sid) : null;
        const doneDate = done ? String(done?.[String(epvType || '').trim().toUpperCase()] || '').slice(0, 10) : '';
        if (doneDate && currentCampaignMonth) return;
      } catch {
        // ignore
      }
      const src = norm(rawDate);
      if (!src) return;
      const shifted = typeof ymdShiftForWorkdays === 'function' ? ymdShiftForWorkdays(src) : '';
      const plannedDate = String(shifted || src).slice(0, 10);
      const rec = pickRecord(sid, plannedDate, src, epvType);
      vidangeEvents.push({
        id: rec?.id ? String(rec.id) : `epv:${sid}:${epvType}:${plannedDate}`,
        kind: 'EPV',
        siteId: sid,
        plannedDate,
        originalDate: src,
        epvType,
        technicianName: String(site?.technician || ''),
        status: String(rec?.status || 'planned'),
        intervention: rec,
        isRecord: false
      });
    };

    (Array.isArray(sites) ? sites : []).forEach((site) => {
      if (!site || site.retired) return;
      if (isTechnician && !techMatchesSite(site?.technician)) return;

      const epv1 = norm(site?.epv1);
      const epv2 = norm(site?.epv2);
      const epv3 = norm(site?.epv3);

      if (epv1 || epv2 || epv3) {
        add(site, 'EPV1', epv1);
        add(site, 'EPV2', epv2);
        add(site, 'EPV3', epv3);
        return;
      }

      const nhEstimated = calculateEstimatedNH(site?.nh2A, site?.dateA, site?.regime);
      const epvDates = calculateEPVDates(site?.regime, site?.dateA, site?.nh1DV, nhEstimated, site?.seuil);
      add(site, 'EPV1', epvDates?.epv1);
      add(site, 'EPV2', epvDates?.epv2);
      add(site, 'EPV3', epvDates?.epv3);
    });

    // Records orphelins : jamais masqués — un record réel sans événement EPV
    // correspondant (site sans EPV calculable, doublon, date dérivée) s'affiche
    // tel quel avec sa date stockée.
    const orphans = vidangeRecords
      .filter((r) => !usedRecordIds.has(String(r?.id)))
      .filter((r) => matchSelectedTech(r?.technicianName, r?.technicianUserId))
      .filter((r) => {
        const s = siteById.get(String(r?.siteId || ''));
        return !(s && s.retired);
      })
      .map((r) => ({
        ...r,
        kind: 'EPV',
        plannedDate: String(r?.plannedDate || '').slice(0, 10),
        epvType: String(r?.epvType || ''),
        technicianName:
          String(r?.technicianName || '') || String(siteById.get(String(r?.siteId || ''))?.technician || ''),
        status: String(r?.status || 'planned'),
        intervention: r,
        isRecord: true,
        orphan: true
      }));

    const pmItems = (Array.isArray(pmAssignments) ? pmAssignments : [])
      .filter(Boolean)
      .filter((p) =>
        matchSelectedTech(
          p?.technicianName ?? p?.technician_name,
          p?.technicianUserId ?? p?.technician_user_id
        )
      )
      .filter((p) => {
        if (!zoneActive) return true;
        const z = String(p?.zone || '').trim();
        return !z || z === zoneActive;
      })
      .filter((p) => normalizePmType(p?.maintenanceType) === 'fullpmwo')
      .map((p) => {
        const mt = normalizePmType(p?.maintenanceType);
        return {
          id: String(p?.id || `pm:${String(p?.pmNumber || '')}`),
          kind: 'PM',
          maintenanceType: mt,
          pmNumber: String(p?.pmNumber || ''),
          siteId: String(p?.siteId || ''),
          plannedDate: String(p?.plannedDate || '').slice(0, 10),
          status: String(p?.pmState || p?.status || ''),
          scheduledWoDate: String(p?.scheduledWoDate || '').slice(0, 10),
          reprogrammationDate: String(p?.reprogrammationDate || '').slice(0, 10),
          closedAt: String(p?.closedAt || '').slice(0, 10),
          isDone: isPmDone(p)
        };
      })
      .filter((p) => {
        if (!p.siteId || !p.plannedDate) return false;
        const s = siteById.get(String(p.siteId)) || null;
        return !(s && s.retired);
      });

    return { pmItems, vidangeItems: [...vidangeEvents, ...orphans] };
  };

  // ——— Console de dispatch (admin/manager uniquement) ———
  const canDispatch = !isTechnician && !isViewer && (isAdmin || isManager);

  const technicianOptions = (Array.isArray(users) ? users : [])
    .filter((u) => u && String(u.role || '') === 'technician' && !(u.disabledAt || u.disabled_at))
    .filter((u) => (zoneTechFilter ? String(u?.zone || '').trim() === zoneTechFilter : true))
    .slice()
    .sort((a, b) =>
      String(a.technicianName || a.email || '').localeCompare(String(b.technicianName || b.email || ''))
    );

  const dispatchableSites = (Array.isArray(sites) ? sites : [])
    .filter((s) => s && !s.retired)
    .filter((s) => (zoneActive ? String(s?.zone || '').trim() === zoneActive : true))
    .slice()
    .sort((a, b) =>
      String(a?.nameSite || a?.idSite || a?.id || '').localeCompare(
        String(b?.nameSite || b?.idSite || b?.id || '')
      )
    );

  const resolveTechUserIdForSite = (site) => {
    const key = normTechName(site?.technician);
    if (!key) return '';
    const exact = technicianOptions.find(
      (u) => normTechName(u.technicianName ?? u.technician_name) === key
    );
    if (exact?.id) return String(exact.id);
    const partial = technicianOptions.filter((u) => {
      const a = normTechName(u.technicianName ?? u.technician_name);
      return a && (a.includes(key) || key.includes(a));
    });
    return partial.length === 1 ? String(partial[0].id) : '';
  };

  // Suggestion : prochain slot EPV non fait du site (même logique que "Fiches")
  // + date décalée jours ouvrés.
  const suggestDispatchForSite = (site) => {
    const sid = String(site?.id || '');
    const done = doneEpvBySiteId instanceof Map ? doneEpvBySiteId.get(sid) : null;
    const slots = ['EPV1', 'EPV2', 'EPV3']
      .map((t) => {
        const raw = t === 'EPV1' ? site?.epv1 : t === 'EPV2' ? site?.epv2 : site?.epv3;
        const src = String(raw || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(src)) return null;
        const shifted = typeof ymdShiftForWorkdays === 'function' ? ymdShiftForWorkdays(src) : '';
        return { type: t, date: String(shifted || src).slice(0, 10), done: Boolean(done?.[t]) };
      })
      .filter(Boolean);
    const pick = slots.find((s) => !s.done) || slots[0] || null;
    return { epvType: pick?.type || 'EPV1', date: pick?.date || today };
  };

  const onDispatchSiteChange = (siteId) => {
    setDispatchSiteId(String(siteId || ''));
    const site = siteById.get(String(siteId)) || null;
    const sug = suggestDispatchForSite(site);
    setDispatchEpvType(sug.epvType);
    setDispatchDate(sug.date);
    setDispatchTechUserId(resolveTechUserIdForSite(site));
  };

  const onDispatchEpvChange = (t) => {
    setDispatchEpvType(t);
    const site = siteById.get(String(dispatchSiteId)) || null;
    const raw = t === 'EPV1' ? site?.epv1 : t === 'EPV2' ? site?.epv2 : site?.epv3;
    const src = String(raw || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(src)) {
      const shifted = typeof ymdShiftForWorkdays === 'function' ? ymdShiftForWorkdays(src) : '';
      setDispatchDate(String(shifted || src).slice(0, 10));
    }
  };

  const submitDispatch = async () => {
    const site = siteById.get(String(dispatchSiteId)) || null;
    if (!site || !dispatchEpvType || !dispatchDate) {
      alert('⚠️ Choisissez un site, un type EPV et une date.');
      return;
    }
    const techUser =
      technicianOptions.find((u) => String(u.id) === String(dispatchTechUserId)) || null;
    const technicianName = String(
      techUser?.technicianName ?? techUser?.technician_name ?? site?.technician ?? ''
    ).trim();
    if (!technicianName) {
      alert('⚠️ Aucun technicien : renseignez le technicien du site ou choisissez-en un.');
      return;
    }
    const op = startOperation(
      `Envoi ${dispatchEpvType} — ${site?.nameSite || dispatchSiteId}…`,
      `${formatDate(dispatchDate)} • ${technicianName}`
    );
    try {
      setDispatchBusy(true);
      const res = await apiFetchJson('/api/interventions', {
        method: 'POST',
        body: JSON.stringify({
          siteId: String(site.id),
          plannedDate: dispatchDate,
          epvType: dispatchEpvType,
          technicianName,
          technicianUserId: techUser?.id ? String(techUser.id) : null,
          status: 'sent'
        })
      });
      op.dismiss();
      if (isClosedInterventionStatus(res?.intervention?.status)) {
        alert(
          `⚠️ Une intervention existe déjà pour ce site/type/date et elle est clôturée (${res?.intervention?.status}). Aucune réouverture effectuée.`
        );
      } else {
        alert(`✅ Intervention envoyée à ${technicianName}.`);
      }
      setDispatchOpen(false);
      try {
        await loadInterventions();
      } catch {
        // ignore
      }
    } catch (e) {
      op.dismiss();
      alert(e?.message || "Erreur lors de l'envoi de l'intervention.");
    } finally {
      setDispatchBusy(false);
    }
  };

  // Envoi unitaire : record planned → :id/send ; événement EPV sans record →
  // POST status:'sent' (idempotent côté serveur, aucun doublon possible).
  const sendVidangeItem = async (it, site) => {
    const rec = it?.intervention;
    const op = startOperation(`Envoi — ${site?.nameSite || it?.siteId}…`);
    try {
      setRowBusyId(String(it?.id));
      if (rec?.id && String(it?.status || '') === 'planned') {
        await apiFetchJson(`/api/interventions/${encodeURIComponent(String(rec.id))}/send`, {
          method: 'POST',
          body: '{}'
        });
      } else if (!rec?.id) {
        const res = await apiFetchJson('/api/interventions', {
          method: 'POST',
          body: JSON.stringify({
            siteId: String(it.siteId),
            plannedDate: String(it.plannedDate || '').slice(0, 10),
            epvType: String(it.epvType || ''),
            technicianName: String(it.technicianName || site?.technician || ''),
            technicianUserId: resolveTechUserIdForSite(site) || null,
            status: 'sent'
          })
        });
        if (isClosedInterventionStatus(res?.intervention?.status)) {
          op.dismiss();
          alert(
            `⚠️ Intervention déjà clôturée (${res?.intervention?.status}) à cette date — rien à envoyer.`
          );
          try {
            await loadInterventions();
          } catch {
            // ignore
          }
          return;
        }
      }
      op.dismiss();
      alert('✅ Intervention envoyée au technicien.');
      try {
        await loadInterventions();
      } catch {
        // ignore
      }
    } catch (e) {
      op.dismiss();
      alert(e?.message || "Erreur lors de l'envoi.");
    } finally {
      setRowBusyId('');
    }
  };

  const submitReassign = async (it) => {
    const rec = it?.intervention;
    const techUser = technicianOptions.find((u) => String(u.id) === String(reassignTechUserId));
    if (!rec?.id || !techUser) {
      alert('⚠️ Choisissez un technicien.');
      return;
    }
    const op = startOperation('Réassignation…');
    try {
      setRowBusyId(String(it?.id));
      await apiFetchJson(`/api/interventions/${encodeURIComponent(String(rec.id))}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          technicianName: String(
            techUser.technicianName ?? techUser.technician_name ?? techUser.email ?? ''
          ),
          technicianUserId: String(techUser.id)
        })
      });
      op.dismiss();
      alert(`✅ Réassignée à ${techUser.technicianName || techUser.email}.`);
      setReassignForId('');
      try {
        await loadInterventions();
      } catch {
        // ignore
      }
    } catch (e) {
      op.dismiss();
      alert(e?.message || 'Erreur lors de la réassignation.');
    } finally {
      setRowBusyId('');
    }
  };

  const cancelIntervention = async (it, site) => {
    const rec = it?.intervention;
    if (!rec?.id) return;
    const ok = window.confirm(
      `Annuler cette intervention ?\n\nSite : ${site?.nameSite || it.siteId}\n${it.epvType} • ${formatDate(
        it.plannedDate
      )}\nTechnicien : ${it.technicianName || '-'}\n\nL'enregistrement sera supprimé.`
    );
    if (!ok) return;
    const op = startOperation("Annulation de l'intervention…");
    try {
      setRowBusyId(String(it?.id));
      await apiFetchJson('/api/interventions', {
        method: 'DELETE',
        body: JSON.stringify({ id: String(rec.id) })
      });
      op.dismiss();
      alert('✅ Intervention annulée.');
      try {
        await loadInterventions();
      } catch {
        // ignore
      }
    } catch (e) {
      op.dismiss();
      alert(e?.message || "Erreur lors de l'annulation.");
    } finally {
      setRowBusyId('');
    }
  };

  // Envoi en masse : toutes les vidanges OUVERTES du filtre courant (mois/zone/
  // technicien) passent à "sent". Idempotent : les déjà envoyées sont réaffirmées.
  const sendMonthBulk = async () => {
    const { vidangeItems } = buildCanonicalItems();
    const targets = vidangeItems
      .filter((v) => !isClosedInterventionStatus(v?.status))
      .map((v) => {
        const site = siteById.get(String(v.siteId));
        return {
          siteId: String(v.siteId),
          plannedDate: String(v.plannedDate || '').slice(0, 10),
          epvType: String(v.epvType || ''),
          technicianName: String(v.technicianName || site?.technician || ''),
          technicianUserId: v?.intervention?.technicianUserId || resolveTechUserIdForSite(site) || null
        };
      })
      .filter((t) => t.siteId && t.plannedDate && t.epvType && t.technicianName);
    if (!targets.length) {
      alert('⚠️ Aucune vidange ouverte à envoyer pour ce filtre.');
      return;
    }
    const techLabel =
      String(interventionsTechnicianUserId || 'all') !== 'all'
        ? technicianOptions.find((u) => String(u.id) === String(interventionsTechnicianUserId))
        : null;
    const ok = window.confirm(
      `Envoyer ${targets.length} vidange(s) aux techniciens ?\n\nMois : ${month || 'tous'} • Zone : ${
        zoneActive || 'toutes'
      } • Technicien : ${
        techLabel ? techLabel.technicianName || techLabel.email : 'tous'
      }\n\nLes interventions "planned" passeront à "sent" (déjà envoyées : réaffirmées).`
    );
    if (!ok) return;
    const op = startOperation(`Envoi du mois — ${targets.length} vidange(s)…`);
    try {
      setSendMonthBusy(true);
      const data = await apiFetchJson('/api/interventions/send-month', {
        method: 'POST',
        body: JSON.stringify({ interventions: targets })
      });
      op.dismiss();
      alert(
        `✅ Envoi du mois terminé.\n\nCréées : ${data?.created || 0} • Mises à jour : ${
          data?.updated || 0
        } • Envoyées : ${data?.sent || 0}`
      );
      try {
        await loadInterventions();
      } catch {
        // ignore
      }
    } catch (e) {
      op.dismiss();
      alert(e?.message || "Erreur lors de l'envoi du mois.");
    } finally {
      setSendMonthBusy(false);
    }
  };

  // Nettoyage : clôture (non_fait) toutes les interventions ouvertes datées
  // d'avant la campagne courante (1er du mois, Africa/Brazzaville côté serveur).
  const cleanStale = async () => {
    const op = startOperation('Analyse des interventions d’anciennes campagnes…');
    try {
      setCleanStaleBusy(true);
      const scope = zoneActive ? { zone: zoneActive } : {};
      const preview = await apiFetchJson('/api/interventions/close-stale', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true, ...scope })
      });
      const n = Number(preview?.toClose || 0);
      if (!n) {
        op.dismiss();
        alert('✅ Aucune intervention ouverte avant la campagne courante.');
        return;
      }
      const beforeLabel = String(preview?.before || '')
        .slice(0, 7)
        .split('-')
        .reverse()
        .join('/');
      op.dismiss();
      const ok = window.confirm(
        `${n} intervention(s) encore ouverte(s) datée(s) d'avant le ${beforeLabel} ` +
          `(zone : ${zoneActive || 'toutes'}) seront clôturées en "non_fait".\n\n` +
          `Ces records d'anciennes campagnes ne sont plus exécutables. Continuer ?`
      );
      if (!ok) return;
      const run = startOperation(`Clôture de ${n} intervention(s)…`);
      try {
        const res = await apiFetchJson('/api/interventions/close-stale', {
          method: 'POST',
          body: JSON.stringify({ ...scope })
        });
        run.done(`✅ ${res?.closed || 0} intervention(s) clôturée(s).`);
      } catch (e) {
        run.dismiss();
        throw e;
      }
      try {
        await loadInterventions();
      } catch {
        // ignore
      }
    } catch (e) {
      alert(e?.message || 'Erreur lors du nettoyage.');
    } finally {
      setCleanStaleBusy(false);
    }
  };

  // Nettoyage : annule les fiches restées ouvertes alors que la vidange est
  // déjà terminée (intervention clôturée ou autre ticket 'Effectuée') —
  // tickets orphelins qui ne seront plus jamais consommés.
  const cleanOrphanFiches = async () => {
    const op = startOperation('Analyse des fiches orphelines…');
    try {
      setCleanFichesBusy(true);
      const scope = zoneActive ? { zone: zoneActive } : {};
      const preview = await apiFetchJson('/api/fiche-history/clean-orphans', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true, ...scope })
      });
      const n = Number(preview?.toCancel || 0);
      if (!n) {
        op.dismiss();
        alert('✅ Aucune fiche orpheline à nettoyer.');
        return;
      }
      const sample = Array.isArray(preview?.sample) ? preview.sample.slice(0, 5) : [];
      const sampleLines = sample
        .map((f) => `  • ${f.ticket_number || '(sans ticket)'} — ${f.site_id} ${f.epv_type || ''} (${f.status || '?'})`)
        .join('\n');
      op.dismiss();
      const ok = window.confirm(
        `${n} fiche(s) orpheline(s) détectée(s) (zone : ${zoneActive || 'toutes'}) — vidange déjà ` +
          `terminée via un autre ticket ou intervention clôturée en "done".\n\n` +
          (sampleLines ? `${sampleLines}\n\n` : '') +
          `Les tickets colis en attente et les fiches sans preuve de vidange sont préservés.\n` +
          `Elles seront annulées (statut "Annulée", motif tracé). Continuer ?`
      );
      if (!ok) return;
      const run = startOperation(`Annulation de ${n} fiche(s)…`);
      try {
        const res = await apiFetchJson('/api/fiche-history/clean-orphans', {
          method: 'POST',
          body: JSON.stringify({ ...scope })
        });
        run.done(`✅ ${res?.cancelled || 0} fiche(s) orpheline(s) annulée(s).`);
      } catch (e) {
        run.dismiss();
        throw e;
      }
      try {
        await loadInterventions();
      } catch {
        // ignore
      }
    } catch (e) {
      alert(e?.message || 'Erreur lors du nettoyage des fiches.');
    } finally {
      setCleanFichesBusy(false);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    if (!isTechnician) return;
    if (typeof apiFetchJson !== 'function') return;
    (async () => {
      setPmError('');
      setPmBusy(true);
      try {
        const month = String(interventionsMonth || '').trim();
        const mm = month.match(/^\d{4}-\d{2}$/);
        if (!mm) {
          setPmAssignments([]);
          return;
        }
        const from = `${month}-01`;
        const to = `${month}-31`;
        const qs = new URLSearchParams({ from, to });
        const data = await apiFetchJson(`/api/pm-assignments?${qs.toString()}`, { method: 'GET' });
        setPmAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
      } catch (e) {
        setPmAssignments([]);
        setPmError(e?.message || 'Erreur serveur.');
      } finally {
        setPmBusy(false);
      }
    })();
  }, [open, isTechnician, apiFetchJson, interventionsMonth]);

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isTechnician ? 'p-0' : 'p-0 sm:p-4'}`}>
      <div
        className={`bg-white shadow-xl overflow-hidden flex flex-col w-full ${
          isTechnician
            ? 'h-[100svh] max-w-none max-h-none rounded-none'
            : 'h-[100svh] max-w-none max-h-[100svh] rounded-none sm:h-auto sm:max-w-5xl sm:max-h-[90vh] sm:rounded-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-3 py-3 sm:p-4 border-b bg-indigo-700 text-white">
          <div className="min-w-0 flex items-center gap-2">
            <CheckCircle size={24} className="flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 min-w-0">
                <span className="min-w-0 truncate">{isTechnician ? 'Mes interventions' : 'Interventions'}</span>
                {isTechnician && Number(technicianPendingTasksCount || 0) > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                    {Number(technicianPendingTasksCount || 0)}
                  </span>
                )}
                {isViewer && (
                  <span className="bg-white/15 text-white border border-white/20 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                    Lecture seule
                  </span>
                )}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                if (isTechnician && authUser?.id) {
                  const maxSentAt = (Array.isArray(interventions) ? interventions : [])
                    .filter((i) => i && i.status === 'sent' && i.sentAt)
                    .map((i) => String(i.sentAt))
                    .sort()
                    .slice(-1)[0];
                  if (maxSentAt && String(maxSentAt) > String(technicianSeenSentAt || '')) {
                    setTechnicianSeenSentAt(String(maxSentAt));
                    try {
                      const k = `tech_seen_sent_at:${String(authUser.id)}`;
                      localStorage.setItem(k, String(maxSentAt));
                    } catch {
                      // ignore
                    }
                  }
                }
                setShowInterventions(false);
                setInterventionsError('');
                setPlanningAssignments({});
                setCompleteModalOpen(false);
                setCompleteModalIntervention(null);
                setCompleteModalSite(null);
                setCompleteForm({ nhNow: '', doneDate: '' });
                setCompleteFormError('');
                setNhModalOpen(false);
                setNhModalIntervention(null);
                setNhModalSite(null);
                setNhForm({ nhValue: '', readingDate: '' });
                setNhFormError('');
                setNhQuarantineInfo(null);
              }}
              className="hover:bg-indigo-800 p-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {isViewer && (
            <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm mb-4">
              Mode lecture seule : vous pouvez consulter les interventions, sans planifier ni valider.
            </div>
          )}
          {!isTechnician && !isViewer && (isAdmin || isManager) && (
            <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-lg px-3 py-2 text-sm mb-4">
              Console de dispatch : suivez les statuts, déclenchez une intervention manuellement,
              envoyez le mois, ou réassignez/annulez une intervention encore ouverte. La génération
              de fiche (bouton « Fiches » sur un site) crée aussi une intervention envoyée.
            </div>
          )}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            {/* Onglets pour tous les rôles — la console manager en a besoin
                (avant : réservés au technicien → vue manager figée sur "demain"). */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                {(() => {
                  // Compteurs dérivés des MÊMES items que la liste (référentiel unique) —
                  // "Aujourd'hui" inclut les retards (plannedDate <= today, non closes).
                  const { pmItems, vidangeItems } = buildCanonicalItems();

                  const openVid = (x) => !isClosedInterventionStatus(x?.status);
                  const openPm = (p) => !p?.isDone;

                  const vidToday = vidangeItems.filter((v) => (!v.plannedDate || v.plannedDate <= today) && openVid(v));
                  const vidTomorrow = vidangeItems.filter((v) => v.plannedDate === tomorrow && openVid(v));
                  const vidMonth = month
                    ? vidangeItems.filter((v) => String(v?.plannedDate || '').slice(0, 7) === month && openVid(v))
                    : vidangeItems.filter(openVid);

                  const pmToday = pmItems.filter((p) => p.plannedDate <= today && openPm(p));
                  const pmTomorrow = pmItems.filter((p) => p.plannedDate === tomorrow && openPm(p));
                  const pmMonth = month
                    ? pmItems.filter((p) => String(p?.plannedDate || '').slice(0, 7) === month && openPm(p))
                    : pmItems.filter(openPm);

                  const todayCount = vidToday.length + pmToday.length;
                  const tomorrowCount = vidTomorrow.length + pmTomorrow.length;
                  const tomorrowSentCount = vidTomorrow.filter((i) => i.status === 'sent').length;
                  const monthCount = vidMonth.length + pmMonth.length;

                  return (
                    <div className="grid grid-cols-3 gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => setTechnicianInterventionsTab('today')}
                        className={`${
                          technicianInterventionsTab === 'today'
                            ? 'bg-indigo-700 text-white'
                            : 'bg-white text-gray-800 border border-gray-300'
                        } px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                      >
                        Aujourd'hui ({todayCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTechnicianInterventionsTab('tomorrow')}
                        className={`${
                          technicianInterventionsTab === 'tomorrow'
                            ? 'bg-indigo-700 text-white'
                            : 'bg-white text-gray-800 border border-gray-300'
                        } px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                      >
                        Demain ({tomorrowCount}{tomorrowSentCount ? `/${tomorrowSentCount} envoyée(s)` : ''})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTechnicianInterventionsTab('month')}
                        className={`${
                          technicianInterventionsTab === 'month'
                            ? 'bg-indigo-700 text-white'
                            : 'bg-white text-gray-800 border border-gray-300'
                        } px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm w-full whitespace-nowrap`}
                      >
                        Mois ({monthCount})
                      </button>
                    </div>
                  );
                })()}
              </div>

            {!isTechnician && (
              <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3 items-end`}>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-600 mb-1">Mois</span>
                  <input
                    type="month"
                    value={interventionsMonth}
                    onChange={(e) => {
                      setInterventionsMonth(e.target.value);
                      const nextMonth = String(e.target.value || '').trim();
                      loadInterventions(nextMonth, interventionsStatus, interventionsTechnicianUserId);
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-600 mb-1">Statut</span>
                  <select
                    value={interventionsStatus}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      setInterventionsStatus(nextStatus);
                      loadInterventions(interventionsMonth, nextStatus, interventionsTechnicianUserId);
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">Tous</option>
                    <option value="planned">Planifiées</option>
                    <option value="sent">Envoyées</option>
                    <option value="done">Effectuées</option>
                  </select>
                </div>

                {(isAdmin || isManager) && (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600 mb-1">Technicien</span>
                    <select
                      value={interventionsTechnicianUserId}
                      onChange={(e) => {
                        const nextTechId = e.target.value;
                        setInterventionsTechnicianUserId(nextTechId);
                        loadInterventions(interventionsMonth, interventionsStatus, nextTechId);
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="all">Tous</option>
                      {(Array.isArray(users) ? users : [])
                        .filter((u) => u && u.role === 'technician')
                        .filter((u) => (zoneTechFilter ? String(u?.zone || '').trim() === zoneTechFilter : true))
                        .slice()
                        .sort((a, b) =>
                          String(a.technicianName || a.email || '').localeCompare(
                            String(b.technicianName || b.email || '')
                          )
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.technicianName || u.email}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {canExportExcel && (
                  <div className="flex flex-col w-full">
                    <span className="text-xs text-gray-600 mb-1 invisible">Actions</span>
                    <button
                      type="button"
                      onClick={handleExportInterventionsExcel}
                      className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold text-sm flex items-center justify-center gap-2 w-full"
                      disabled={exportBusy || interventionsBusy || interventions.length === 0}
                    >
                      <Download size={18} />
                      Exporter Excel
                    </button>
                  </div>
                )}

                {showZoneFilter && (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600 mb-1">Zone</span>
                    <select
                      value={interventionsZone}
                      onChange={(e) => {
                        const next = e.target.value;
                        setInterventionsZone(next);
                        loadInterventions(interventionsMonth, interventionsStatus, interventionsTechnicianUserId);
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {zones.map((z) => (
                        <option key={z} value={z}>
                          {z === 'ALL' ? 'Toutes' : z}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {canDispatch && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !dispatchOpen;
                      setDispatchOpen(next);
                      if (next && !dispatchSiteId && dispatchableSites.length) {
                        onDispatchSiteChange(String(dispatchableSites[0]?.id || ''));
                      }
                    }}
                    className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-xs sm:text-sm flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Déclencher une intervention
                  </button>
                  <button
                    type="button"
                    onClick={sendMonthBulk}
                    disabled={sendMonthBusy || interventionsBusy}
                    className="bg-sky-600 text-white px-3 py-2 rounded-lg hover:bg-sky-700 font-semibold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-60"
                    title="Publier (sent) toutes les vidanges ouvertes du filtre courant"
                  >
                    <Download size={16} className="rotate-180" />
                    Envoyer le mois aux techniciens
                  </button>
                  <button
                    type="button"
                    onClick={cleanStale}
                    disabled={cleanStaleBusy || sendMonthBusy || interventionsBusy}
                    className="bg-rose-50 text-rose-700 border border-rose-300 px-3 py-2 rounded-lg hover:bg-rose-100 font-semibold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-60"
                    title="Clôturer en 'non_fait' les interventions ouvertes datées d'avant la campagne courante"
                  >
                    <Trash2 size={16} />
                    Nettoyer anciennes campagnes
                  </button>
                  <button
                    type="button"
                    onClick={cleanOrphanFiches}
                    disabled={cleanFichesBusy || cleanStaleBusy || sendMonthBusy || interventionsBusy}
                    className="bg-amber-50 text-amber-700 border border-amber-300 px-3 py-2 rounded-lg hover:bg-amber-100 font-semibold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-60"
                    title="Annuler les fiches restées ouvertes alors que la vidange est déjà terminée (tickets orphelins)"
                  >
                    <Trash2 size={16} />
                    Nettoyer fiches orphelines
                  </button>
                </div>

                {dispatchOpen && (
                  <div className="mt-3 bg-white border border-indigo-200 rounded-lg p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 mb-1">Site</span>
                        <select
                          value={dispatchSiteId}
                          onChange={(e) => onDispatchSiteChange(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">— Choisir —</option>
                          {dispatchableSites.map((s) => (
                            <option key={String(s.id)} value={String(s.id)}>
                              {s.nameSite || s.idSite || s.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 mb-1">Type</span>
                        <select
                          value={dispatchEpvType}
                          onChange={(e) => onDispatchEpvChange(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="EPV1">EPV1</option>
                          <option value="EPV2">EPV2</option>
                          <option value="EPV3">EPV3</option>
                        </select>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 mb-1">Date prévue</span>
                        <input
                          type="date"
                          value={dispatchDate}
                          onChange={(e) => setDispatchDate(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600 mb-1">Technicien</span>
                        <select
                          value={dispatchTechUserId}
                          onChange={(e) => setDispatchTechUserId(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">— Technicien du site —</option>
                          {technicianOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.technicianName || u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={submitDispatch}
                        disabled={dispatchBusy || !dispatchSiteId || !dispatchDate}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold text-sm disabled:opacity-60"
                      >
                        Envoyer au technicien
                      </button>
                      <button
                        type="button"
                        onClick={() => setDispatchOpen(false)}
                        className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold text-sm"
                      >
                        Fermer
                      </button>
                      <span className="text-[11px] text-gray-500">
                        L'intervention arrive directement dans « Mes interventions » du technicien
                        (statut envoyée). Idempotent : aucun doublon si déjà déclenchée.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {interventionsError && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                {interventionsError}
              </div>
            )}
          </div>

          {(() => {
            const statusRank = (st) => {
              const s = String(st || '');
              if (s === 'sent') return 0;
              if (s === 'planned') return 1;
              if (s === 'done') return 2;
              return 3;
            };

            const list = interventionsScoped
              .slice()
              .filter((i) => {
                const sid = String(i?.siteId || '').trim();
                if (!sid) return false;
                const s = siteById.get(sid) || null;
                return !(s && s.retired);
              });

            const pendingEpv23BySiteId = (() => {
              const s = new Set();
              list.forEach((i) => {
                if (!i) return;
                if (String(i?.kind || '') === 'PM') return;
                const st = String(i?.status || '');
                if (st === 'done') return;
                const t = String(i?.epvType || '').trim().toUpperCase();
                if (t !== 'EPV2' && t !== 'EPV3') return;
                const sid = String(i?.siteId || '').trim();
                if (sid) s.add(sid);
              });
              return s;
            })();

            const { pmItems, vidangeItems } = buildCanonicalItems();

            const findLinkedVidangeForPm = (p) => {
              if (!p || !p.siteId || !p.plannedDate) return null;
              if (p.maintenanceType !== 'fullpmwo') return null;
              const candidates = list
                .filter((i) => String(i?.epvType || '') === 'EPV1')
                .filter((i) => String(i?.siteId || '') === String(p.siteId))
                .filter((i) => i?.plannedDate);
              let best = null;
              let bestAbs = null;
              candidates.forEach((i) => {
                const diff = daysBetween(p.plannedDate, i.plannedDate);
                if (diff === null) return;
                const abs = Math.abs(diff);
                const ok = abs === 0 || (abs >= 2 && abs <= 6);
                if (!ok) return;
                if (bestAbs === null || abs < bestAbs) {
                  bestAbs = abs;
                  best = i;
                }
              });
              return best;
            };

            const pmSentLabel = (p) => {
              if (!p) return '';
              if (p.maintenanceType === 'dgservice') return 'Vidange Simple';
              if (p.maintenanceType !== 'fullpmwo') return 'PM';
              const linked = findLinkedVidangeForPm(p);
              if (linked) return 'PM+Vidange';
              return 'PM Simple';
            };

            const pmStatusDisplay = (p) => {
              const st = String(p?.status || '').trim().toUpperCase();
              if (
                st === 'EFFECTUEE' ||
                st === 'DONE' ||
                st === 'CLOSED' ||
                st === 'CLOSED COMPLETE' ||
                st === 'CLOSED_COMPLETE' ||
                st === 'CLOSEDCOMPLETE' ||
                st === 'AWAITING CLOSURE' ||
                st === 'AWAITING_CLOSURE'
              ) {
                return { label: 'EFFECTUEE', date: p.closedAt || p.plannedDate };
              }
              if (st === 'REPROGRAMMEE' || st === 'REPROGRAMMED') {
                return { label: 'REPROGRAMMEE', date: p.reprogrammationDate || p.plannedDate };
              }
              if (st === 'ASSIGNED' || st === 'SENT' || st === 'PLANNED') {
                return { label: 'ASSIGNED', date: p.scheduledWoDate || p.plannedDate };
              }
              return { label: st || 'ASSIGNED', date: p.plannedDate };
            };

            const isPmReprogrammed = (p) => {
              const st = String(p?.status || '').trim().toUpperCase();
              return st === 'REPROGRAMMEE' || st === 'REPROGRAMMED';
            };

            const ymdToDate = (ymd) => {
              const s = String(ymd || '').slice(0, 10);
              const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (!m) return null;
              return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
            };

            const daysBetween = (aYmd, bYmd) => {
              const a = ymdToDate(aYmd);
              const b = ymdToDate(bYmd);
              if (!a || !b) return null;
              const ms = b.getTime() - a.getTime();
              return Math.round(ms / (24 * 60 * 60 * 1000));
            };

            // Vidanges = événements EPV recalculés + records orphelins (référentiel unique).
            const vidangeByStatus = (() => {
              const f = String(interventionsStatus || 'all');
              if (!f || f === 'all') return vidangeItems;
              if (f === 'done') return vidangeItems.filter((x) => String(x?.status || '') === 'done');
              if (f === 'sent') return vidangeItems.filter((x) => String(x?.status || '') === 'sent');
              if (f === 'planned') return vidangeItems.filter((x) => String(x?.status || '') !== 'done' && String(x?.status || '') !== 'sent');
              return vidangeItems;
            })();

            // Aujourd'hui : retards inclus (plannedDate <= today, non closes) — plus
            // aucune vidange en retard ne peut être "loupée" entre les onglets.
            const vidangesFiltered =
              technicianInterventionsTab === 'today'
                ? vidangeByStatus.filter((i) => (!i.plannedDate || i.plannedDate <= today) && !isClosedInterventionStatus(i?.status))
                : technicianInterventionsTab === 'tomorrow'
                  ? vidangeByStatus.filter((i) => i.plannedDate === tomorrow && !isClosedInterventionStatus(i?.status))
                  : month
                    ? vidangeByStatus.filter((i) => String(i?.plannedDate || '').slice(0, 7) === month)
                    : vidangeByStatus;

            const pmFiltered =
              technicianInterventionsTab === 'today'
                ? pmItems.filter((p) => p.plannedDate <= today && !isPmDone(p))
                : technicianInterventionsTab === 'tomorrow'
                  ? pmItems.filter((p) => p.plannedDate === tomorrow && !isPmDone(p))
                  : month
                    ? pmItems.filter((p) => String(p?.plannedDate || '').slice(0, 7) === month)
                    : pmItems;

            const pmFilteredByStatus = (() => {
              const f = String(interventionsStatus || 'all');
              if (!f || f === 'all') return pmFiltered;
              if (f === 'done') return pmFiltered.filter((p) => isPmDone(p));
              if (f === 'sent') return pmFiltered.filter((p) => String(p?.status || '').trim().toUpperCase() === 'SENT');
              if (f === 'planned') return pmFiltered.filter((p) => !isPmDone(p) && String(p?.status || '').trim().toUpperCase() !== 'SENT');
              return pmFiltered;
            })();

            const items = [...pmFilteredByStatus, ...vidangesFiltered]
              .slice()
              .sort((a, b) => {
                const isDone = (x) => {
                  if (!x) return false;
                  if (String(x?.kind || '') === 'PM') {
                    return isPmDone(x);
                  }
                  return String(x?.status || '') === 'done';
                };

                if (technicianInterventionsTab === 'month') {
                  const da = isDone(a) ? 1 : 0;
                  const db = isDone(b) ? 1 : 0;
                  if (da !== db) return da - db;
                }
                const sa = String(a?.kind || '') === 'PM' ? siteById.get(String(a?.siteId || '')) || null : siteById.get(String(a?.siteId || '')) || null;
                const sb = String(b?.kind || '') === 'PM' ? siteById.get(String(b?.siteId || '')) || null : siteById.get(String(b?.siteId || '')) || null;
                const da = String(a?.kind || '') === 'PM'
                  ? String(a?.plannedDate || '')
                  : resolveVidangePlannedDate(a, sa, ymdShiftForWorkdays);
                const db = String(b?.kind || '') === 'PM'
                  ? String(b?.plannedDate || '')
                  : resolveVidangePlannedDate(b, sb, ymdShiftForWorkdays);
                const c = da.localeCompare(db);
                if (c !== 0) return c;
                const ra = statusRank(a?.status);
                const rb = statusRank(b?.status);
                if (ra !== rb) return ra - rb;
                return String(a?.siteId || '').localeCompare(String(b?.siteId || ''));
              });

            const renderItem = (it) => {
              const isPm = String(it?.kind || '') === 'PM';
              const site = siteById.get(String(it?.siteId || '')) || null;

              if (isPm) {
                const info = pmStatusDisplay(it);
                const label = pmSentLabel(it);
                const pmDone = isPmDone(it);
                const pmReprog = isPmReprogrammed(it);
                const linkedVidange = findLinkedVidangeForPm(it);
                const linkedVidangeOverdue =
                  linkedVidange &&
                  String(linkedVidange?.status || '') !== 'done' &&
                  String(linkedVidange?.plannedDate || '').slice(0, 10) < today;
                const siteId = String(it?.siteId || '').trim();
                const focusVidange = Boolean(linkedVidangeOverdue) || pendingEpv23BySiteId.has(siteId);
                const focusPm = Boolean(linkedVidange) && !focusVidange;
                const canShowPmNhOnly = pmDone && !pendingEpv23BySiteId.has(siteId);
                const showPmNhOnly = !focusPm && canShowPmNhOnly;
                return (
                  <div
                    key={`pm:${it.id}`}
                    className={`border rounded-lg p-3 relative ${
                      pmDone ? 'border-green-200 bg-green-50' : pmReprog ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
                    }`}
                  >
                    {pmDone && (
                      <div className="absolute top-2 right-2 text-green-700" title="Effectuée">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-extrabold px-2 py-1 rounded border ${
                              pmDone
                                ? 'bg-green-100 text-green-900 border-green-200'
                                : pmReprog
                                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            PM
                          </span>
                          <div className="font-semibold text-gray-800 truncate">
                            {site?.nameSite || it.siteId}
                            {it?.maintenanceType === 'fullpmwo' ? ' - FullPMWO' : it?.maintenanceType === 'dgservice' ? ' - DG-Service' : ''}
                          </div>
                        </div>
                        {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                        <div className="text-xs text-gray-600 mt-1">
                          Statut : {info.label} - {formatDate(info.date)}
                        </div>
                        {pmReprog && it?.reprogrammationDate && (
                          <div className="text-xs text-amber-900 mt-1 font-semibold">
                            Nouvelle date : {formatDate(it.reprogrammationDate)}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 rounded border font-semibold bg-slate-50 text-slate-800 border-slate-200">
                            Ticket: {String(it?.pmNumber || '').trim() ? `#${String(it.pmNumber).trim()}` : '-'}
                          </span>
                          {label ? (
                            <span className="text-xs px-2 py-1 rounded border font-semibold bg-sky-50 text-sky-800 border-sky-200">
                              sent • {label}
                            </span>
                          ) : null}
                        </div>

                        {!pmDone && (isAdmin || isManager) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const ok = window.confirm(
                                    `Révoquer ce PM envoyé ?\n\nTicket: ${String(it?.pmNumber || '')}\nSite: ${site?.nameSite || it.siteId || ''}\nDate: ${formatDate(String(it?.plannedDate || ''))}`
                                  );
                                  if (!ok) return;
                                  const op = startOperation(`Révocation du PM ${String(it?.pmNumber || '')}…`);
                                  try {
                                    await apiFetchJson('/api/pm-assignments', {
                                      method: 'DELETE',
                                      body: JSON.stringify({ id: it?.id || null, pmNumber: it?.pmNumber || null })
                                    });
                                    await loadInterventions();
                                  } finally {
                                    op.dismiss();
                                  }
                                  alert('✅ PM révoqué.');
                                } catch (e) {
                                  alert(e?.message || 'Erreur serveur.');
                                }
                              }}
                              className="bg-red-600 text-white px-2 py-1.5 rounded-lg hover:bg-red-700 font-semibold text-xs"
                              title="Supprimer PM envoyée/plannifiée"
                            >
                              Révoquer
                            </button>
                          </div>
                        )}

                        {(isTechnician && site && (focusPm || showPmNhOnly)) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {focusPm && !site?.retired && !isClosedInterventionStatus(linkedVidange?.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompleteModalIntervention(linkedVidange);
                                  setCompleteModalSite(site);
                                  const raw = Math.max(0, Number(site?.nh2A || 0));
                                  setCompleteForm({ nhNow: String(Math.trunc(raw)), doneDate: today });
                                  setCompleteFormError('');
                                  setCompleteModalOpen(true);
                                }}
                                className="bg-green-600 text-white px-2 py-1.5 rounded-lg hover:bg-green-700 font-semibold text-xs"
                              >
                                Marquer effectuée
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              const st = String(it?.status || '');
              const effectivePlannedDate = String(it?.plannedDate || '').slice(0, 10);
              const isOverdue = !isClosedInterventionStatus(st) && String(effectivePlannedDate || '') < today;

              const linkedPm = pmItems.find((p) => {
                if (!p || p.maintenanceType !== 'fullpmwo') return false;
                const link = findLinkedVidangeForPm(p);
                return link && String(link?.id) === String(it?.intervention?.id || it?.id);
              });
              const movedToPm = Boolean(linkedPm);
              const siteId = String(it?.siteId || '').trim();
              const focusVidange = Boolean(isOverdue) || pendingEpv23BySiteId.has(siteId);

              if (site?.retired) return null;
              if (movedToPm && !focusVidange) return null;
              const statusColor =
                st === 'done'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : st === 'non_fait'
                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                  : st === 'sent'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200';

              const cardTone =
                st === 'done'
                  ? 'border-green-200 bg-green-50'
                  : st === 'non_fait'
                    ? 'border-gray-200 bg-gray-50'
                  : st === 'sent'
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200';

              return (
                <div
                  key={`vid:${it.id}`}
                  className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${cardTone} relative`}
                >
                  {st === 'done' && (
                    <div className="absolute top-2 right-2 text-green-700" title="Effectuée">
                      <CheckCircle2 size={18} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold px-2 py-1 rounded bg-sky-50 text-sky-800 border border-sky-200">
                        VIDANGES
                      </span>
                      {it?.orphan && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200"
                          title="Intervention persistée sans date EPV correspondante recalculée"
                        >
                          HORS EPV
                        </span>
                      )}
                      <div className="font-semibold text-gray-800 truncate">{site?.nameSite || it.siteId}</div>
                    </div>
                    {site?.idSite && <div className="text-xs text-gray-600">ID: {site.idSite}</div>}
                    <div className="text-xs text-gray-600">
                      {it.epvType} • {formatDate(effectivePlannedDate)} • {it.technicianName}
                    </div>
                    {st === 'non_fait' && it?.closeReason && (
                      <div className="text-xs text-gray-600 mt-1 font-semibold">
                        Motif : {String(it.closeReason)}
                      </div>
                    )}
                    {st === 'done' && it?.doneByEmail && String(it.doneByRole || '') !== 'technician' && (
                      <div className="text-[11px] text-indigo-700 mt-1 font-semibold">
                        Clôturée par {it.doneByEmail} ({it.doneByRole})
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded border font-semibold ${statusColor}`}>{st}</span>
                    {isOverdue && (
                      <span className="text-xs px-2 py-1 rounded border font-semibold bg-red-50 text-red-800 border-red-200">
                        EN RETARD
                      </span>
                    )}

                    {!(!focusVidange && movedToPm) && !isClosedInterventionStatus(st) && isTechnician && (
                      <button
                        onClick={() => {
                          setCompleteModalIntervention(it?.intervention || it);
                          setCompleteModalSite(site);
                          const raw = Math.max(0, Number(site?.nh2A || 0));
                          setCompleteForm({ nhNow: String(Math.trunc(raw)), doneDate: today });
                          setCompleteFormError('');
                          setCompleteModalOpen(true);
                        }}
                        className="bg-green-600 text-white px-2 py-1.5 rounded-lg hover:bg-green-700 font-semibold text-xs"
                      >
                        Marquer effectuée
                      </button>
                    )}
                  </div>

                  {canDispatch && !isClosedInterventionStatus(st) && (
                    <div className="mt-2 pt-2 border-t border-gray-200/70 flex flex-wrap items-center gap-2">
                      {(st === 'planned' || !it?.intervention?.id) && (
                        <button
                          type="button"
                          onClick={() => sendVidangeItem(it, site)}
                          disabled={rowBusyId === String(it?.id)}
                          className="bg-sky-600 text-white px-2 py-1.5 rounded-lg hover:bg-sky-700 font-semibold text-xs disabled:opacity-60"
                          title={it?.intervention?.id ? 'Publier au technicien (planned → sent)' : 'Créer et envoyer au technicien'}
                        >
                          {it?.intervention?.id ? 'Envoyer' : 'Envoyer au technicien'}
                        </button>
                      )}
                      {it?.intervention?.id && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setReassignForId(
                                reassignForId === String(it.intervention.id)
                                  ? ''
                                  : String(it.intervention.id)
                              );
                              setReassignTechUserId('');
                            }}
                            disabled={rowBusyId === String(it?.id)}
                            className="bg-violet-600 text-white px-2 py-1.5 rounded-lg hover:bg-violet-700 font-semibold text-xs disabled:opacity-60"
                          >
                            Réassigner
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelIntervention(it, site)}
                            disabled={rowBusyId === String(it?.id)}
                            className="bg-red-600 text-white px-2 py-1.5 rounded-lg hover:bg-red-700 font-semibold text-xs disabled:opacity-60"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {canDispatch && reassignForId === String(it?.intervention?.id || '') && it?.intervention?.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-2 py-2">
                      <select
                        value={reassignTechUserId}
                        onChange={(e) => setReassignTechUserId(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[10rem]"
                      >
                        <option value="">— Nouveau technicien —</option>
                        {technicianOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.technicianName || u.email}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => submitReassign(it)}
                        disabled={!reassignTechUserId || rowBusyId === String(it?.id)}
                        className="bg-violet-700 text-white px-2 py-1.5 rounded-lg hover:bg-violet-800 font-semibold text-xs disabled:opacity-60"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        onClick={() => setReassignForId('')}
                        className="bg-gray-200 text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-300 font-semibold text-xs"
                      >
                        Fermer
                      </button>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div
                className="space-y-3"
                key={`tech_tab:${String(technicianInterventionsTab)}:${String(interventionsMonth || '')}:${String(
                  interventionsUiRev || 0
                )}`}
              >
                {pmError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                    {pmError}
                  </div>
                )}
                {pmBusy && (
                  <div className="text-xs text-gray-600">Chargement PM…</div>
                )}
                {items.length === 0 ? (
                  <div className="text-sm text-gray-600">Aucune intervention.</div>
                ) : technicianInterventionsTab !== 'month' ? (
                  <div className="space-y-2">
                    {items.map((it) => {
                      const el = renderItem(it);
                      if (!el) return null;
                      return (
                        <React.Fragment key={`row:${String(it?.kind || '')}:${String(it?.id || '')}`}>
                          {el}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.reduce(
                      (acc, it) => {
                        const el = renderItem(it);
                        if (!el) return acc;

                        const kind = String(it?.kind || '');
                        const site = siteById.get(String(it?.siteId || '')) || null;
                        const d =
                          kind === 'PM'
                            ? String(it?.plannedDate || '').slice(0, 10)
                            : resolveVidangePlannedDate(it, site, ymdShiftForWorkdays);

                        const lastDate = acc._lastDate || '';
                        if (d && d !== lastDate) {
                          acc._lastDate = d;
                          acc.nodes.push(
                            <div
                              key={`month_header:${d}`}
                              className="mt-4 mb-2 text-sm font-extrabold text-slate-800 bg-slate-100 border border-slate-200 px-4 py-3 rounded-lg"
                            >
                              {formatDate(d)}
                            </div>
                          );
                        }

                        acc.nodes.push(
                          <React.Fragment key={`month_row:${kind}:${String(it?.id || '')}:${d}`}>
                            {el}
                          </React.Fragment>
                        );

                        return acc;
                      },
                      { nodes: [], _lastDate: '' }
                    ).nodes}
                  </div>
                )}
              </div>
            );
          })()}
          <CompleteInterventionModal
            open={completeModalOpen}
            completeModalSite={completeModalSite}
            completeModalIntervention={completeModalIntervention}
            formatDate={formatDate}
            completeForm={completeForm}
            onChangeDoneDate={(v) => {
              setCompleteForm((prev) => ({ ...(prev || {}), doneDate: v }));
              setCompleteFormError('');
            }}
            onChangeNhNow={(v) => {
              setCompleteForm((prev) => ({ ...(prev || {}), nhNow: v }));
              setCompleteFormError('');
            }}
            completeFormError={completeFormError}
            isAdmin={isAdmin}
            onClose={() => {
              setCompleteModalOpen(false);
              setCompleteModalIntervention(null);
              setCompleteModalSite(null);
              setCompleteForm({ nhNow: '', doneDate: '' });
              setCompleteFormError('');
            }}
            onCancel={() => {
              setCompleteModalOpen(false);
              setCompleteModalIntervention(null);
              setCompleteModalSite(null);
              setCompleteForm({ nhNow: '', doneDate: '' });
              setCompleteFormError('');
            }}
            onConfirm={async () => {
              const interventionId = completeModalIntervention?.id;
              if (!interventionId) {
                setCompleteFormError('Intervention introuvable.');
                return;
              }
              const doneDate = String(completeForm?.doneDate || '').trim();
              const nhNow = Number(String(completeForm?.nhNow || '').trim());
              if (!/^\d{4}-\d{2}-\d{2}$/.test(doneDate)) {
                setCompleteFormError('Date invalide.');
                return;
              }
              if (!Number.isFinite(nhNow)) {
                setCompleteFormError('Veuillez saisir un compteur (NH) valide.');
                return;
              }
              try {
                await handleCompleteIntervention(interventionId, {
                  nhNow,
                  doneDate,
                  // Contexte de résolution si l'événement est synthétisé (pas de record)
                  siteId: completeModalIntervention?.siteId || completeModalSite?.id || '',
                  epvType: completeModalIntervention?.epvType || '',
                  plannedDate: completeModalIntervention?.plannedDate || '',
                  technicianName:
                    completeModalIntervention?.technicianName || completeModalSite?.technician || ''
                });
                setCompleteModalOpen(false);
                setCompleteModalIntervention(null);
                setCompleteModalSite(null);
                setCompleteForm({ nhNow: '', doneDate: '' });
                setCompleteFormError('');
              } catch (e) {
                // handled in handler
              }
            }}
          />

          <NhUpdateModal
            open={nhModalOpen}
            nhModalSite={nhModalSite}
            nhModalIntervention={nhModalIntervention}
            nhForm={nhForm}
            onChangeReadingDate={(v) => {
              setNhForm((prev) => ({ ...(prev || {}), readingDate: v }));
              setNhFormError('');
              setNhQuarantineInfo(null);
            }}
            onChangeNhValue={(v) => {
              setNhForm((prev) => ({ ...(prev || {}), nhValue: v }));
              setNhFormError('');
              setNhQuarantineInfo(null);
            }}
            nhFormError={nhFormError}
            isAdmin={isAdmin}
            onClose={() => {
              setNhModalOpen(false);
              setNhModalIntervention(null);
              setNhModalSite(null);
              setNhForm({ nhValue: '', readingDate: '' });
              setNhFormError('');
              setNhQuarantineInfo(null);
            }}
            onCancel={() => {
              setNhModalOpen(false);
              setNhModalIntervention(null);
              setNhModalSite(null);
              setNhForm({ nhValue: '', readingDate: '' });
              setNhFormError('');
              setNhQuarantineInfo(null);
            }}
            quarantineInfo={nhQuarantineInfo}
            onOpenQuarantine={onOpenQuarantine}
            onConfirm={async () => {
              const siteId = nhModalSite?.id;
              if (!siteId) {
                setNhFormError('Site introuvable.');
                return;
              }
              const readingDate = String(nhForm?.readingDate || '').trim();
              const nhValue = Number(String(nhForm?.nhValue || '').trim());
              if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
                setNhFormError('Date invalide.');
                return;
              }
              if (!Number.isFinite(nhValue) || nhValue < 0) {
                setNhFormError('Veuillez saisir un NH valide.');
                return;
              }
              const op = startOperation(`Mise à jour NH — ${nhModalSite?.nameSite || ''}…`, `NH2 A: ${nhValue} — ${readingDate}`);
              try {
                await apiFetchJson(`/api/sites/${siteId}/nh`, {
                  method: 'POST',
                  body: JSON.stringify({ readingDate, nhValue })
                });
                op.update({ detail: 'Rechargement des données…' });
                await loadData();
                await loadInterventions();
                if (typeof bumpInterventionsUiRev === 'function') bumpInterventionsUiRev();
                op.dismiss();
                alert('✅ NH mis à jour.');
                setNhModalOpen(false);
                setNhModalIntervention(null);
                setNhModalSite(null);
                setNhForm({ nhValue: '', readingDate: '' });
                setNhFormError('');
                setNhQuarantineInfo(null);
              } catch (e) {
                op.dismiss();
                if (e?.data?.quarantined) {
                  setNhQuarantineInfo({ reason: e.data.reason, quarantineId: e.data.quarantineId, message: e.message });
                  setNhFormError('');
                } else {
                  setNhFormError(e?.message || 'Erreur serveur.');
                }
              }
            }}
          />
        </div>

        <div className={`p-4 border-t bg-white ${isAdmin ? 'flex flex-col sm:flex-row sm:justify-end gap-2' : 'flex justify-end'}`}>
          <button
            onClick={() => {
              setShowInterventions(false);
              setInterventionsError('');
              setPlanningAssignments({});
              setCompleteModalOpen(false);
              setCompleteModalIntervention(null);
              setCompleteModalSite(null);
              setCompleteForm({ nhNow: '', doneDate: '' });
              setCompleteFormError('');
              setNhModalOpen(false);
              setNhModalIntervention(null);
              setNhModalSite(null);
              setNhForm({ nhValue: '', readingDate: '' });
              setNhFormError('');
            }}
            className={`bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold ${isAdmin ? 'w-full sm:w-auto' : ''}`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterventionsModal;
