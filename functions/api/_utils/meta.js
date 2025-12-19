export async function nextTicketNumber(env) {
  const row = await env.DB.prepare('SELECT meta_value FROM meta WHERE meta_key = ?').bind('ticket_number').first();
  const current = Number(row?.meta_value || 0);
  const next = current + 1;
  await env.DB.prepare('INSERT OR REPLACE INTO meta (meta_key, meta_value) VALUES (?, ?)').bind('ticket_number', String(next)).run();
  return next;
}

export function formatTicket(n) {
  return `T${String(n).padStart(5, '0')}`;
}
