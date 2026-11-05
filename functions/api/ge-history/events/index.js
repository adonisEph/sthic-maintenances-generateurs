import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';
import { isGeRelatedWork, isGeReplacement } from '../../_utils/geWorkFilter.js';

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
  const d = String(description || '').toUpperCase();
  if (/\bDEPOSE\b/.test(d)) return 'depose';
  if (/\bPOSE\b/.test(d) || isGeReplacement(d)) return 'pose';
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
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO ge_deployments (id, site_id, groupe, kva, serie, installed_at, removed_at, source, note, created_by_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'noc', ?, ?, ?, ?)`
    ).bind(
      id,
      site.id,
      String(ev.groupe || site.generateur || ''),
      String(ev.kva || site.capacite || ''),
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

  const lifecycle = await applyLifecycle(env, site, kind, eventDate, ev);

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
    return { updated: true, id: existing.id, ...lifecycle };
  }

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
      if (res.openedDeployment) lifecycle.opened += 1;
      if (res.closedDeployment) lifecycle.closed += 1;
      if (res.reason) errors.push(`#${i + 1}: ${res.reason}`);
    }

    await touchLastUpdatedAt(env);
    return json({ ok: true, inserted, updated, skipped, lifecycle, errors });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
