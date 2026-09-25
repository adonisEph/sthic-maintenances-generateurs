import { ensureAdminUser } from '../_utils/db.js';
import { json, readJson, requireAuth, isSuperAdmin, userZone, ymdToday } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import {
  NH_SOURCE,
  evaluateNhCandidate,
  applyNhReading,
  recordQuarantine
} from '../_utils/nhCoherence.js';

const normIdSite = (v) =>
  String(v || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const parseYmd = (v) => {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  return s.slice(0, 10);
};

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    const z = String(userZone(data) || 'BZV/POOL');
    const canAllZones = isSuperAdmin(data);

    if (rows.length === 0) {
      return json({ ok: true, updated: 0, ignored: 0, skipped: 0 }, { status: 200 });
    }

    const sitesRes = canAllZones
      ? await env.DB.prepare('SELECT * FROM sites').all()
      : await env.DB.prepare('SELECT * FROM sites WHERE zone = ?').bind(z).all();
    const sites = Array.isArray(sitesRes?.results) ? sitesRes.results : [];
    const byIdSite = new Map(sites.map((s) => [normIdSite(s?.id_site), s]).filter(([k]) => Boolean(k)));

    let updated = 0;
    let ignored = 0;
    let skipped = 0;
    let quarantined = 0;
    let quarantineFailed = 0;

    let ignoredBadDate = 0;
    let ignoredDateBeforeDv = 0;
    let ignoredDecrease = 0;
    let ignoredMissingId = 0;
    let ignoredUnknownId = 0;
    let ignoredNhBelowDv = 0;
    let ignoredRetired = 0;
    let quarantinedNhBelowDv = 0;
    let quarantinedNhAbnormallyHigh = 0;
    let quarantinedRetired = 0;
    let quarantinedOther = 0;

    const ignoredSamples = [];
    const quarantinedSamples = [];
    const pushIgnoredSample = (reason, r, idx, extra = {}) => {
      if (ignoredSamples.length >= 80) return;
      ignoredSamples.push({
        reason,
        row: Number(idx) + 1,
        idSite: String(r?.idSite || ''),
        nh2A: r?.nh2A == null ? null : Number(r.nh2A),
        dateA: r?.dateA == null ? '' : String(r.dateA),
        ...extra
      });
    };
    const pushQuarantinedSample = (reason, r, idx, extra = {}) => {
      if (quarantinedSamples.length >= 80) return;
      quarantinedSamples.push({
        reason,
        row: Number(idx) + 1,
        idSite: String(r?.idSite || ''),
        nh2A: r?.nh2A == null ? null : Number(r.nh2A),
        dateA: r?.dateA == null ? '' : String(r.dateA),
        ...extra
      });
    };

    const todayYmd = ymdToday();

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const idSite = normIdSite(r?.idSite);
      if (!idSite) {
        ignored += 1;
        ignoredMissingId += 1;
        pushIgnoredSample('missing_id_site', r, i);
        continue;
      }
      const site = byIdSite.get(idSite);
      if (!site) {
        ignored += 1;
        ignoredUnknownId += 1;
        pushIgnoredSample('unknown_id_site', r, i, { normalizedIdSite: idSite });
        continue;
      }

      const nextNh2A = r?.nh2A == null || r?.nh2A === '' ? null : Number(r.nh2A);
      const nextDateA = r?.dateA == null || String(r.dateA).trim() === '' ? '' : parseYmd(r.dateA);

      const hasNh = Number.isFinite(nextNh2A);
      if (!hasNh) {
        // Sans compteur, une ligne RMS n'apporte rien d'exploitable.
        skipped += 1;
        continue;
      }
      // Sans date fournie : relevé daté d'aujourd'hui (jamais la date_a précédente —
      // sinon la prochaine projection gonflerait le compteur).
      const readingDate = nextDateA || todayYmd;

      // Évaluation unifiée : mêmes règles que Auto et Manuel.
      // INVARIANT : nh1_dv / date_dv ne sont jamais modifiés par ce canal.
      // Sites retirés : TOUT relevé est systématiquement quarantiné pour
      // remise en cohérence manuelle — jamais appliqué automatiquement.
      const verdict = evaluateNhCandidate(site, { nh2A: nextNh2A, dateA: readingDate }, { todayYmd });
      const isRetired = site?.retired === true || site?.retired === 1
        || String(site?.retired || '').trim().toLowerCase() === 'true';
      const effectiveVerdict = isRetired && verdict.verdict === 'apply'
        ? { ...verdict, verdict: 'quarantine', reason: 'retired_site', detail: { ...(verdict.detail || {}), retired: true } }
        : verdict;

      if (effectiveVerdict.verdict === 'reject') {
        ignored += 1;
        ignoredBadDate += 1;
        pushIgnoredSample(effectiveVerdict.reason, r, i, { normalizedIdSite: idSite });
        continue;
      }

      if (effectiveVerdict.verdict === 'quarantine') {
        const rec = await recordQuarantine(
          env,
          site,
          {
            source: NH_SOURCE.RMS,
            reason: effectiveVerdict.reason,
            proposedNh2A: effectiveVerdict.nh2A,
            proposedDateA: effectiveVerdict.dateA,
            detail: { ...(effectiveVerdict.detail || {}), rmsRow: i + 1, retired: isRetired === true }
          },
          { user: data?.user, zone: site?.zone }
        );
        if (rec?.error) {
          // Incohérence détectée mais NON persistée : le récap doit le signaler
          // au lieu de laisser croire que la quarantaine contient l'entrée.
          quarantineFailed += 1;
          pushIgnoredSample('quarantine_write_failed', r, i, {
            normalizedIdSite: idSite,
            siteId: String(site.id),
            verdictReason: effectiveVerdict.reason,
            writeError: rec?.message || null
          });
        } else {
          quarantined += 1;
          if (effectiveVerdict.reason === 'nh_below_dv') quarantinedNhBelowDv += 1;
          else if (effectiveVerdict.reason === 'parasite_high') quarantinedNhAbnormallyHigh += 1;
          else if (effectiveVerdict.reason === 'retired_site') quarantinedRetired += 1;
          else quarantinedOther += 1;
          pushQuarantinedSample(effectiveVerdict.reason, r, i, {
            normalizedIdSite: idSite,
            siteId: String(site.id),
            quarantineId: rec?.id || null,
            prevNh1DV: site?.nh1_dv,
            prevNh2A: site?.nh2_a,
            detail: effectiveVerdict.detail || null
          });
        }
        continue;
      }

      await applyNhReading(
        env,
        site,
        { nh2A: effectiveVerdict.nh2A, dateA: effectiveVerdict.dateA },
        { source: NH_SOURCE.RMS, user: data?.user }
      );
      updated += 1;
    }

    if (updated > 0 || quarantined > 0) {
      await touchLastUpdatedAt(env);
    }

    return json(
      {
        ok: true,
        updated,
        ignored,
        skipped,
        quarantined,
        quarantineFailed,
        ignoredMissingId,
        ignoredUnknownId,
        ignoredBadDate,
        ignoredDateBeforeDv,
        ignoredDecrease,
        ignoredNhBelowDv,
        ignoredRetired,
        quarantinedNhBelowDv,
        quarantinedNhAbnormallyHigh,
        quarantinedRetired,
        quarantinedOther,
        ignoredSamples,
        quarantinedSamples
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
