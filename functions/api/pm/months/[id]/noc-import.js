import { ensureAdminUser } from '../../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../../../_utils/http.js';
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

function normalizeYmd(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const ymd = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const monthId = String(params?.id || '').trim();
    if (!monthId) return json({ error: 'Mois requis.' }, { status: 400 });

    const month = await env.DB.prepare('SELECT * FROM pm_months WHERE id = ?').bind(monthId).first();
    if (!month) return json({ error: 'Mois introuvable.' }, { status: 404 });

    const body = await readJson(request);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const filename = normStr(body?.filename);

    const now = isoNow();
    const importId = newId();

    const scopeZone = isSuperAdmin(data) ? null : String(userZone(data) || 'BZV/POOL');

    let updated = 0;
    let missing = 0;
    let createdMissing = 0;
    let missingNotCreated = 0;
    const missingNumbers = [];
    const notCreatedNumbers = [];

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
        closedAt: normStr(r?.closedAt),
        siteCode: normStr(r?.siteCode),
        shortDescription: normStr(r?.shortDescription),
        scheduledWoDate: normalizeYmd(r?.scheduledWoDate),
        assignedTo: normStr(r?.assignedTo)
      });
    }

    const CHUNK_SIZE = 10;
    const chunks = chunkArray(cleanedRows, CHUNK_SIZE);

    for (const chunk of chunks) {
      const numbers = chunk.map((r) => r.number);
      if (numbers.length === 0) continue;

      const inPlaceholders = numbers.map(() => '?').join(',');
      const existing = scopeZone
        ? await env.DB.prepare(
            `SELECT number FROM pm_items WHERE month_id = ? AND COALESCE(region, zone, '') = ? AND number IN (${inPlaceholders})`
          )
            .bind(monthId, scopeZone, ...numbers)
            .all()
        : await env.DB.prepare(
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

      const missingChunk = chunk.filter((r) => !existingSet.has(r.number));
      if (missingChunk.length > 0) {
        const missingChunkNumbers = missingChunk.map((r) => String(r?.number || '').trim()).filter(Boolean);
        const siteCodes = Array.from(
          new Set(
            missingChunk
              .map((r) => String(r?.siteCode || '').trim())
              .filter(Boolean)
          )
        );
        const siteMap = new Map();
        if (siteCodes.length > 0) {
          const inSites = siteCodes.map(() => '?').join(',');
          const stmt = env.DB.prepare(
            `SELECT id_site, name_site, technician, zone FROM sites WHERE id_site IN (${inSites})`
          ).bind(...siteCodes);
          const resSites = await stmt.all();
          for (const s of resSites?.results || []) {
            const k = String(s?.id_site || '').trim();
            if (!k) continue;
            siteMap.set(k, s);
          }
        }

        const insertPmValues = missingChunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const insertPmArgs = [];
        for (const r of missingChunk) {
          const code = String(r?.siteCode || '').trim();
          const s = code ? siteMap.get(code) : null;
          const z = scopeZone || String(s?.zone || '').trim() || null;
          insertPmArgs.push(
            newId(),
            monthId,
            r.number,
            code || null,
            s?.name_site ? String(s.name_site) : null,
            z,
            z,
            r.shortDescription,
            'FullPMWO',
            r.scheduledWoDate,
            r.assignedTo || (s?.technician ? String(s.technician) : null),
            'noc',
            r.state || 'Assigned',
            r.closedAt,
            now,
            now,
            now
          );
        }

        const insertPmSql =
          `INSERT OR IGNORE INTO pm_items (` +
          `id, month_id, number, site_code, site_name, region, zone, short_description, maintenance_type, scheduled_wo_date, assigned_to, created_source, state, closed_at, last_noc_import_at, created_at, updated_at` +
          `) VALUES ${insertPmValues}`;

        const res = await env.DB.prepare(insertPmSql).bind(...insertPmArgs).run();

        // Vérifie réellement quels tickets manquants ont été créés (INSERT OR IGNORE peut ne rien insérer)
        if (missingChunkNumbers.length > 0) {
          const inNow = missingChunkNumbers.map(() => '?').join(',');
          const createdNow = scopeZone
            ? await env.DB.prepare(
                `SELECT number FROM pm_items WHERE month_id = ? AND COALESCE(region, zone, '') = ? AND number IN (${inNow})`
              )
                .bind(monthId, scopeZone, ...missingChunkNumbers)
                .all()
            : await env.DB.prepare(
                `SELECT number FROM pm_items WHERE month_id = ? AND number IN (${inNow})`
              )
                .bind(monthId, ...missingChunkNumbers)
                .all();

          const createdSet = new Set((createdNow?.results || []).map((r) => String(r?.number || '').trim()).filter(Boolean));
          const createdCount = createdSet.size;
          createdMissing += createdCount;
          const notCreatedCount = Math.max(0, missingChunkNumbers.length - createdCount);
          missingNotCreated += notCreatedCount;
          if (notCreatedCount > 0) {
            for (const n of missingChunkNumbers) {
              if (!createdSet.has(n) && notCreatedNumbers.length < 50) notCreatedNumbers.push(n);
            }
          }
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

      const updValues = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
      const updArgs = [];
      for (const r of chunk) {
        updArgs.push(r.number, r.state, r.closedAt, r.siteCode, r.shortDescription, r.scheduledWoDate, r.assignedTo);
      }

      const updSql =
        `WITH upd(number, state, closed_at, site_code, short_description, scheduled_wo_date, assigned_to) AS (VALUES ${updValues})\n` +
        ` UPDATE pm_items\n` +
        ` SET state = COALESCE((SELECT state FROM upd WHERE upd.number = pm_items.number), state),\n` +
        `     closed_at = COALESCE((SELECT closed_at FROM upd WHERE upd.number = pm_items.number), closed_at),\n` +
        `     site_code = COALESCE(NULLIF(TRIM(pm_items.site_code), ''), (SELECT site_code FROM upd WHERE upd.number = pm_items.number)),\n` +
        `     short_description = COALESCE(NULLIF(TRIM(pm_items.short_description), ''), (SELECT short_description FROM upd WHERE upd.number = pm_items.number)),\n` +
        `     scheduled_wo_date = COALESCE(NULLIF(TRIM(pm_items.scheduled_wo_date), ''), (SELECT scheduled_wo_date FROM upd WHERE upd.number = pm_items.number)),\n` +
        `     assigned_to = COALESCE(NULLIF(TRIM(pm_items.assigned_to), ''), (SELECT assigned_to FROM upd WHERE upd.number = pm_items.number)),\n` +
        `     created_source = COALESCE(NULLIF(TRIM(pm_items.created_source), ''), 'noc'),\n` +
        `     last_noc_import_at = ?,\n` +
        `     updated_at = ?\n` +
        ` WHERE month_id = ? AND number IN (SELECT number FROM upd)` +
        (scopeZone ? " AND COALESCE(region, zone, '') = ?" : '');

      const finalArgs = scopeZone
        ? [...updArgs, now, now, monthId, scopeZone]
        : [...updArgs, now, now, monthId];

      await env.DB.prepare(updSql)
        .bind(...finalArgs)
        .run();
    }

    await env.DB.prepare('UPDATE pm_months SET updated_at = ? WHERE id = ?').bind(now, monthId).run();

    await touchLastUpdatedAt(env);

    return json(
      {
        ok: true,
        updated,
        missing,
        missingNotCreated,
        createdMissing,
        missingNumbers,
        notCreatedNumbers
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
