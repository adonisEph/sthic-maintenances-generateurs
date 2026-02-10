export async function nextTicketNumber(env) {
  return nextTicketNumberForZone(env, '');
}

export function ticketMetaKeyFromZone(zone) {
  const z = String(zone || '').trim().toUpperCase();
  if (z === 'UPCN') return 'ticket_number_upcn';
  if (z === 'PNR/KOUILOU') return 'ticket_number_pnr';
  if (z === 'BZV/POOL') return 'ticket_number';
  return 'ticket_number';
}

export async function getTicketCounter(env, zone) {
  const key = ticketMetaKeyFromZone(zone);
  await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
    .bind(key, '0')
    .run();
  const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
  const current = Number(row?.meta_value || 0);
  return Number.isFinite(current) ? current : 0;
}

export async function nextTicketNumberForZone(env, zone) {
  const key = ticketMetaKeyFromZone(zone);
  await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
    .bind(key, '0')
    .run();

  const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
  const current = Number(row?.meta_value || 0);
  const next = current + 1;
  await env.DB.prepare('INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES (?, ?)')
    .bind(key, String(next))
    .run();
  await touchLastUpdatedAt(env);
  return next;
}

export async function getLastUpdatedAt(env) {
  const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind('last_updated_at').first();
  return row?.meta_value ? String(row.meta_value) : null;
}

export async function touchLastUpdatedAt(env, value = new Date().toISOString()) {
  await env.DB.prepare('INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES (?, ?)')
    .bind('last_updated_at', String(value))
    .run();
  return value;
}

export function ticketPrefixFromZone(zone) {
  const z = String(zone || '').trim().toUpperCase();
  if (z === 'UPCN') return 'N';
  if (z === 'PNR/KOUILOU') return 'P';
  if (z === 'BZV/POOL') return 'T';
  return 'T';
}

export function formatTicket(n, zone) {
  const prefix = ticketPrefixFromZone(zone);
  return `${prefix}${String(n).padStart(5, '0')}`;
}
