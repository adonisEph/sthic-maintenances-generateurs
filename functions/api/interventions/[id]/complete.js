import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, ymdToday, isSuperAdmin, userZone } from '../../_utils/http.js';
import { calculateEPVDates } from '../../_utils/calc.js';
import { nextTicketNumberForZone, formatTicket, touchLastUpdatedAt } from '../../_utils/meta.js';

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

    const regime = Number(site.regime || 0);

    const nextNh1DV = nhNow;
    const nextDateDV = doneDate;
    const nextNh2A = nhNow;
    const nextDateA = doneDate;

    const epvDates = calculateEPVDates(regime, nextNh1DV, nhNow, contractSeuil);

    await env.DB.prepare(
      'UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, nh_estimated = ?, diff_nhs = 0, diff_estimated = 0, updated_at = ? WHERE id = ?'
    )
      .bind(nextNh1DV, nextDateDV, nextNh2A, nextDateA, nhNow, now, site.id)
      .run();

    await env.DB.prepare(
      'UPDATE interventions SET status = ?, done_at = ?, nh_now = ?, updated_at = ? WHERE id = ?'
    )
      .bind('done', doneDate, nhNow === null ? null : nhNow, now, id)
      .run();

    const ticketZone = String(site?.zone || site?.region || '').trim();
    const tn = await nextTicketNumberForZone(env, ticketZone);
    const ticketNumber = formatTicket(tn, ticketZone);

    const ficheId = `fiche-${id}`;
    const status = 'Effectuée';

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

    return json({ ok: true, epv: epvDates }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
