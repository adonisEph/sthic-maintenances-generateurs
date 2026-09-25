import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

// Nettoyage des fiches orphelines : une fiche restée ouverte (ni 'Annulée' ni
// 'Effectuée') alors que la vidange correspondante est déjà terminée. Deux cas :
//   A) la fiche pointe vers une intervention clôturée (done/non_fait)
//   B) une autre fiche 'Effectuée' plus récente existe pour le même site + EPV
//      (le ticket affiché aux techniciens a été clôturé via un autre ticket)
// Les fiches ouvertes SANS intervention ni doublon effectué sont conservées :
// ce sont des tickets de travail légitimes en attente.
//
// Body : { zone?: 'BZV/POOL'|..., dryRun?: bool }
// - superadmin : zone optionnelle (toutes si absente) ; autres rôles : zone forcée
// - dryRun : renvoie le décompte + échantillon sans rien modifier
const OPEN = "(f.status IS NULL OR f.status NOT IN ('Annulée', 'Effectuée'))";
const ORPHAN_CLOSED_INT = `EXISTS (
    SELECT 1 FROM interventions i
    WHERE i.id = f.intervention_id AND i.status IN ('done', 'non_fait')
  )`;
const ORPHAN_SUPERSEDED = `EXISTS (
    SELECT 1 FROM fiche_history g
    WHERE g.site_id = f.site_id AND g.id != f.id AND g.status = 'Effectuée'
      AND (f.epv_type IS NULL OR f.epv_type = '' OR g.epv_type IS f.epv_type)
      AND (
        g.date_completed >= f.date_generated
        OR (f.planned_date IS NOT NULL AND g.planned_date IS f.planned_date)
      )
  )`;

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const body = await readJson(request);
    const dryRun = Boolean(body?.dryRun);

    // Zone : managers/admin non-superadmin confinés à leur zone (jointure sites).
    let zoneClause = '';
    const zoneBinds = [];
    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if (z) {
        zoneClause = ' AND s.zone = ?';
        zoneBinds.push(z);
      }
    } else {
      const z = String(body?.zone || '').trim();
      if (z && z !== 'ALL') {
        zoneClause = ' AND s.zone = ?';
        zoneBinds.push(z);
      }
    }

    const baseWhere = `FROM fiche_history f
      JOIN sites s ON s.id = f.site_id
      WHERE ${OPEN} AND (${ORPHAN_CLOSED_INT} OR ${ORPHAN_SUPERSEDED})${zoneClause}`;

    if (dryRun) {
      const row = await env.DB.prepare(`SELECT COUNT(*) AS n ${baseWhere}`).bind(...zoneBinds).first();
      const sample = await env.DB.prepare(
        `SELECT f.id, f.ticket_number, f.site_id, f.epv_type, f.planned_date, f.status ${baseWhere}
         ORDER BY f.site_id LIMIT 20`
      )
        .bind(...zoneBinds)
        .all();
      return json(
        { ok: true, dryRun: true, toCancel: Number(row?.n || 0), sample: Array.isArray(sample?.results) ? sample.results : [] },
        { status: 200 }
      );
    }

    const now = isoNow();
    let cancelled = 0;

    // La clause zone (jointure s dans le dry-run) devient une sous-requête dans
    // l'UPDATE (SQLite ne supporte pas les jointures en UPDATE).
    const orphanZoneSub = zoneClause ? ' AND f.site_id IN (SELECT id FROM sites s WHERE s.zone = ?)' : '';

    try {
      const resA = await env.DB.prepare(
        `UPDATE fiche_history AS f
         SET status = 'Annulée',
             warehouse_flow_status = NULL,
             cancel_reason = 'Fiche orpheline — intervention clôturée (done/non_fait)',
             updated_at = ?
         WHERE ${OPEN} AND ${ORPHAN_CLOSED_INT}${orphanZoneSub}`
      )
        .bind(now, ...zoneBinds)
        .run();
      cancelled += Number(resA?.meta?.changes || 0);

      const resB = await env.DB.prepare(
        `UPDATE fiche_history AS f
         SET status = 'Annulée',
             warehouse_flow_status = NULL,
             cancel_reason = 'Fiche orpheline — vidange effectuée via un autre ticket',
             updated_at = ?
         WHERE ${OPEN} AND ${ORPHAN_SUPERSEDED}${orphanZoneSub}`
      )
        .bind(now, ...zoneBinds)
        .run();
      cancelled += Number(resB?.meta?.changes || 0);
    } catch (e) {
      // Compat pré-migration 0034 : colonne cancel_reason absente → sans motif.
      if (!String(e?.message || '').toLowerCase().includes('cancel_reason')) throw e;
      const resA = await env.DB.prepare(
        `UPDATE fiche_history AS f
         SET status = 'Annulée', warehouse_flow_status = NULL, updated_at = ?
         WHERE ${OPEN} AND ${ORPHAN_CLOSED_INT}${orphanZoneSub}`
      )
        .bind(now, ...zoneBinds)
        .run();
      cancelled += Number(resA?.meta?.changes || 0);

      const resB = await env.DB.prepare(
        `UPDATE fiche_history AS f
         SET status = 'Annulée', warehouse_flow_status = NULL, updated_at = ?
         WHERE ${OPEN} AND ${ORPHAN_SUPERSEDED}${orphanZoneSub}`
      )
        .bind(now, ...zoneBinds)
        .run();
      cancelled += Number(resB?.meta?.changes || 0);
    }

    if (cancelled > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, cancelled }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
