import * as XLSX from 'xlsx';
import {
  calculateRegime,
  calculateDiffNHs,
  calculateEstimatedNH,
  calculateEPVDates,
  formatDate,
  getDaysUntil
} from '../../utils/calculations';
import { getUpdatedSite } from './selectors';

const ymdToday = () => new Date().toISOString().split('T')[0];

const parseExcelDateToYmd = (value) => {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) return ymdToday();
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  if (value) return String(value);
  return ymdToday();
};

const parseRetiredFlag = (row) => {
  const retireValue = row?.['Retiré'] || row?.['Retire'] || row?.retired;
  return retireValue === 'VRAI' || retireValue === true || retireValue === 'TRUE' || retireValue === 1;
};

export const buildImportedSitesFromRows = (jsonRows, onProgress) => {
  const rows = Array.isArray(jsonRows) ? jsonRows : [];
  const total = rows.length;

  const importedSites = [];
  for (let index = 0; index < total; index += 1) {
    const row = rows[index] || {};
    if (!row['Name Site'] && !row['NameSite']) {
      continue;
    }

    const nh1 = parseInt(row['NH1 DV'] || row['NH1DV'] || 0);
    const nh2 = parseInt(row['NH2 A'] || row['NH2A'] || 0);

    const dateDV = row['Date DV'] || row['DateDV'];
    const dateA = row['Date A'] || row['DateA'];

    const dateDVStr = parseExcelDateToYmd(dateDV);
    const dateAStr = parseExcelDateToYmd(dateA);

    const regime = calculateRegime(nh1, nh2, dateDVStr, dateAStr);
    const nhEstimated = calculateEstimatedNH(nh2, dateAStr, regime);
    const diffNHs = calculateDiffNHs(nh1, nh2);
    const diffEstimated = calculateDiffNHs(nh1, nhEstimated);
    const epvDates = calculateEPVDates(regime, dateAStr, nh1, nhEstimated);

    importedSites.push({
      id: Date.now() + index,
      nameSite: row['Name Site'] || row['NameSite'] || `Site ${index + 1}`,
      idSite: row['ID Site'] || row['IDSite'] || row['Id Site'] || `ID${index + 1}`,
      technician:
        row['Techniciens'] ||
        row['Technicians'] ||
        row['Technicien'] ||
        row['Technician'] ||
        'Non assigné',
      generateur: row['Generateur'] || row['Générateur'] || row['GENERATEUR'] || 'Non spécifié',
      capacite: row['Capacité'] || row['Capacite'] || row['CAPACITE'] || 'Non spécifié',
      kitVidange: row['Kit Vidange'] || row['KitVidange'] || row['KIT VIDANGE'] || 'Non spécifié',
      regime,
      nh1DV: nh1,
      dateDV: dateDVStr,
      nh2A: nh2,
      dateA: dateAStr,
      nhEstimated,
      diffNHs,
      diffEstimated,
      seuil: 250,
      retired: parseRetiredFlag(row),
      ...epvDates
    });

    if (typeof onProgress === 'function' && index % 50 === 0) {
      onProgress(index, total);
    }
  }

  return importedSites;
};

export const buildSitesExportRows = (sites) => {
  const list = Array.isArray(sites) ? sites : [];
  return list.map((site) => {
    const updatedSite = getUpdatedSite(site);
    return {
      Techniciens: updatedSite.technician,
      'ID Site': updatedSite.idSite,
      'Name Site': updatedSite.nameSite,
      Generateur: updatedSite.generateur,
      'Capacité': updatedSite.capacite,
      'Kit Vidange': updatedSite.kitVidange,
      'Régime': updatedSite.regime,
      'NH1 DV': updatedSite.nh1DV,
      'Date DV': formatDate(updatedSite.dateDV),
      'NH2 A': updatedSite.nh2A,
      'Date A': formatDate(updatedSite.dateA),
      'Date updatée': formatDate(updatedSite.dateA),
      'NH updaté': updatedSite.nhEstimated,
      'Diff NHs': updatedSite.diffNHs,
      'Diff updatée': updatedSite.diffEstimated,
      Seuil: updatedSite.seuil,
      'Date EPV 1': formatDate(updatedSite.epv1),
      'Jours EPV 1': getDaysUntil(updatedSite.epv1),
      'Date EPV 2': formatDate(updatedSite.epv2),
      'Jours EPV 2': getDaysUntil(updatedSite.epv2),
      'Date EPV 3': formatDate(updatedSite.epv3),
      'Jours EPV 3': getDaysUntil(updatedSite.epv3),
      'Retiré': updatedSite.retired ? 'VRAI' : 'FAUX'
    };
  });
};
