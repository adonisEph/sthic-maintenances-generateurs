import { ensureAdminUser } from '../_utils/db.js';
import { json, readJson, requireAuth, isSuperAdmin, userZone, ymdToday, isoNow, newId } from '../_utils/http.js';

const VALID_ZONES = ['BZV/POOL', 'PNR/KOUILOU', 'UPCN'];
const YM = /^\d{4}-\d{2}$/;
// Mois de démarrage d'utilisation de l'application — les campagnes
// antérieures relèvent des saisies historiques (process pré-app).
const APP_START_MONTH = '2026-02';

const isManagerRole = (data) =>
  ['admin', 'manager', 'manager_bzv_pool'].includes(String(data?.user?.role || ''));

const scopeZone = (data, url) => {
  if (isSuperAdmin(data)) {
    const q = String(url.searchParams.get('zone') || 'ALL').trim().toUpperCase();
    return VALID_ZONES.includes(q) ? q : '';
  }
  return String(userZone(data) || '').trim().toUpperCase();
};

/**
 * GET /api/analytics/vidanges-trend
 *
 * Tendance des vidanges / campagnes — croisement PM × Vidanges (+ saisies
 * manuelles historiques). Filtres :
 *   ?months=N          → les N derniers mois BOUCLÉS (mois courant/futur exclus)
 *   ?month=YYYY-MM     → une seule campagne
 *   ?from=YYYY-MM&to=  → plage de campagnes (max 36)
 *   ?zone=             → SuperAdmin uniquement ; managers verrouillés.
 *
 * Par campagne :
 *   planned = pm_items FullPMWO + ticket — applicatif seul, SAUF les mois
 *             antérieurs à APP_START_MONTH sans aucune donnée applicative
 *             où les saisies historiques tiennent lieu de données.
 *   done    = fiches 'Effectuée' + vidanges historiques saisies (elles
 *             ont réellement eu lieu hors-app — elles comptent).
 * Clé de campagne : planned_date. manualPlanned/manualDone exposés
 * pour la décomposition au survol.
 */
export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isManagerRole(data)) return json({ error: 'Accès interdit.' }, { status: 403 });

    const url = new URL(request.url);
    const zone = scopeZone(data, url);
    const currentYm = ymdToday().slice(0, 7);

    const qMonth = String(url.searchParams.get('month') || '').slice(0, 7);
    const qFrom = String(url.searchParams.get('from') || '').slice(0, 7);
    const qTo = String(url.searchParams.get('to') || '').slice(0, 7);
    const monthsLimit = Math.max(1, Math.min(24, Number(url.searchParams.get('months')) || 6));

    const plannedSql = `
      SELECT m.month AS month, COUNT(*) AS planned, COUNT(DISTINCT i.site_code) AS plannedSites
      FROM pm_items i JOIN pm_months m ON m.id = i.month_id
      WHERE i.maintenance_type = 'FullPMWO'
        AND i.number IS NOT NULL AND TRIM(i.number) <> ''
        ${zone ? 'AND UPPER(TRIM(i.zone)) = ?' : ''}
      GROUP BY m.month`;
    const doneSql = `
      SELECT substr(f.planned_date, 1, 7) AS month,
             COUNT(*) AS done,
             COUNT(DISTINCT f.site_id) AS doneSites
      FROM fiche_history f
      JOIN sites s ON s.id = f.site_id
      WHERE f.status = 'Effectuée'
        AND f.planned_date IS NOT NULL AND f.planned_date <> ''
        ${zone ? 'AND UPPER(TRIM(s.zone)) = ?' : ''}
      GROUP BY substr(f.planned_date, 1, 7)`;
    const manualSql = `
      SELECT * FROM analysis_manual_entries
      ${zone ? 'WHERE UPPER(TRIM(zone)) = ?' : ''}
      ORDER BY month DESC`;

    const [plannedRes, doneRes, manualRes] = await Promise.all([
      zone ? env.DB.prepare(plannedSql).bind(zone).all() : env.DB.prepare(plannedSql).all(),
      zone ? env.DB.prepare(doneSql).bind(zone).all() : env.DB.prepare(doneSql).all(),
      zone ? env.DB.prepare(manualSql).bind(zone).all() : env.DB.prepare(manualSql).all()
    ]);

    const byMonth = new Map();
    const row = (m) =>
      byMonth.get(m) ||
      { month: m, planned: 0, plannedSites: 0, done: 0, doneSites: 0, manualPlanned: 0, manualDone: 0 };

    for (const r of plannedRes?.results || []) {
      const m = String(r?.month || '').slice(0, 7);
      if (!YM.test(m)) continue;
      const cur = row(m);
      cur.planned = Number(r.planned) || 0;
      cur.plannedSites = Number(r.plannedSites) || 0;
      byMonth.set(m, cur);
    }
    for (const r of doneRes?.results || []) {
      const m = String(r?.month || '').slice(0, 7);
      if (!YM.test(m)) continue;
      const cur = row(m);
      cur.done = Number(r.done) || 0;
      cur.doneSites = Number(r.doneSites) || 0;
      byMonth.set(m, cur);
    }

    const manualEntries = (manualRes?.results || [])
      .filter((r) => YM.test(String(r?.month || '').slice(0, 7)))
      .map((r) => ({
        id: String(r.id),
        month: String(r.month).slice(0, 7),
        zone: String(r.zone || ''),
        planned: Number(r.planned_fullpmwo) || 0,
        done: Number(r.done_vidanges) || 0,
        note: String(r.note || ''),
        createdByEmail: String(r.created_by_email || ''),
        createdAt: String(r.created_at || '')
      }));

    for (const e of manualEntries) {
      const cur = row(e.month);
      cur.manualPlanned += e.planned;
      cur.manualDone += e.done;
      byMonth.set(e.month, cur);
    }

    // --- Fenêtre de campagnes selon le mode de filtre
    let months;
    if (YM.test(qMonth)) {
      months = [row(qMonth)].filter((r) => byMonth.has(qMonth));
    } else if (YM.test(qFrom) && YM.test(qTo)) {
      const [lo, hi] = qFrom <= qTo ? [qFrom, qTo] : [qTo, qFrom];
      months = Array.from(byMonth.values()).filter(
        (r) => r.month >= lo && r.month <= hi
      );
    } else {
      // Preset : uniquement les mois bouclés (courant et futurs exclus)
      months = Array.from(byMonth.values())
        .filter((r) => r.month < currentYm)
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, monthsLimit);
    }

    months = months
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((r) => {
        // « Planifiés » : tickets FullPMWO applicatifs. Exception — mois
        // antérieurs au démarrage de l'app sans aucune donnée applicative :
        // les saisies historiques TIENNENT LIEU de planifiés (le process
        // existait avant l'app ; le rapport doit couvrir tout l'historique).
        // « Effectuées » : fiches applicatives + vidanges historiques
        // saisies (réellement effectuées hors-app — elles comptent).
        const manualPlannedUsed =
          r.planned === 0 && r.month < APP_START_MONTH ? r.manualPlanned : 0;
        const planned = r.planned + manualPlannedUsed;
        const done = r.done + r.manualDone;
        return {
          ...r,
          planned,
          plannedSites: r.planned > 0 ? r.plannedSites : manualPlannedUsed,
          plannedFromManual: manualPlannedUsed > 0,
          manualPlannedUsed,
          done,
          doneSites: r.doneSites + r.manualDone,
          delta: done - planned,
          coverage: planned > 0 ? Math.round((done / planned) * 1000) / 10 : null,
          depassement: planned > 0 ? done > planned : done > 0
        };
      });

    const totals = months.reduce(
      (acc, r) => ({
        planned: acc.planned + r.planned,
        plannedSites: acc.plannedSites + r.plannedSites,
        done: acc.done + r.done,
        doneSites: acc.doneSites + r.doneSites,
        manualDone: acc.manualDone + r.manualDone,
        manualPlanned: acc.manualPlanned + r.manualPlanned,
        manualPlannedUsed: acc.manualPlannedUsed + (r.manualPlannedUsed || 0),
        depassementMonths: acc.depassementMonths + (r.depassement ? 1 : 0)
      }),
      { planned: 0, plannedSites: 0, done: 0, doneSites: 0, manualDone: 0, manualPlanned: 0, manualPlannedUsed: 0, depassementMonths: 0 }
    );
    totals.delta = totals.done - totals.planned;
    totals.coverage = totals.planned > 0 ? Math.round((totals.done / totals.planned) * 1000) / 10 : null;

    return json({
      ok: true,
      zone: zone || 'ALL',
      months,
      totals,
      manualEntries,
      canEditManual: isSuperAdmin(data)
    });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

/**
 * POST /api/analytics/vidanges-trend — saisie manuelle historique
 * (SuperAdmin uniquement). Unicité (month, zone) → upsert.
 * Body: { month:'YYYY-MM', zone:'BZV/POOL', plannedFullpmwo?, doneVidanges?, note? }
 */
export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isSuperAdmin(data)) return json({ error: 'Saisie historique réservée au SuperAdmin.' }, { status: 403 });

    const body = await readJson(request);
    const month = String(body?.month || '').slice(0, 7);
    const zone = String(body?.zone || '').trim().toUpperCase();
    const planned = Math.max(0, Math.min(999999, Math.trunc(Number(body?.plannedFullpmwo) || 0)));
    const done = Math.max(0, Math.min(999999, Math.trunc(Number(body?.doneVidanges) || 0)));
    const note = String(body?.note || '').trim().slice(0, 300);
    const currentYm = ymdToday().slice(0, 7);

    if (!YM.test(month)) return json({ error: 'Mois invalide (YYYY-MM attendu).' }, { status: 400 });
    if (month > currentYm) return json({ error: 'Impossible de saisir un mois futur.' }, { status: 400 });
    if (!VALID_ZONES.includes(zone)) return json({ error: 'Zone invalide.' }, { status: 400 });
    if (planned === 0 && done === 0) {
      return json({ error: 'Saisir au moins une valeur non nulle (planifiés ou effectuées).' }, { status: 400 });
    }

    const now = isoNow();
    const userId = data?.user?.id ? String(data.user.id) : null;
    const userEmail = data?.user?.email ? String(data.user.email) : null;

    const existing = await env.DB.prepare(
      'SELECT id FROM analysis_manual_entries WHERE month = ? AND zone = ?'
    ).bind(month, zone).first();

    if (existing?.id) {
      await env.DB.prepare(
        'UPDATE analysis_manual_entries SET planned_fullpmwo = ?, done_vidanges = ?, note = ?, updated_by_email = ?, updated_at = ? WHERE id = ?'
      ).bind(planned, done, note, userEmail, now, String(existing.id)).run();
      return json({ ok: true, updated: true, id: existing.id });
    }

    const id = newId();
    await env.DB.prepare(
      `INSERT INTO analysis_manual_entries
       (id, month, zone, planned_fullpmwo, done_vidanges, note, created_by_user_id, created_by_email, updated_by_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, month, zone, planned, done, note, userId, userEmail, userEmail, now, now).run();

    return json({ ok: true, created: true, id });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

/**
 * DELETE /api/analytics/vidanges-trend?id=... (SuperAdmin uniquement)
 */
export async function onRequestDelete({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    if (!isSuperAdmin(data)) return json({ error: 'Suppression réservée au SuperAdmin.' }, { status: 403 });

    const url = new URL(request.url);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!id) return json({ error: 'id manquant.' }, { status: 400 });

    await env.DB.prepare('DELETE FROM analysis_manual_entries WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
