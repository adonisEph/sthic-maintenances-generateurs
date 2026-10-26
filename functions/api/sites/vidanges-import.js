import { ensureAdminUser } from '../_utils/db.js';
import { json, readJson, requireAuth, isSuperAdmin, userZone, ymdToday, isoNow, newId } from '../_utils/http.js';
import {
  touchLastUpdatedAt,
  nextTicketNumberForZone,
  formatTicket,
  nextPnrDayTicketNumber,
  formatPnrDayTicket
} from '../_utils/meta.js';
import { calculateEstimatedNH, calculateDiffNHs, calculateRegime } from '../_utils/calc.js';
import { NH_SOURCE, supersedePendingQuarantine } from '../_utils/nhCoherence.js';

const normIdSite = (v) =>
  String(v || '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/ /g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const normYmd = (v) => {
  const s = String(v || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

/**
 * Import VIDANGES DONE : déclare en masse des vidanges effectuées.
 * Sémantique identique à POST /api/interventions/[id]/complete par site :
 *  - nh1_dv/date_dv ← compteur + date de la vidange (baseline autorisée)
 *  - nh2_a/date_a : vidange rétro (doneDate < date_a) → l'état réel le plus
 *    frais est préservé ; sinon alignés sur la vidange
 *  - recalcul immédiat des dérivés (régime, nh_estimated, diffs) — les
 *    projections EPV sont fraîches dès la ligne suivante
 *  - intervention ouverte la plus proche clôturée en 'done' (sinon créée)
 *  - fiche ouverte la plus récente marquée 'Effectuée' (sinon créée avec
 *    ticket) → les tuiles "Échéances" affichent "Effectuée le JJ/MM"
 *  - audit nh_readings (source vidange, is_reset si compteur < ancienne baseline)
 *
 * Lignes ignorées (pas d'auto-résolution possible en masse) :
 *  - conflict : doneDate < date_a ET compteur > nh2_a (contradiction physique)
 *  - before_dv : vidange antérieure à la dernière baseline connue
 *  - future_date / invalid_* / retired / unknown / already_done
 */
export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const body = await readJson(request);
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    const z = String(userZone(data) || 'BZV/POOL');
    const canAllZones = isSuperAdmin(data) || role === 'manager_bzv_pool';
    const todayYmd = ymdToday();
    const now = isoNow();
    const userId = data?.user?.id ? String(data.user.id) : null;
    const userEmail = data?.user?.email ? String(data.user.email) : null;

    const sitesRes = canAllZones
      ? await env.DB.prepare('SELECT * FROM sites').all()
      : await env.DB.prepare('SELECT * FROM sites WHERE zone = ?').bind(z).all();
    const sites = Array.isArray(sitesRes?.results) ? sitesRes.results : [];
    const byIdSite = new Map(sites.map((s) => [normIdSite(s?.id_site), s]).filter(([k]) => Boolean(k)));

    let applied = 0;
    let appliedRetro = 0;
    let appliedReset = 0;
    let appliedRegress = 0;
    let skipped = 0;
    let errors = 0;
    const skippedSamples = [];
    const appliedSamples = [];
    const pushSample = (arr, cap, obj) => { if (arr.length < cap) arr.push(obj); };

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const rowNum = i + 1;
      const skip = (reason, extra = {}) => {
        skipped += 1;
        pushSample(skippedSamples, 80, { reason, row: rowNum, idSite: String(r?.idSite || ''), ...extra });
      };

      const idSite = normIdSite(r?.idSite);
      if (!idSite) { skip('missing_id_site'); continue; }
      const site = byIdSite.get(idSite);
      if (!site) { skip('unknown_id_site', { normalizedIdSite: idSite }); continue; }
      if (site?.retired === true || site?.retired === 1 || String(site?.retired || '').toLowerCase() === 'true') {
        skip('retired_site'); continue;
      }

      const nhNow = Number(r?.nh1DV);
      if (!Number.isFinite(nhNow) || nhNow < 0) { skip('invalid_nh', { nh1DV: r?.nh1DV ?? null }); continue; }
      const doneDate = normYmd(r?.dateDV);
      if (!doneDate) { skip('invalid_date', { dateDV: r?.dateDV ?? null }); continue; }
      if (doneDate > todayYmd) { skip('future_date', { doneDate }); continue; }

      const siteDateA = String(site?.date_a || '').slice(0, 10);
      const siteDateDV = String(site?.date_dv || '').slice(0, 10);
      const siteNh2A = Number(site?.nh2_a);
      const prevNh1DV = Number(site?.nh1_dv);

      // Vidange déclarée antérieure à la dernière baseline connue : la baseline
      // reculerait dans le temps → incohérent, à trancher manuellement.
      if (siteDateDV && doneDate < siteDateDV) { skip('before_dv', { doneDate, dateDv: siteDateDV }); continue; }

      const backdated = Boolean(siteDateA) && doneDate < siteDateA;
      // Contradiction physique : relevés réels postérieurs au compteur saisi —
      // impossible à trancher automatiquement en masse.
      if (backdated && Number.isFinite(siteNh2A) && nhNow > siteNh2A) {
        skip('conflict', { doneDate, nhNow, lastNh2A: siteNh2A, lastDateA: siteDateA });
        continue;
      }

      // Idempotence : une vidange déjà enregistrée à cette date → ne pas
      // dupliquer intervention + fiche à chaque réimport.
      try {
        const alreadyDone = await env.DB.prepare(
          "SELECT id FROM interventions WHERE site_id = ? AND status = 'done' AND done_at = ? LIMIT 1"
        ).bind(String(site.id), doneDate).first();
        if (alreadyDone?.id) { skip('already_done', { doneDate }); continue; }
      } catch {
        // non bloquant
      }

      try {
        // --- État du site : baseline + état réel (préservation rétro) + recalcul
        const nextNh2A = backdated ? siteNh2A : nhNow;
        const nextDateA = backdated ? siteDateA : doneDate;
        let regime = calculateRegime(nhNow, nextNh2A, doneDate, nextDateA);
        if (!Number.isFinite(regime) || regime <= 0 || regime > 24) {
          regime = Number(site?.regime) > 0 ? Number(site.regime) : 0;
        }
        const nhEstimated = calculateEstimatedNH(nextNh2A, nextDateA, regime);
        const diffNHs = calculateDiffNHs(nhNow, nextNh2A);
        const diffEstimated = calculateDiffNHs(nhNow, nhEstimated);
        const isReset = Number.isFinite(prevNh1DV) && nhNow < prevNh1DV;
        const isRegress = !backdated && Number.isFinite(siteNh2A) && nhNow < siteNh2A;

        await env.DB.prepare(
          'UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, nh_offset = 0, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
        )
          .bind(nhNow, doneDate, nextNh2A, nextDateA, regime, nhEstimated, diffNHs, diffEstimated, now, String(site.id))
          .run();

        // --- Audit (même gabarit que complete.js)
        try {
          await env.DB.prepare(
            `INSERT INTO nh_readings
             (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv,
              prev_nh_offset, new_nh_offset, is_reset, source, created_by_user_id, created_by_email, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              newId(),
              String(site.id),
              doneDate,
              Math.trunc(nhNow),
              site.nh2_a == null ? null : Number(site.nh2_a),
              siteDateA || null,
              Number.isFinite(prevNh1DV) ? prevNh1DV : null,
              siteDateDV || null,
              site.nh_offset == null ? 0 : Number(site.nh_offset),
              isReset ? 1 : 0,
              NH_SOURCE.VIDANGE,
              userId,
              userEmail,
              now,
              now
            )
            .run();
        } catch {
          // audit non bloquant
        }
        await supersedePendingQuarantine(env, site.id, now, 'vidange_imported');

        // --- Intervention : clôturer l'ouverte la plus proche (la vidange due),
        // sinon créer un record done pour garder la traçabilité.
        const epvDoneTypes = new Set();
        try {
          const doneRes = await env.DB.prepare(
            `SELECT DISTINCT epv_type FROM fiche_history
             WHERE site_id = ? AND status = 'Effectuée' AND substr(date_completed, 1, 7) = ?`
          ).bind(String(site.id), doneDate.slice(0, 7)).all();
          for (const f of doneRes?.results || []) {
            const t = String(f?.epv_type || '').trim().toUpperCase();
            if (t === 'EPV1' || t === 'EPV2' || t === 'EPV3') epvDoneTypes.add(t);
          }
        } catch {
          // non bloquant
        }
        const nextEpv = ['EPV1', 'EPV2', 'EPV3'].find((t) => !epvDoneTypes.has(t)) || 'EPV1';

        let intervention = await env.DB.prepare(
          `SELECT * FROM interventions WHERE site_id = ? AND status IN ('planned', 'sent')
           ORDER BY CASE WHEN planned_date IS NULL THEN 1 ELSE 0 END, planned_date ASC LIMIT 1`
        ).bind(String(site.id)).first();

        let interventionId = '';
        if (intervention?.id) {
          interventionId = String(intervention.id);
          await env.DB.prepare(
            'UPDATE interventions SET status = ?, done_at = ?, done_by_user_id = ?, done_by_email = ?, done_by_role = ?, updated_at = ? WHERE id = ?'
          ).bind('done', doneDate, userId, userEmail, role, now, interventionId).run();
        } else {
          interventionId = newId();
          await env.DB.prepare(
            `INSERT INTO interventions (id, site_id, zone, planned_date, epv_type, technician_user_id, technician_name, status, created_by_user_id, done_at, done_by_user_id, done_by_email, done_by_role, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'done', ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            interventionId,
            String(site.id),
            String(site.zone || 'BZV/POOL'),
            doneDate,
            nextEpv,
            null,
            String(site.technician || '').trim(),
            userId,
            doneDate,
            userId,
            userEmail,
            role,
            now,
            now
          ).run();
        }
        const epvType = String(intervention?.epv_type || nextEpv).trim() || nextEpv;
        const fichePlannedDate = String(intervention?.planned_date || doneDate).slice(0, 10) || doneDate;

        // --- Fiche : marquer l'ouverte la plus récente, sinon créer avec ticket.
        const intervalHours = Number.isFinite(prevNh1DV) ? nhNow - prevNh1DV : null;
        const contractSeuil = Number(site?.seuil || 250);
        const isWithinContract = Number.isFinite(intervalHours) ? (intervalHours <= contractSeuil ? 1 : 0) : null;

        let fiche = await env.DB.prepare(
          `SELECT id, ticket_number FROM fiche_history
           WHERE site_id = ? AND (status IS NULL OR status NOT IN ('Annulée', 'Effectuée'))
           ORDER BY created_at DESC LIMIT 1`
        ).bind(String(site.id)).first();

        let ticketNumber = String(fiche?.ticket_number || '').trim();
        if (!ticketNumber) {
          const ticketZone = String(site?.zone || '').trim();
          if (ticketZone.toUpperCase() === 'PNR/KOUILOU') {
            const next = await nextPnrDayTicketNumber(env, doneDate);
            ticketNumber = formatPnrDayTicket(doneDate, next);
          } else {
            const tn = await nextTicketNumberForZone(env, ticketZone);
            ticketNumber = formatTicket(tn, ticketZone);
          }
        }

        if (fiche?.id) {
          await env.DB.prepare(
            `UPDATE fiche_history SET status = 'Effectuée', date_completed = ?, interval_hours = ?, contract_seuil = ?,
             is_within_contract = ?, nh1_dv = ?, date_dv = ?, nh_now = ?, epv_type = COALESCE(NULLIF(epv_type, ''), ?),
             intervention_id = COALESCE(intervention_id, ?), updated_at = ? WHERE id = ?`
          ).bind(
            doneDate, intervalHours, contractSeuil, isWithinContract,
            Number.isFinite(prevNh1DV) ? prevNh1DV : null, siteDateDV || null, nhNow,
            epvType, interventionId, now, String(fiche.id)
          ).run();
        } else {
          const ficheId = `fiche-${interventionId}`;
          try {
            await env.DB.prepare(
              `INSERT INTO fiche_history (id, ticket_number, site_id, site_name, technician, technician_user_id, date_generated, status, planned_date, epv_type, created_by, date_completed, interval_hours, contract_seuil, is_within_contract, intervention_id, nh1_dv, date_dv, nh_now, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'Effectuée', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              ficheId, ticketNumber, String(site.id), site.name_site, site.technician || '', null,
              now, fichePlannedDate, epvType, userEmail, doneDate, intervalHours, contractSeuil,
              isWithinContract, interventionId,
              Number.isFinite(prevNh1DV) ? prevNh1DV : null, siteDateDV || null, nhNow, now, now
            ).run();
          } catch {
            // Schéma minimal (colonnes récentes absentes)
            await env.DB.prepare(
              `INSERT INTO fiche_history (id, ticket_number, site_id, site_name, technician, date_generated, status, planned_date, epv_type, created_by, date_completed, interval_hours, contract_seuil, is_within_contract, intervention_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'Effectuée', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              ficheId, ticketNumber, String(site.id), site.name_site, site.technician || '',
              now, fichePlannedDate, epvType, userEmail, doneDate, intervalHours, contractSeuil,
              isWithinContract, interventionId, now, now
            ).run();
          }
        }

        applied += 1;
        if (isReset) appliedReset += 1;
        else if (backdated) appliedRetro += 1;
        else if (isRegress) appliedRegress += 1;
        pushSample(appliedSamples, 80, { row: rowNum, idSite, doneDate, nhNow, retro: backdated, reset: isReset, regress: isRegress });
      } catch (e) {
        errors += 1;
        pushSample(skippedSamples, 80, { reason: 'write_error', row: rowNum, idSite, error: e?.message || '' });
      }
    }

    if (applied > 0) {
      await touchLastUpdatedAt(env);
      try {
        await env.DB.prepare(
          `INSERT INTO notifications (id, type, zone, audience, title, body, site_id, ref_id, actor_user_id, actor_email, created_at)
           VALUES (?, 'vidanges_imported', ?, 'managers', ?, ?, '', '', ?, ?, ?)`
        ).bind(
          newId(),
          String(z || 'BZV/POOL'),
          'Import VIDANGES DONE',
          `${applied} vidange(s) importée(s) par ${userEmail || 'inconnu'} (${appliedRetro} rétro, ${appliedReset} reset, ${appliedRegress} recul).`,
          userId,
          userEmail,
          now
        ).run();
      } catch {
        // notifications non bloquantes
      }
    }

    return json(
      {
        ok: true,
        applied,
        appliedRetro,
        appliedReset,
        appliedRegress,
        skipped,
        errors,
        skippedSamples,
        appliedSamples
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
