import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone, ymdToday } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';

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

function canWrite(data, site) {
  const role = String(data?.user?.role || '');
  if (role === 'admin' || role === 'manager_bzv_pool') return true;
  if (role === 'manager') return String(site?.zone || 'BZV/POOL') === userZone(data);
  return false;
}

async function loadSite(env, id) {
  return env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
}

// POST : ouvre un nouveau déploiement GE (clôt l'actif s'il existe).
// Avec removedAt → crée un déploiement ARCHIVÉ (GE passé) sans toucher
// ni le déploiement actif ni la signalétique du site.
// Body : { groupe, kva, serie, installedAt?, removedAt?, note?, updateSite? }
export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const siteId = String(params?.id || '').trim();
    const site = await loadSite(env, siteId);
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });
    if (!canWrite(data, site)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const installedRaw = body.installedAt ?? body.installed_at ?? body.eventDate;
    const removedRaw = body.removedAt ?? body.removed_at;
    const installedProvided = normalizeDate(installedRaw);
    const removedAt = normalizeDate(removedRaw);
    if (installedRaw && !installedProvided) return json({ error: 'Date de pose invalide.' }, { status: 400 });
    if (removedRaw && !removedAt) return json({ error: 'Date de dépose invalide.' }, { status: 400 });

    const now = isoNow();

    // Branche « GE passé » : fiche archivée, aucun effet de bord.
    if (removedAt) {
      if (!installedProvided) return json({ error: 'Date de pose requise pour un GE passé.' }, { status: 400 });
      if (installedProvided > removedAt) return json({ error: 'La pose doit précéder la dépose.' }, { status: 400 });
      const id = newId();
      await env.DB.prepare(
        `INSERT INTO ge_deployments (id, site_id, groupe, kva, serie, installed_at, removed_at, source, note, created_by_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)`
      ).bind(
        id, siteId,
        String(body.groupe ?? '').trim(), String(body.kva ?? '').trim(), String(body.serie ?? '').trim(),
        installedProvided, removedAt, String(body.note ?? '').trim(),
        String(data?.user?.email || ''), now, now
      ).run();
      await touchLastUpdatedAt(env);
      return json({ ok: true, openedDeployment: id, closedDeployment: null, installedAt: installedProvided, removedAt, archived: true });
    }

    const installedAt = installedProvided || ymdToday();
    const groupe = String(body.groupe ?? site.generateur ?? '').trim();
    const kva = String(body.kva ?? site.capacite ?? '').trim();
    const serie = String(body.serie ?? '').trim();
    const note = String(body.note ?? '').trim();
    const active = await env.DB.prepare(
      'SELECT * FROM ge_deployments WHERE site_id = ? AND removed_at IS NULL ORDER BY created_at DESC LIMIT 1'
    ).bind(siteId).first();

    let closedId = null;
    if (active) {
      await env.DB.prepare('UPDATE ge_deployments SET removed_at = ?, updated_at = ? WHERE id = ?')
        .bind(installedAt, now, active.id).run();
      closedId = active.id;
    }

    const id = newId();
    await env.DB.prepare(
      `INSERT INTO ge_deployments (id, site_id, groupe, kva, serie, installed_at, removed_at, source, note, created_by_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'manual', ?, ?, ?, ?)`
    ).bind(id, siteId, groupe, kva, serie, installedAt, note, String(data?.user?.email || ''), now, now).run();

    // « Remplacer le GE » : la signalétique du site suit le nouveau GE (sauf refus explicite).
    if (body.updateSite !== false) {
      await env.DB.prepare('UPDATE sites SET generateur = ?, capacite = ?, updated_at = ? WHERE id = ?')
        .bind(groupe, kva, now, siteId).run();
    }

    await touchLastUpdatedAt(env);
    return json({ ok: true, openedDeployment: id, closedDeployment: closedId, installedAt });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

// PATCH : corrige la signalétique / les dates d'un déploiement.
// Body : { deploymentId, groupe?, kva?, serie?, installedAt?, removedAt?, note? }
export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const siteId = String(params?.id || '').trim();
    const site = await loadSite(env, siteId);
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });
    if (!canWrite(data, site)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const depId = String(body.deploymentId || body.deployment_id || '').trim();
    const dep = await env.DB.prepare('SELECT * FROM ge_deployments WHERE id = ? AND site_id = ?')
      .bind(depId, siteId).first();
    if (!dep) return json({ error: 'Déploiement introuvable.' }, { status: 404 });

    const updates = {};
    if (body.groupe !== undefined) updates.groupe = String(body.groupe || '').trim();
    if (body.kva !== undefined) updates.kva = String(body.kva || '').trim();
    if (body.serie !== undefined) updates.serie = String(body.serie || '').trim();
    if (body.note !== undefined) updates.note = String(body.note || '').trim();
    if (body.installedAt !== undefined || body.installed_at !== undefined) {
      const d = normalizeDate(body.installedAt ?? body.installed_at);
      if (body.installedAt && !d) return json({ error: 'Date de pose invalide.' }, { status: 400 });
      updates.installed_at = d || null;
    }
    if (body.removedAt !== undefined || body.removed_at !== undefined) {
      const d = normalizeDate(body.removedAt ?? body.removed_at);
      if (body.removedAt && !d) return json({ error: 'Date de dépose invalide.' }, { status: 400 });
      updates.removed_at = d || null;
    }

    if (!Object.keys(updates).length) return json({ error: 'Rien à modifier.' }, { status: 400 });

    const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await env.DB.prepare(`UPDATE ge_deployments SET ${sets}, updated_at = ? WHERE id = ?`)
      .bind(...Object.values(updates), isoNow(), depId).run();

    await touchLastUpdatedAt(env);
    const updated = await env.DB.prepare('SELECT * FROM ge_deployments WHERE id = ?').bind(depId).first();
    return json({ ok: true, deployment: updated });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
