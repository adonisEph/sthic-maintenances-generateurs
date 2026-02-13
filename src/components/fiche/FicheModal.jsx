import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

const FicheModal = ({
  open,
  siteForFiche,
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

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [canvasReady, setCanvasReady] = useState(false);

  const signatureOk = useMemo(() => {
    const nameOk = Boolean(String(signatureTypedName || '').trim());
    const pngOk = Boolean(String(signatureDrawnPng || '').trim().startsWith('data:image/png;base64,'));
    return nameOk && pngOk;
  }, [signatureTypedName, signatureDrawnPng]);

  const ticketPrefix = (() => {
    const z = String(siteForFiche?.zone || '').trim().toUpperCase();
    if (z === 'UPCN') return 'N';
    if (z === 'PNR/KOUILOU') return 'P';
    return 'T';
  })();

  const getCanvasPoint = (ev) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX ?? 0) - rect.left;
    const y = (ev.clientY ?? 0) - rect.top;
    return { x, y };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDrawnPng('');
  };

  const commitCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const png = canvas.toDataURL('image/png');
      setSignatureDrawnPng(png);
    } catch {
      setSignatureDrawnPng('');
    }
  };

  const startDraw = (ev) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = getCanvasPoint(ev);
    if (!pt) return;
    drawingRef.current = true;
    lastPointRef.current = pt;
    ev.preventDefault?.();
  };

  const moveDraw = (ev) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(ev);
    if (!pt) return;

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
    ev.preventDefault?.();
  };

  const endDraw = (ev) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    commitCanvas();
    ev.preventDefault?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 0;
    const h = canvas.clientHeight || 0;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    setCanvasReady(true);
  }, [open, siteForFiche?.id]);

  useEffect(() => {
    if (!canvasReady) return;
    if (!signatureDrawnPng) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = signatureDrawnPng;
  }, [canvasReady, signatureDrawnPng]);

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
                VIDANGE DU GE {siteForFiche.generateur} {siteForFiche.capacite} + Filtre à air GE + 05 Litres liquide de
                refroidissement
              </p>
            </div>

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
                        {siteForFiche.kitVidange.split('/').map((item, idx) => (
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
                <div className="flex items-center justify-end" style={{ height: '45px' }}>
                  {signatureDrawnPng ? (
                    <img alt="Signature" src={signatureDrawnPng} style={{ height: '40px', maxWidth: '100%' }} />
                  ) : (
                    <div style={{ height: '40px', width: '100%' }} />
                  )}
                </div>
                <p className="text-[11px] text-right mt-1">{String(signatureTypedName || '').trim()}</p>
                <p className="text-xs text-right mt-3">DATE</p>
                <p className="text-right font-bold">{formatDate(new Date().toISOString())}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du responsable (obligatoire)</label>
                <input
                  value={String(signatureTypedName || '')}
                  onChange={(e) => setSignatureTypedName(String(e.target.value || ''))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Nom et prénom"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Signature (obligatoire)</label>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-300 font-semibold"
                  >
                    Effacer
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: '120px', touchAction: 'none' }}
                    onPointerDown={startDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerCancel={endDraw}
                    onPointerLeave={endDraw}
                  />
                </div>
                {!signatureOk && (
                  <div className="text-xs text-red-700 mt-2">
                    Signature obligatoire (nom + dessin) avant impression / PDF.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FicheModal;
