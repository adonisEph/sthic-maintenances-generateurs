import { apiFetchJson } from './apiClient';

export const fetchSites = async () => {
  const data = await apiFetchJson('/api/sites', { method: 'GET' });
  return Array.isArray(data?.sites) ? data.sites : [];
};

export const dailyUpdateSites = async () => {
  return apiFetchJson('/api/sites/daily-update', {
    method: 'POST',
    body: JSON.stringify({})
  });
};

export const deleteSiteById = async (siteId) => {
  return apiFetchJson(`/api/sites/${siteId}`, { method: 'DELETE' });
};
