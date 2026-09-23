import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

// Nettoyage en masse : clôture (statut 'non_fait') toutes les interventions
// encore ouvertes (planned/sent) dont la date planifiée est antérieure à la
// campagne courante (= 1er du mois courant, Africa/Brazzaville) ou à la date
// `before` fournie.
//
// Body : { before?: 'YYYY-MM-DD', month?: 'YYYY-MM', zone?: 'BZV/POOL'|..., dryRun?: bool }
// - before prioritaire, sinon month → `${month}-01`, sinon mois courant
// - superadmin : zone optionnelle (toutes si absente) ; autres rôles : zone forcée
// - dryRun: renvoie le décompte sans rien modifier
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

    // Cutoff
    let before = String(body?.before || '').slice(0, 10);
    const month = String(body?.month || '').slice(0, 7);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
      if (/^\d{4}-\d{2}$/.test(month)) {
        before = `${month}-01`;
      } else {
        try {
          before = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Brazzaville',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date()).slice(0, 7) + '-01';
        } catch {
          before = `${new Date().toISOString().slice(0, 7)}-01`;
        }
      }
    }

    // Zone : superadmin peut viser une zone précise (ou toutes) ; les autres
    // rôles sont confinés à leur zone (GET applique le même scoping).
    let zoneClause = '';
    const binds = [before];
    if (!isSuperAdmin(data)) {
      const z = userZone(data);
      if (z) {
        zoneClause = ' AND zone = ?';
        binds.push(z);
      }
    } else {
      const z = String(body?.zone || '').trim();
      if (z && z !== 'ALL') {
        zoneClause = ' AND zone = ?';
        binds.push(z);
      }
    }

    if (dryRun) {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM interventions
         WHERE planned_date < ? AND status IN ('planned', 'sent')${zoneClause}`
      )
        .bind(...binds)
        .first();
      return json({ ok: true, dryRun: true, before, toClose: Number(row?.n || 0) }, { status: 200 });
    }

    const now = isoNow();
    const res = await env.DB.prepare(
      `UPDATE interventions
       SET status = 'non_fait',
           close_reason = 'Campagne antérieure — nettoyage ' || SUBSTR(planned_date, 6, 2) || '/' || SUBSTR(planned_date, 1, 4),
           updated_at = ?
       WHERE planned_date < ? AND status IN ('planned', 'sent')${zoneClause}`
    )
      .bind(now, ...binds)
      .run();

    const closed = Number(res?.meta?.changes || 0);
    if (closed > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, before, closed }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
