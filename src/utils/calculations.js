// Toutes les fonctions de calcul - LOGIQUE MÉTIER PRÉSERVÉE

export const calculateRegime = (nh1, nh2, date1, date2) => {
  const diffNH = nh2 - nh1;
  const diffDays = Math.abs(Math.ceil((new Date(date2) - new Date(date1)) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 0;
  return Math.round(diffNH / diffDays);
};

export const calculateDiffNHs = (nh1, nh2) => {
  return nh2 - nh1;
};

export const calculateEstimatedNH = (nh2A, dateA, regime) => {
  const base = Number(nh2A);
  const r = Number(regime);

  if (!Number.isFinite(base)) return 0;
  if (!Number.isFinite(r) || r === 0) return base;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastUpdate = new Date(dateA);
  if (Number.isNaN(lastUpdate.getTime())) return base;
  lastUpdate.setHours(0, 0, 0, 0);

  const daysSinceUpdate = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
  if (!Number.isFinite(daysSinceUpdate) || daysSinceUpdate <= 0) return base;

  return base + (r * daysSinceUpdate);
};

export const addDays = (date, days) => {
  if (!date || days === null || days === undefined || isNaN(days)) {
    return 'N/A';
  }
  try {
    const result = new Date(date);
    if (isNaN(result.getTime())) {
      return 'N/A';
    }
    result.setDate(result.getDate() + Math.round(days));
    return result.toISOString().split('T')[0];
  } catch (error) {
    console.error('Erreur addDays:', error, 'date:', date, 'days:', days);
    return 'N/A';
  }
};

export const calculateEPVDates = (regime, dateA, nh1DV, nhEstimated) => {
  const SEUIL = 250;
  
  if (regime === 0) {
    return { epv1: 'N/A', epv2: 'N/A', epv3: 'N/A' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffEstimated = nhEstimated - nh1DV;
  const remainingHours = SEUIL - diffEstimated;
  const daysToEPV1 = remainingHours / regime;
  const epv1 = addDays(today.toISOString().split('T')[0], daysToEPV1);

  const daysToEPV2 = SEUIL / regime;
  const epv2 = addDays(epv1, daysToEPV2);
  const epv3 = addDays(epv2, daysToEPV2);

  return { epv1, epv2, epv3 };
};

export const formatDate = (dateStr) => {
  if (!dateStr || dateStr === 'N/A') return dateStr;
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const getDaysUntil = (dateStr) => {
  if (!dateStr || dateStr === 'N/A') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getUrgencyClass = (daysUntil, retired) => {
  if (retired) return 'bg-gray-100 border-gray-400';
  if (daysUntil === null) return '';
  if (daysUntil < 0) return 'bg-red-100 border-red-400';
  if (daysUntil <= 3) return 'bg-red-50 border-red-300';
  if (daysUntil <= 7) return 'bg-orange-50 border-orange-300';
  return 'bg-green-50 border-green-300';
};
