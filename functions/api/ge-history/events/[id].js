import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';

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

async function loadEventWithSite(env, id) {
  const ev = await env.DB.prepare('SELECT * FROM ge_history_events WHERE id = ?').bind(id).first();
  if (!ev) return { ev: null, site: null };
  const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(ev.site_id).first();
  return { ev, site };
}

function canWrite(data, site) {
  const role = String(data?.user?.role || '');
  if (role === 'admin' || role === 'manager_bzv_pool') return true;
  if (role === 'manager') return String(site?.zone || 'BZV/POOL') === userZone(data);
  return false;
}

export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const id = String(params?.id || '').trim();
    const { ev, site } = await loadEventWithSite(env, id);
    if (!ev) return json({ error: 'Événement introuvable.' }, { status: 404 });
    if (!canWrite(data, site)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const updates = {};

    if (body.eventDate !== undefined || body.event_date !== undefined) {
      const d = normalizeDate(body.eventDate ?? body.event_date);
      if (!d) return json({ error: 'Date invalide.' }, { status: 400 });
      updates.event_date = d;
    }
    if (body.woNumber !== undefined || body.wo_number !== undefined) {
      updates.wo_number = digitsOnly(body.woNumber ?? body.wo_number);
    }
    if (body.description !== undefined) {
      updates.description = String(body.description || '').trim();
    }
    if (body.runHours !== undefined || body.run_hours !== undefined) {
      const n = body.runHours ?? body.run_hours;
      updates.run_hours = n === '' || n === null ? null : Number(n);
      if (updates.run_hours !== null && !Number.isFinite(updates.run_hours)) {
        return json({ error: 'N. Heures invalide.' }, { status: 400 });
      }
    }
    if (body.kind !== undefined) {
      const k = String(body.kind || '').trim().toLowerCase();
      if (!['curatif', 'pose', 'depose', 'vidange'].includes(k)) {
        return json({ error: 'Type invalide.' }, { status: 400 });
      }
      updates.kind = k;
    }

    if (!Object.keys(updates).length) return json({ error: 'Rien à modifier.' }, { status: 400 });

    const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await env.DB.prepare(`UPDATE ge_history_events SET ${sets}, updated_at = ? WHERE id = ?`)
      .bind(...Object.values(updates), isoNow(), id).run();

    await touchLastUpdatedAt(env);
    const updated = await env.DB.prepare('SELECT * FROM ge_history_events WHERE id = ?').bind(id).first();
    return json({ ok: true, event: updated });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestDelete({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const id = String(params?.id || '').trim();
    const { ev, site } = await loadEventWithSite(env, id);
    if (!ev) return json({ error: 'Événement introuvable.' }, { status: 404 });
    if (!canWrite(data, site)) return json({ error: 'Accès interdit.' }, { status: 403 });

    await env.DB.prepare('DELETE FROM ge_history_events WHERE id = ?').bind(id).run();
    await touchLastUpdatedAt(env);
    return json({ ok: true, deleted: id });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
