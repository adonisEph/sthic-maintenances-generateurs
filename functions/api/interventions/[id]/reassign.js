import { ensureAdminUser } from '../../_utils/db.js';
import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone } from '../../_utils/http.js';
import { touchLastUpdatedAt } from '../../_utils/meta.js';

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
    closeReason: row.close_reason || null,
    ticketNumber: row.ticket_number || null,
    ficheId: row.fiche_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const normTech = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

// Réassignation d'une intervention OUVERTE à un autre technicien.
// Body : { technicianName (requis), technicianUserId? , plannedDate? }
// - technicianUserId absent → résolution par nom (zone de l'intervention puis global)
// - plannedDate optionnelle → permet de replanifier en même temps
export async function onRequestPost({ request, env, data, params }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID manquant.' }, { status: 400 });

    const body = await readJson(request);
    const technicianName = String(body?.technicianName || '').trim();
    let technicianUserId = body?.technicianUserId ? String(body.technicianUserId) : null;
    const plannedDate = String(body?.plannedDate || '').slice(0, 10);

    if (!technicianName) return json({ error: 'Technicien requis.' }, { status: 400 });
    if (plannedDate && !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
      return json({ error: 'Date invalide (YYYY-MM-DD).' }, { status: 400 });
    }

    const existing = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Intervention introuvable.' }, { status: 404 });

    const st = String(existing.status || '');
    if (st === 'done' || st === 'non_fait') {
      return json({ error: 'Impossible de réassigner une intervention clôturée.' }, { status: 400 });
    }

    const rowZone = String(existing.zone || 'BZV/POOL');
    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if ((role === 'admin' || role === 'manager' || role === 'manager_bzv_pool') && z && rowZone !== z) {
        return json({ error: 'Accès interdit.' }, { status: 403 });
      }
    }

    // Résolution technician_user_id par nom si absent (zone de l'intervention puis global).
    if (!technicianUserId) {
      try {
        const key = normTech(technicianName);
        if (key) {
          const res = await env.DB.prepare(
            "SELECT id, technician_name, zone FROM users WHERE role = 'technician' AND (disabled_at IS NULL OR disabled_at = '')"
          ).all();
          const rows = Array.isArray(res?.results) ? res.results : [];
          const inZone = rows.filter((r) => String(r?.zone || '') === rowZone);
          const pickFrom = (list) => {
            const exact = list.find((r) => normTech(r?.technician_name) === key) || null;
            if (exact?.id) return exact;
            const partial = list.filter((r) => {
              const a = normTech(r?.technician_name);
              return a && (a.includes(key) || key.includes(a));
            });
            return partial.length === 1 ? partial[0] : null;
          };
          const match = pickFrom(inZone) || pickFrom(rows);
          if (match?.id) technicianUserId = String(match.id);
        }
      } catch {
        // ignore : technician_user_id reste null, le nom fait foi pour la visibilité
      }
    }

    const now = isoNow();
    const newDate = plannedDate || String(existing.planned_date || '');

    try {
      await env.DB.prepare(
        'UPDATE interventions SET technician_user_id = ?, technician_name = ?, planned_date = ?, updated_at = ? WHERE id = ?'
      )
        .bind(technicianUserId, technicianName, newDate, now, id)
        .run();
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('unique')) {
        return json(
          { error: 'Une intervention existe déjà pour ce site/type à cette date.' },
          { status: 409 }
        );
      }
      throw e;
    }

    await touchLastUpdatedAt(env);

    const updated = await env.DB.prepare('SELECT * FROM interventions WHERE id = ?').bind(id).first();
    return json({ intervention: mapRow(updated) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
