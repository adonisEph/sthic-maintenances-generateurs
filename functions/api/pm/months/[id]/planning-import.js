import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, requireAdmin, readJson, isoNow, newId } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

function normStr(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!requireAdmin(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const month = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(monthId).first();
    if (!month) return json({ error: 'Mois introuvable.' }, { status: 404 });

    const body = await readJson(request);
    const items = Array.isArray(body?.items) ? body.items : [];
    const filename = normStr(body?.filename);

    const now = isoNow();

    await env.DB.prepare('DELETE FROM pm_items WHERE month_id = ?').bind(monthId).run();

    let inserted = 0;
    for (const it of items) {
      const number = String(it?.number || '').trim();
      if (!number) continue;

      const id = newId();
      await env.DB.prepare(
        'INSERT INTO pm_items (id, month_id, number, site_code, site_name, region, zone, short_description, maintenance_type, scheduled_wo_date, assigned_to, state, closed_at, reprogrammation_date, reprogrammation_reason, reprogrammation_status, last_noc_import_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          id,
          monthId,
          number,
          normStr(it?.siteCode),
          normStr(it?.siteName),
          normStr(it?.region),
          normStr(it?.zone),
          normStr(it?.shortDescription),
          normStr(it?.maintenanceType),
          normStr(it?.scheduledWoDate),
          normStr(it?.assignedTo),
          String(it?.state || 'Assigned'),
          normStr(it?.closedAt),
          normStr(it?.reprogrammationDate),
          normStr(it?.reprogrammationReason),
          normStr(it?.reprogrammationStatus),
          null,
          now,
          now
        )
        .run();
      inserted += 1;
    }

    const importId = newId();
    await env.DB.prepare(
      'INSERT INTO pm_imports (id, month_id, kind, imported_at, filename, row_count, created_by_user_id, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        importId,
        monthId,
        'planning',
        now,
        filename,
        inserted,
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null
      )
      .run();

    await env.DB.prepare('UPDATE pm_months SET updated_at = ? WHERE id = ?').bind(now, monthId).run();

    await touchLastUpdatedAt(env);

    return json({ ok: true, inserted }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
