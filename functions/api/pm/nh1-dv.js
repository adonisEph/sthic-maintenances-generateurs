import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isSuperAdmin, userZone, isoNow, newId } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import { calculateEstimatedNH } from '../_utils/calc.js';
import { NH_MAX_REGIME } from '../_utils/nhCoherence.js';

// Correction de la baseline vidange NH1 DV — réservée à la zone UPCN.
// La baseline de cette zone vient d'être saisie manuellement (« Mettre à jour
// UPCN ») : elle doit rester corrigeable tant que la zone s'installe.
// diff_nhs / diff_estimated / nh_estimated / régime implicite recalculés.
// Audit : ligne nh_readings is_reset=1 (baseline corrigée), prev_* conservé.

const MANAGER_ROLES = ['admin', 'manager', 'manager_bzv_pool'];
const UPCN_ZONE = 'UPCN';
const NH_SOURCE_BASELINE = 'baseline';

const normZone = (z) =>
  String(z || '').trim().toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');

const normYmd = (v) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const daysBetween = (a, b) => {
  const d1 = normYmd(a);
  const d2 = normYmd(b);
  if (!d1 || !d2) return NaN;
  return Math.floor((Date.parse(`${d2}T00:00:00Z`) - Date.parse(`${d1}T00:00:00Z`)) / 86400000);
};

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '').trim();
    if (!MANAGER_ROLES.includes(role)) return json({ error: 'Réservé aux managers/admin.' }, { status: 403 });

    const body = await readJson(request);
    const siteId = String(body?.siteId || '').trim();
    const nh1 = Number(body?.nh1Dv);
    if (!siteId) return json({ error: 'Site requis.' }, { status: 400 });
    if (!Number.isFinite(nh1) || nh1 < 0) return json({ error: 'NH1 DV invalide.' }, { status: 400 });

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    // Restriction métier : baseline corrigeable UNIQUEMENT en zone UPCN
    // (zone fraîchement intégrée). Les autres zones passent par le rebase
    // quarantaine — la baseline y est immuable.
    if (normZone(site.zone) !== UPCN_ZONE) {
      return json({ error: 'Correction de NH1 DV réservée à la zone UPCN.' }, { status: 403 });
    }
    if (!isSuperAdmin(data) && role !== 'manager_bzv_pool') {
      if (normZone(userZone(data)) !== UPCN_ZONE) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const nh2 = Number(site.nh2_a);
    const dateA = normYmd(site.date_a);
    if (!Number.isFinite(nh2) || !dateA) return json({ error: 'Pas de relevé NH2 A sur ce site.' }, { status: 400 });
    if (nh1 > nh2) return json({ error: 'NH1 DV ne peut pas dépasser NH2 A.' }, { status: 400 });

    // Régime implicite depuis la nouvelle baseline ; sinon régime stocké.
    const days = daysBetween(site.date_dv, dateA);
    const implied = Number.isFinite(days) && days > 0 ? Math.round((nh2 - nh1) / days) : 0;
    const regime = implied >= 1 && implied <= NH_MAX_REGIME
      ? implied
      : (Number(site.regime) > 0 ? Number(site.regime) : 0);
    const nhEstimated = calculateEstimatedNH(nh2, dateA, regime);
    const diff = nh2 - nh1;
    const diffEstimated = nhEstimated - nh1;
    const now = isoNow();

    await env.DB.prepare(
      'UPDATE sites SET nh1_dv = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
    ).bind(nh1, regime, nhEstimated, diff, diffEstimated, now, String(site.id)).run();

    try {
      await env.DB.prepare(
        `INSERT INTO nh_readings
         (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv,
          prev_nh_offset, new_nh_offset, is_reset, source, quarantine_id,
          created_by_user_id, created_by_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newId(), String(site.id), dateA, Math.trunc(nh2),
        site.nh2_a ?? null, site.date_a ?? null, site.nh1_dv ?? null, site.date_dv ?? null,
        site.nh_offset ?? 0, 0, 1, NH_SOURCE_BASELINE, null,
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null, now, now
      ).run();
    } catch { /* audit best-effort */ }

    await touchLastUpdatedAt(env);
    return json({
      ok: true,
      site: {
        id: String(site.id), nh1Dv: nh1, dateDv: site.date_dv || '',
        nh2A: nh2, dateA, diffNhs: diff, regime, nhEstimated
      }
    }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
