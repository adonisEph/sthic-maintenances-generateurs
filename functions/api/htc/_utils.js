import { userZone } from '../_utils/http.js';

export const HTC_ZONE = 'BZV/POOL';

const NUM_PREFIX = { exit: 'BS', entry: 'BE', return: 'BR', recovery: 'RC', request: 'DM', reinstatement: 'RI', client_return: 'RM', dotation: 'DT', component: 'PC' };

export const HTC_CONDITIONS = ['fonctionnel', 'defectueux', 'a_reparer', 'hs'];

export function isHtcManager(data) {
  const r = String(data?.user?.role || '');
  return r === 'warehouse' || r === 'admin';
}

export function canHtcRequest(data) {
  const r = String(data?.user?.role || '');
  return ['warehouse', 'admin', 'field_supervisor', 'technician', 'manager', 'manager_bzv_pool'].includes(r);
}

// Tout le module HTC est borné BZV/POOL : les non-admin d'une autre zone sont exclus.
export function htcZoneOk(data) {
  const r = String(data?.user?.role || '');
  if (r === 'admin') return true;
  return userZone(data) === HTC_ZONE;
}

export function htcYear(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: 'Africa/Brazzaville', year: 'numeric' }).format(d);
  } catch {
    return String(d.getUTCFullYear());
  }
}

// Allocateur numéro unique par type+année (meta CAS, même approche que ticket-number).
export async function allocHtcNumber(env, kind) {
  const prefix = NUM_PREFIX[kind];
  if (!prefix) throw new Error(`Type de bon inconnu: ${kind}`);
  const year = htcYear();
  const key = `htc_num_${kind}_${year}`;
  await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)').bind(key, '0').run();

  for (let i = 0; i < 8; i += 1) {
    const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
    const current = Number(row?.meta_value || 0);
    if (!Number.isFinite(current) || current < 0) throw new Error('Compteur bons HTC invalide.');
    const next = Math.floor(current) + 1;
    const upd = await env.DB.prepare('UPDATE meta SET meta_value = ? WHERE meta_key = ? AND meta_value = ?')
      .bind(String(next), key, String(current))
      .run();
    if (Number(upd?.meta?.changes || 0) > 0) {
      return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
    }
  }
  throw new Error('Impossible d\'allouer un numéro de bon (conflit). Réessaie.');
}

// Stock calculé par article (bons non annulés) :
//   stock     = Σ entrées + Σ retours BS + Σ réintégrations + Σ récupérations « fonctionnel » − Σ sorties
//   stockSite = Σ récupérations non-fonctionnelles − Σ réintégrations − Σ remises client HTC
// siteCond  = même découpe par condition d'origine (defectueux / a_reparer / hs).
// Renvoie { [itemId]: { stock, stockSite, siteCond } } pour le lieu donné (lieu stocké par ligne).
export async function htcStockMap(env, location = null) {
  const locClause = location ? 'AND l.location = ?' : '';
  const stmt = `
    SELECT l.item_id AS item_id,
           SUM(CASE WHEN m.type IN ('entry', 'return', 'reinstatement') THEN l.qty
                    WHEN m.type = 'recovery' AND l.item_condition = 'fonctionnel' THEN l.qty
                    WHEN m.type IN ('exit', 'dotation') THEN -l.qty ELSE 0 END) AS stock,
           SUM(CASE WHEN m.type = 'recovery' AND l.item_condition != 'fonctionnel' THEN l.qty
                    WHEN m.type IN ('reinstatement', 'client_return') THEN -l.qty ELSE 0 END) AS stock_site,
           SUM(CASE WHEN m.type = 'recovery' AND l.item_condition = 'defectueux' THEN l.qty
                    WHEN m.type IN ('reinstatement', 'client_return') AND l.item_condition = 'defectueux' THEN -l.qty ELSE 0 END) AS site_defectueux,
           SUM(CASE WHEN m.type = 'recovery' AND l.item_condition = 'a_reparer' THEN l.qty
                    WHEN m.type IN ('reinstatement', 'client_return') AND l.item_condition = 'a_reparer' THEN -l.qty ELSE 0 END) AS site_a_reparer,
           SUM(CASE WHEN m.type = 'recovery' AND l.item_condition = 'hs' THEN l.qty
                    WHEN m.type IN ('reinstatement', 'client_return') AND l.item_condition = 'hs' THEN -l.qty ELSE 0 END) AS site_hs
    FROM htc_movement_lines l
    JOIN htc_movements m ON m.id = l.movement_id
    WHERE m.status != 'cancelled' ${locClause}
    GROUP BY l.item_id`;
  const res = location
    ? await env.DB.prepare(stmt).bind(location).all()
    : await env.DB.prepare(stmt).all();
  const map = {};
  for (const r of res?.results || []) {
    map[r.item_id] = {
      stock: Number(r.stock || 0),
      stockSite: Number(r.stock_site || 0),
      siteCond: {
        defectueux: Number(r.site_defectueux || 0),
        a_reparer: Number(r.site_a_reparer || 0),
        hs: Number(r.site_hs || 0)
      }
    };
  }
  return map;
}

export function mapItem(r, stockMap) {
  const cell = stockMap ? stockMap[r.id] : null;
  return {
    id: r.id,
    name: r.name,
    category: r.category || 'other',
    location: r.location || 'entrepot',
    unit: r.unit || 'pièce',
    notes: r.notes || '',
    active: Number(r.active) === 1,
    stock: cell ? Number(cell.stock || 0) : (stockMap ? 0 : null),
    stockSite: cell ? Number(cell.stockSite || 0) : 0,
    siteCond: cell?.siteCond || { defectueux: 0, a_reparer: 0, hs: 0 },
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function mapRequest(r, lines, compLines) {
  let siteIds = [];
  try { siteIds = JSON.parse(r.site_ids || '[]') || []; } catch { siteIds = []; }
  return {
    id: r.id,
    requestNumber: r.request_number,
    status: r.status || 'pending',
    requestKind: r.request_kind || 'site',
    beneficiaryName: r.beneficiary_name || '',
    beneficiaryUserId: r.beneficiary_user_id || '',
    beneficiaryRole: r.beneficiary_role || '',
    signatureName: r.signature_name || '',
    signatureImage: r.signature_image || '',
    siteIds,
    requesterName: r.requester_name || '',
    requesterRole: r.requester_role || '',
    requestedByUserId: r.requested_by_user_id || '',
    siteId: r.site_id || '',
    siteName: r.site_name || '',
    reason: r.reason || '',
    notes: r.notes || '',
    swoNumber: r.swo_number || '',
    rejectReason: r.reject_reason || '',
    exitMovementId: r.exit_movement_id || '',
    processedBy: r.processed_by || '',
    processedAt: r.processed_at || '',
    createdBy: r.created_by || '',
    createdAt: r.created_at,
    lines: (lines || []).map((l) => ({
      id: l.id,
      itemId: l.item_id,
      itemName: l.item_name || '',
      location: l.location || '',
      qty: Number(l.qty || 0)
    })),
    componentLines: (compLines || []).map((l) => ({
      id: l.id,
      component: l.component || '',
      qty: Number(l.qty || 0),
      sourceItemId: l.source_item_id || '',
      sourceItemName: l.source_item_name || '',
      sourceRef: l.source_ref || ''
    }))
  };
}

export function mapMovement(r, lines, compLines) {
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    location: r.location || '',
    movementDate: r.movement_date || '',
    siteId: r.site_id || '',
    siteName: r.site_name || '',
    reason: r.reason || '',
    requesterName: r.requester_name || '',
    requesterRole: r.requester_role || '',
    senderType: r.sender_type || '',
    smrNumber: r.smr_number || '',
    swoNumber: r.swo_number || '',
    beneficiary: r.beneficiary || '',
    beneficiaryRole: r.beneficiary_role || '',
    agentName: r.agent_name || '',
    provenance: r.provenance || '',
    requestId: r.request_id || '',
    returnOfMovementId: r.return_of_movement_id || '',
    returnOfNumber: r.return_of_number || '',
    signatureName: r.signature_name || '',
    signatureImage: r.signature_image || '',
    status: r.status || 'issued',
    createdBy: r.created_by || '',
    createdAt: r.created_at,
    lines: (lines || []).map((l) => ({
      id: l.id,
      itemId: l.item_id,
      itemName: l.item_name || '',
      location: l.location || '',
      qty: Number(l.qty || 0),
      qtyReturned: Number(l.qty_returned || 0),
      condition: l.item_condition || 'fonctionnel'
    })),
    componentLines: (compLines || []).map((l) => ({
      id: l.id,
      component: l.component || '',
      qty: Number(l.qty || 0),
      qtyReturned: Number(l.qty_returned || 0),
      sourceItemId: l.source_item_id || '',
      sourceItemName: l.source_item_name || '',
      sourceRef: l.source_ref || ''
    }))
  };
}
