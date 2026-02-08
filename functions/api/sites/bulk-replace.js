import { ensureAdminUser } from '../_utils/db.js';
import { json, readJson, isoNow, newId, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);
    const sites = Array.isArray(body?.sites) ? body.sites : [];
    const z = String(userZone(data) || 'BZV/POOL');

    if (isSuperAdmin(data)) {
      await env.DB.prepare('DELETE FROM sites').run();
    } else {
      await env.DB.prepare('DELETE FROM sites WHERE zone = ?').bind(z).run();
    }

    const now = isoNow();
    for (const s of sites) {
      const id = s?.id ? String(s.id) : newId();
      const rowZone = isSuperAdmin(data)
        ? String(s.zone || z || 'BZV/POOL')
        : z;

      await env.DB.prepare(
        'INSERT INTO sites (id, zone, name_site, id_site, technician, generateur, capacite, kit_vidange, nh1_dv, date_dv, nh2_a, date_a, regime, nh_estimated, diff_nhs, diff_estimated, seuil, retired, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          id,
          rowZone,
          String(s.nameSite || ''),
          String(s.idSite || ''),
          String(s.technician || ''),
          String(s.generateur || ''),
          String(s.capacite || ''),
          String(s.kitVidange || ''),
          Number(s.nh1DV || 0),
          String(s.dateDV || ''),
          Number(s.nh2A || 0),
          String(s.dateA || ''),
          Number(s.regime || 0),
          Number(s.nhEstimated || 0),
          Number(s.diffNHs || 0),
          Number(s.diffEstimated || 0),
          Number(s.seuil || 250),
          s.retired ? 1 : 0,
          now,
          now
        )
        .run();
    }

    await touchLastUpdatedAt(env);

    return json({ ok: true, count: sites.length }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
