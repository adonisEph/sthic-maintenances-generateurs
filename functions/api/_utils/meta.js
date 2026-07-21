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
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const maxUsed = await getMaxUsedTicketCounterForZone(env, zone);
  return Math.max(safeCurrent, maxUsed);
}

export async function getMaxUsedTicketCounterForZone(env, zone) {
  const z = String(zone || '').trim().toUpperCase();
  const prefix = ticketPrefixFromZone(z);
  const row = await env.DB.prepare(
    `SELECT ticket_number
     FROM fiche_history
     WHERE ticket_number LIKE ?
     ORDER BY ticket_number DESC`
  )
    .bind(`${prefix}%`)
    .first();

  const raw = String(row?.ticket_number || '').trim().toUpperCase();
  if (!raw.startsWith(prefix)) return 0;
  const n = Number(raw.slice(prefix.length));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function pnrDayMetaKey(ymd) {
  return `ticket_number_pnr_day_${String(ymd || '').slice(0, 10)}`;
}

export function formatPnrDayTicket(ymd, n) {
  const src = String(ymd || '').slice(0, 10);
  const [yy, mm, dd] = src.split('-');
  return `${dd}/${mm}/${yy}-${n}`;
}

export async function getMaxUsedPnrDayTicketCounter(env, ymd) {
  const src = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src)) return 0;
  const ticketPrefix = formatPnrDayTicket(src, '').replace(/-$/, '');
  const row = await env.DB.prepare(
    `SELECT MAX(CAST(SUBSTR(ticket_number, 12) AS INTEGER)) AS max_n
     FROM fiche_history
     WHERE ticket_number LIKE ?`
  )
    .bind(`${ticketPrefix}-%`)
    .first();

  const n = Number(row?.max_n || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function nextPnrDayTicketNumber(env, ymd) {
  const src = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src)) {
    throw new Error('Date ticket PNR invalide.');
  }

  const key = pnrDayMetaKey(src);
  await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
    .bind(key, '0')
    .run();

  let next = 0;
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;

    const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
    const currentRaw = Number(row?.meta_value || 0);
    const current = Number.isFinite(currentRaw) && currentRaw >= 0 ? Math.floor(currentRaw) : 0;
    const maxUsed = await getMaxUsedPnrDayTicketCounter(env, src);
    const base = Math.max(current, maxUsed);
    next = base + 1;

    const upd = await env.DB.prepare(
      'UPDATE meta SET meta_value = ? WHERE meta_key = ? AND meta_value = ?'
    )
      .bind(String(next), key, String(current))
      .run();

    if (Number(upd?.meta?.changes || 0) > 0) {
      await touchLastUpdatedAt(env);
      return next;
    }
  }

  throw new Error('Impossible d\'allouer un ticket PNR unique. Réessayez.');
}

export async function nextTicketNumberForZone(env, zone) {
  const key = ticketMetaKeyFromZone(zone);
  await env.DB.prepare('INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES (?, ?)')
    .bind(key, '0')
    .run();

  let next = 0;
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;

    const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind(key).first();
    const currentRaw = Number(row?.meta_value || 0);
    const current = Number.isFinite(currentRaw) && currentRaw >= 0 ? Math.floor(currentRaw) : 0;
    const maxUsed = await getMaxUsedTicketCounterForZone(env, zone);
    const base = Math.max(current, maxUsed);
    next = base + 1;

    const upd = await env.DB.prepare(
      'UPDATE meta SET meta_value = ? WHERE meta_key = ? AND meta_value = ?'
    )
      .bind(String(next), key, String(current))
      .run();

    if (Number(upd?.meta?.changes || 0) > 0) {
      await touchLastUpdatedAt(env);
      return next;
    }
  }

  throw new Error('Impossible d\'allouer un ticket unique. Réessayez.');
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
