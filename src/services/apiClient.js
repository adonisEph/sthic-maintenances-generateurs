export const apiFetchJson = async (path, init = {}) => {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    ...init
  });

  const rawText = await res.text().catch(() => '');
  const data = (() => {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      return {};
    }
  })();

  if (!res.ok) {
    const fallbackMsg = String((data && (data.error || data.message)) || rawText || res.statusText || 'Erreur serveur.').trim();
    const msg =
      res.status === 429
        ? 'Trop de requêtes (429). Merci de patienter quelques secondes puis de réessayer.'
        : fallbackMsg;
    throw new Error(msg);
  }

  return data;
};
