import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, requireAdmin, readJson, isoNow, newId } from '../../../_utils/http.js';
import { touchLastUpdatedAt } from '../../../_utils/meta.js';

function normStr(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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

    const cleanedRows = [];
    for (const r of rows) {
      const number = String(r?.number || '').trim();
      if (!number) continue;
      cleanedRows.push({
        number,
        state: normStr(r?.state),
        closedAt: normStr(r?.closedAt)
      });
    }

    const CHUNK_SIZE = 10;
    const chunks = chunkArray(cleanedRows, CHUNK_SIZE);

    for (const chunk of chunks) {
      const numbers = chunk.map((r) => r.number);
      if (numbers.length === 0) continue;

      const inPlaceholders = numbers.map(() => '?').join(',');
      const existing = await env.DB.prepare(
        `SELECT number FROM pm_items WHERE month_id = ? AND number IN (${inPlaceholders})`
      )
        .bind(monthId, ...numbers)
        .all();

      const existingSet = new Set((existing?.results || []).map((r) => String(r.number)));
      for (const n of numbers) {
        if (existingSet.has(n)) {
          updated += 1;
        } else {
          missing += 1;
          if (missingNumbers.length < 50) missingNumbers.push(n);
        }
      }

      const insertValues = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const insertArgs = [];
      for (const r of chunk) {
        insertArgs.push(newId(), importId, monthId, r.number, r.state, r.closedAt);
      }
      await env.DB.prepare(
        `INSERT INTO pm_noc_rows (id, import_id, month_id, number, state, closed_at) VALUES ${insertValues}`
      )
        .bind(...insertArgs)
        .run();

      const updValues = chunk.map(() => '(?, ?, ?)').join(',');
      const updArgs = [];
      for (const r of chunk) {
        updArgs.push(r.number, r.state, r.closedAt);
      }

      await env.DB.prepare(
        `WITH upd(number, state, closed_at) AS (VALUES ${updValues})
         UPDATE pm_items
         SET state = COALESCE((SELECT state FROM upd WHERE upd.number = pm_items.number), state),
             closed_at = COALESCE((SELECT closed_at FROM upd WHERE upd.number = pm_items.number), closed_at),
             last_noc_import_at = ?,
             updated_at = ?
         WHERE month_id = ? AND number IN (SELECT number FROM upd)`
      )
        .bind(...updArgs, now, now, monthId)
        .run();
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
