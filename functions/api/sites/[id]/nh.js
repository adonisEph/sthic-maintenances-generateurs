import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, ymdToday, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';
import { calculateDiffNHs, calculateEstimatedNH, calculateRegime } from '../../_utils/calc.js';

function mapSiteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.zone || 'BZV/POOL',
    nameSite: row.name_site,
    idSite: row.id_site,
    technician: row.technician,
    generateur: row.generateur,
    capacite: row.capacite,
    kitVidange: row.kit_vidange,
    nh1DV: row.nh1_dv,
    dateDV: row.date_dv,
    nh2A: row.nh2_a,
    dateA: row.date_a,
    regime: row.regime,
    nhEstimated: row.nh_estimated,
    diffNHs: row.diff_nhs,
    diffEstimated: row.diff_estimated,
    seuil: row.seuil,
    retired: Boolean(row.retired)
  };
}

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const siteId = String(params?.id || '').trim();
    if (!siteId) return json({ error: 'Site requis.' }, { status: 400 });

    const body = await readJson(request);
    const readingDateRaw = String(body?.readingDate || '').trim();
    const readingDate = /^\d{4}-\d{2}-\d{2}$/.test(readingDateRaw) ? readingDateRaw : ymdToday();
    const rawNh = Number(body?.nhValue);
    const forceReset = Boolean(body?.reset || body?.forceReset);

    if (!Number.isFinite(rawNh) || rawNh < 0) return json({ error: 'Compteur (NH) invalide.' }, { status: 400 });

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if (String(site.zone || 'BZV/POOL') !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'technician' && role !== 'manager') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    if (role === 'technician') {
      const techName = String(data?.user?.technicianName || '').trim();
      if (!techName || String(site.technician || '').trim() !== techName) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const prevNh2A = site.nh2_a == null ? null : Number(site.nh2_a);
    const prevDateA = site.date_a == null ? null : String(site.date_a);
    const prevNh1DV = site.nh1_dv == null ? null : Number(site.nh1_dv);
    const prevDateDV = site.date_dv == null ? null : String(site.date_dv);
    const prevOffset = site.nh_offset == null ? 0 : Number(site.nh_offset);

    const prevEffective = Number.isFinite(Number(prevNh2A)) ? Number(prevNh2A) : 0;
    const prevRaw = prevEffective - prevOffset;

    const hasPrev = Number.isFinite(Number(prevNh2A));
    const isReset = hasPrev ? (forceReset && rawNh < prevRaw ? 1 : 0) : 0;
    const nextOffset = isReset ? prevEffective : prevOffset;
    const effectiveNh = nextOffset + rawNh;

    if (Number.isFinite(Number(site.nh1_dv)) && effectiveNh < Number(site.nh1_dv)) {
      return json({ error: "Le compteur (NH) ne peut pas être inférieur au NH1 DV du site." }, { status: 400 });
    }

    const regime = calculateRegime(site.nh1_dv, effectiveNh, site.date_dv, readingDate);
    const nhEstimated = calculateEstimatedNH(effectiveNh, readingDate, regime);
    const diffNHs = calculateDiffNHs(site.nh1_dv, effectiveNh);
    const diffEstimated = calculateDiffNHs(site.nh1_dv, nhEstimated);

    const now = isoNow();

    await env.DB.prepare(
      'UPDATE sites SET nh2_a = ?, date_a = ?, nh_offset = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
    )
      .bind(effectiveNh, readingDate, nextOffset, regime, nhEstimated, diffNHs, diffEstimated, now, siteId)
      .run();

    const rid = newId();
    await env.DB.prepare(
      'INSERT INTO nh_readings (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv, prev_nh_offset, new_nh_offset, is_reset, created_by_user_id, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        rid,
        siteId,
        readingDate,
        Math.trunc(rawNh),
        prevNh2A,
        prevDateA,
        prevNh1DV,
        prevDateDV,
        prevOffset,
        nextOffset,
        isReset,
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null,
        now,
        now
      )
      .run();

    await touchLastUpdatedAt(env);

    const updated = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    return json(
      {
        ok: true,
        site: mapSiteRow(updated),
        readingId: rid,
        isReset: Boolean(isReset)
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
