import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone, ymdToday, newId } from '../../_utils/http.js';
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

const saneRegime = (r) => Number.isFinite(r) && r >= 1 && r <= NH_MAX_REGIME;

const daysBetweenYmd = (a, b) => {
  const m1 = String(a || '').match(/^\d{4}-\d{2}-\d{2}$/);
  const m2 = String(b || '').match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m1 || !m2) return NaN;
  return Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
};

const impliedRegime = (nh2, nh1v, d1, d2) => {
  const dd = daysBetweenYmd(d1, d2);
  const dv = Number(nh2) - Number(nh1v);
  return Number.isFinite(dd) && dd > 0 && Number.isFinite(dv) ? Math.round(dv / dd) : NaN;
};

// Régime sain — le régime stocké peut être parasité : cascade hybride.
// 1) choix manuel validé (entier 1..24)
// 2) régime implicite des valeurs prev_* de l'entrée (état pré-parasite)
// 3) régime dérivé de l'historique nh_readings (dernier relevé cohérent)
// 4) régime stocké si sain
async function resolveSaneRegime(env, site, entry, manualRegime) {
  let regime = Number(manualRegime);
  if (saneRegime(regime)) return { regime: Math.round(regime), source: 'manual' };

  regime = impliedRegime(entry?.prev_nh2_a, entry?.prev_nh1_dv, entry?.prev_date_dv, entry?.prev_date_a);
  if (saneRegime(regime)) return { regime, source: 'prev_state' };

  try {
    const hist = await env.DB.prepare(
      `SELECT nh_value, reading_date, prev_nh1_dv, prev_date_dv FROM nh_readings
       WHERE site_id = ? ORDER BY reading_date DESC, created_at DESC LIMIT 20`
    )
      .bind(String(site.id))
      .all();
    for (const h of hist?.results || []) {
      const r = impliedRegime(h?.nh_value, h?.prev_nh1_dv, h?.prev_date_dv, h?.reading_date);
      if (saneRegime(r)) return { regime: r, source: 'history' };
    }
  } catch {
    // historique indisponible
  }

  if (saneRegime(Number(site.regime))) return { regime: Math.round(Number(site.regime)), source: 'stored' };
  return { regime: NaN, source: null };
}

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
      let nh = Number(body?.nh2A);
      let dateA = String(body?.dateA || '').slice(0, 10);

      if (body?.autoCorrect === true) {
        // Correction automatique des valeurs parasitées — réservée à
        // parasite_high. Intervalle = jours(date_dv → jour de la correction) ;
        // nh2_a corrigé = nh1_dv + regime × intervalle ; date_a inchangée.
        // C'est une réparation d'état (pas un nouveau relevé) : on court-circuite
        // evaluateNhCandidate — sinon la valeur logique, souvent inférieure au
        // compteur parasité, serait rejetée en "decrease".
        if (String(entry.reason || '') !== 'parasite_high') {
          return json({ error: 'Correction auto réservée aux valeurs parasitées.' }, { status: 400 });
        }
        const nh1 = Number(site.nh1_dv);
        const dateDV = String(site.date_dv || '').slice(0, 10);

        const resolved = await resolveSaneRegime(env, site, entry, body?.regime);
        if (!saneRegime(resolved.regime)) {
          return json(
            { error: 'Régime indéterminable : choisissez un régime (1-24 H/J) avant la correction.' },
            { status: 400 }
          );
        }
        const regime = resolved.regime;
        const regimeSource = resolved.source;

        const todayStr = ymdToday();
        const days = dateDV
          ? Math.floor((Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${dateDV}T00:00:00Z`)) / 86400000)
          : NaN;
        if (!Number.isFinite(nh1) || !Number.isFinite(regime) || regime <= 0 || !Number.isFinite(days) || days < 0) {
          return json(
            { error: 'Correction auto impossible : régime ou date_dv manquant/incohérent.' },
            { status: 400 }
          );
        }
        nh = nh1 + regime * days;
        const storedDateA = String(site.date_a || '').slice(0, 10);
        const nhEstimated = calculateEstimatedNH(nh, storedDateA, regime);
        const diffNHs = calculateDiffNHs(nh1, nh);
        const diffEstimated = calculateDiffNHs(nh1, nhEstimated);
        await env.DB.prepare(
          'UPDATE sites SET nh2_a = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
        )
          .bind(nh, regime, nhEstimated, diffNHs, diffEstimated, now, String(site.id))
          .run();
        await env.DB.prepare(
          `INSERT INTO nh_readings
           (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv,
            prev_nh_offset, new_nh_offset, is_reset, source, quarantine_id,
            created_by_user_id, created_by_email, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            newId(),
            String(site.id),
            todayStr,
            Math.trunc(nh),
            site?.nh2_a ?? null,
            site?.date_a ?? null,
            site?.nh1_dv ?? null,
            site?.date_dv ?? null,
            site?.nh_offset ?? null,
            0,
            0,
            NH_SOURCE.QUARANTINE,
            id,
            data?.user?.id ? String(data.user.id) : null,
            data?.user?.email ? String(data.user.email) : null,
            now,
            now
          )
          .run();
        updatedSite = {
          ...site,
          nh2_a: nh,
          regime,
          nh_estimated: nhEstimated,
          diff_nhs: diffNHs,
          diff_estimated: diffEstimated,
          updated_at: now
        };
        payload = { nh2A: nh, dateA: storedDateA || todayStr, autoCorrect: true, days, regime, regimeSource };
      }

      if (updatedSite === null) {
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
      }
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
      // Réparation de baseline corrompue, DE BOUT EN BOUT : réécrit nh1_dv/date_dv
      // ET remet nh2_a en cohérence — sinon la valeur parasitée survivait à la
      // réparation et les projections restaient fausses.
      const nh1 = Number(body?.nh1DV);
      const dateDV = String(body?.dateDV || '').slice(0, 10);
      if (!Number.isFinite(nh1) || nh1 < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateDV)) {
        return json({ error: 'NH1 DV ou Date DV corrigés invalides.' }, { status: 400 });
      }
      const todayStr = ymdToday();

      // nh2_a : valeur explicite du body, sinon valeur logique
      // nh1 + régime × jours(dateDV → aujourd'hui) avec date_a = aujourd'hui
      // → état stocké cohérent par construction (régime implicite = régime choisi).
      let nh2 = Number(body?.nh2A);
      let dateA = String(body?.dateA || '').slice(0, 10);
      const hasExplicitNh2 = Number.isFinite(nh2) && nh2 >= 0;

      let regime;
      let regimeSource = null;
      let nh2AutoCorrected = false;
      if (hasExplicitNh2) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateA)) dateA = todayStr;
        regime = calculateRegime(nh1, nh2, dateDV, dateA);
        if (!saneRegime(regime)) {
          const res = await resolveSaneRegime(env, site, entry, body?.regime);
          regime = res.regime;
          regimeSource = res.source;
        } else {
          regimeSource = 'implied';
        }
      } else {
        const res = await resolveSaneRegime(env, site, entry, body?.regime);
        if (!saneRegime(res.regime)) {
          return json(
            { error: 'Régime indéterminable : fournissez NH2 A corrigé ou un régime (1-24 H/J).' },
            { status: 400 }
          );
        }
        regime = res.regime;
        regimeSource = res.source;
        const days = daysBetweenYmd(dateDV, todayStr);
        if (!Number.isFinite(days) || days < 0) {
          return json(
            { error: 'Date DV corrigée dans le futur : correction impossible.' },
            { status: 400 }
          );
        }
        nh2 = nh1 + regime * days;
        dateA = todayStr;
        nh2AutoCorrected = true;
      }
      if (!Number.isFinite(regime) || regime <= 0) regime = 0;

      const nhEstimated = calculateEstimatedNH(nh2, dateA, regime);
      const diffNHs = calculateDiffNHs(nh1, nh2);
      const diffEstimated = calculateDiffNHs(nh1, nhEstimated);
      await env.DB.prepare(
        'UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
      )
        .bind(nh1, dateDV, nh2, dateA, regime, nhEstimated, diffNHs, diffEstimated, now, String(site.id))
        .run();
      await env.DB.prepare(
        `INSERT INTO nh_readings
         (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv,
          prev_nh_offset, new_nh_offset, is_reset, source, quarantine_id,
          created_by_user_id, created_by_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          newId(),
          String(site.id),
          dateA,
          Math.trunc(nh2),
          site?.nh2_a ?? null,
          site?.date_a ?? null,
          site?.nh1_dv ?? null,
          site?.date_dv ?? null,
          site?.nh_offset ?? null,
          0,
          1,
          NH_SOURCE.QUARANTINE,
          id,
          data?.user?.id ? String(data.user.id) : null,
          data?.user?.email ? String(data.user.email) : null,
          now,
          now
        )
        .run();
      updatedSite = {
        ...site,
        nh1_dv: nh1,
        date_dv: dateDV,
        nh2_a: nh2,
        date_a: dateA,
        regime,
        nh_estimated: nhEstimated,
        diff_nhs: diffNHs,
        diff_estimated: diffEstimated,
        updated_at: now
      };
      payload = { nh1DV: nh1, dateDV, nh2A: nh2, dateA, regime, regimeSource, nh2AutoCorrected };
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
