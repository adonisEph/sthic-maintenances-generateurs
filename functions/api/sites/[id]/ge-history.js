import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../../_utils/http.js';
import { effectiveTechnicianName, technicianMatches } from '../../_utils/nhCoherence.js';

function digitsOnly(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d;
}

function vidangeLabel(groupe, kva) {
  const g = String(groupe || '').trim();
  const k = String(kva || '').trim();
  const kvaLabel = k ? (/kva/i.test(k) ? k : `${k} KVA`) : '';
  return `VIDANGE DU GE ${[g, kvaLabel].filter(Boolean).join(' ')}`.trim();
}

function inWindow(dateStr, kind, dep, allDeps) {
  const s = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const inst = String(dep.installed_at || '').slice(0, 10) || null;
  const rem = String(dep.removed_at || '').slice(0, 10) || null;
  if (inst && s < inst) return false;
  if (rem && s > rem) return false;
  // Une dépose datée du jour de pose = fin de la fiche PRÉCÉDENTE.
  if (inst && s === inst && kind === 'depose') return false;
  // Une pose datée du jour de dépose = ouverture de la fiche SUIVANTE.
  if (rem && s === rem && kind === 'pose') return false;
  // Jour de bascule : les lignes ordinaires restent sur la fiche qui se ferme.
  if (
    inst && s === inst && kind !== 'pose' && kind !== 'depose' &&
    (allDeps || []).some((d2) => d2 !== dep && String(d2.removed_at || '').slice(0, 10) === s)
  ) return false;
  return true;
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool' && role !== 'technician') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const siteId = String(params?.id || '').trim();
    if (!siteId) return json({ error: 'Site requis.' }, { status: 400 });

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    if (!isSuperAdmin(data) && role !== 'technician' && role !== 'manager_bzv_pool') {
      if (String(site.zone || 'BZV/POOL') !== userZone(data)) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }
    if (role === 'technician') {
      const techName = await effectiveTechnicianName(env, data);
      if (!technicianMatches(site?.technician, techName)) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const deps = (
      await env.DB.prepare(
        'SELECT * FROM ge_deployments WHERE site_id = ? ORDER BY (installed_at IS NULL), installed_at, created_at'
      ).bind(siteId).all()
    ).results || [];

    const deployments = deps.length
      ? deps
      : [{
          id: null,
          site_id: siteId,
          groupe: site.generateur || '',
          kva: site.capacite || '',
          serie: '',
          installed_at: null,
          removed_at: null,
          source: 'derived',
          virtual: true
        }];

    // Tous les déploiements sont archivés (GE passés saisis manuellement) :
    // on conserve une fiche virtuelle « GE actif » déduite du site, sinon les
    // vidanges/travaux actuels n'auraient plus de fiche où tomber. Sa fenêtre
    // démarre à la dernière dépose connue.
    if (!deployments.some((d) => !d.removed_at)) {
      const lastRemoved = deployments
        .map((d) => String(d.removed_at || '').slice(0, 10))
        .filter(Boolean)
        .sort()
        .pop() || null;
      deployments.push({
        id: null,
        site_id: siteId,
        groupe: site.generateur || '',
        kva: site.capacite || '',
        serie: '',
        installed_at: lastRemoved,
        removed_at: null,
        source: 'derived',
        virtual: true
      });
    }

    const fiches = (
      await env.DB.prepare(
        `SELECT id, ticket_number, date_completed, nh_now, created_at
         FROM fiche_history
         WHERE site_id = ? AND status = 'Effectuée' AND date_completed IS NOT NULL
         ORDER BY date_completed, created_at`
      ).bind(siteId).all()
    ).results || [];

    const events = (
      await env.DB.prepare(
        'SELECT * FROM ge_history_events WHERE site_id = ? ORDER BY event_date, created_at'
      ).bind(siteId).all()
    ).results || [];

    const readings = (
      await env.DB.prepare(
        'SELECT reading_date, nh_value, source, created_at FROM nh_readings WHERE site_id = ? ORDER BY reading_date, created_at'
      ).bind(siteId).all()
    ).results || [];

    const out = deployments.map((dep, i) => {
      const groupe = dep.groupe || site.generateur || '';
      const kva = dep.kva || site.capacite || '';
      const journal = [];

      for (const f of fiches) {
        if (!inWindow(f.date_completed, 'vidange', dep, deployments)) continue;
        journal.push({
          kind: 'vidange',
          date: String(f.date_completed).slice(0, 10),
          sortTs: String(f.created_at || ''),
          wo: digitsOnly(f.ticket_number),
          ticket: f.ticket_number || '',
          description: vidangeLabel(groupe, kva),
          runHours: f.nh_now,
          ficheId: f.id,
          editable: false
        });
      }

      for (const e of events) {
        if (!inWindow(e.event_date, e.kind || 'curatif', dep, deployments)) continue;
        journal.push({
          kind: e.kind || 'curatif',
          date: String(e.event_date).slice(0, 10),
          sortTs: String(e.created_at || ''),
          wo: digitsOnly(e.wo_number) || String(e.wo_number || ''),
          description: e.description || '',
          runHours: e.run_hours,
          eventId: e.id,
          source: e.source || '',
          editable: true
        });
      }

      journal.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.sortTs < b.sortTs ? -1 : a.sortTs > b.sortTs ? 1 : 0;
      });

      const siteReadings = readings
        .filter((r) => inWindow(r.reading_date, 'releve', dep, deployments))
        .map((r) => r.nh_value);

      // Fiche pré-app : aucun relevé compteur dans l'app → la colonne de
      // gauche est dérivée des N.Heures saisis sur les interventions.
      const readingsDerived = !siteReadings.length;
      const effectiveReadings = readingsDerived
        ? journal
            .map((j) => (j.runHours === null || j.runHours === undefined ? null : Number(j.runHours)))
            .filter((n) => Number.isFinite(n))
        : siteReadings;

      return {
        id: dep.id,
        index: i + 1,
        virtual: !!dep.virtual,
        active: !dep.removed_at,
        groupe,
        kva,
        serie: dep.serie || '',
        installedAt: dep.installed_at || null,
        removedAt: dep.removed_at || null,
        source: dep.source || '',
        journal,
        readings: effectiveReadings,
        readingsDerived: readingsDerived && effectiveReadings.length > 0
      };
    });

    // Orphelins : lignes dont la date ne tombe dans AUCUNE fenêtre de
    // déploiement (typiquement un import pré-app avant création des fiches
    // archivées). On les remonte pour que la modale puisse les signaler —
    // sinon elles seraient stockées mais invisibles.
    const orphanEvents = events
      .filter((e) => !deployments.some((d) => inWindow(e.event_date, e.kind || 'curatif', d, deployments)))
      .map((e) => ({
        kind: e.kind || 'curatif',
        date: String(e.event_date || '').slice(0, 10),
        wo: digitsOnly(e.wo_number) || String(e.wo_number || ''),
        description: e.description || ''
      }));
    const orphanFiches = fiches
      .filter((f) => !deployments.some((d) => inWindow(f.date_completed, 'vidange', d, deployments)))
      .map((f) => ({
        kind: 'vidange',
        date: String(f.date_completed || '').slice(0, 10),
        wo: digitsOnly(f.ticket_number),
        description: 'Vidange app'
      }));
    const orphans = [...orphanEvents, ...orphanFiches].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return json({
      ok: true,
      orphans,
      site: {
        id: site.id,
        zone: site.zone || 'BZV/POOL',
        nameSite: site.name_site,
        idSite: site.id_site,
        technician: site.technician,
        generateur: site.generateur,
        capacite: site.capacite,
        retired: !!site.retired
      },
      deployments: out
    });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
