import {
  calculateEstimatedNH,
  calculateDiffNHs,
  calculateEPVDates,
  getDaysUntil
} from '../../utils/calculations';

export const getUpdatedSite = (site) => {
  const nhEstimated = calculateEstimatedNH(site.nh2A, site.dateA, site.regime);
  const diffEstimated = calculateDiffNHs(site.nh1DV, nhEstimated);
  const epvDates = calculateEPVDates(site.regime, site.dateA, site.nh1DV, nhEstimated, site?.seuil);

  const normYmd = (d) => {
    const s = String(d || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  };

  const epv1 = normYmd(site?.epv1) || normYmd(epvDates?.epv1);
  const epv2 = normYmd(site?.epv2) || normYmd(epvDates?.epv2);
  const epv3 = normYmd(site?.epv3) || normYmd(epvDates?.epv3);

  return {
    ...site,
    nhEstimated,
    diffEstimated,
    epv1,
    epv2,
    epv3,
    daysUntilEPV1: getDaysUntil(epv1)
  };
};
