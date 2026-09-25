import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, ymdToday, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';
import {
  NH_SOURCE,
  evaluateNhCandidate,
  applyNhReading,
  recordQuarantine,
  effectiveTechnicianName,
  technicianMatches
} from '../../_utils/nhCoherence.js';

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
    retired: Boolean(row.retired),
    updatedAt: row.updated_at || null
  };
}

const QUARANTINE_MESSAGES = {
  nh_below_dv: 'Compteur inférieur à NH1 DV — possible changement deepsea/générateur. Valeur mise en quarantaine.',
  parasite_high: 'Valeur incohérente (régime implicite > 24 H/J). Mise en quarantaine.',
  date_before_dv: 'Date de relevé antérieure à la dernière vidange. Mise en quarantaine.',
  future_date: 'Date de relevé dans le futur. Mise en quarantaine.',
  date_regression: 'Date de relevé antérieure au dernier relevé connu. Mise en quarantaine.',
  decrease: 'Compteur inférieur au dernier relevé connu. Mise en quarantaine.',
  retired_site: 'Site retiré — relevé mis en quarantaine pour remise en cohérence manuelle.'
};

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

    if (!Number.isFinite(rawNh) || rawNh < 0) return json({ error: 'Compteur (NH) invalide.' }, { status: 400 });

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'technician' && role !== 'manager' && role !== 'manager_bzv_pool') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    // Techniciens : pas de filtre zone (comme GET /api/sites) — la sécurité
    // repose sur le matching du nom de technicien ci-dessous.
    if (!isSuperAdmin(data) && role !== 'technician' && role !== 'manager_bzv_pool') {
      const z = userZone(data);
      if (String(site.zone || 'BZV/POOL') !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    if (role === 'technician') {
      // Même matching normalisé que GET /api/sites : nom DB en source de vérité.
      const techName = await effectiveTechnicianName(env, data);
      if (!technicianMatches(site?.technician, techName)) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    // Évaluation unifiée : mêmes règles que Auto et RMS.
    const verdict = evaluateNhCandidate(site, { nh2A: rawNh, dateA: readingDate });

    if (verdict.verdict === 'reject') {
      return json({ error: 'Compteur (NH) ou date invalide.' }, { status: 400 });
    }

    // Site retiré : relevé systématiquement quarantiné (remise en cohérence
    // manuelle) — jamais appliqué automatiquement, même s'il est cohérent.
    const isRetired = site?.retired === true || site?.retired === 1
      || String(site?.retired || '').trim().toLowerCase() === 'true';
    const effectiveVerdict = isRetired && verdict.verdict === 'apply'
      ? { ...verdict, verdict: 'quarantine', reason: 'retired_site', detail: { ...(verdict.detail || {}), retired: true } }
      : verdict;

    if (effectiveVerdict.verdict === 'quarantine') {
      const rec = await recordQuarantine(
        env,
        site,
        {
          source: NH_SOURCE.MANUAL,
          reason: effectiveVerdict.reason,
          proposedNh2A: effectiveVerdict.nh2A,
          proposedDateA: effectiveVerdict.dateA,
          detail: effectiveVerdict.detail
        },
        { user: data?.user, zone: site?.zone }
      );
      await touchLastUpdatedAt(env);
      return json(
        {
          ok: false,
          quarantined: true,
          reason: effectiveVerdict.reason,
          quarantineId: rec?.id || null,
          quarantinePersisted: !rec?.error,
          quarantineError: rec?.message || null,
          error: QUARANTINE_MESSAGES[effectiveVerdict.reason] || 'Valeur incohérente. Mise en quarantaine.'
        },
        { status: 409 }
      );
    }

    const applied = await applyNhReading(
      env,
      site,
      { nh2A: effectiveVerdict.nh2A, dateA: effectiveVerdict.dateA },
      { source: NH_SOURCE.MANUAL, user: data?.user }
    );

    await touchLastUpdatedAt(env);

    const updated = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
    return json(
      {
        ok: true,
        site: mapSiteRow(updated),
        readingId: applied.readingId,
        isReset: false
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
