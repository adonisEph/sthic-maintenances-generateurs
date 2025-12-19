export function calculateRegime(nh1, nh2, date1, date2) {
  const diffNH = Number(nh2) - Number(nh1);
  const diffDays = Math.abs(Math.ceil((new Date(date2) - new Date(date1)) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 0;
  return Math.round(diffNH / diffDays);
}

export function calculateDiffNHs(nh1, nh2) {
  return Number(nh2) - Number(nh1);
}

export function calculateEstimatedNH(nh2A, dateA, regime) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastUpdate = new Date(dateA);
  lastUpdate.setHours(0, 0, 0, 0);
  const daysSinceUpdate = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
  if (daysSinceUpdate <= 0) return Number(nh2A);
  return Number(nh2A) + (Number(regime) * daysSinceUpdate);
}

function addDays(date, days) {
  if (!date || days === null || days === undefined || Number.isNaN(Number(days))) {
    return 'N/A';
  }
  const result = new Date(date);
  if (Number.isNaN(result.getTime())) return 'N/A';
  result.setDate(result.getDate() + Math.round(Number(days)));
  return result.toISOString().split('T')[0];
}

export function calculateEPVDates(regime, nh1DV, nhEstimated, seuil = 250) {
  const r = Number(regime);
  const s = Number(seuil);
  if (!r) {
    return { epv1: 'N/A', epv2: 'N/A', epv3: 'N/A' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffEstimated = Number(nhEstimated) - Number(nh1DV);
  const remainingHours = s - diffEstimated;
  const daysToEPV1 = remainingHours / r;
  const epv1 = addDays(today.toISOString().split('T')[0], daysToEPV1);

  const daysToEPV2 = s / r;
  const epv2 = addDays(epv1, daysToEPV2);
  const epv3 = addDays(epv2, daysToEPV2);

  return { epv1, epv2, epv3 };
}
