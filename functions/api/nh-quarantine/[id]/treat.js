import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone, ymdToday } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';
import { calculateRegime, calculateEstimatedNH, calculateDiffNHs } from '../../_utils/calc.js';
import {
  NH_SOURCE,
  NH_MAX_REGIME,
  evaluateNhCandidate,
  applyNhReading,
  rebaseSite,
  effectiveTechnicianName,
  technicianMatches
} from '../../_utils/nhCoherence.js';

const ALLOWED_TREATMENTS = ['correct', 'rebase', 'fix_nh1dv', 'dismiss'];
const MANAGER_ROLES = ['admin', 'manager', 'manager_bzv_pool'];

export async function onRequestPost({ request, env, data, params }) {
  try {
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const body = await readJson(request);
    const action = String(body?.action || '').trim();
    if (!ALLOWED_TREATMENTS.includes(action)) {
      return json({ error: 'Action invalide.' }, { status: 400 });
    }

    let entry;
    try {
      entry = await env.DB.prepare('SELECT * FROM nh_quarantine WHERE id = ?').bind(id).first();
    } catch {
      return json({ error: 'Quarantaine indisponible.' }, { status: 500 });
    }
    if (!entry) return json({ error: 'Entrée introuvable.' }, { status: 404 });
    if (entry.status !== 'pending') {
      return json({ error: 'Entrée déjà traitée.' }, { status: 409 });
    }

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(String(entry.site_id)).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    const role = String(data?.user?.role || '');
    const isManager = MANAGER_ROLES.includes(role);

    // Permissions :
    //  - technician : uniquement ses sites, actions correct/rebase/dismiss
    //  - managers/admin : leur zone ; fix_nh1dv réservé à eux
    //  - superadmin : tout
    if (role === 'technician') {
      const techName = await effectiveTechnicianName(env, data);
      if (!technicianMatches(site?.technician, techName)) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
      if (action === 'fix_nh1dv') {
        return json({ error: 'Réparation NH1 DV réservée aux managers/admin.' }, { status: 403 });
      }
    } else if (isManager) {
      if (!isSuperAdmin(data) && role !== 'manager_bzv_pool') {
        const z = userZone(data);
        if (String(site.zone || 'BZV/POOL') !== z) {
          return json({ error: 'Accès interdit.' }, { status: 403 });
        }
      }
    } else {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const now = isoNow();
    let updatedSite = null;
    let payload = null;

    if (action === 'dismiss') {
      payload = { note: String(body?.note || '') };
    } else if (action === 'correct') {
      // La valeur corrigée est réévaluée contre l'état ACTUEL du site.
      const nh = Number(body?.nh2A);
      const dateA = String(body?.dateA || '').slice(0, 10);
      if (!Number.isFinite(nh) || nh < 0) {
        return json({ error: 'Compteur corrigé invalide.' }, { status: 400 });
      }
      const verdict = evaluateNhCandidate(site, { nh2A: nh, dateA }, { todayYmd: ymdToday() });
      if (verdict.verdict !== 'apply') {
        return json(
          { error: 'Valeur corrigée toujours incohérente.', reason: verdict.reason },
          { status: 409 }
        );
      }
      const applied = await applyNhReading(
        env,
        site,
        { nh2A: verdict.nh2A, dateA: verdict.dateA },
        { source: NH_SOURCE.QUARANTINE, user: data?.user, quarantineId: id }
      );
      updatedSite = applied.site;
      payload = { nh2A: verdict.nh2A, dateA: verdict.dateA };
    } else if (action === 'rebase') {
      // Changement deepsea/générateur confirmé : la valeur proposée (ou corrigée)
      // devient la nouvelle base nh1_dv.
      const nh = body?.nh2A != null ? Number(body.nh2A) : Number(entry.proposed_nh2_a);
      const dateA = String(body?.dateA || entry.proposed_date_a || ymdToday()).slice(0, 10);
      if (!Number.isFinite(nh) || nh < 0) {
        return json({ error: 'Valeur de rebase invalide.' }, { status: 400 });
      }
      const rebased = await rebaseSite(
        env,
        site,
        { nh2A: nh, dateA },
        { source: NH_SOURCE.QUARANTINE, user: data?.user, quarantineId: id }
      );
      updatedSite = rebased.site;
      payload = { nh1DV: nh, dateDV: dateA, nh2A: nh, dateA };
    } else if (action === 'fix_nh1dv') {
      // Réparation de baseline corrompue : réécrit nh1_dv/date_dv, recalcule les dérivés.
      const nh1 = Number(body?.nh1DV);
      const dateDV = String(body?.dateDV || '').slice(0, 10);
      if (!Number.isFinite(nh1) || nh1 < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateDV)) {
        return json({ error: 'NH1 DV ou Date DV corrigés invalides.' }, { status: 400 });
      }
      const nh2 = Number(site.nh2_a);
      const dateA = String(site.date_a || '').slice(0, 10);
      let regime = calculateRegime(nh1, nh2, dateDV, dateA);
      if (!Number.isFinite(regime) || regime <= 0 || regime > NH_MAX_REGIME) {
        regime = Number(site.regime) > 0 ? Number(site.regime) : 0;
      }
      const nhEstimated = calculateEstimatedNH(nh2, dateA, regime);
      const diffNHs = calculateDiffNHs(nh1, nh2);
      const diffEstimated = calculateDiffNHs(nh1, nhEstimated);
      await env.DB.prepare(
        'UPDATE sites SET nh1_dv = ?, date_dv = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
      )
        .bind(nh1, dateDV, regime, nhEstimated, diffNHs, diffEstimated, now, String(site.id))
        .run();
      updatedSite = { ...site, nh1_dv: nh1, date_dv: dateDV, regime, nh_estimated: nhEstimated, diff_nhs: diffNHs, diff_estimated: diffEstimated };
      payload = { nh1DV: nh1, dateDV };
    }

    await env.DB.prepare(
      `UPDATE nh_quarantine SET status = ?, treatment = ?, treated_by_user_id = ?, treated_by_email = ?,
       treated_at = ?, treatment_payload = ?, updated_at = ? WHERE id = ?`
    )
      .bind(
        action === 'dismiss' ? 'dismissed' : 'treated',
        action,
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null,
        now,
        payload ? JSON.stringify(payload) : null,
        now,
        id
      )
      .run();

    await touchLastUpdatedAt(env);

    return json({ ok: true, action, site: updatedSite }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
