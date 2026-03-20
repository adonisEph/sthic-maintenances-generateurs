import { ensureAdminUser } from '../_utils/db.js';
import { json, readJson, isoNow, newId, requireAuth, isSuperAdmin, userZone, ymdToday } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import { calculateDiffNHs, calculateEstimatedNH, calculateRegime } from '../_utils/calc.js';

const normIdSite = (v) => String(v || '').trim();

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
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

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

    const now = isoNow();

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const idSite = normIdSite(r?.idSite);
      if (!idSite) {
        ignored += 1;
        continue;
      }
      const site = byIdSite.get(idSite);
      if (!site) {
        ignored += 1;
        continue;
      }

      const nextNh2A = r?.nh2A == null || r?.nh2A === '' ? null : Number(r.nh2A);
      const nextDateA = r?.dateA == null || String(r.dateA).trim() === '' ? '' : parseYmd(r.dateA);

      // rule: don't modify a field if value is missing
      const hasNh = Number.isFinite(nextNh2A);
      const hasDate = Boolean(nextDateA);
      if (!hasNh && !hasDate) {
        skipped += 1;
        continue;
      }

      const prevNh2A = site.nh2_a == null ? null : Number(site.nh2_a);
      const prevDateA = site.date_a == null ? '' : String(site.date_a);
      const prevNh1DV = site.nh1_dv == null ? null : Number(site.nh1_dv);
      const prevDateDV = site.date_dv == null ? '' : String(site.date_dv);
      const prevOffset = site.nh_offset == null ? 0 : Number(site.nh_offset);

      const effectivePrev = Number.isFinite(Number(prevNh2A)) ? Number(prevNh2A) : 0;
      const prevRaw = effectivePrev - prevOffset;

      const readingDate = hasDate ? nextDateA : (/^\d{4}-\d{2}-\d{2}$/.test(prevDateA) ? prevDateA : ymdToday());

      // If NH is not provided, keep effective NH2A and offset as-is.
      let effectiveNh = effectivePrev;
      let nextOffset = prevOffset;
      let isReset = 0;
      let readingRawNh = prevRaw;

      if (hasNh) {
        const rawNh = Number(nextNh2A);
        const hasPrev = Number.isFinite(Number(prevNh2A));
        const inputLooksEffective = prevOffset > 0 && rawNh >= effectivePrev;
        isReset = hasPrev && !inputLooksEffective ? (rawNh < prevRaw ? 1 : 0) : 0;
        nextOffset = isReset ? effectivePrev : prevOffset;
        effectiveNh = inputLooksEffective ? rawNh : (nextOffset + rawNh);
        readingRawNh = inputLooksEffective ? (effectiveNh - nextOffset) : rawNh;

        if (Number.isFinite(Number(prevNh1DV)) && effectiveNh < Number(prevNh1DV)) {
          // Invalid reading: ignore line
          ignored += 1;
          continue;
        }
      }

      const regime = calculateRegime(prevNh1DV, effectiveNh, prevDateDV, readingDate);
      const nhEstimated = calculateEstimatedNH(effectiveNh, readingDate, regime);
      const diffNHs = calculateDiffNHs(prevNh1DV, effectiveNh);
      const diffEstimated = calculateDiffNHs(prevNh1DV, nhEstimated);

      await env.DB.prepare(
        'UPDATE sites SET nh2_a = ?, date_a = ?, nh_offset = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
      )
        .bind(effectiveNh, readingDate, nextOffset, regime, nhEstimated, diffNHs, diffEstimated, now, String(site.id))
        .run();

      const rid = newId();
      await env.DB.prepare(
        'INSERT INTO nh_readings (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv, prev_nh_offset, new_nh_offset, is_reset, created_by_user_id, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          rid,
          String(site.id),
          readingDate,
          Math.trunc(Number(readingRawNh) || 0),
          prevNh2A,
          prevDateA,
          prevNh1DV,
          prevDateDV,
          prevOffset,
          nextOffset,
          isReset,
          data?.user?.id ? String(data.user.id) : null,
          data?.user?.email ? String(data.user.email) : null,
          now,
          now
        )
        .run();

      updated += 1;
    }

    if (updated > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, updated, ignored, skipped }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
