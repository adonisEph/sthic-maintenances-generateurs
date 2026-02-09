import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

function requireAdminOrViewer(data) {
  const role = String(data?.user?.role || '');
  return role === 'admin' || role === 'viewer' || role === 'manager';
}

function mapItemRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    monthId: r.month_id,
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
    closedAt: r.closed_at,
    reprogrammationDate: r.reprogrammation_date,
    reprogrammationReason: r.reprogrammation_reason,
    reprogrammationStatus: r.reprogrammation_status,
    lastNocImportAt: r.last_noc_import_at,
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

    const url = new URL(request.url);
    const sp = url.searchParams;
    const q = String(sp.get('q') || '').trim();
    const state = String(sp.get('state') || '').trim();
    const date = String(sp.get('date') || '').trim();
    const from = String(sp.get('from') || '').trim();
    const to = String(sp.get('to') || '').trim();
    const reprog = String(sp.get('reprog') || '').trim();
    const reprogStatus = String(sp.get('reprogStatus') || '').trim();

    const where = ['month_id = ?'];
    const bind = [monthId];

    // Scope zone: super-admin + viewer voit tout, sinon zone du user
    if (!isSuperAdmin(data) && role !== 'viewer') {
      where.push("COALESCE(region, zone, '') = ?");
      bind.push(String(userZone(data) || 'BZV/POOL'));
    }

    if (date) {
      where.push("substr(scheduled_wo_date, 1, 10) = ?");
      bind.push(date.slice(0, 10));
    } else {
      if (from) {
        where.push("substr(scheduled_wo_date, 1, 10) >= ?");
        bind.push(from.slice(0, 10));
      }
      if (to) {
        where.push("substr(scheduled_wo_date, 1, 10) <= ?");
        bind.push(to.slice(0, 10));
      }
    }

    if (state && state !== 'all') {
      where.push('state = ?');
      bind.push(state);
    }

    if (reprog === 'only') {
      where.push('(reprogrammation_date IS NOT NULL OR reprogrammation_status IS NOT NULL OR reprogrammation_reason IS NOT NULL)');
    } else if (reprog === 'none') {
      where.push('(reprogrammation_date IS NULL AND reprogrammation_status IS NULL AND reprogrammation_reason IS NULL)');
    }

    if (reprogStatus) {
      where.push('reprogrammation_status = ?');
      bind.push(reprogStatus);
    }

    if (q) {
      where.push(
        '(' +
          [
            'number',
            'site_code',
            'site_name',
            'region',
            'zone',
            'short_description',
            'maintenance_type',
            'assigned_to',
            'state'
          ]
            .map((c) => `${c} LIKE ?`)
            .join(' OR ') +
          ')'
      );
      const like = `%${q}%`;
      bind.push(like, like, like, like, like, like, like, like, like);
    }

    const sql = `SELECT * FROM pm_items WHERE ${where.join(' AND ')} ORDER BY scheduled_wo_date ASC, number ASC`;
    const res = await env.DB.prepare(sql).bind(...bind).all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    return json({ items: rows.map(mapItemRow) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

function normStr(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

export async function onRequestPatch({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const body = await readJson(request);
    const id = String(body?.id || '').trim();
    if (!id) return json({ error: 'ID requis.' }, { status: 400 });

    const reprogrammationDateRaw = body?.reprogrammationDate;
    const reprogrammationStatusRaw = body?.reprogrammationStatus;
    const reprogrammationReasonRaw = body?.reprogrammationReason;

    const reprogrammationDate = reprogrammationDateRaw == null ? null : normStr(reprogrammationDateRaw);
    if (reprogrammationDate && !/^\d{4}-\d{2}-\d{2}$/.test(reprogrammationDate)) {
      return json({ error: 'Date invalide.' }, { status: 400 });
    }

    const reprogrammationStatus = reprogrammationStatusRaw == null ? null : normStr(reprogrammationStatusRaw);
    if (reprogrammationStatus && !['APPROVED', 'REJECTED', 'PENDING'].includes(reprogrammationStatus)) {
      return json({ error: 'Statut invalide.' }, { status: 400 });
    }

    const reprogrammationReason = reprogrammationReasonRaw == null ? null : normStr(reprogrammationReasonRaw);

    const existing = await env.DB.prepare('SELECT * FROM pm_items WHERE id = ? AND month_id = ?').bind(id, monthId).first();
    if (!existing) return json({ error: 'Ticket introuvable.' }, { status: 404 });

    if (!isSuperAdmin(data)) {
      const z = String(userZone(data) || 'BZV/POOL');
      const itemZone = String(existing?.region || existing?.zone || '').trim();
      if (!itemZone || itemZone !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const now = isoNow();
    await env.DB.prepare(
      'UPDATE pm_items SET reprogrammation_date = ?, reprogrammation_status = ?, reprogrammation_reason = ?, updated_at = ? WHERE id = ? AND month_id = ?'
    )
      .bind(reprogrammationDate, reprogrammationStatus, reprogrammationReason, now, id, monthId)
      .run();

    await touchLastUpdatedAt(env);

    const updated = await env.DB.prepare('SELECT * FROM pm_items WHERE id = ? AND month_id = ?').bind(id, monthId).first();
    return json({ item: mapItemRow(updated) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
