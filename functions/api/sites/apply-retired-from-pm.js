import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

function normalizeSiteCode(v) {
  return String(v || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizeZone(v) {
  return String(v || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

async function applyRetiredFlagForZone(env, { zone, retiredCodes, activeCodes }) {
  const z = normalizeZone(zone);
  if (!z) return { changed: 0, retiredChanged: 0, activeChanged: 0 };

  const retiredList = Array.isArray(retiredCodes) ? retiredCodes.map(normalizeSiteCode).filter(Boolean) : [];
  const activeList = Array.isArray(activeCodes) ? activeCodes.map(normalizeSiteCode).filter(Boolean) : [];

  const runUpdate = async (codes, retiredValue) => {
    const list = Array.isArray(codes) ? codes : [];
    if (list.length === 0) return 0;

    const now = isoNow();
    let localChanged = 0;

    const chunkSize = 80;
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      const ph = chunk.map(() => '?').join(',');
      const target = Number(retiredValue ? 1 : 0);

      const res = await env.DB.prepare(
        `UPDATE sites SET retired = ?, updated_at = ? WHERE zone = ? AND UPPER(REPLACE(COALESCE(id_site, ''), ' ', '')) IN (${ph}) AND retired != ?`
      )
        .bind(target, now, z, ...chunk, target)
        .run();

      localChanged += Number(res?.meta?.changes || 0);
    }

    return localChanged;
  };

  const retiredChanged = await runUpdate(retiredList, true);
  const activeChanged = await runUpdate(activeList, false);

  return {
    changed: retiredChanged + activeChanged,
    retiredChanged,
    activeChanged
  };
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '');
    if (role !== 'admin' && role !== 'manager') return json({ error: 'Accès interdit.' }, { status: 403 });

    const body = await readJson(request);

    const scopeZonesRaw = Array.isArray(body?.scopeZones) ? body.scopeZones : (body?.zone != null ? [body.zone] : []);
    const superAdmin = isSuperAdmin(data);

    const scopeZones = superAdmin
      ? scopeZonesRaw.map(normalizeZone).filter(Boolean)
      : [normalizeZone(userZone(data) || 'BZV/POOL')].filter(Boolean);

    if (scopeZones.length === 0) {
      return json({ error: 'Zone requise.' }, { status: 400 });
    }

    const retiredSites = Array.isArray(body?.retiredSites) ? body.retiredSites : [];
    const activeSites = Array.isArray(body?.activeSites) ? body.activeSites : [];
    const retiredSiteCodes = Array.isArray(body?.retiredSiteCodes) ? body.retiredSiteCodes : [];
    const activeSiteCodes = Array.isArray(body?.activeSiteCodes) ? body.activeSiteCodes : [];

    const hasPerZoneLists = retiredSites.length > 0 || activeSites.length > 0;
    if (!hasPerZoneLists && retiredSiteCodes.length === 0 && activeSiteCodes.length === 0) {
      return json({ error: 'Liste de sites vide.' }, { status: 400 });
    }

    let changed = 0;
    let retiredChanged = 0;
    let activeChanged = 0;

    for (const z of scopeZones) {
      const zNorm = normalizeZone(z);
      const retiredForZone = hasPerZoneLists
        ? retiredSites
            .filter((it) => normalizeZone(it?.zone) === zNorm)
            .map((it) => it?.siteCode)
        : retiredSiteCodes;
      const activeForZone = hasPerZoneLists
        ? activeSites
            .filter((it) => normalizeZone(it?.zone) === zNorm)
            .map((it) => it?.siteCode)
        : activeSiteCodes;

      const res = await applyRetiredFlagForZone(env, {
        zone: zNorm,
        retiredCodes: retiredForZone,
        activeCodes: activeForZone
      });
      changed += Number(res?.changed || 0);
      retiredChanged += Number(res?.retiredChanged || 0);
      activeChanged += Number(res?.activeChanged || 0);
    }

    if (changed) {
      await touchLastUpdatedAt(env);
    }

    return json(
      {
        ok: true,
        scopeZones,
        changed,
        retiredChanged,
        activeChanged
      },
      { status: 200 }
    );
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
