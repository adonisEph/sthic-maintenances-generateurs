import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, ymdToday, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import { technicianMatches, effectiveTechnicianName } from '../_utils/nhCoherence.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    zone: row.zone || 'BZV/POOL',
    siteId: row.site_id,
    plannedDate: row.planned_date,
    epvType: row.epv_type,
    technicianUserId: row.technician_user_id || null,
    technicianName: row.technician_name,
    status: row.status,
    sentAt: row.sent_at || null,
    doneAt: row.done_at || null,
    doneByEmail: row.done_by_email || null,
    doneByRole: row.done_by_role || null,
    closeReason: row.close_reason || null,
    ticketNumber: row.ticket_number || null,
    ficheId: row.fiche_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (!['admin', 'technician', 'manager', 'manager_bzv_pool', 'warehouse', 'controller', 'field_supervisor', 'viewer'].includes(role)) {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const status = url.searchParams.get('status');
    const technicianUserId = url.searchParams.get('technicianUserId');
    const siteId = url.searchParams.get('siteId');
    const includeOpen = url.searchParams.get('includeOpen') === '1';

    let where = '1=1';
    const binds = [];

    const z = userZone(data);
    if (!isSuperAdmin(data) && role === 'admin') {
      where += ' AND i.zone = ?';
      binds.push(z);
    }
    // Technicien : PAS de filtre zone — la zone stockée sur l'intervention peut être
    // erronée/périmée alors que le site lui est bien assigné (cohérent avec GET /api/sites).
    if (role === 'manager' || role === 'field_supervisor') {
      where += ' AND i.zone = ?';
      binds.push(z);
    }
    if (role === 'warehouse') {
      where += ' AND i.zone = ?';
      binds.push(z);
    }

    // includeOpen=1 : la plage de dates couvre aussi TOUTES les interventions encore
    // ouvertes (planned/sent) hors plage — sinon le backlog du mois précédent disparaît.
    if (includeOpen && (from || to)) {
      const dateClauses = [];
      if (from) {
        dateClauses.push('i.planned_date >= ?');
        binds.push(from);
      }
      if (to) {
        dateClauses.push('i.planned_date <= ?');
        binds.push(to);
      }
      where += ` AND ((${dateClauses.join(' AND ')}) OR i.status IN ('planned', 'sent'))`;
    } else {
      if (from) {
        where += ' AND i.planned_date >= ?';
        binds.push(from);
      }
      if (to) {
        where += ' AND i.planned_date <= ?';
        binds.push(to);
      }
    }
    if (status) {
      where += ' AND i.status = ?';
      binds.push(status);
    }

    if (siteId) {
      where += ' AND i.site_id = ?';
      binds.push(String(siteId));
    }

    // Technicien : visibilité par user_id OU par nom (fallback nom normalisé appliqué
    // en JS ci-dessous — les accents/casse ne peuvent pas être normalisés en SQL).
    // Le SQL élargit volontairement (technician_name IS NOT NULL) puis on resserre en JS.
    if (role === 'technician') {
      where += ' AND (i.technician_user_id = ? OR i.technician_name IS NOT NULL)';
      binds.push(data.user.id);
    } else if ((role === 'admin' && isSuperAdmin(data)) && technicianUserId) {
      where += ' AND i.technician_user_id = ?';
      binds.push(String(technicianUserId));
    }

    const stmt = env.DB.prepare(
      `SELECT i.*, fh.ticket_number, fh.id as fiche_id
       FROM interventions i
       LEFT JOIN (
         SELECT intervention_id, MIN(id) AS fiche_id
         FROM fiche_history
         WHERE intervention_id IS NOT NULL
         GROUP BY intervention_id
       ) f ON f.intervention_id = i.id
       LEFT JOIN fiche_history fh ON fh.id = f.fiche_id
       WHERE ${where}
       ORDER BY i.planned_date ASC`
    );
    const res = await stmt.bind(...binds).all();
    let rows = Array.isArray(res?.results) ? res.results : [];

    // Technicien : resserrage JS — user_id exact OU nom normalisé (égalité/contient).
    if (role === 'technician') {
      const myName = await effectiveTechnicianName(env, data);
      const uid = String(data.user.id || '');
      rows = rows.filter(
        (r) =>
          String(r?.technician_user_id || '') === uid ||
          technicianMatches(r?.technician_name, myName)
      );
    }

    return json(
      { interventions: rows.map(mapRow), today: ymdToday() },
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
  let body = null;
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') return json({ error: 'Accès interdit.' }, { status: 403 });

    body = await readJson(request);
    const plannedDate = String(body.plannedDate || '');
    const epvType = String(body.epvType || '');
    const siteId = String(body.siteId || '');
    let technicianUserId = body.technicianUserId ? String(body.technicianUserId) : null;
    const technicianName = String(body.technicianName || '');

    const requestedStatus = String(body.status || '').trim() || 'planned';
    if (requestedStatus !== 'planned' && requestedStatus !== 'sent') {
      return json({ error: "Statut invalide (attendu: 'planned' ou 'sent')." }, { status: 400 });
    }

    if (!plannedDate || !epvType || !siteId || !technicianName) {
      return json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    const site = await env.DB.prepare('SELECT id, zone, retired FROM sites WHERE id = ?').bind(siteId).first();
    if (!site) return json({ error: 'Site introuvable.' }, { status: 404 });
    const zone = String(site.zone || 'BZV/POOL');
    if (Boolean(site?.retired)) return json({ error: 'Site retiré : vidange bloquée.' }, { status: 409 });
    if (role === 'admin' && !isSuperAdmin(data)) {
      const z = userZone(data);
      if (zone !== z) return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    // If technicianUserId is not provided, try to resolve it server-side
    // This makes fiche generation robust even if the frontend cannot match users.
    // Recherche d'abord dans la zone du site, puis global — un compte tech dont la
    // zone diffère du site ne doit pas laisser technician_user_id à NULL.
    if (!technicianUserId) {
      try {
        const norm = (v) =>
          String(v || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')

            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        const key = norm(technicianName);
        if (key) {
          const res = await env.DB.prepare(
            "SELECT id, technician_name, zone FROM users WHERE role = 'technician' AND (disabled_at IS NULL OR disabled_at = '')"
          ).all();
          const rows = Array.isArray(res?.results) ? res.results : [];
          const inZone = rows.filter((r) => String(r?.zone || '') === zone);
          const pickFrom = (list) => {
            const exact = list.find((r) => norm(r?.technician_name) === key) || null;
            if (exact?.id) return exact;
            const partial = list.filter((r) => {
              const a = norm(r?.technician_name);
              return a && (a.includes(key) || key.includes(a));
            });
            return partial.length === 1 ? partial[0] : null;
          };
          const match = pickFrom(inZone) || pickFrom(rows);
          if (match?.id) technicianUserId = String(match.id);
        }
      } catch {
        // ignore: technicianUserId will remain null
      }
    }

    const id = newId();
    const now = isoNow();

    const status = requestedStatus;
    const sentAt = status === 'sent' ? now : null;

    await env.DB.prepare(
      'INSERT INTO interventions (id, site_id, zone, planned_date, epv_type, technician_user_id, technician_name, status, sent_at, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, siteId, zone, plannedDate, epvType, technicianUserId, technicianName, status, sentAt, data.user.id, now, now)
      .run();

    await touchLastUpdatedAt(env);

    const created = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    return json({ intervention: mapRow(created) }, { status: 201 });
  } catch (e) {
    const msg = String(e?.message || 'Erreur serveur.');
    if (msg.toLowerCase().includes('unique')) {
      try {
        if (!body) {
          return json({ error: 'Intervention déjà planifiée.' }, { status: 409 });
        }

        const plannedDate = String(body.plannedDate || '');
        const epvType = String(body.epvType || '');
        const siteId = String(body.siteId || '');
        const requestedStatus = String(body.status || '').trim() || 'planned';
        const requestedTechnicianName = String(body.technicianName || '');
        const requestedTechnicianUserId = body.technicianUserId ? String(body.technicianUserId) : null;

        const existing = await env.DB.prepare(
          'SELECT * FROM interventions WHERE site_id = ? AND planned_date = ? AND epv_type = ? ORDER BY created_at DESC LIMIT 1'
        )
          .bind(siteId, plannedDate, epvType)
          .first();

        if (!existing) {
          return json({ error: 'Intervention déjà planifiée.' }, { status: 409 });
        }

        if (requestedStatus === 'sent') {
          const now = isoNow();

          // Try to fill technician_user_id if missing and a technician is provided.
          let techIdToSet = requestedTechnicianUserId;
          if (!techIdToSet && !existing.technician_user_id) {
            try {
              const site = await env.DB.prepare('SELECT zone FROM sites WHERE id = ?').bind(siteId).first();
              const zone = String(site?.zone || 'BZV/POOL');
              const norm = (v) =>
                String(v || '')
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, ' ');
              const key = norm(requestedTechnicianName);
              if (key) {
                const res = await env.DB.prepare(
                  "SELECT id, technician_name FROM users WHERE role = 'technician' AND (disabled_at IS NULL OR disabled_at = '') AND zone = ?"
                )
                  .bind(zone)
                  .all();
                const rows = Array.isArray(res?.results) ? res.results : [];
                const match = rows.find((r) => norm(r?.technician_name) === key) || null;
                if (match?.id) {
                  techIdToSet = String(match.id);
                } else {
                  const partial = rows.filter((r) => {
                    const a = norm(r?.technician_name);
                    return a && (a.includes(key) || key.includes(a));
                  });
                  if (partial.length === 1 && partial[0]?.id) techIdToSet = String(partial[0].id);
                }
              }
            } catch {
              techIdToSet = null;
            }
          }

          // Upgrade planned->sent and set sent_at if missing. Keep technician_user_id if already set.
          await env.DB.prepare(
            "UPDATE interventions SET status = 'sent', sent_at = COALESCE(sent_at, ?), technician_user_id = COALESCE(technician_user_id, ?), updated_at = ? WHERE id = ? AND status IN ('planned', 'sent')"
          )
            .bind(now, techIdToSet, now, String(existing.id))
            .run();
          await touchLastUpdatedAt(env);
          const updated = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(String(existing.id)).first();
          return json({ intervention: mapRow(updated) }, { status: 200 });
        }

        return json({ intervention: mapRow(existing) }, { status: 200 });
      } catch {
        return json({ error: 'Intervention déjà planifiée.' }, { status: 409 });
      }
    }
    return json({ error: msg }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const id = String(body?.id || '').trim();
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const row = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    if (!row) return json({ ok: true, deleted: 0 }, { status: 200 });

    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if (z && String(row.zone || 'BZV/POOL') !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    if (String(row.status || '') === 'done' || String(row.status || '') === 'non_fait') {
      return json({ error: 'Impossible de supprimer une intervention effectuée.' }, { status: 400 });
    }

    const res = await env.DB.prepare("DELETE FROM interventions WHERE id = ? AND status IN ('planned', 'sent')")
      .bind(id)
      .run();

    if ((res?.meta?.changes || 0) > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, deleted: Number(res?.meta?.changes || 0) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
