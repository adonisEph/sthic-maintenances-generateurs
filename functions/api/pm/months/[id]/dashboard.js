import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, ymdToday } from '../../../_utils/http.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer';
}

function normState(s) {
  return String(s || '').trim().toLowerCase();
}

function bucketForState(state) {
  const v = normState(state);
  if (v === 'closed complete' || v === 'closed') return 'done';
  if (v === 'awaiting closure' || v === 'awaiting') return 'awaiting';
  if (v === 'work in progress' || v === 'wip') return 'wip';
  if (v === 'assigned') return 'assigned';
  return 'other';
}

export async function onRequestGet({ env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const today = ymdToday();

    const res = await env.DB.prepare('SELECT state, scheduled_wo_date, maintenance_type, zone FROM pm_items WHERE month_id = ?')
      .bind(monthId)
      .all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    const totals = {
      total: 0,
      done: 0,
      wip: 0,
      awaiting: 0,
      assigned: 0,
      other: 0,
      overdueAssigned: 0,
      remaining: 0,
      donePct: 0
    };

    const byZone = {};
    const byType = {};

    for (const r of rows) {
      totals.total += 1;
      const bucket = bucketForState(r?.state);
      totals[bucket] += 1;

      const sched = r?.scheduled_wo_date ? String(r.scheduled_wo_date).slice(0, 10) : '';
      if (bucket === 'assigned' && sched && sched < today) totals.overdueAssigned += 1;

      const zone = String(r?.zone || '').trim() || 'N/A';
      const typ = String(r?.maintenance_type || '').trim() || 'N/A';

      if (!byZone[zone]) byZone[zone] = { zone, total: 0, done: 0, wip: 0, awaiting: 0, assigned: 0, other: 0, overdueAssigned: 0 };
      if (!byType[typ]) byType[typ] = { maintenanceType: typ, total: 0, done: 0, wip: 0, awaiting: 0, assigned: 0, other: 0, overdueAssigned: 0 };

      byZone[zone].total += 1;
      byZone[zone][bucket] += 1;
      if (bucket === 'assigned' && sched && sched < today) byZone[zone].overdueAssigned += 1;

      byType[typ].total += 1;
      byType[typ][bucket] += 1;
      if (bucket === 'assigned' && sched && sched < today) byType[typ].overdueAssigned += 1;
    }

    totals.remaining = Math.max(0, totals.total - totals.done);
    totals.donePct = totals.total > 0 ? Math.round((totals.done / totals.total) * 1000) / 10 : 0;

    const zones = Object.values(byZone).sort((a, b) => String(a.zone).localeCompare(String(b.zone)));
    const types = Object.values(byType).sort((a, b) => String(a.maintenanceType).localeCompare(String(b.maintenanceType)));

    return json(
      {
        monthId,
        today,
        totals,
        zones,
        types
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
