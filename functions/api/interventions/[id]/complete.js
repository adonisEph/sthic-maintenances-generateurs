import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone, ymdToday } from '../../_utils/http.js';
import { nextPnrDayTicketNumber, formatPnrDayTicket, nextTicketNumberForZone, formatTicket, touchLastUpdatedAt } from '../../_utils/meta.js';
import { calculateEstimatedNH, calculateDiffNHs, calculateEPVDates, calculateRegime } from '../../_utils/calc.js';
import { NH_SOURCE, supersedePendingQuarantine, technicianMatches, effectiveTechnicianName } from '../../_utils/nhCoherence.js';

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const id = String(params?.id || '');
    const body = await readJson(request);

    const role = String(data?.user?.role || '').trim();
    const isAdmin = role === 'admin';
    const isManager = role === 'manager';
    const isManagerBzvPool = role === 'manager_bzv_pool';
    const isTechnician = role === 'technician';
    const myTechName = isTechnician ? await effectiveTechnicianName(env, data) : '';

    // Résolution de l'intervention :
    //  1) par id direct (cas nominal)
    //  2) par siteId+epvType du body — événement EPV synthétisé côté client
    //     (pas de record persisté) → on rattache au record ouvert le plus récent
    //  3) find-or-create : aucun record ouvert → on en crée un pour que la vidange
    //     reste auditable (sinon l'EPV affichée serait impossible à clôturer : 404)
    let intervention = id ? await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first() : null;

    const bodySiteId = String(body?.siteId || '').trim();
    const bodyEpvType = String(body?.epvType || '').trim().toUpperCase();
    const bodyPlannedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.plannedDate || '').slice(0, 10))
      ? String(body.plannedDate).slice(0, 10)
      : '';

    if (!intervention && bodySiteId && bodyEpvType) {
      // Préférence au record auquel une fiche (ticket) est déjà rattachée :
      // le technicien doit clôturer LE ticket généré par le manager, pas un
      // éventuel doublon d'intervention sans fiche.
      intervention = await env.DB.prepare(
        `SELECT i.* FROM interventions i
         WHERE i.site_id = ? AND i.epv_type = ? AND i.status IN ('planned', 'sent')
         ORDER BY EXISTS(
           SELECT 1 FROM fiche_history fh
           WHERE fh.intervention_id = i.id
             AND (fh.status IS NULL OR fh.status NOT IN ('Annulée', 'Effectuée'))
         ) DESC, i.planned_date DESC
         LIMIT 1`
      )
        .bind(bodySiteId, bodyEpvType)
        .first();
    }

    if (!intervention && bodySiteId && bodyEpvType) {
      const siteRow = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(bodySiteId).first();
      if (!siteRow) return json({ error: 'Site introuvable.' }, { status: 404 });

      if (isTechnician && !technicianMatches(siteRow.technician, myTechName)) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }

      const now0 = isoNow();
      const newIntId = newId();
      const techName = isTechnician
        ? myTechName
        : String(body?.technicianName || siteRow.technician || '').trim();
      await env.DB.prepare(
        'INSERT OR IGNORE INTO interventions (id, site_id, zone, planned_date, epv_type, technician_user_id, technician_name, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          newIntId,
          bodySiteId,
          String(siteRow.zone || 'BZV/POOL'),
          bodyPlannedDate || String(body?.doneDate || '').slice(0, 10) || ymdToday(),
          bodyEpvType,
          isTechnician ? String(data.user.id) : null,
          techName,
          'planned',
          data.user.id,
          now0,
          now0
        )
        .run();
      // Re-sélection : la ligne créée, ou une ligne existante (collision unique) sur le triplet.
      intervention =
        (await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(newIntId).first()) ||
        (await env.DB.prepare(
          'SELECT * FROM interventions WHERE site_id = ? AND epv_type = ? ORDER BY planned_date DESC LIMIT 1'
        )
          .bind(bodySiteId, bodyEpvType)
          .first());
    }

    if (!intervention) return json({ error: 'Intervention introuvable.' }, { status: 404 });

    const isAssignedTech =
      Boolean(intervention.technician_user_id && String(intervention.technician_user_id) === String(data.user.id)) ||
      (isTechnician && technicianMatches(intervention.technician_name, myTechName));
    if (!isAdmin && !isManager && !isManagerBzvPool && !isAssignedTech) {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    if (intervention.status === 'done') {
      return json({ ok: true }, { status: 200 });
    }
    if (String(intervention.status || '') === 'non_fait') {
      return json({ error: 'Intervention déjà clôturée en Non-fait.' }, { status: 409 });
    }

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(intervention.site_id).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });
    if (Boolean(site?.retired)) {
      return json({ error: 'Site retiré : vidange bloquée.' }, { status: 409 });
    }

    // Technicien assigné (user_id ou nom) : autorisé même si la zone stockée du site
    // est erronée — cohérent avec GET /api/sites qui ne zone-filtre pas les techniciens.
    if (!isTechnician && !isSuperAdmin(data) && !isManager && !isManagerBzvPool) {
      const z = userZone(data);
      if (String(site.zone || 'BZV/POOL') !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    // IMPORTANT : intervention.id (record résolu) — PAS le `id` de l'URL qui peut
    // valoir 'auto' (événement EPV synthétisé) ou pointer un doublon.
    const relatedFicheByIntervention = await env.DB.prepare(
      "SELECT id, ticket_number, status, warehouse_flow_status, intervention_id FROM fiche_history WHERE intervention_id = ? AND (status IS NULL OR status != 'Annulée') ORDER BY created_at DESC LIMIT 1"
    )
      .bind(intervention.id)
      .first();

    // Fallback élargi : fiche OUVERTE du même site (EPV identique ou fiche
    // générique), même si sa date planifiée diffère ou si elle pointe vers un
    // autre record d'intervention encore ouvert (doublon). C'est le ticket
    // généré par le manager : il doit être clôturé, pas orpheliné.
    let relatedFallbackFiche = null;
    let orphanInterventionId = null;
    if (!relatedFicheByIntervention?.id) {
      const epv = String(intervention.epv_type || '').trim();
      const res = await env.DB.prepare(
        `SELECT fh.id, fh.ticket_number, fh.status, fh.warehouse_flow_status, fh.intervention_id, fh.planned_date, fh.epv_type
         FROM fiche_history fh
         WHERE fh.site_id = ?
           AND (fh.status IS NULL OR fh.status NOT IN ('Annulée', 'Effectuée'))
           AND (fh.epv_type IS NULL OR fh.epv_type = '' OR ? = '' OR fh.epv_type = ?)
         ORDER BY CASE WHEN fh.planned_date IS ? THEN 0 ELSE 1 END, fh.created_at DESC
         LIMIT 5`
      )
        .bind(site.id, epv, epv, intervention.planned_date || null)
        .all();
      const candidates = Array.isArray(res?.results) ? res.results : [];
      for (const f of candidates) {
        const oid = String(f.intervention_id || '');
        if (!oid || oid === String(intervention.id)) {
          relatedFallbackFiche = f;
          break;
        }
        const other = await env.DB.prepare('SELECT status FROM interventions WHERE id = ?').bind(oid).first();
        if (!other || ['planned', 'sent'].includes(String(other.status || ''))) {
          relatedFallbackFiche = f;
          orphanInterventionId = oid || null;
          break;
        }
      }
    }

    const relatedFiche = relatedFicheByIntervention?.id ? relatedFicheByIntervention : relatedFallbackFiche;

    const now = isoNow();

    const userDoneDate = String(body?.doneDate || '').trim();
    const userNhNowRaw = body?.nhNow;

    const doneDate = /^\d{4}-\d{2}-\d{2}$/.test(userDoneDate) ? userDoneDate : ymdToday();
    // nhNow = valeur réelle du compteur au moment de la vidange.
    // Fallback non-technicien : dernier relevé RÉEL (nh2_a) — jamais nh_estimated
    // (une projection promue en baseline corromprait nh1_dv).
    let nhNow = Number.isFinite(Number(userNhNowRaw)) ? Number(userNhNowRaw) : Number(site.nh2_a || 0);
    if (!Number.isFinite(nhNow) || nhNow < 0) {
      return json({ error: 'Compteur (NH) invalide.' }, { status: 400 });
    }

    if (isTechnician) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(userDoneDate)) {
        return json({ error: 'Date de vidange invalide.' }, { status: 400 });
      }
      if (!Number.isFinite(Number(userNhNowRaw))) {
        return json({ error: 'Compteur (NH) invalide.' }, { status: 400 });
      }
      // Compteur < NH1 DV : deepsea/générateur probablement changé → rebase explicite.
      // Pas de blocage sec : la vidange est le canal autorisé à réécrire nh1_dv,
      // mais le technicien doit confirmer le reset (allowRebase) — audit is_reset=1.
      if (Number(site.nh1_dv) > nhNow && body?.allowRebase !== true) {
        return json(
          {
            error: 'Le compteur (NH) est inférieur au NH1 DV du site — compteur/deepsea ou générateur probablement changé.',
            code: 'nh_below_dv',
            nh1Dv: Number(site.nh1_dv)
          },
          { status: 409 }
        );
      }
    }

    const intervalHours = nhNow - Number(site.nh1_dv);
    const contractSeuil = Number(site.seuil || 250);
    const isWithinContract = Number.isFinite(intervalHours) ? (intervalHours <= contractSeuil) : null;

    const nextNh1DV = nhNow;
    const nextDateDV = doneDate;
    const nextNh2A = nhNow;
    const nextDateA = doneDate;

    // Recalcul métier (régime + estimations + diffs)
    let nextRegime = calculateRegime(nextNh1DV, nextNh2A, nextDateDV, nextDateA);
    if (nextRegime === 0 && Number(site.regime) > 0) {
      nextRegime = Number(site.regime);
    }
    const nextNhEstimated = calculateEstimatedNH(nextNh2A, nextDateA, nextRegime);
    const nextDiffNHs = calculateDiffNHs(nextNh1DV, nextNh2A); // = 0
    const nextDiffEstimated = calculateDiffNHs(nextNh1DV, nextNhEstimated);

    const epvDates = calculateEPVDates(nextRegime, nextNh1DV, nextNhEstimated, contractSeuil);

    await env.DB.prepare(
      'UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, nh_offset = 0, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
    )
      .bind(
        nextNh1DV,
        nextDateDV,
        nextNh2A,
        nextDateA,
        nextRegime,
        nextNhEstimated,
        nextDiffNHs,
        nextDiffEstimated,
        now,
        site.id
      )
      .run();

    // Audit vidange : la vidange est le seul canal autorisé à réécrire nh1_dv.
    const prevNh1DV = site.nh1_dv == null ? null : Number(site.nh1_dv);
    const rid = `${intervention.id}-vidange-${Date.now()}`;
    try {
      await env.DB.prepare(
        `INSERT INTO nh_readings
         (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv,
          prev_nh_offset, new_nh_offset, is_reset, source, created_by_user_id, created_by_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          rid,
          String(site.id),
          doneDate,
          Math.trunc(nhNow),
          site.nh2_a == null ? null : Number(site.nh2_a),
          site.date_a == null ? null : String(site.date_a).slice(0, 10),
          prevNh1DV,
          site.date_dv == null ? null : String(site.date_dv).slice(0, 10),
          site.nh_offset == null ? 0 : Number(site.nh_offset),
          Number.isFinite(prevNh1DV) && nhNow < prevNh1DV ? 1 : 0,
          NH_SOURCE.VIDANGE,
          data?.user?.id ? String(data.user.id) : null,
          data?.user?.email ? String(data.user.email) : null,
          now,
          now
        )
        .run();
    } catch {
      // audit non bloquant
    }
    await supersedePendingQuarantine(env, site.id, now, 'vidange_completed');

    // done_by_* : trace le clôturant RÉEL (manager/admin quand le technicien
    // est absent) — sans ça la vidange serait attribuée silencieusement au
    // technicien assigné.
    await env.DB.prepare(
      'UPDATE interventions SET status = ?, done_at = ?, done_by_user_id = ?, done_by_email = ?, done_by_role = ?, updated_at = ? WHERE id = ?'
    )
      .bind(
        'done',
        doneDate,
        data?.user?.id ? String(data.user.id) : null,
        data?.user?.email ? String(data.user.email) : null,
        role,
        now,
        intervention.id
      )
      .run();

    // Notification métier : vidange effectuée → managers de la zone + superadmin.
    try {
      await env.DB.prepare(
        `INSERT INTO notifications (id, type, zone, audience, title, body, site_id, ref_id, actor_user_id, actor_email, created_at)
         VALUES (?, 'intervention_done', ?, 'managers', ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          newId(),
          String(siteRow?.zone || intervention?.zone || 'BZV/POOL'),
          'Vidange effectuée',
          `${siteRow?.name_site || siteRow?.id_site || intervention.site_id} — ${String(intervention?.epv_type || 'EPV')} clôturée le ${doneDate} par ${String(data?.user?.email || 'inconnu')}`,
          String(intervention.site_id || ''),
          String(intervention.id),
          data?.user?.id ? String(data.user.id) : null,
          data?.user?.email ? String(data.user.email) : null,
          now
        )
        .run();
    } catch {
      // notifications non bloquantes (table absente → migration 0033)
    }

    const status = 'Effectuée';

    // 1) Priorité: fiche déjà liée à cette intervention
    // 2) Fallback: fiche créée en amont (manager/admin) mais pas liée (intervention_id absent/différent)
    //    => on la ré-attache à cette intervention pour garantir la cohérence ticket/fiche.
    const existingFicheByIntervention = relatedFicheByIntervention;
    const fallbackFiche = relatedFallbackFiche;
    const existingFiche = relatedFiche;

    // si on a trouvé une fiche fallback: on l'attache à l'intervention RÉSOLUE
    if (fallbackFiche?.id) {
      await env.DB.prepare(
        'UPDATE fiche_history SET intervention_id = ?, updated_at = ? WHERE id = ?'
      )
        .bind(intervention.id, now, String(fallbackFiche.id))
        .run();
      // Doublon : l'autre record ouvert auquel la fiche pointait est clôturé en
      // non_fait — sinon il resterait indéfiniment dans "à clôturer".
      if (orphanInterventionId) {
        try {
          await env.DB.prepare(
            "UPDATE interventions SET status = 'non_fait', close_reason = ?, updated_at = ? WHERE id = ? AND status IN ('planned', 'sent')"
          )
            .bind('Doublon — vidange effectuée via une autre intervention', now, orphanInterventionId)
            .run();
        } catch {
          // non bloquant
        }
      }
    }

    // Ticket: ne générer un nouveau ticket que si on crée une nouvelle fiche, ou si la fiche trouvée n'en a pas.
    const ticketZone = String(site?.zone || site?.region || '').trim();
    let ticketNumber = String(existingFiche?.ticket_number || '').trim();
    if (!ticketNumber) {
      const z = String(ticketZone || '').trim().toUpperCase();
      if (z === 'PNR/KOUILOU') {
        const ymd = String(doneDate || '').slice(0, 10);
        const next = await nextPnrDayTicketNumber(env, ymd);
        ticketNumber = formatPnrDayTicket(ymd, next);
      } else {
        const tn = await nextTicketNumberForZone(env, ticketZone);
        ticketNumber = formatTicket(tn, ticketZone);
      }
    }

    // Stamp technician_user_id sur la fiche (matching robuste côté Historique).
    const ficheTechUserId = intervention.technician_user_id || (isTechnician ? String(data.user.id) : null);

    if (existingFiche?.id) {
      await env.DB.prepare(
        'UPDATE fiche_history SET status = ?, date_completed = ?, interval_hours = ?, contract_seuil = ?, is_within_contract = ?, nh1_dv = ?, date_dv = ?, nh_now = ?, updated_at = ? WHERE id = ?'
      )
        .bind(
          status,
          doneDate,
          intervalHours,
          contractSeuil,
          isWithinContract === null ? null : (isWithinContract ? 1 : 0),
          site.nh1_dv,
          site.date_dv,
          nhNow,
          now,
          String(existingFiche.id)
        )
        .run();

      if (ficheTechUserId) {
        try {
          await env.DB.prepare(
            'UPDATE fiche_history SET technician_user_id = COALESCE(technician_user_id, ?) WHERE id = ?'
          )
            .bind(ficheTechUserId, String(existingFiche.id))
            .run();
        } catch {
          // colonne absente (migration 0031 non appliquée) — non bloquant
        }
      }

      // si la fiche existante n'avait pas de ticket (cas rare), on le fixe ici
      if (!String(existingFiche?.ticket_number || '').trim() && ticketNumber) {
        await env.DB.prepare(
          'UPDATE fiche_history SET ticket_number = ?, updated_at = ? WHERE id = ?'
        )
          .bind(ticketNumber, now, String(existingFiche.id))
          .run();
      }

      await touchLastUpdatedAt(env);

      const updatedSite = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(site.id).first();

      return json({ ok: true, epv: epvDates, site: updatedSite ? { id: updatedSite.id } : null }, { status: 200 });
    }

    const ficheId = `fiche-${intervention.id}`;

    try {
      await env.DB.prepare(
        'INSERT INTO fiche_history (id, ticket_number, site_id, site_name, technician, technician_user_id, date_generated, status, planned_date, epv_type, created_by, date_completed, interval_hours, contract_seuil, is_within_contract, intervention_id, nh1_dv, date_dv, nh_now, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          ficheId,
          ticketNumber,
          site.id,
          site.name_site,
          intervention.technician_name,
          ficheTechUserId,
          now,
          status,
          intervention.planned_date,
          intervention.epv_type,
          data.user.email,
          doneDate,
          intervalHours,
          contractSeuil,
          isWithinContract === null ? null : (isWithinContract ? 1 : 0),
          intervention.id,
          site.nh1_dv,
          site.date_dv,
          nhNow,
          now,
          now
        )
        .run();
    } catch {
      await env.DB.prepare(
        'INSERT INTO fiche_history (id, ticket_number, site_id, site_name, technician, date_generated, status, planned_date, epv_type, created_by, date_completed, interval_hours, contract_seuil, is_within_contract, intervention_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          ficheId,
          ticketNumber,
          site.id,
          site.name_site,
          intervention.technician_name,
          now,
          status,
          intervention.planned_date,
          intervention.epv_type,
          data.user.email,
          doneDate,
          intervalHours,
          contractSeuil,
          isWithinContract === null ? null : (isWithinContract ? 1 : 0),
          intervention.id,
          now,
          now
        )
        .run();
    }

    await touchLastUpdatedAt(env);

    const updatedSite = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(site.id).first();

    return json({ ok: true, epv: epvDates, site: updatedSite ? { id: updatedSite.id } : null }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
