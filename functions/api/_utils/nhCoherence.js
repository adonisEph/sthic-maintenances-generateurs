import { isoNow, newId, ymdToday } from './http.js';
import { calculateRegime, calculateEstimatedNH, calculateDiffNHs } from './calc.js';

// Borne physique : un générateur ne peut pas tourner plus de 24 H/J.
export const NH_MAX_REGIME = 24;

// Dernière vidange "ancienne" (≈ 2 mois) : au-delà, un gros écart NH peut être
// légitime (générateur ayant beaucoup tourné sans vidange) — le contrôle
// parasite_high est alors désactivé pour ne pas saturer la quarantaine.
export const NH_STALE_DV_DAYS = 60;

// Canaux d'origine des relevés (colonne nh_readings.source / nh_quarantine.source)
export const NH_SOURCE = {
  AUTO: 'auto',
  MANUAL: 'manual',
  RMS: 'rms',
  VIDANGE: 'vidange',
  EDIT: 'edit',
  QUARANTINE: 'quarantine',
  SCAN: 'scan'
};

const normYmd = (v) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const ymdToMs = (ymd) => {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const daysBetween = (fromYmd, toYmd) => {
  const a = ymdToMs(fromYmd);
  const b = ymdToMs(toYmd);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
};

const num = (v) => (v == null || v === '' ? null : Number(v));

/** Normalisation tolérante des noms de technicien (même règle que GET /api/sites). */
export const normalizeTechName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Matching nom-de-technicien : égalité ou contenu sur forme normalisée. */
export const technicianMatches = (siteTechnician, userTechnicianName) => {
  const key = normalizeTechName(userTechnicianName);
  const tech = normalizeTechName(siteTechnician);
  if (!key || !tech) return false;
  return tech === key || tech.includes(key) || key.includes(tech);
};

/** Nom de technicien effectif : la valeur DB fait foi (session parfois périmée). */
export async function effectiveTechnicianName(env, data) {
  let name = String(data?.user?.technicianName || '').trim();
  try {
    const u = await env.DB
      .prepare('SELECT technician_name FROM users WHERE id = ?')
      .bind(String(data?.user?.id || ''))
      .first();
    const dbName = String(u?.technician_name || '').trim();
    if (dbName) name = dbName;
  } catch {
    // ignore
  }
  return name;
}

/**
 * Évalue un relevé candidat { nh2A, dateA } contre l'état du site (row DB snake_case).
 * Retourne { verdict: 'apply'|'quarantine'|'reject', reason, detail, nh2A, dateA }.
 *
 * Règles (ordre = priorité) :
 *  - invalid_nh / invalid_date : saisie inexploitable
 *  - future_date      : reading_date > aujourd'hui
 *  - date_before_dv   : reading_date < date_dv (antérieur à la dernière vidange)
 *  - nh_below_dv      : nh < nh1_dv → candidat rebase (deepsea/générateur changé)
 *  - parasite_high    : régime implicite > 24 H/J → donnée parasitée
 *  - date_regression  : reading_date < date_a actuelle
 *  - decrease         : nh < nh2_a actuel (compteur ne décroît pas physiquement)
 */
export function evaluateNhCandidate(site, candidate, opts = {}) {
  const todayYmd = normYmd(opts.todayYmd) || ymdToday();

  const nh1Dv = num(site?.nh1_dv);
  const dateDv = normYmd(site?.date_dv);
  const prevNh2A = num(site?.nh2_a);
  const prevDateA = normYmd(site?.date_a);

  const rawNh = candidate?.nh2A;
  const hasNh = rawNh != null && rawNh !== '' && Number.isFinite(Number(rawNh));
  const nh = hasNh ? Number(rawNh) : null;

  const rawDate = candidate?.dateA;
  const dateProvided = rawDate != null && String(rawDate).trim() !== '';
  const dateA = dateProvided ? normYmd(rawDate) : todayYmd;

  if (!hasNh || nh < 0) {
    return { verdict: 'reject', reason: 'invalid_nh', nh2A: nh, dateA };
  }
  if (dateProvided && !normYmd(rawDate)) {
    return { verdict: 'reject', reason: 'invalid_date', nh2A: nh, dateA: String(rawDate).slice(0, 10) };
  }

  const base = { nh2A: nh, dateA };

  if (dateA > todayYmd) {
    return { verdict: 'quarantine', reason: 'future_date', ...base, detail: { todayYmd } };
  }
  if (dateDv && dateA < dateDv) {
    return { verdict: 'quarantine', reason: 'date_before_dv', ...base, detail: { dateDv } };
  }
  if (Number.isFinite(nh1Dv) && nh < nh1Dv) {
    return {
      verdict: 'quarantine',
      reason: 'nh_below_dv',
      ...base,
      detail: { nh1Dv, hint: 'rebase' }
    };
  }
  if (Number.isFinite(nh1Dv) && dateDv) {
    const days = daysBetween(dateDv, dateA);
    const diff = nh - nh1Dv;
    const impliedRegime = days === null ? 0 : days > 0 ? diff / days : diff > 0 ? Infinity : 0;
    const staleDv = Number.isFinite(days) && days >= NH_STALE_DV_DAYS;
    if (impliedRegime > NH_MAX_REGIME && !staleDv) {
      return {
        verdict: 'quarantine',
        reason: 'parasite_high',
        ...base,
        detail: { nh1Dv, dateDv, diff, days, impliedRegime: Math.round(impliedRegime) }
      };
    }
  }
  if (prevDateA && dateA < prevDateA) {
    return { verdict: 'quarantine', reason: 'date_regression', ...base, detail: { prevDateA } };
  }
  if (Number.isFinite(prevNh2A) && nh < prevNh2A) {
    return { verdict: 'quarantine', reason: 'decrease', ...base, detail: { prevNh2A } };
  }

  return { verdict: 'apply', reason: 'ok', ...base };
}

/**
 * Évalue l'état STOCKÉ d'un site (scan auto) — détecte les données déjà corrompues.
 * Retourne { verdict: 'coherent'|'quarantine', reason, detail }.
 */
export function evaluateStoredSite(site, opts = {}) {
  const todayYmd = normYmd(opts.todayYmd) || ymdToday();
  const nh1Dv = num(site?.nh1_dv);
  const dateDv = normYmd(site?.date_dv);
  const nh2A = num(site?.nh2_a);
  const dateA = normYmd(site?.date_a);

  if (!Number.isFinite(nh2A) || !dateA) {
    return { verdict: 'coherent', reason: 'incomplete_data' };
  }
  if (dateA > todayYmd) {
    return { verdict: 'quarantine', reason: 'future_date', detail: { nh2A, dateA, todayYmd } };
  }
  if (dateDv && dateA < dateDv) {
    return { verdict: 'quarantine', reason: 'date_before_dv', detail: { nh2A, dateA, dateDv } };
  }
  if (Number.isFinite(nh1Dv) && nh2A < nh1Dv) {
    return { verdict: 'quarantine', reason: 'nh_below_dv', detail: { nh1Dv, nh2A } };
  }
  if (Number.isFinite(nh1Dv) && dateDv) {
    const days = daysBetween(dateDv, dateA);
    const diff = nh2A - nh1Dv;
    const impliedRegime = days === null ? 0 : days > 0 ? diff / days : diff > 0 ? Infinity : 0;
    const staleDv = Number.isFinite(days) && days >= NH_STALE_DV_DAYS;
    if (impliedRegime > NH_MAX_REGIME && !staleDv) {
      return {
        verdict: 'quarantine',
        reason: 'parasite_high',
        detail: { nh1Dv, dateDv, nh2A, dateA, diff, days, impliedRegime: Math.round(impliedRegime) }
      };
    }
  }
  return { verdict: 'coherent', reason: 'ok' };
}

async function insertNhReading(env, site, { readingDate, nhValue, isReset, source, quarantineId, prev, user }) {
  const rid = newId();
  const now = isoNow();
  await env.DB.prepare(
    `INSERT INTO nh_readings
     (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv,
      prev_nh_offset, new_nh_offset, is_reset, source, quarantine_id,
      created_by_user_id, created_by_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      rid,
      String(site.id),
      String(readingDate),
      Math.trunc(Number(nhValue) || 0),
      prev?.nh2A ?? null,
      prev?.dateA ?? null,
      prev?.nh1DV ?? null,
      prev?.dateDV ?? null,
      prev?.nhOffset ?? null,
      0,
      isReset ? 1 : 0,
      String(source || ''),
      quarantineId || null,
      user?.id ? String(user.id) : null,
      user?.email ? String(user.email) : null,
      now,
      now
    )
    .run();
  return rid;
}

const prevSnapshot = (site) => ({
  nh2A: num(site?.nh2_a),
  dateA: normYmd(site?.date_a),
  nh1DV: num(site?.nh1_dv),
  dateDV: normYmd(site?.date_dv),
  nhOffset: num(site?.nh_offset) ?? 0
});

/**
 * Clôture les quarantaines pending d'un site quand une valeur cohérente est appliquée.
 */
export async function supersedePendingQuarantine(env, siteId, now, note) {
  try {
    await env.DB.prepare(
      `UPDATE nh_quarantine SET status = 'superseded', updated_at = ?, detail = COALESCE(detail, '') || ? WHERE site_id = ? AND status = 'pending'`
    )
      .bind(now, String(note ? ` | ${note}` : ''), String(siteId))
      .run();
  } catch {
    // table absente : ignorer
  }
}

/**
 * Applique un relevé cohérent : met à jour UNIQUEMENT nh2_a/date_a (+ dérivés),
 * ne touche JAMAIS nh1_dv/date_dv. Écrit l'audit nh_readings.
 */
export async function applyNhReading(env, site, { nh2A, dateA }, ctx = {}) {
  const prev = prevSnapshot(site);
  const nh = Number(nh2A);
  const date = normYmd(dateA) || ymdToday();
  const now = isoNow();

  let regime = calculateRegime(prev.nh1DV, nh, prev.dateDV, date);
  if (!Number.isFinite(regime) || regime <= 0 || regime > NH_MAX_REGIME) {
    regime = Number(site?.regime) > 0 ? Number(site.regime) : 0;
  }
  const nhEstimated = calculateEstimatedNH(nh, date, regime);
  const diffNHs = calculateDiffNHs(prev.nh1DV, nh);
  const diffEstimated = calculateDiffNHs(prev.nh1DV, nhEstimated);

  await env.DB.prepare(
    'UPDATE sites SET nh2_a = ?, date_a = ?, nh_offset = 0, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
  )
    .bind(nh, date, regime, nhEstimated, diffNHs, diffEstimated, now, String(site.id))
    .run();

  const readingId = await insertNhReading(env, site, {
    readingDate: date,
    nhValue: nh,
    isReset: false,
    source: ctx.source || NH_SOURCE.MANUAL,
    quarantineId: ctx.quarantineId || null,
    prev,
    user: ctx.user
  });

  await supersedePendingQuarantine(env, site.id, now, 'coherent_value_applied');

  return {
    readingId,
    site: {
      ...site,
      nh2_a: nh,
      date_a: date,
      nh_offset: 0,
      regime,
      nh_estimated: nhEstimated,
      diff_nhs: diffNHs,
      diff_estimated: diffEstimated,
      updated_at: now
    }
  };
}

/**
 * Rebase : compteur/deepsea/générateur changé → nh2_a_new devient la nouvelle base.
 * nh1_dv := nh2_a_new, date_dv := reading_date ; diff repart à 0. Régime conservé.
 */
export async function rebaseSite(env, site, { nh2A, dateA }, ctx = {}) {
  const prev = prevSnapshot(site);
  const nh = Number(nh2A);
  const date = normYmd(dateA) || ymdToday();
  const now = isoNow();

  const regime = Number(site?.regime) > 0 ? Number(site.regime) : 0;

  await env.DB.prepare(
    'UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, nh_offset = 0, regime = ?, nh_estimated = ?, diff_nhs = 0, diff_estimated = 0, updated_at = ? WHERE id = ?'
  )
    .bind(nh, date, nh, date, regime, nh, now, String(site.id))
    .run();

  const readingId = await insertNhReading(env, site, {
    readingDate: date,
    nhValue: nh,
    isReset: true,
    source: ctx.source || NH_SOURCE.QUARANTINE,
    quarantineId: ctx.quarantineId || null,
    prev,
    user: ctx.user
  });

  await supersedePendingQuarantine(env, site.id, now, 'rebase_applied');

  return {
    readingId,
    site: {
      ...site,
      nh1_dv: nh,
      date_dv: date,
      nh2_a: nh,
      date_a: date,
      nh_offset: 0,
      regime,
      nh_estimated: nh,
      diff_nhs: 0,
      diff_estimated: 0,
      updated_at: now
    }
  };
}

/**
 * Enregistre (ou met à jour) une entrée de quarantaine pending pour un site.
 * Dédupliqué : un seul pending par site — le dernier état observé gagne.
 */
export async function recordQuarantine(env, site, entry, ctx = {}) {
  const now = isoNow();
  const proposed = {
    nh2A: entry?.proposedNh2A != null ? Number(entry.proposedNh2A) : null,
    dateA: normYmd(entry?.proposedDateA) || null
  };
  const prev = prevSnapshot(site);
  const detailJson = entry?.detail ? JSON.stringify(entry.detail) : null;
  const userId = ctx?.user?.id ? String(ctx.user.id) : null;
  const userEmail = ctx?.user?.email ? String(ctx.user.email) : null;

  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM nh_quarantine WHERE site_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
    )
      .bind(String(site.id))
      .first();

    if (existing?.id) {
      await env.DB.prepare(
        `UPDATE nh_quarantine SET source = ?, reason = ?, proposed_nh2_a = ?, proposed_date_a = ?,
         prev_nh1_dv = ?, prev_date_dv = ?, prev_nh2_a = ?, prev_date_a = ?, prev_nh_offset = ?,
         detail = ?, created_by_user_id = ?, created_by_email = ?, updated_at = ? WHERE id = ?`
      )
        .bind(
          String(entry?.source || ''),
          String(entry?.reason || ''),
          proposed.nh2A,
          proposed.dateA,
          prev.nh1DV,
          prev.dateDV,
          prev.nh2A,
          prev.dateA,
          prev.nhOffset,
          detailJson,
          userId,
          userEmail,
          now,
          String(existing.id)
        )
        .run();
      return { id: String(existing.id), created: false };
    }

    const id = newId();
    await env.DB.prepare(
      `INSERT INTO nh_quarantine
       (id, site_id, zone, source, reason, proposed_nh2_a, proposed_date_a,
        prev_nh1_dv, prev_date_dv, prev_nh2_a, prev_date_a, prev_nh_offset,
        detail, status, created_by_user_id, created_by_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    )
      .bind(
        id,
        String(site.id),
        String(site?.zone || ctx?.zone || 'BZV/POOL'),
        String(entry?.source || ''),
        String(entry?.reason || ''),
        proposed.nh2A,
        proposed.dateA,
        prev.nh1DV,
        prev.dateDV,
        prev.nh2A,
        prev.dateA,
        prev.nhOffset,
        detailJson,
        userId,
        userEmail,
        now,
        now
      )
      .run();
    return { id, created: true };
  } catch (e) {
    // Jamais avalé en silence : l'appelant doit pouvoir signaler l'échec.
    return { id: null, created: false, error: true, message: e?.message || 'Écriture quarantaine impossible.' };
  }
}
