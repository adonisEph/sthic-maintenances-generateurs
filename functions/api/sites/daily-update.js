import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isoNow, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function ymdInTimeZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function ymdToUtcMs(ymd) {
  const src = String(ymd || '').slice(0, 10);
  const m = src.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export async function onRequestPost({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const timeZone = 'Africa/Brazzaville';
    const todayYmd = ymdInTimeZone(new Date(), timeZone);

    const z = userZone(data);
    const selectStmt = isSuperAdmin(data)
      ? env.DB.prepare('SELECT id, nh2_a, date_a, regime, nh1_dv, retired FROM sites')
      : env.DB
          .prepare(
            "SELECT id, nh2_a, date_a, regime, nh1_dv, retired FROM sites WHERE zone = ? OR zone IS NULL OR TRIM(zone) = ''"
          )
          .bind(z);

    const res = await selectStmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    const todayMs = ymdToUtcMs(todayYmd);
    const now = isoNow();

    let updated = 0;
    let skippedNoDateA = 0;
    let skippedNoRegime = 0;

    const updateStmt = env.DB.prepare(
      'UPDATE sites SET nh2_a = ?, date_a = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
    );

    for (const row of rows) {
      const prevDateA = String(row?.date_a || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(prevDateA)) {
        skippedNoDateA += 1;
        continue;
      }

      const r = Number(row?.regime);
      if (!Number.isFinite(r) || r <= 0) {
        skippedNoRegime += 1;
        continue;
      }

      const prevMs = ymdToUtcMs(prevDateA);
      if (!Number.isFinite(prevMs)) {
        skippedNoDateA += 1;
        continue;
      }

      const daysSince = Math.floor((todayMs - prevMs) / (1000 * 60 * 60 * 24));
      if (!Number.isFinite(daysSince) || daysSince <= 0) continue;

      const prevNh2A = Number(row?.nh2_a || 0);
      const nh1Dv = Number(row?.nh1_dv || 0);
      const nextNh2A = prevNh2A + (r * daysSince);
      const nextDiff = nextNh2A - nh1Dv;

      await updateStmt.bind(nextNh2A, todayYmd, nextNh2A, nextDiff, nextDiff, now, row.id).run();
      updated += 1;
    }

    if (updated > 0) {
      await touchLastUpdatedAt(env);
    }

    return json(
      {
        ok: true,
        today: todayYmd,
        updated,
        skipped: updated === 0,
        skippedNoDateA,
        skippedNoRegime
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
