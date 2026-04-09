import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone, ymdToday } from '../../_utils/http.js';
import { nextTicketNumberForZone, formatTicket, touchLastUpdatedAt } from '../../_utils/meta.js';
import { calculateEstimatedNH, calculateDiffNHs, calculateEPVDates } from '../../_utils/calc.js';
import { createNotification, loadPushSubscriptionsForUsers, fanoutWebPushNoPayload } from '../../_utils/notifications.js';

export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const id = String(params?.id || '');
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const intervention = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    if (!intervention) return json({ error: 'Intervention introuvable.' }, { status: 404 });

    const isAdmin = data.user.role === 'admin';
    const isAssignedTech = intervention.technician_user_id && intervention.technician_user_id === data.user.id;
    if (!isAdmin && !isAssignedTech) {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    if (intervention.status === 'done') {
      return json({ ok: true }, { status: 200 });
    }

    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(intervention.site_id).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if (String(site.zone || 'BZV/POOL') !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    const body = await readJson(request);
    const now = isoNow();

    const userDoneDate = String(body?.doneDate || '').trim();
    const userNhNowRaw = body?.nhNow;

    const doneDate = /^\d{4}-\d{2}-\d{2}$/.test(userDoneDate) ? userDoneDate : ymdToday();
    const nhNow = Number.isFinite(Number(userNhNowRaw)) ? Number(userNhNowRaw) : Number(site.nh_estimated || site.nh2_a || 0);

    if (data.user.role === 'technician') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(userDoneDate)) {
        return json({ error: 'Date de vidange invalide.' }, { status: 400 });
      }
      if (!Number.isFinite(Number(userNhNowRaw))) {
        return json({ error: 'Compteur (NH) invalide.' }, { status: 400 });
      }
      if (Number(site.nh1_dv) > Number(userNhNowRaw)) {
        return json({ error: "Le compteur (NH) ne peut pas être inférieur au NH1 DV du site." }, { status: 400 });
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
    const nextRegime = Number.isFinite(Number(site.regime)) ? Number(site.regime) : 0;
    const nextNhEstimated = calculateEstimatedNH(nextNh2A, nextDateA, nextRegime);
    const nextDiffNHs = calculateDiffNHs(nextNh1DV, nextNh2A); // = 0
    const nextDiffEstimated = calculateDiffNHs(nextNh1DV, nextNhEstimated);

    const epvDates = calculateEPVDates(nextRegime, nextNh1DV, nextNhEstimated, contractSeuil);

    await env.DB.prepare(
      'UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?'
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

    await env.DB.prepare(
      'UPDATE interventions SET status = ?, done_at = ?, updated_at = ? WHERE id = ?'
    )
      .bind('done', doneDate, now, id)
      .run();

    const status = 'Effectuée';

    // 1) Priorité: fiche déjà liée à cette intervention
    // 2) Fallback: fiche créée en amont (manager/admin) mais pas liée (intervention_id absent/différent)
    //    => on la ré-attache à cette intervention pour garantir la cohérence ticket/fiche.
    const existingFicheByIntervention = await env.DB.prepare(
      'SELECT id, ticket_number FROM fiche_history WHERE intervention_id = ?'
    )
      .bind(id)
      .first();

    const fallbackFiche = !existingFicheByIntervention?.id
      ? await env.DB.prepare(
          `SELECT id, ticket_number
           FROM fiche_history
           WHERE site_id = ?
             AND planned_date IS ?
             AND epv_type IS ?
             AND technician = ?
             AND status IN ('En attente', 'Envoyée au magasin', 'Contrôle magasin')
           ORDER BY created_at DESC
           LIMIT 1`
        )
          .bind(site.id, intervention.planned_date || null, intervention.epv_type || null, intervention.technician_name)
          .first()
      : null;

    const existingFiche = existingFicheByIntervention?.id ? existingFicheByIntervention : fallbackFiche;

    // si on a trouvé une fiche fallback: on l'attache à l'intervention courante
    if (fallbackFiche?.id) {
      await env.DB.prepare(
        'UPDATE fiche_history SET intervention_id = ?, updated_at = ? WHERE id = ?'
      )
        .bind(id, now, String(fallbackFiche.id))
        .run();
    }

    // Ticket: ne générer un nouveau ticket que si on crée une nouvelle fiche, ou si la fiche trouvée n'en a pas.
    const ticketZone = String(site?.zone || site?.region || '').trim();
    let ticketNumber = String(existingFiche?.ticket_number || '').trim();
    if (!ticketNumber) {
      const z = String(ticketZone || '').trim().toUpperCase();
      if (z === 'PNR/KOUILOU') {
        // Même règle que /api/meta/ticket-number/next pour PNR/KOUILOU (format dd/mm/yyyy-n)
        const ymd = String(doneDate || '').slice(0, 10);
        const key = `ticket_number_pnr_day_${ymd}`;

        await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
          .bind(key, '0')
          .run();

        const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
        const current = Number(row?.meta_value || 0);
        const next = (Number.isFinite(current) ? current : 0) + 1;

        await env.DB.prepare('INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES (?, ?)')
          .bind(key, String(next))
          .run();

        await touchLastUpdatedAt(env);

        const [yy, mm, dd] = ymd.split('-');
        ticketNumber = `${dd}/${mm}/${yy}-${next}`;
      } else {
        const tn = await nextTicketNumberForZone(env, ticketZone);
        ticketNumber = formatTicket(tn, ticketZone);
      }
    }

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

      try {
        const siteZone = String(site?.zone || 'BZV/POOL');

        const viewersRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'viewer'").all();
        const viewerIds = (Array.isArray(viewersRes?.results) ? viewersRes.results : []).map((r) => String(r?.id || '')).filter(Boolean);

        const managersRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'manager' AND zone = ?").bind(siteZone).all();
        const managerIds = (Array.isArray(managersRes?.results) ? managersRes.results : []).map((r) => String(r?.id || '')).filter(Boolean);

        const adminsRes = await env.DB.prepare("SELECT id, zone FROM users WHERE role = 'admin'").all();
        const adminRows = Array.isArray(adminsRes?.results) ? adminsRes.results : [];
        const adminIds = adminRows
          .filter((r) => {
            const z = String(r?.zone || 'BZV/POOL');
            if (z === 'BZV/POOL') return true;
            return z === siteZone;
          })
          .map((r) => String(r?.id || ''))
          .filter(Boolean);

        const recipients = Array.from(new Set([...viewerIds, ...managerIds, ...adminIds])).filter(Boolean);
        const title = 'Vidange effectuée';
        const bodyTxt = `${String(site?.name_site || '') || 'Site'} (${String(site?.id_site || '').trim() || site.id}) - ${doneDate}`;

        for (const uid of recipients) {
          await createNotification(env, {
            userId: uid,
            title,
            body: bodyTxt,
            kind: 'EPV_DONE',
            refId: String(id),
            zone: siteZone
          });
        }

        const subs = await loadPushSubscriptionsForUsers(env, recipients);
        await fanoutWebPushNoPayload(env, subs);
      } catch {
        // ignore notifications failures
      }

      return json({ ok: true, epv: epvDates, site: updatedSite ? { id: updatedSite.id } : null }, { status: 200 });
    }

    const ficheId = `fiche-${id}`;

    try {
      await env.DB.prepare(
        'INSERT INTO fiche_history (id, ticket_number, site_id, site_name, technician, date_generated, status, planned_date, epv_type, created_by, date_completed, interval_hours, contract_seuil, is_within_contract, intervention_id, nh1_dv, date_dv, nh_now, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
          id,
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
          id,
          now,
          now
        )
        .run();
    }

    await touchLastUpdatedAt(env);

    const updatedSite = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(site.id).first();

    try {
      const siteZone = String(site?.zone || 'BZV/POOL');

      const viewersRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'viewer'").all();
      const viewerIds = (Array.isArray(viewersRes?.results) ? viewersRes.results : []).map((r) => String(r?.id || '')).filter(Boolean);

      const managersRes = await env.DB.prepare("SELECT id FROM users WHERE role = 'manager' AND zone = ?").bind(siteZone).all();
      const managerIds = (Array.isArray(managersRes?.results) ? managersRes.results : []).map((r) => String(r?.id || '')).filter(Boolean);

      const adminsRes = await env.DB.prepare("SELECT id, zone FROM users WHERE role = 'admin'").all();
      const adminRows = Array.isArray(adminsRes?.results) ? adminsRes.results : [];
      const adminIds = adminRows
        .filter((r) => {
          const z = String(r?.zone || 'BZV/POOL');
          if (z === 'BZV/POOL') return true;
          return z === siteZone;
        })
        .map((r) => String(r?.id || ''))
        .filter(Boolean);

      const recipients = Array.from(new Set([...viewerIds, ...managerIds, ...adminIds])).filter(Boolean);
      const title = 'Vidange effectuée';
      const bodyTxt = `${String(site?.name_site || '') || 'Site'} (${String(site?.id_site || '').trim() || site.id}) - ${doneDate}`;

      for (const uid of recipients) {
        await createNotification(env, {
          userId: uid,
          title,
          body: bodyTxt,
          kind: 'EPV_DONE',
          refId: String(id),
          zone: siteZone
        });
      }

      const subs = await loadPushSubscriptionsForUsers(env, recipients);
      await fanoutWebPushNoPayload(env, subs);
    } catch {
      // ignore notifications failures
    }

    return json({ ok: true, epv: epvDates, site: updatedSite ? { id: updatedSite.id } : null }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
