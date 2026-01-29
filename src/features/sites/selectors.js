import {
  calculateEstimatedNH,
  calculateDiffNHs,
  calculateEPVDates,
  getDaysUntil
} from '../../utils/calculations';

export const getUpdatedSite = (site) => {
  const nhEstimated = calculateEstimatedNH(site.nh2A, site.dateA, site.regime);
  const diffEstimated = calculateDiffNHs(site.nh1DV, nhEstimated);
  const epvDates = calculateEPVDates(site.regime, site.dateA, site.nh1DV, nhEstimated);

  return {
    ...site,
    nhEstimated,
    diffEstimated,
    epv1: epvDates.epv1,
    epv2: epvDates.epv2,
    epv3: epvDates.epv3,
    daysUntilEPV1: getDaysUntil(epvDates.epv1)
  };
};
