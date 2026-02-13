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

    if (!isSuperAdmin(data) && (role === 'manager' || role === 'technician')) {
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

    const ticketNumber = String(body?.ticketNumber || '').trim();
    const siteId = String(body?.siteId || '').trim();
    const siteName = String(body?.siteName || '').trim();
    const technician = String(body?.technician || '').trim();
    const plannedDate = body?.plannedDate ? String(body.plannedDate).slice(0, 10) : null;
    const epvType = body?.epvType ? String(body.epvType).trim() : null;

    const signatureTypedName = String(body?.signatureTypedName || '').trim();
    const signatureDrawnPng = String(body?.signatureDrawnPng || '').trim();

    if (!ticketNumber || !siteId || !siteName || !technician) {
      return json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    // Signature obligatoire (dessin + nom tapé)
    if (!signatureTypedName || !signatureDrawnPng.startsWith('data:image/png;base64,')) {
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

    // Doublon bloquant: 1 ticketNumber => 1 fiche
    const existing = await env.DB.prepare('SELECT id FROM fiche_history WHERE ticket_number = ?').bind(ticketNumber).first();
    if (existing?.id) {
      return json({ error: 'Fiche déjà sortie pour ce ticket.' }, { status: 409 });
    }

    const id = newId();
    const now = isoNow();

    await env.DB.prepare(
      `INSERT INTO fiche_history
      (id, ticket_number, site_id, site_name, technician, date_generated, status, planned_date, epv_type, created_by,
       signature_typed_name, signature_drawn_png, signed_by_email, signed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        ticketNumber,
        siteId,
        siteName,
        technician,
        now,
        'En attente',
        plannedDate,
        epvType,
        data?.user?.email ? String(data.user.email) : null,
        signatureTypedName,
        signatureDrawnPng,
        data?.user?.email ? String(data.user.email) : null,
        now,
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