import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';
import { isGeRelatedWork, isGeReplacement, parseReplacementGe, parseReplacedGe } from '../../_utils/geWorkFilter.js';

const VALID_KINDS = new Set(['curatif', 'pose', 'depose', 'vidange']);

function digitsOnly(v) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeDate(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

function normalizeKind(v, description) {
  const k = String(v || '').trim().toLowerCase();
  if (VALID_KINDS.has(k)) return k;
  const d = String(description || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // POSE/DEPOSE n'ouvrent/ferment une fiche que dans un contexte GE —
  // « Pose panneau de signalisation », « Pose armoire »… ne sont PAS des
  // déploiements de générateur.
  const geWord = /\b(GE|GENERATEUR|ELECTROGENE|GROUPE\s+ELECTRO|GENSET)\b/;
  if (/\bDEPOSE\b/.test(d) && geWord.test(d)) return 'depose';
  if ((/\bPOSE\b/.test(d) && geWord.test(d)) || isGeReplacement(d)) return 'pose';
  if (/VIDANGE/.test(d)) return 'vidange';
  return 'curatif';
}

function agentAuthorized(request, env) {
  const expected = String(env.GE_AGENT_API_KEY || '').trim();
  if (!expected) return false;
  const got = String(request.headers.get('X-Api-Key') || request.headers.get('x-api-key') || '').trim();
  return got === expected;
}

async function applyLifecycle(env, site, kind, eventDate, ev) {
  const active = await env.DB.prepare(
    'SELECT * FROM ge_deployments WHERE site_id = ? AND removed_at IS NULL ORDER BY created_at DESC LIMIT 1'
  ).bind(site.id).first();
  const maxRemoved = (
    await env.DB.prepare(
      'SELECT MAX(removed_at) AS m FROM ge_deployments WHERE site_id = ? AND removed_at IS NOT NULL'
    ).bind(site.id).first()
  )?.m || null;

  // Garde-fou backfill : une pose/dépose datée dans le passé (fenêtre d'un
  // GE archivé) est une simple ligne de journal — elle ne doit JAMAIS
  // refermer la fiche active ni rouvrir un déploiement historique, sinon un
  // import NOC de l'historique détruirait le fenêtrage du site.
  const inActiveEra = active
    ? (!active.installed_at || eventDate >= String(active.installed_at).slice(0, 10))
    : (!maxRemoved || eventDate > String(maxRemoved).slice(0, 10));
  if (!inActiveEra) return {};

  const now = isoNow();
  if (kind === 'depose') {
    if (active) {
      await env.DB.prepare('UPDATE ge_deployments SET removed_at = ?, updated_at = ? WHERE id = ?')
        .bind(eventDate, now, active.id).run();
    }
    return { closedDeployment: active?.id || null };
  }

  if (kind === 'pose') {
    if (active) {
      await env.DB.prepare('UPDATE ge_deployments SET removed_at = ?, updated_at = ? WHERE id = ?')
        .bind(eventDate, now, active.id).run();
    }
    // Signalétique du nouveau GE : champs explicites > texte de la
    // description (« … par GE Elcos 30kva ») > champs du site.
    const parsed = parseReplacementGe(ev.description);
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO ge_deployments (id, site_id, groupe, kva, serie, installed_at, removed_at, source, note, created_by_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'noc', ?, ?, ?, ?)`
    ).bind(
      id,
      site.id,
      String(ev.groupe || parsed.groupe || site.generateur || ''),
      String(ev.kva || parsed.kva || site.capacite || ''),
      String(ev.serie || ''),
      eventDate,
      String(ev.note || ''),
      String(ev.actor || ''),
      now,
      now
    ).run();
    return { openedDeployment: id };
  }
  return {};
}

// Reconstruit les déploiements ARCHIVÉS manquants à partir des bornes
// pose/dépose présentes dans ge_history_events. Idempotent : ne crée un
// déploiement que là où AUCUNE fenêtre existante ne couvre l'intervalle
// déduit — les saisies manuelles et le GE actif ne sont jamais touchés.
// C'est ce qui permet à un import pré-app de déduire les anciens GE
// sans coquilles créées à la main.
async function reconcileGeDeployments(env, site) {
  const deps = (
    await env.DB.prepare('SELECT * FROM ge_deployments WHERE site_id = ?').bind(site.id).all()
  ).results || [];
  const lc = (
    await env.DB.prepare(
      "SELECT event_date, kind, description FROM ge_history_events WHERE site_id = ? AND kind IN ('pose','depose') ORDER BY event_date, created_at, id"
    ).bind(site.id).all()
  ).results || [];
  if (!lc.length) return 0;

  // Marche chronologique : pose ouvre un intervalle, depose le ferme.
  const targets = [];
  let cur = null;
  for (const e of lc) {
    const d = String(e.event_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (e.kind === 'pose') {
      if (cur) { cur.end = d; targets.push(cur); }
      const g = parseReplacementGe(e.description);
      cur = { start: d, end: null, groupe: g.groupe, kva: g.kva };
    } else {
      if (!cur) {
        const g = parseReplacedGe(e.description);
        cur = { start: null, end: d, groupe: g.groupe, kva: g.kva };
      } else {
        cur.end = d;
      }
      targets.push(cur);
      cur = null;
    }
  }
  if (cur) targets.push(cur);
  if (!targets.length) return 0;

  // Fenêtre amont : lignes antérieures à la 1re borne → déploiement
  // « GE précédent » [null → première transition], signalétique de
  // l'ancien GE extraite du 1er remplacement si disponible.
  const firstEv = (await env.DB.prepare('SELECT MIN(event_date) AS m FROM ge_history_events WHERE site_id = ?').bind(site.id).first())?.m;
  const earliest = String(firstEv || '').slice(0, 10);
  if (targets[0].start && earliest && earliest < targets[0].start) {
    const firstPose = lc.find((e) => e.kind === 'pose');
    const g = firstPose ? parseReplacedGe(firstPose.description) : { groupe: '', kva: '' };
    targets.unshift({ start: null, end: targets[0].start, groupe: g.groupe, kva: g.kva });
  }

  let created = 0;
  const now = isoNow();
  for (const t of targets) {
    const ts = t.start || '0000-00-00';
    const te = t.end || '9999-99-99';
    if (ts >= te) continue; // intervalle dégénéré (pose et dépose même jour)
    const covered = deps.some((dep) => {
      const ds = String(dep.installed_at || '').slice(0, 10) || '0000-00-00';
      const de = String(dep.removed_at || '').slice(0, 10) || '9999-99-99';
      return ds < te && de > ts; // chevauchement intérieur (adjacent ≠ couvert)
    });
    if (covered) continue;
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO ge_deployments (id, site_id, groupe, kva, serie, installed_at, removed_at, source, note, created_by_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', ?, ?, 'noc-auto', ?, '', ?, ?)`
    ).bind(id, site.id, t.groupe || '', t.kva || '', t.start, t.end, 'Déduit des bornes pose/dépose NOC', now, now).run();
    created += 1;
    deps.push({ installed_at: t.start, removed_at: t.end }); // couvre les intervalles suivants
  }
  return created;
}

async function upsertEvent(env, site, ev) {
  const eventDate = normalizeDate(ev.eventDate ?? ev.event_date ?? ev.actualWoDate ?? ev.date);
  if (!eventDate) return { skipped: true, reason: 'date invalide' };

  const description = String(ev.description ?? ev.desc ?? '').trim();
  const woRaw = ev.woNumber ?? ev.wo_number ?? ev.number ?? ev.ticket ?? '';
  const wo = digitsOnly(woRaw);
  const runHours = ev.runHours ?? ev.run_hours ?? ev.generatorRunHours;
  const nh = runHours === undefined || runHours === null || runHours === '' ? null : Number(runHours);
  const kind = normalizeKind(ev.kind, description);
  const source = String(ev.source || 'noc');
  const now = isoNow();

  // Filtre de pertinence : les curatifs non liés au générateur (télécom,
  // tenants, IT…) n'entrent pas dans la fiche. Les saisies manuelles
  // (source='manual') sont volontaires → jamais filtrées.
  if (kind === 'curatif' && source !== 'manual' && !isGeRelatedWork(description)) {
    return { skipped: true, reason: `non lié GE: ${description.slice(0, 60)}` };
  }

  let existing = null;
  if (wo) {
    existing = await env.DB.prepare(
      'SELECT id FROM ge_history_events WHERE site_id = ? AND wo_number = ? AND event_date = ?'
    ).bind(site.id, wo, eventDate).first();
  }
  if (!existing && description) {
    existing = await env.DB.prepare(
      `SELECT id FROM ge_history_events WHERE site_id = ? AND event_date = ? AND description = ? AND wo_number = ''`
    ).bind(site.id, eventDate, description).first();
  }

  if (existing) {
    await env.DB.prepare(
      `UPDATE ge_history_events SET run_hours = ?, description = ?, kind = ?, source = ?, updated_at = ? WHERE id = ?`
    ).bind(Number.isFinite(nh) ? nh : null, description, kind, source, now, existing.id).run();
    return { updated: true, id: existing.id };
  }

  // Cycle de vie UNIQUEMENT à l'insertion — sinon chaque ré-import
  // rejouerait pose/dépose et créerait des déploiements en double.
  const lifecycle = await applyLifecycle(env, site, kind, eventDate, ev);

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO ge_history_events (id, site_id, wo_number, event_date, run_hours, description, kind, source, created_by_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, site.id, wo, eventDate,
    Number.isFinite(nh) ? nh : null,
    description, kind, source,
    String(ev.actor || ''), now, now
  ).run();
  return { inserted: true, id, ...lifecycle };
}

// DELETE /api/ge-history/events — purge des lignes importées d'un site.
// Body : { siteId, source?: 'noc'|'agent'|'all', from?: YYYY-MM-DD, to?: YYYY-MM-DD }
// Défaut : source noc+agent uniquement — les saisies manuelles sont conservées.
export async function onRequestDelete({ request, env, data }) {
  try {
    await ensureAdminUser(env);

    const isAgent = agentAuthorized(request, env);
    if (!isAgent) {
      if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
      const role = String(data?.user?.role || '');
      if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const body = await readJson(request);
    const siteRef = String(body?.siteId || body?.idSite || body?.site || '').trim();
    if (!siteRef) return json({ error: 'siteId requis.' }, { status: 400 });

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ? OR id_site = ?').bind(siteRef, siteRef).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    if (!isAgent && !isSuperAdmin(data) && String(data?.user?.role || '') !== 'manager_bzv_pool') {
      if (String(site.zone || 'BZV/POOL') !== userZone(data)) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const src = String(body?.source || '').trim().toLowerCase();
    const from = normalizeDate(body.from ?? '');
    const to = normalizeDate(body.to ?? '');

    const conds = ['site_id = ?'];
    const binds = [site.id];
    if (src === 'all') {
      // toutes sources — réservé aux cas explicites
    } else if (src === 'noc' || src === 'agent') {
      conds.push('source = ?');
      binds.push(src);
    } else {
      conds.push("source <> 'manual'");
    }
    if (from) { conds.push('event_date >= ?'); binds.push(from); }
    if (to) { conds.push('event_date <= ?'); binds.push(to); }

    const res = await env.DB.prepare(`DELETE FROM ge_history_events WHERE ${conds.join(' AND ')}`)
      .bind(...binds).run();

    await touchLastUpdatedAt(env);
    return json({ ok: true, deleted: Number(res?.meta?.changes || 0) });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);

    const isAgent = agentAuthorized(request, env);
    if (!isAgent) {
      if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
      const role = String(data?.user?.role || '');
      if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const body = await readJson(request);
    const rawItems = Array.isArray(body?.items) ? body.items
      : Array.isArray(body?.events) ? body.events
      : Array.isArray(body?.rows) ? body.rows
      : Array.isArray(body) ? body : [];

    const topSite = body?.siteId || body?.idSite || body?.site || '';
    const items = rawItems.length
      ? rawItems.map((it) => ({ siteRef: it.siteId || it.idSite || it.site || topSite, ...it }))
      : (topSite ? [{ siteRef: topSite, ...body }] : []);

    if (!items.length) return json({ error: 'Aucun événement fourni.' }, { status: 400 });

    // Traitement chrono : le rejeu pose/dépose devient déterministe même
    // si le fichier NOC n'est pas trié par date.
    items.sort((a, b) => {
      const da = normalizeDate(a.eventDate ?? a.event_date ?? a.actualWoDate ?? a.date) || '9999';
      const db = normalizeDate(b.eventDate ?? b.event_date ?? b.actualWoDate ?? b.date) || '9999';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    const siteCache = new Map();
    const resolveSite = async (ref) => {
      const key = String(ref || '').trim();
      if (!key) return null;
      if (siteCache.has(key)) return siteCache.get(key);
      const row = await env.DB.prepare('SELECT * FROM sites WHERE id = ? OR id_site = ?').bind(key, key).first();
      siteCache.set(key, row || null);
      return siteCache.get(key);
    };

    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];
    const lifecycle = { opened: 0, closed: 0 };
    const touchedSites = new Map();

    for (let i = 0; i < items.length; i++) {
      const ev = items[i] || {};
      const site = await resolveSite(ev.siteRef);
      if (!site) {
        skipped += 1;
        errors.push(`#${i + 1}: site introuvable (${ev.siteRef || 'non précisé'})`);
        continue;
      }
      if (!isAgent && !isSuperAdmin(data) && String(data?.user?.role || '') !== 'manager_bzv_pool') {
        if (String(site.zone || 'BZV/POOL') !== userZone(data)) {
          skipped += 1;
          errors.push(`#${i + 1}: site hors zone (${site.id_site || site.id})`);
          continue;
        }
      }
      const res = await upsertEvent(env, site, { ...ev, actor: isAgent ? 'agent-excel' : (data?.user?.email || '') });
      if (res.inserted) inserted += 1;
      else if (res.updated) updated += 1;
      else skipped += 1;
      if (!res.skipped) touchedSites.set(site.id, site);
      if (res.openedDeployment) lifecycle.opened += 1;
      if (res.closedDeployment) lifecycle.closed += 1;
      if (res.reason) errors.push(`#${i + 1}: ${res.reason}`);
    }

    // Rejeu des bornes pose/dépose → fiches archivées déduites là où
    // aucune fenêtre ne couvre encore l'intervalle (idempotent).
    let autoDeployments = 0;
    for (const site of touchedSites.values()) {
      try { autoDeployments += await reconcileGeDeployments(env, site); } catch { /* non bloquant */ }
    }

    await touchLastUpdatedAt(env);
    return json({ ok: true, inserted, updated, skipped, lifecycle, autoDeployments, errors });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
