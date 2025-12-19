import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAdmin, ymdToday, isoNow } from '../_utils/http.js';

function ymdAddDays(ymd, days) {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function onRequestPost({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const today = ymdToday();
    const tomorrow = ymdAddDays(today, 1);
    const now = isoNow();

    const res = await env.DB.prepare(
      "UPDATE interventions SET status = 'sent', sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE planned_date = ? AND status = 'planned'"
    )
      .bind(now, now, tomorrow)
      .run();

    return json({ ok: true, plannedDate: tomorrow, updated: res?.meta?.changes || 0 }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
