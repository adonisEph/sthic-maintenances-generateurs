import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, requireAdmin, isSuperAdmin, userZone } from '../../../_utils/http.js';

function normZone(v) {
  return String(v || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer' || role === 'manager';
}

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    planId: r.plan_id,
    monthId: r.month_id,
    month: r.month,
    number: r.number,
    siteCode: r.site_code,
    siteName: r.site_name,
    region: r.region,
    zone: r.zone,
    shortDescription: r.short_description,
    maintenanceType: r.maintenance_type,
    scheduledWoDate: r.scheduled_wo_date,
    assignedTo: r.assigned_to,
    state: r.state,
    epv2: r.epv2,
    epv3: r.epv3,
    pairSiteCode: r.pair_site_code,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export async function onRequestGet({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdminOrViewer(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const role = String(data?.user?.role || '');

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const monthRow = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(monthId).first();
    if (!monthRow) return json({ error: 'Mois introuvable.' }, { status: 404 });

    const url = new URL(request.url);
    const sp = url.searchParams;

    const qZone = normZone(sp.get('zone'));
    const qPlanId = String(sp.get('planId') || '').trim();

    const zones = (() => {
      if (isSuperAdmin(data) || role === 'viewer') {
        if (qZone) return [qZone];
        return null; // all zones
      }
      return [normZone(userZone(data))];
    })();

    const where = ['month_id = ?'];
    const bind = [monthId];

    if (qPlanId) {
      where.push('plan_id = ?');
      bind.push(qPlanId);
    }

    if (Array.isArray(zones) && zones.length > 0) {
      where.push(`UPPER(TRIM(REPLACE(zone, '\u00A0', ' '))) IN (${zones.map(() => '?').join(', ')})`);
      bind.push(...zones);
    }

    const stmt = env.DB.prepare(
      `SELECT * FROM pm_global_plan_items WHERE ${where.join(' AND ')} ORDER BY zone ASC, scheduled_wo_date ASC, COALESCE(number, '') ASC, COALESCE(site_code, '') ASC`
    ).bind(...bind);

    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    return json(
      {
        monthId,
        month: String(monthRow?.month || ''),
        items: rows.map(mapRow).filter(Boolean)
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });
    return json({ error: 'Méthode non supportée.' }, { status: 405 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
