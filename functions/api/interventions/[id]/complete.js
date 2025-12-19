import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, ymdToday } from '../../_utils/http.js';
import { calculateEPVDates } from '../../_utils/calc.js';
import { nextTicketNumber, formatTicket } from '../../_utils/meta.js';

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

    const body = await readJson(request);
    const now = isoNow();
    const today = ymdToday();

    const intervalHours = Number(site.nh2_a) - Number(site.nh1_dv);
    const contractSeuil = Number(site.seuil || 250);
    const isWithinContract = Number.isFinite(intervalHours) ? (intervalHours <= contractSeuil) : null;

    const regime = Number(site.regime || 0);
    const nhNow = Number(site.nh_estimated || site.nh2_a || 0);

    const nextNh1DV = nhNow;
    const nextDateDV = today;
    const nextNh2A = nhNow;
    const nextDateA = today;

    const epvDates = calculateEPVDates(regime, nextNh1DV, nhNow, contractSeuil);

    await env.DB.prepare(
      'UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, nh_estimated = ?, diff_nhs = 0, diff_estimated = 0, updated_at = ? WHERE id = ?'
    )
      .bind(nextNh1DV, nextDateDV, nextNh2A, nextDateA, nhNow, now, site.id)
      .run();

    await env.DB.prepare(
      "UPDATE interventions SET status = 'done', done_at = ?, updated_at = ? WHERE id = ?"
    )
      .bind(now, now, id)
      .run();

    const tn = await nextTicketNumber(env);
    const ticketNumber = formatTicket(tn);

    const ficheId = `fiche-${id}`;
    const status = 'Effectuée';

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
        now,
        intervalHours,
        contractSeuil,
        isWithinContract === null ? null : (isWithinContract ? 1 : 0),
        id,
        now,
        now
      )
      .run();

    return json({ ok: true, epv: epvDates }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
