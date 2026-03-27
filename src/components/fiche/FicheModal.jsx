import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

const FicheModal = ({
  open,
  siteForFiche,
  ficheHistory,
  ficheId,
  canWarehouse,
  warehouseAirFilterOk,
  warehouseCoolant5lOk,
  onSaveWarehouseCheck,
  bannerImage,
  ticketNumber,
  signatureTypedName,
  setSignatureTypedName,
  signatureDrawnPng,
  setSignatureDrawnPng,
  isBatchFiche,
  batchFicheIndex,
  batchFicheSites,
  goBatchFiche,
  handlePrintFiche,
  handleSaveFichePdf,
  onClose,
  formatDate
}) => {
  if (!open || !siteForFiche) return null;

  const shouldIncludeAirFilter = useMemo(() => {
    const list = Array.isArray(ficheHistory) ? ficheHistory : [];

    const siteId = String(siteForFiche?.id || '').trim();
    if (!siteId) return true;

    const dateDV = siteForFiche?.dateDV ? String(siteForFiche.dateDV).slice(0, 10) : '';
    if (!dateDV) return true;

    const already = list.some((f) => {
      if (!f) return false;
      if (String(f.siteId || '').trim() !== siteId) return false;
      const dg = f.dateGenerated ? String(f.dateGenerated).slice(0, 10) : '';
      if (!dg) return false;
      if (dg < dateDV) return false;
      const st = String(f.status || '').trim();
      if (st.toLowerCase().includes('annul')) return false;
      if (f.warehouseAirFilterOk !== true) return false;
      return true;
    });

    return !already;
  }, [ficheHistory, siteForFiche]);

  const shouldIncludeCoolant = useMemo(() => {
    const list = Array.isArray(ficheHistory) ? ficheHistory : [];

    const siteId = String(siteForFiche?.id || '').trim();
    if (!siteId) return true;

    const dateDV = siteForFiche?.dateDV ? String(siteForFiche.dateDV).slice(0, 10) : '';
    if (!dateDV) return true;

    const already = list.some((f) => {
      if (!f) return false;
      if (String(f.siteId || '').trim() !== siteId) return false;
      const dg = f.dateGenerated ? String(f.dateGenerated).slice(0, 10) : '';
      if (!dg) return false;
      if (dg < dateDV) return false;
      const st = String(f.status || '').trim();
      if (st.toLowerCase().includes('annul')) return false;
      if (f.warehouseCoolant5lOk !== true) return false;
      return true;
    });

    return !already;
  }, [ficheHistory, siteForFiche]);

  const shouldIncludeAirAndCoolant = shouldIncludeAirFilter || shouldIncludeCoolant;

  const kitItems = useMemo(() => {
    const raw = String(siteForFiche?.kitVidange || '');
    const items = raw
      .split('/')
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    if (shouldIncludeAirFilter && shouldIncludeCoolant) return items;

    const norm = (v) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    return items.filter((it) => {
      const n = norm(it);
      if (!shouldIncludeAirFilter && n.includes('filtre') && n.includes('air')) return false;
      if (!shouldIncludeCoolant && n.includes('liquide') && n.includes('refroid')) return false;
      return true;
    });
  }, [siteForFiche, shouldIncludeAirFilter, shouldIncludeCoolant]);

  const signatureOk = useMemo(() => {
    const v = String(signatureDrawnPng || '').trim();
    if (!v) return false;
    if (v.startsWith('data:image/')) return true;
    if (v.startsWith('blob:')) return true;
    if (v.startsWith('http://') || v.startsWith('https://')) return true;
    if (v.startsWith('/')) return true;
    return false;
  }, [signatureDrawnPng]);

  useEffect(() => {
    if (!open) return;
    if (String(signatureDrawnPng || '').trim().startsWith('data:image/png;base64,')) return;

    let cancelled = false;
    (async () => {
      try {
        const v = Date.now();

        const tryFetch = async (path) => {
          const res = await fetch(`${path}?v=${v}`, { cache: 'no-store' });
          if (!res.ok) return null;
          const contentType = String(res.headers.get('content-type') || '').toLowerCase();
          if (!contentType.startsWith('image/')) return null;
          return res.blob();
        };

        const zone = String(siteForFiche?.zone || '').trim().toUpperCase();
        const signaturePreferred =
          zone === 'PNR/KOUILOU'
            ? '/signature_responsable_pnr_kouilou.png'
            : zone === 'UPCN'
              ? '/signature_responsable_upcn.png'
              : null;

        const blob =
          (signaturePreferred ? await tryFetch(signaturePreferred) : null) ||
          (await tryFetch('/signature_responsable.png')) ||
          (await tryFetch('/signature_responsable.PNG')) ||
          (await tryFetch('/assets/signature_responsable.png')) ||
          (await tryFetch('/assets/signature_responsable.PNG')) ||
          null;

        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (cancelled) return;
          const dataUrl = String(reader.result || '');
          if (dataUrl.startsWith('data:image/')) {
            setSignatureDrawnPng(dataUrl);
            setSignatureTypedName('');
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, signatureDrawnPng, setSignatureDrawnPng, setSignatureTypedName]);

  const ticketPrefix = (() => {
    const z = String(siteForFiche?.zone || '').trim().toUpperCase();
    if (z === 'UPCN') return 'N';
    if (z === 'PNR/KOUILOU') return 'P';
    return 'T';
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gray-100">
          <h2 className="text-xl font-bold text-gray-800">📄 Fiche d'Intervention - Aperçu</h2>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
            {isBatchFiche && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => goBatchFiche(-1)}
                  disabled={batchFicheIndex <= 0}
                  className="bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700 font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                >
                  Précédent
                </button>
                <button
                  onClick={() => goBatchFiche(1)}
                  disabled={batchFicheIndex >= batchFicheSites.length - 1}
                  className="bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700 font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                >
                  Suivant
                </button>
              </div>
            )}
            <button
              onClick={handlePrintFiche}
              disabled={!signatureOk}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold w-full sm:w-auto disabled:bg-gray-400"
            >
              Imprimer
            </button>
            <button
              onClick={handleSaveFichePdf}
              disabled={!signatureOk}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold w-full sm:w-auto disabled:bg-gray-400"
            >
              Enregistrer le PDF
            </button>
            <button
              onClick={onClose}
              className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative border-b bg-white h-0">
          <div className="h-20" />
        </div>

        <div className="bg-white p-8 overflow-auto" style={{ maxHeight: '80vh' }}>
          <div
            id="fiche-print"
            className="bg-white mx-auto flex flex-col"
            style={{ maxWidth: '210mm', width: '100%', height: '277mm', boxSizing: 'border-box' }}
          >
            {bannerImage && (
              <div className="mb-3 border-2 border-gray-300 rounded overflow-hidden bg-gray-200">
                <img
                  src={bannerImage}
                  alt="Bannière Helios Towers - STHIC"
                  className="w-full"
                  style={{ height: 'auto', display: 'block' }}
                />
              </div>
            )}

            {!bannerImage && (
              <div className="mb-4 bg-yellow-50 border-2 border-yellow-300 rounded p-3 text-center">
                <p className="text-yellow-800 font-semibold">⚠️ Bannière non chargée</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-gray-600 text-xs mb-1">CLIENT</p>
                <p className="font-bold text-base">HTC</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">SITE</p>
                <p className="font-bold text-base">{siteForFiche.nameSite}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">RÉFÉRENCE TICKET</p>
                <p className="font-bold text-base">{ticketPrefix}{String(ticketNumber).padStart(5, '0')}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">NOM(S) DE L'INTERVENANT</p>
                <p className="font-bold text-base">{siteForFiche.technician}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600 text-xs mb-1">BPV N°</p>
                <p className="font-bold text-base">{formatDate(new Date().toISOString())}</p>
              </div>
            </div>

            <hr className="my-3 border-gray-800" style={{ borderWidth: '2px' }} />

            <div className="mb-6">
              <p className="text-gray-600 text-xs mb-2">OBJET</p>
              <p className="font-bold text-sm">
                VIDANGE DU GE {siteForFiche.generateur} {siteForFiche.capacite}
                {shouldIncludeAirAndCoolant
                  ? `${shouldIncludeAirFilter ? ' + Filtre à air GE' : ''}${shouldIncludeCoolant ? ' + 05 Litres liquide de refroidissement' : ''}`
                  : ''}
              </p>
            </div>

            {canWarehouse && (
              <div className="mb-4 border border-gray-300 rounded-lg p-3 text-sm">
                <div className="font-bold text-gray-800 mb-2">Contrôle magasin (warehouse)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(warehouseAirFilterOk)}
                      onChange={(e) => onSaveWarehouseCheck && onSaveWarehouseCheck({
                        ficheId,
                        warehouseAirFilterOk: Boolean(e.target.checked),
                        warehouseCoolant5lOk: Boolean(warehouseCoolant5lOk)
                      })}
                    />
                    Filtre à air GE disponible/sorti
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(warehouseCoolant5lOk)}
                      onChange={(e) => onSaveWarehouseCheck && onSaveWarehouseCheck({
                        ficheId,
                        warehouseAirFilterOk: Boolean(warehouseAirFilterOk),
                        warehouseCoolant5lOk: Boolean(e.target.checked)
                      })}
                    />
                    05 Litres liquide de refroidissement disponible/sorti
                  </label>
                </div>
              </div>
            )}

            <hr className="my-3 border-gray-800" style={{ borderWidth: '2px' }} />

            <div className="flex-1 flex flex-col">
              <table className="w-full border-2 border-gray-800 text-sm" style={{ height: '100%' }}>
                <thead>
                  <tr>
                    <th
                      className="border-2 border-gray-800 p-3 bg-gray-100 text-center"
                      style={{ width: '15%' }}
                    >
                      Qtés
                    </th>
                    <th
                      className="border-2 border-gray-800 p-3 bg-gray-100 text-center"
                      style={{ width: '20%' }}
                    >
                      PMW000xxxxxx
                    </th>
                    <th className="border-2 border-gray-800 p-3 bg-gray-100" style={{ width: '65%' }}>
                      Désignations
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-2 border-gray-800 p-4" style={{ verticalAlign: 'top' }}>
                      &nbsp;
                    </td>
                    <td className="border-2 border-gray-800 p-4" style={{ verticalAlign: 'top' }}>
                      &nbsp;
                    </td>
                    <td className="border-2 border-gray-800 p-6" style={{ verticalAlign: 'top' }}>
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        {kitItems.map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.trim()}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mt-auto pt-4">
              <div className="border-2 border-gray-800 p-4" style={{ minHeight: '90px' }}>
                <p className="font-bold mb-3 text-base">H</p>
                <p className="text-3xl font-bold text-center mt-2">{siteForFiche.nh1DV} H</p>
              </div>
              <div className="border-2 border-gray-800 p-4" style={{ minHeight: '90px' }}>
                <p className="font-bold mb-3 text-right text-base">SIGNATURE RESPONSABLE</p>
                <div className="flex items-center justify-end" style={{ height: '65px' }}>
                  {signatureDrawnPng ? (
                    <img
                      alt="Signature"
                      src={signatureDrawnPng}
                      style={{ height: '80px', width: '260px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ height: '60px', width: '100%' }} />
                  )}
                </div>
                <p className="text-xs text-right mt-3">DATE</p>
                <p className="text-right font-bold">{formatDate(new Date().toISOString())}</p>
              </div>
            </div>
          </div>
                  
          <div className="mt-6 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div />
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Signature (obligatoire)</label>
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                  {signatureDrawnPng ? (
                    <div className="text-xs text-indigo-700 mt-2 font-semibold">
                      Signature responsable chargée (PNG).
                    </div>
                  ) : (
                    <div className="text-xs text-red-700 mt-2">
                      Signature responsable (PNG) introuvable. Vérifier le fichier <code>/signature_responsable.png</code>.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FicheModal;
