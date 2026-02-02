import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, ymdToday, isoNow, readJson, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function ymdAddDays(ymd, days) {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const providedPlannedDate = String(body?.plannedDate || '').trim();

    const today = ymdToday();
    const tomorrow = ymdAddDays(today, 1);
    const plannedDate = providedPlannedDate || tomorrow;
    const now = isoNow();

    const z = userZone(data);

    const stmt = isSuperAdmin(data)
      ? env.DB.prepare(
          "UPDATE interventions SET status = 'sent', sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE planned_date = ? AND status = 'planned'"
        ).bind(now, now, plannedDate)
      : env.DB.prepare(
          "UPDATE interventions SET status = 'sent', sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE zone = ? AND planned_date = ? AND status = 'planned'"
        ).bind(now, now, z, plannedDate);

    const res = await stmt.run();

    if ((res?.meta?.changes || 0) > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, plannedDate, updated: res?.meta?.changes || 0 }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
