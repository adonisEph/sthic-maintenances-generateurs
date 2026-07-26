import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, userZone, isSuperAdmin } from '../_utils/http.js';

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool' && role !== 'warehouse' && role !== 'controller' && role !== 'field_supervisor' && role !== 'viewer') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const siteId = String(url.searchParams.get('siteId') || '').trim();
    if (!siteId) return json({ error: 'siteId requis.' }, { status: 400 });

    const days = Math.max(1, Math.floor(Number(url.searchParams.get('days') || 90)));
    const itemType = String(url.searchParams.get('itemType') || '').trim();

    const requesterZone = String(userZone(data) || 'BZV/POOL').trim().toUpperCase();
    const canAllZones = role === 'warehouse' || isSuperAdmin(data) || role === 'manager_bzv_pool' || role === 'admin';

    let where = 'site_id = ? AND movement_type = ?';
    const bind = [siteId, 'exit'];

    if (itemType) {
      where += ' AND item_type = ?';
      bind.push(itemType);
    }

    if (!canAllZones) {
      where += ' AND zone = ?';
      bind.push(requesterZone);
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    where += ' AND created_at >= ?';
    bind.push(cutoff);

    const res = await env.DB.prepare(
      `SELECT * FROM stock_movements WHERE ${where} ORDER BY created_at DESC`
    ).bind(...bind).all();

    const rows = Array.isArray(res?.results) ? res.results : [];

    const exits = rows.map((r) => ({
      id: r.id,
      itemType: r.item_type,
      quantity: Number(r.quantity) || 0,
      zone: r.zone || 'BZV/POOL',
      siteId: r.site_id,
      siteName: r.site_name,
      ficheId: r.fiche_id,
      technicianName: r.technician_name,
      notes: r.notes,
      createdBy: r.created_by,
      createdAt: r.created_at
    }));

    const byType = {};
    for (const e of exits) {
      if (!byType[e.itemType]) byType[e.itemType] = [];
      byType[e.itemType].push(e);
    }

    return json({ exits, byType, days }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
