import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isSuperAdmin, userZone, ymdToday } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import { NH_SOURCE, applyNhReading } from '../_utils/nhCoherence.js';

// « Mettre à niveau » — projection Correct Auto appliquée aux sites retirés.
// Les sites retirés de campagne ne reçoivent plus les MAJ Auto/RMS : leur
// nh2_a/date_a gèlent. On projette le compteur logique à aujourd'hui :
//   nh2_a = nh1_dv + régime × jours(date_dv → aujourd'hui)
//   date_a = aujourd'hui · diff_nhs recalculé · nh_estimated = nh2_a
// NH1 DV/date_dv ne sont JAMAIS touchés (baseline de vidange immuable).
// Même résolution de régime qu'en quarantaine : implicite de l'état courant
// → stocké → historique nh_readings. Deux modes : preview (rien écrit) et
// apply (applyNhReading → lecture tracée source 'projection').

const MANAGER_ROLES = ['admin', 'manager', 'manager_bzv_pool'];
const NH_MAX_REGIME = 24;

const saneRegime = (r) => Number.isFinite(r) && r >= 1 && r <= NH_MAX_REGIME;

const normYmd = (v) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const daysBetweenYmd = (a, b) => {
  const d1 = normYmd(a);
  const d2 = normYmd(b);
  if (!d1 || !d2) return NaN;
  return Math.floor((Date.parse(`${d2}T00:00:00Z`) - Date.parse(`${d1}T00:00:00Z`)) / 86400000);
};

const impliedRegime = (nh2, nh1, d1, d2) => {
  const dd = daysBetweenYmd(d1, d2);
  const dv = Number(nh2) - Number(nh1);
  return Number.isFinite(dd) && dd > 0 && Number.isFinite(dv) ? Math.round(dv / dd) : NaN;
};

// Régime pour la projection (pas de choix manuel en bulk) :
// 1) régime implicite de l'état courant (pente réellement observée depuis la DV)
// 2) régime stocké sain
// 3) dernier régime implicite cohérent de l'historique nh_readings
async function resolveProjectionRegime(env, site) {
  const r = impliedRegime(site?.nh2_a, site?.nh1_dv, site?.date_dv, site?.date_a);
  if (saneRegime(r)) return { regime: r, source: 'observé' };
  if (saneRegime(Number(site?.regime))) return { regime: Math.round(Number(site.regime)), source: 'stocké' };
  try {
    const hist = await env.DB.prepare(
      `SELECT nh_value, reading_date, prev_nh1_dv, prev_date_dv FROM nh_readings
       WHERE site_id = ? ORDER BY reading_date DESC, created_at DESC LIMIT 20`
    ).bind(String(site.id)).all();
    for (const h of hist?.results || []) {
      const hr = impliedRegime(h?.nh_value, h?.prev_nh1_dv, h?.prev_date_dv, h?.reading_date);
      if (saneRegime(hr)) return { regime: hr, source: 'historique' };
    }
  } catch { /* historique indisponible */ }
  return { regime: NaN, source: null };
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '').trim();
    if (!MANAGER_ROLES.includes(role)) return json({ error: 'Réservé aux managers/admin.' }, { status: 403 });

    const body = await readJson(request);
    const siteIds = Array.isArray(body?.siteIds) ? body.siteIds.map((s) => String(s || '').trim()).filter(Boolean) : [];
    if (!siteIds.length || siteIds.length > 500) return json({ error: 'Fournis 1 à 500 sites.' }, { status: 400 });
    const apply = body?.apply === true;

    const scopeZones = (() => {
      if (isSuperAdmin(data) || role === 'manager_bzv_pool') return null;
      const z = String(userZone(data) || 'BZV/POOL');
      return [z.trim().toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ')];
    })();

    const todayStr = ymdToday();
    const rows = [];
    const toApply = [];

    for (const sid of siteIds.slice(0, 500)) {
      const site = await env.DB.prepare(
        'SELECT id, id_site, name_site, zone, technician, nh1_dv, date_dv, nh2_a, date_a, diff_nhs, regime, seuil FROM sites WHERE id = ?'
      ).bind(sid).first();

      const skip = (reason) => rows.push({ siteId: sid, siteCode: site?.id_site || '', siteName: site?.name_site || '', skipped: true, reason });
      if (!site) { skip('site introuvable'); continue; }

      const zone = String(site.zone || 'BZV/POOL').trim().toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
      if (Array.isArray(scopeZones) && scopeZones.length && !scopeZones.includes(zone)) { skip('hors zone'); continue; }

      const nh1 = Number(site.nh1_dv);
      const dateDv = normYmd(site.date_dv);
      if (!Number.isFinite(nh1) || !dateDv) { skip('baseline vidange manquante (NH1 DV / Date DV)'); continue; }

      const days = daysBetweenYmd(dateDv, todayStr);
      if (!Number.isFinite(days) || days < 0) { skip('date_dv dans le futur'); continue; }
      if (normYmd(site.date_a) === todayStr) { skip('déjà à jour'); continue; }

      const pending = await env.DB.prepare(
        "SELECT id FROM nh_quarantine WHERE site_id = ? AND status = 'pending' LIMIT 1"
      ).bind(String(site.id)).first();
      if (pending) { skip('quarantaine en attente — à traiter dans le Centre NH'); continue; }

      const res = await resolveProjectionRegime(env, site);
      if (!saneRegime(res.regime)) { skip('régime indéterminable (1-24 H/J)'); continue; }

      const nh2 = nh1 + res.regime * days;
      rows.push({
        siteId: sid, siteCode: site.id_site || '', siteName: site.name_site || '', zone,
        technician: site.technician || '',
        before: { nh2A: site.nh2_a ?? null, dateA: site.date_a || '', diffNhs: site.diff_nhs ?? null },
        after: { nh2A: nh2, dateA: todayStr, diffNhs: nh2 - nh1, regime: res.regime, regimeSource: res.source, days },
        seuil: site.seuil ?? null,
        skipped: false
      });
      if (apply) toApply.push({ site, nh2 });
    }

    if (apply) {
      for (const { site, nh2 } of toApply) {
        await applyNhReading(
          env, site,
          { nh2A: nh2, dateA: todayStr },
          { source: NH_SOURCE.PROJECTION, user: data?.user }
        );
      }
      if (toApply.length) await touchLastUpdatedAt(env);
    }

    return json({
      ok: true, applied: apply,
      count: rows.filter((r) => !r.skipped).length,
      skippedCount: rows.filter((r) => r.skipped).length,
      items: rows
    }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
