import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isoNow, newId, isSuperAdmin, userZone } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';

const VALID_ITEM_TYPES = ['air_filter', 'ventilation_belt', 'coolant_5l'];
const VALID_MOVEMENT_TYPES = ['entry', 'exit'];

const GENERATOR_TYPES = [
  'generator_logic_perkins',
  'elcos_perkins',
  'pi_20',
  'sdmo_t22',
  'elcos_yanmar',
  'jubaili_bross_30'
];

const ITEMS_WITH_GENERATOR = ['air_filter', 'ventilation_belt'];

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    itemType: r.item_type,
    movementType: r.movement_type,
    quantity: Number(r.quantity) || 0,
    zone: r.zone || 'BZV/POOL',
    siteId: r.site_id || null,
    siteName: r.site_name || null,
    ficheId: r.fiche_id || null,
    technicianName: r.technician_name || null,
    generatorType: r.generator_type || null,
    notes: r.notes || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at
  };
}

export async function onRequestGet({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool' && role !== 'warehouse' && role !== 'controller' && role !== 'field_supervisor' && role !== 'viewer') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const itemType = String(url.searchParams.get('itemType') || '').trim();
    const zone = String(url.searchParams.get('zone') || '').trim();
    const siteId = String(url.searchParams.get('siteId') || '').trim();
    const generatorType = String(url.searchParams.get('generatorType') || '').trim();

    let where = '1=1';
    const bind = [];

    if (itemType && VALID_ITEM_TYPES.includes(itemType)) {
      where += ' AND item_type = ?';
      bind.push(itemType);
    }

    const requesterZone = String(userZone(data) || 'BZV/POOL').trim().toUpperCase();
    const canAllZones = role === 'warehouse' || isSuperAdmin(data) || role === 'manager_bzv_pool' || role === 'admin' || role === 'controller' || role === 'field_supervisor' || role === 'viewer';

    if (zone) {
      where += ' AND zone = ?';
      bind.push(zone);
    } else if (!canAllZones) {
      where += ' AND zone = ?';
      bind.push(requesterZone);
    }

    if (siteId) {
      where += ' AND site_id = ?';
      bind.push(siteId);
    }

    if (generatorType) {
      where += ' AND generator_type = ?';
      bind.push(generatorType);
    }

    const stmt = env.DB.prepare(`SELECT * FROM stock_movements WHERE ${where} ORDER BY created_at DESC LIMIT 500`).bind(...bind);
    const res = await stmt.all();
    const rows = Array.isArray(res?.results) ? res.results : [];
    const movements = rows.map(mapRow).filter(Boolean);

    const stock = {};
    for (const t of VALID_ITEM_TYPES) {
      stock[t] = 0;
    }
    for (const m of movements) {
      if (!stock[m.itemType]) stock[m.itemType] = 0;
      stock[m.itemType] += (m.movementType === 'entry' ? m.quantity : -m.quantity);
    }

    const stockByGen = {};
    for (const m of movements) {
      if (ITEMS_WITH_GENERATOR.includes(m.itemType) && m.generatorType) {
        const key = `${m.itemType}__${m.generatorType}`;
        if (!stockByGen[key]) stockByGen[key] = 0;
        stockByGen[key] += (m.movementType === 'entry' ? m.quantity : -m.quantity);
      }
    }

    return json({ movements, stock, stockByGen, generatorTypes: GENERATOR_TYPES, scopeZone: canAllZones ? null : requesterZone }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager' && role !== 'manager_bzv_pool' && role !== 'warehouse') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const body = await readJson(request);
    const itemType = String(body?.itemType || '').trim();
    const movementType = String(body?.movementType || '').trim();
    const quantity = Math.max(1, Math.floor(Number(body?.quantity) || 1));

    if (!VALID_ITEM_TYPES.includes(itemType)) {
      return json({ error: 'Type de consommable invalide.' }, { status: 400 });
    }
    if (!VALID_MOVEMENT_TYPES.includes(movementType)) {
      return json({ error: 'Type de mouvement invalide.' }, { status: 400 });
    }

    const requesterZone = String(userZone(data) || 'BZV/POOL').trim().toUpperCase();
    const canAllZones = role === 'warehouse' || isSuperAdmin(data) || role === 'manager_bzv_pool';
    const zone = canAllZones
      ? String(body?.zone || requesterZone).trim().toUpperCase()
      : requesterZone;

    const siteId = body?.siteId ? String(body.siteId).trim() : null;
    const siteName = body?.siteName ? String(body.siteName).trim() : null;
    const ficheId = body?.ficheId ? String(body.ficheId).trim() : null;
    const technicianName = body?.technicianName ? String(body.technicianName).trim() : null;
    const notes = body?.notes ? String(body.notes).trim() : null;
    const generatorType = body?.generatorType ? String(body.generatorType).trim() : null;

    if (generatorType && !GENERATOR_TYPES.includes(generatorType)) {
      return json({ error: 'Type de générateur invalide.' }, { status: 400 });
    }

    if (movementType === 'exit' && !siteId) {
      return json({ error: 'Site requis pour une sortie.' }, { status: 400 });
    }

    if (movementType === 'exit') {
      const stockWhere = ITEMS_WITH_GENERATOR.includes(itemType) && generatorType
        ? 'item_type = ? AND zone = ? AND generator_type = ?'
        : 'item_type = ? AND zone = ?';
      const stockBind = ITEMS_WITH_GENERATOR.includes(itemType) && generatorType
        ? [itemType, zone, generatorType]
        : [itemType, zone];
      const stockRow = await env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN movement_type = 'entry' THEN quantity ELSE -quantity END), 0) AS current_stock
         FROM stock_movements WHERE ${stockWhere}`
      ).bind(...stockBind).first();
      const currentStock = Number(stockRow?.current_stock || 0);
      if (currentStock < quantity) {
        return json({ error: `Stock insuffisant. Disponible: ${currentStock}` }, { status: 400 });
      }
    }

    const id = newId();
    const now = isoNow();

    await env.DB.prepare(
      `INSERT INTO stock_movements (id, item_type, movement_type, quantity, zone, site_id, site_name, fiche_id, technician_name, generator_type, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, itemType, movementType, quantity, zone, siteId, siteName, ficheId, technicianName, generatorType, notes, data?.user?.email ? String(data.user.email) : null, now)
      .run();

    await touchLastUpdatedAt(env);

    const row = await env.DB.prepare('SELECT * FROM stock_movements WHERE id = ?').bind(id).first();
    return json({ movement: mapRow(row) }, { status: 201 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });

    const role = String(data?.user?.role || '').trim();
    if (role !== 'admin' && role !== 'manager_bzv_pool' && role !== 'warehouse') {
      return json({ error: 'Accès interdit.' }, { status: 403 });
    }

    const body = await readJson(request);
    const id = String(body?.id || '').trim();
    if (!id) return json({ error: 'id requis.' }, { status: 400 });

    const res = await env.DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(id).run();
    if ((res?.meta?.changes || 0) > 0) {
      await touchLastUpdatedAt(env);
    }

    return json({ ok: true, deleted: Number(res?.meta?.changes || 0) }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
