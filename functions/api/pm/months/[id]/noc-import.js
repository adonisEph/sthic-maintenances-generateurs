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
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const filename = normStr(body?.filename);

    const now = isoNow();
    const importId = newId();

    let updated = 0;
    let missing = 0;
    const missingNumbers = [];

    await env.DB.prepare(
      'INSERT INTO pm_imports (id, month_id, kind, imported_at, filename, row_count, created_by_user_id, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        importId,
        monthId,
        'noc',
        now,
        filename,
        rows.length,
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null
      )
      .run();

    for (const r of rows) {
      const number = String(r?.number || '').trim();
      if (!number) continue;

      const state = normStr(r?.state);
      const closedAt = normStr(r?.closedAt);

      const rowId = newId();
      await env.DB.prepare('INSERT INTO pm_noc_rows (id, import_id, month_id, number, state, closed_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(rowId, importId, monthId, number, state, closedAt)
        .run();

      const res = await env.DB.prepare(
        'UPDATE pm_items SET state = COALESCE(?, state), closed_at = COALESCE(?, closed_at), last_noc_import_at = ?, updated_at = ? WHERE month_id = ? AND number = ?'
      )
        .bind(state, closedAt, now, now, monthId, number)
        .run();

      const changes = Number(res?.meta?.changes || 0);
      if (changes > 0) {
        updated += 1;
      } else {
        missing += 1;
        if (missingNumbers.length < 50) missingNumbers.push(number);
      }
    }

    await env.DB.prepare('UPDATE pm_months SET updated_at = ? WHERE id = ?').bind(now, monthId).run();

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        updated,
        missing,
        missingNumbers
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
