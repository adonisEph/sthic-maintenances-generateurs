import { useCallback, useMemo, useState } from 'react';
import {
  calculateRegime,
  calculateDiffNHs,
  calculateEstimatedNH,
  calculateEPVDates
} from '../../utils/calculations';
import { apiFetchJson } from '../../services/apiClient';
import { fetchSites, deleteSiteById } from '../../services/sitesApi';

const EMPTY_FORM = {
  nameSite: '',
  idSite: '',
  technician: '',
  generateur: '',
  capacite: '',
  kitVidange: '',
  nh1DV: '',
  dateDV: '',
  nh2A: '',
  dateA: '',
  retired: false
};

export const useSites = ({ sites, setSites }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const nextSites = await fetchSites();
      setSites(nextSites);
    } catch {
      setSites([]);
    }
  }, [setSites]);

  const handleAddSite = useCallback(async () => {
    if (
      !formData.nameSite ||
      !formData.idSite ||
      !formData.technician ||
      !formData.generateur ||
      !formData.capacite ||
      !formData.kitVidange ||
      !formData.nh1DV ||
      !formData.dateDV ||
      !formData.nh2A ||
      !formData.dateA
    ) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const nh1 = parseInt(formData.nh1DV);
    const nh2 = parseInt(formData.nh2A);
    const regime = calculateRegime(nh1, nh2, formData.dateDV, formData.dateA);
    const nhEstimated = calculateEstimatedNH(nh2, formData.dateA, regime);
    const diffNHs = calculateDiffNHs(nh1, nh2);
    const diffEstimated = calculateDiffNHs(nh1, nhEstimated);
    const epvDates = calculateEPVDates(regime, formData.dateA, nh1, nhEstimated);

    const newSite = {
      nameSite: formData.nameSite,
      idSite: formData.idSite,
      technician: formData.technician,
      generateur: formData.generateur,
      capacite: formData.capacite,
      kitVidange: formData.kitVidange,
      regime,
      nh1DV: nh1,
      dateDV: formData.dateDV,
      nh2A: nh2,
      dateA: formData.dateA,
      nhEstimated,
      diffNHs,
      diffEstimated,
      seuil: 250,
      retired: formData.retired,
      ...epvDates
    };

    try {
      const ok = window.confirm(
        `Confirmer l'ajout du site "${newSite.nameSite}" (ID: ${newSite.idSite}) ?`
      );
      if (!ok) return;
      await apiFetchJson('/api/sites', {
        method: 'POST',
        body: JSON.stringify(newSite)
      });
      await loadData();
      resetForm();
      setShowAddForm(false);
      alert('✅ Site ajouté avec succès.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  }, [formData, loadData, resetForm]);

  const handleUpdateSite = useCallback(async () => {
    if (!formData.nh2A || !formData.dateA) {
      alert('Veuillez remplir NH2 A et Date A');
      return;
    }

    try {
      const site = selectedSite;
      const ok = window.confirm(
        `Confirmer la mise à jour du site "${site?.nameSite || ''}" (ID: ${site?.idSite || ''}) ?`
      );
      if (!ok) return;
      const nh2 = parseInt(formData.nh2A);
      const regime = calculateRegime(site.nh1DV, nh2, site.dateDV, formData.dateA);
      const nhEstimated = calculateEstimatedNH(nh2, formData.dateA, regime);
      const diffNHs = calculateDiffNHs(site.nh1DV, nh2);
      const diffEstimated = calculateDiffNHs(site.nh1DV, nhEstimated);

      const data = await apiFetchJson(`/api/sites/${site.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nh2A: nh2,
          dateA: formData.dateA,
          regime,
          nhEstimated,
          diffNHs,
          diffEstimated,
          retired: formData.retired
        })
      });

      if (data?.site?.id) {
        setSites(
          (Array.isArray(sites) ? sites : []).map((s) =>
            String(s.id) === String(data.site.id) ? data.site : s
          )
        );
      }

      setShowUpdateForm(false);
      setSelectedSite(null);
      resetForm();
      alert('✅ Site mis à jour.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  }, [formData, resetForm, selectedSite, setSites, sites]);

  const handleEditSite = useCallback(async () => {
    if (
      !formData.nameSite ||
      !formData.idSite ||
      !formData.technician ||
      !formData.generateur ||
      !formData.capacite ||
      !formData.kitVidange ||
      !formData.nh1DV ||
      !formData.dateDV ||
      !formData.nh2A ||
      !formData.dateA
    ) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const site = selectedSite;
      const ok = window.confirm(
        `Confirmer la modification du site "${site?.nameSite || ''}" (ID: ${site?.idSite || ''}) ?`
      );
      if (!ok) return;
      const nh1 = parseInt(formData.nh1DV);
      const nh2 = parseInt(formData.nh2A);
      const regime = calculateRegime(nh1, nh2, formData.dateDV, formData.dateA);
      const nhEstimated = calculateEstimatedNH(nh2, formData.dateA, regime);
      const diffNHs = calculateDiffNHs(nh1, nh2);
      const diffEstimated = calculateDiffNHs(nh1, nhEstimated);

      const data = await apiFetchJson(`/api/sites/${site.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameSite: formData.nameSite,
          idSite: formData.idSite,
          technician: formData.technician,
          generateur: formData.generateur,
          capacite: formData.capacite,
          kitVidange: formData.kitVidange,
          nh1DV: nh1,
          dateDV: formData.dateDV,
          nh2A: nh2,
          dateA: formData.dateA,
          regime,
          nhEstimated,
          diffNHs,
          diffEstimated,
          retired: formData.retired
        })
      });

      if (data?.site?.id) {
        setSites(
          (Array.isArray(sites) ? sites : []).map((s) =>
            String(s.id) === String(data.site.id) ? data.site : s
          )
        );
      }

      setShowEditForm(false);
      setSelectedSite(null);
      resetForm();
      alert('✅ Site modifié.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  }, [formData, resetForm, selectedSite, setSites, sites]);

  const handleDeleteSite = useCallback(async () => {
    try {
      await deleteSiteById(siteToDelete.id);
      const updatedSites = (Array.isArray(sites) ? sites : []).filter(
        (site) => String(site.id) !== String(siteToDelete.id)
      );
      setSites(updatedSites);
      setShowDeleteConfirm(false);
      setSiteToDelete(null);
      alert('✅ Site supprimé.');
    } catch (e) {
      alert(e?.message || 'Erreur serveur.');
    }
  }, [setSites, siteToDelete, sites]);

  const actions = useMemo(
    () => ({
      resetForm,
      loadData,
      handleAddSite,
      handleUpdateSite,
      handleEditSite,
      handleDeleteSite
    }),
    [handleAddSite, handleDeleteSite, handleEditSite, handleUpdateSite, loadData, resetForm]
  );

  return {
    showAddForm,
    setShowAddForm,
    showUpdateForm,
    setShowUpdateForm,
    showEditForm,
    setShowEditForm,
    showDeleteConfirm,
    setShowDeleteConfirm,
    siteToDelete,
    setSiteToDelete,
    selectedSite,
    setSelectedSite,
    formData,
    setFormData,
    ...actions
  };
};
