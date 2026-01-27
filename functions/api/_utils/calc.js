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
  const base = Number(nh2A);
  const r = Number(regime);
  if (!Number.isFinite(base)) return 0;
  if (!Number.isFinite(r) || r === 0) return base;

  const ymdInTimeZone = (d, timeZone) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };

  const ymdToUtcMs = (ymd) => {
    const src = String(ymd || '').slice(0, 10);
    const m = src.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  const todayYmd = ymdInTimeZone(new Date(), 'Africa/Brazzaville');
  const todayMs = ymdToUtcMs(todayYmd);
  const lastUpdateMs = ymdToUtcMs(dateA);
  if (!Number.isFinite(todayMs) || !Number.isFinite(lastUpdateMs)) return base;

  const daysSinceUpdate = Math.floor((todayMs - lastUpdateMs) / (1000 * 60 * 60 * 24));
  if (!Number.isFinite(daysSinceUpdate) || daysSinceUpdate <= 0) return base;
  return base + (r * daysSinceUpdate);
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

  let todayYmd;
  try {
    todayYmd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Brazzaville',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    todayYmd = new Date().toISOString().slice(0, 10);
  }

  const diffEstimated = Number(nhEstimated) - Number(nh1DV);
  const remainingHours = s - diffEstimated;
  const daysToEPV1 = remainingHours / r;
  const epv1 = addDays(todayYmd, daysToEPV1);

  const daysToEPV2 = s / r;
  const epv2 = addDays(epv1, daysToEPV2);
  const epv3 = addDays(epv2, daysToEPV2);

  return { epv1, epv2, epv3 };
}
