import { isoNow, json, requireAuth, ymdToday } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import {
  NH_MAX_REGIME,
  NH_SOURCE,
  evaluateStoredSite,
  recordQuarantine
} from '../_utils/nhCoherence.js';
import { calculateRegime, calculateEstimatedNH, calculateDiffNHs } from '../_utils/calc.js';

const normYmd = (v) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const daysSince = (dateYmd, todayYmd) => {
  const m1 = String(dateYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const m2 = String(todayYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m1 || !m2) return 0;
  const a = Date.UTC(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
  const b = Date.UTC(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
  return Number.isFinite(d) && d > 0 ? d : 0;
};

export async function onRequestPost({ env, data }) {
  try {
    if (!requireAuth(data)) {
      return json({ error: 'Non autorisé.' }, { status: 401 });
    }

    // Processus système : recalc PUR de champs dérivés (jamais nh2_a/date_a/nh1_dv).
    // Toutes les zones sont couvertes — sinon les zones sans utilisateur connecté
    // ce jour-là garderaient des projections périmées (ex. PNR/KOUILOU jamais
    // recalculé quand seul le SuperAdmin BZV/POOL déclenche).
    const todayYmd = ymdToday();

    const res = await env.DB.prepare(
      `SELECT id, zone, nh1_dv, date_dv, nh2_a, date_a, nh_offset, regime
       FROM sites`
    ).all();
    const rows = res?.results || [];

    const upd = await env.DB.prepare(
      'UPDATE sites SET regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
    );
    const statements = [];
    let updated = 0;
    let scanned = 0;
    let flagged = 0;
    let quarantineFailed = 0;
    const flaggedSamples = [];
    const byZone = {};

    for (const row of rows) {
      const siteId = String(row.id || '');
      if (!siteId) continue;
      scanned += 1;

      // Détection d'incohérences sur l'état STOCKÉ → quarantaine persistante.
      // Les sites retirés sont traités avec la même rigueur que les actifs.
      const check = evaluateStoredSite(row, { todayYmd });
      if (check.verdict === 'quarantine') {
        const rec = await recordQuarantine(
          env,
          row,
          {
            source: NH_SOURCE.AUTO,
            reason: check.reason,
            proposedNh2A: row?.nh2_a,
            proposedDateA: row?.date_a,
            detail: check.detail
          },
          { user: data?.user, zone: row?.zone }
        );
        if (rec?.error) {
          quarantineFailed += 1;
          if (flaggedSamples.length < 25) {
            flaggedSamples.push({ siteId, reason: check.reason, writeError: rec?.message || null });
          }
        } else {
          flagged += 1;
          if (flaggedSamples.length < 25) {
            flaggedSamples.push({ siteId, reason: check.reason, detail: check.detail });
          }
        }
      }

      // Recalc PUR : uniquement les champs dérivés. Aucune écriture sur
      // nh1_dv / date_dv / nh2_a / date_a — les sources restent intactes.
      const nh1 = Number(row?.nh1_dv);
      const dateDv = normYmd(row?.date_dv);
      const prevNh2A = Number(row?.nh2_a);
      const prevDateA = normYmd(row?.date_a);
      if (!Number.isFinite(prevNh2A) || !prevDateA || !dateDv) continue;

      let regime = calculateRegime(nh1, prevNh2A, dateDv, prevDateA);
      if (!Number.isFinite(regime) || regime <= 0 || regime > NH_MAX_REGIME) {
        regime = Number(row?.regime) > 0 ? Number(row.regime) : 0;
      }

      const d = daysSince(prevDateA, todayYmd);
      const nhEstimated = Number.isFinite(regime) && regime > 0
        ? Math.round(prevNh2A + regime * d)
        : prevNh2A;
      const diff = calculateDiffNHs(nh1, prevNh2A);
      const diffEst = calculateDiffNHs(nh1, nhEstimated);

      statements.push(upd.bind(regime, nhEstimated, diff, diffEst, isoNow(), siteId));
      updated += 1;
      const zk = String(row?.zone || 'N/A');
      byZone[zk] = (byZone[zk] || 0) + 1;
    }

    if (statements.length) await env.DB.batch(statements);
    const lastUpdatedAt = await touchLastUpdatedAt(env);

    return json({
      success: true,
      date: todayYmd,
      updatedCount: updated,
      scannedCount: scanned,
      updatedByZone: byZone,
      quarantinedCount: flagged,
      quarantineFailedCount: quarantineFailed,
      quarantinedSamples: flaggedSamples,
      lastUpdatedAt
    });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
