import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone } from '../_utils/http.js';

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    planId: r.plan_id,
    month: r.month,
    zone: r.zone,
    siteId: r.site_id,
    siteCode: r.site_code,
    siteName: r.site_name,
    region: r.region,
    shortDescription: r.short_description,
    number: r.number,
    assignedTo: r.assigned_to,
    technicianUserId: r.technician_user_id,
    scheduledWoDate: r.scheduled_wo_date,
    dateOfClosing: r.date_of_closing,
    state: r.state,
    epv2: r.epv2,
    epv3: r.epv3,
    pairSiteCode: r.pair_site_code,
    pairSiteId: r.pair_site_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'viewer') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const month = String(url.searchParams.get('month') || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'month invalide (YYYY-MM).' }, { status: 400 });

    const requestedZone = String(url.searchParams.get('zone') || '').trim();
    const scopeZone = (role === 'admin' || role === 'manager') && !isSuperAdmin(data) ? userZone(data) : null;

    const zone = scopeZone ? String(scopeZone) : requestedZone;
    if (!zone) return json({ error: 'zone requise.' }, { status: 400 });

    if (scopeZone && String(zone) !== String(scopeZone)) {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const plan = await env.DB.prepare('SELECT * FROM intelligent_plans WHERE month = ? AND zone = ?').bind(month, zone).first();
    if (!plan?.id) {
      return json({ month, zone, items: [] }, { status: 200 });
    }

    const res = await env.DB.prepare(
      'SELECT * FROM intelligent_plan_items WHERE plan_id = ? ORDER BY scheduled_wo_date ASC, COALESCE(site_code, \'\') ASC'
    )
      .bind(String(plan.id))
      .all();

    const rows = Array.isArray(res?.results) ? res.results : [];

    return json(
      {
        month,
        zone,
        planId: String(plan.id),
        generatedAt: plan.generated_at,
        items: rows.map(mapRow).filter(Boolean)
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
