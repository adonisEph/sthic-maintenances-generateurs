import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, isSuperAdmin, userZone, readJson, isoNow, newId } from '../_utils/http.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.site_zone || row.zone || 'BZV/POOL',
    ticketNumber: row.ticket_number,
    siteId: row.site_id,
    siteName: row.site_name,
    technician: row.technician,
    dateGenerated: row.date_generated,
    status: row.status,
    plannedDate: row.planned_date,
    epvType: row.epv_type,
    createdBy: row.created_by,
    dateCompleted: row.date_completed,
    intervalHours: row.interval_hours,
    contractSeuil: row.contract_seuil,
    isWithinContract: row.is_within_contract === null ? null : Boolean(row.is_within_contract),
    nh1DV: row.nh1_dv === undefined ? undefined : row.nh1_dv,
    dateDV: row.date_dv === undefined ? undefined : row.date_dv,
    nhNow: row.nh_now === undefined ? undefined : row.nh_now,
    interventionId: row.intervention_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signatureTypedName: row.signature_typed_name || null,
    signatureDrawnPng: row.signature_drawn_png || null,
    signedByEmail: row.signed_by_email || null,
    signedAt: row.signed_at || null,
    warehouseAirFilterOk: row.warehouse_air_filter_ok === null ? null : Boolean(row.warehouse_air_filter_ok),
    warehouseCoolant5lOk: row.warehouse_coolant_5l_ok === null ? null : Boolean(row.warehouse_coolant_5l_ok),
    warehouseCheckedBy: row.warehouse_checked_by || null,
    warehouseCheckedAt: row.warehouse_checked_at || null,
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    let where = '1=1';
    const binds = [];

    if (from) {
      where += ' AND fh.date_generated >= ?';
      binds.push(from);
    }
    if (to) {
      where += ' AND fh.date_generated <= ?';
      binds.push(to);
    }

    const role = String(data?.user?.role || '');

    if (role === 'technician') {
      where += ' AND fh.technician = ?';
      binds.push(String(data.user.technicianName || ''));
    }

    if (!isSuperAdmin(data) && (role === 'manager' || role === 'technician' || role === 'warehouse')) {
      where += ' AND s.zone = ?';
      binds.push(String(userZone(data) || 'BZV/POOL'));
    }

    const stmt = env.DB.prepare(
      `SELECT fh.*, s.zone as site_zone 
      FROM fiche_history fh
      LEFT JOIN sites s ON s.id = fh.site_id
      WHERE ${where}
      ORDER BY fh.date_generated DESC
      LIMIT 2000`
    );
    const res = await stmt.bind(...binds).all();
    const rows = Array.isArray(res?.results) ? res.results : [];

    return json(
      { fiches: rows.map(mapRow) },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);

    const mode = String(body?.mode || '').trim().toLowerCase();
    const isDraft = mode === 'draft';

    const ticketNumber = isDraft ? String(body?.ticketNumber || '').trim() : String(body?.ticketNumber || '').trim();
    const siteId = String(body?.siteId || '').trim();
    const siteName = String(body?.siteName || '').trim();
    const technician = String(body?.technician || '').trim();

    const plannedDate = body?.plannedDate ? String(body.plannedDate).slice(0, 10) : null;
    const epvType = body?.epvType ? String(body.epvType).trim() : null;
    const interventionId = body?.interventionId != null ? String(body.interventionId).trim() : null;

    const signatureTypedName = String(body?.signatureTypedName || '').trim();
    const signatureDrawnPng = String(body?.signatureDrawnPng || '').trim();

    const hasResponsibleSignature = (value) => {
      const v = String(value || '').trim();
      if (!v) return false;
      if (v.startsWith('data:image/')) return true;
      if (v.startsWith('blob:')) return true;
      if (v.startsWith('http://') || v.startsWith('https://')) return true;
      if (v.startsWith('/')) return true;
      return false;
    };

    if (!siteId || !siteName || !technician || (!isDraft && !ticketNumber)) {
      return json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    // Signature obligatoire uniquement pour une fiche finalisée
    if (!isDraft && !hasResponsibleSignature(signatureDrawnPng)) {
      return json({ error: 'Signature responsable obligatoire.' }, { status: 400 });
    }

    // Contrôle zone (manager doit rester dans sa zone, superadmin ok)
    const site = await env.DB.prepare('SELECT id, zone FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });

    const zone = String(site.zone || 'BZV/POOL');
    if (!isSuperAdmin(data) && role === 'manager') {
      const z = String(userZone(data) || 'BZV/POOL');
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    // Anti-doublon brouillon: réutiliser le brouillon existant (même site/date/type/intervention)
    if (isDraft) {
      const existingDraft = await env.DB.prepare(
        `SELECT * FROM fiche_history
         WHERE status = 'Brouillon'
           AND site_id = ?
           AND planned_date IS ?
           AND epv_type IS ?
           AND intervention_id IS ?
           AND (ticket_number IS NULL OR ticket_number = '')
         ORDER BY created_at DESC
         LIMIT 1`
      )
        .bind(siteId, plannedDate, epvType, interventionId)
        .first();

      if (existingDraft?.id) {
        return json({ fiche: mapRow(existingDraft) }, { status: 200 });
      }
    }

    // Doublon bloquant: 1 ticketNumber => 1 fiche (uniquement si ticket renseigné)
    if (!isDraft && ticketNumber) {
      const existing = await env.DB.prepare('SELECT id FROM fiche_history WHERE ticket_number = ?').bind(ticketNumber).first();
      if (existing?.id) {
        return json({ error: 'Fiche déjà sortie pour ce ticket.' }, { status: 409 });
      }
    }

    const id = newId();
    const now = isoNow();

    await env.DB.prepare(
      `INSERT INTO fiche_history
      (id, ticket_number, site_id, site_name, technician, date_generated, status, planned_date, epv_type, created_by,
       signature_typed_name, signature_drawn_png, signed_by_email, signed_at, intervention_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        ticketNumber || null,
        siteId,
        siteName,
        technician,
        now,
        isDraft ? 'Brouillon' : 'En attente',
        plannedDate,
        epvType,
        data?.user?.email ? String(data.user.email) : null,
        signatureTypedName,
        isDraft ? null : signatureDrawnPng,
        data?.user?.email ? String(data.user.email) : null,
        isDraft ? null : now,
        interventionId,
        now,
        now
      )
      .run();

    const created = await env.DB.prepare('SELECT * FROM fiche_history WHERE id = ?').bind(id).first();
    return json({ fiche: mapRow(created) }, { status: 201 });
  } catch (e) {
    const msg = String(e?.message || 'Erreur serveur.');
    // Collision unique (double clic / requêtes simultanées)
    if (msg.toLowerCase().includes('unique')) return json({ error: 'Fiche déjà sortie pour ce ticket.' }, { status: 409 });
    return json({ error: msg }, { status: 500 });
  }
}