import React, { useRef, useState, useEffect } from 'react';
import { Eraser, PenLine } from 'lucide-react';

// Zone de signature « papier » : Pointer Events (souris / tactile / stylet /
// pavé tactile), getCoalescedEvents pour les points sous-frame, largeur de
// trait variable selon pression + vitesse, lissage par courbes quadratiques.
const SignaturePad = ({ onChange, height = 120 }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const lastWidth = useRef(2.2);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const setup = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (!w || !h) return;
      c.width = w * ratio;
      c.height = h * ratio;
      const ctx = c.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e293b';
      ctx.fillStyle = '#1e293b';
    };
    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now(), p: e.pressure };
  };

  // Largeur « plume » : pression du stylet quand dispo, sinon la vitesse —
  // un geste rapide affine le trait, un geste lent l'épaissit.
  const strokeWidth = (pt, prev) => {
    const MIN_W = 0.8;
    const MAX_W = 3.4;
    let target;
    if (pt.p && pt.p > 0 && pt.p !== 0.5) {
      target = MIN_W + pt.p * (MAX_W - MIN_W);
    } else {
      const dt = Math.max(1, pt.t - prev.t);
      const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      const speed = dist / dt; // px/ms
      target = MAX_W - Math.min(1, speed / 3) * (MAX_W - MIN_W);
    }
    // Lissage de la largeur (évite les à-coups entre échantillons).
    return lastWidth.current * 0.65 + target * 0.35;
  };

  const drawSegment = (ctx, a, b) => {
    const w = strokeWidth(b, a);
    lastWidth.current = w;
    // Lissage : courbe quadratique vers le point médian — trait « encre » fluide.
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.stroke();
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    drawing.current = true;
    const pt = pos(e);
    lastPoint.current = pt;
    lastWidth.current = 2.2;
    const ctx = canvasRef.current.getContext('2d');
    // Point unique (tap) → pastille.
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.1, 0, Math.PI * 2);
    ctx.fill();
    if (!signed) setSigned(true);
  };

  const onPointerMove = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    // Points coalescés : le navigateur regroupe les échantillons entre frames —
    // indispensable pour suivre un geste rapide au millimètre près.
    const events = typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length
      ? e.getCoalescedEvents()
      : [e];
    for (const ev of events) {
      const pt = pos(ev);
      drawSegment(ctx, lastPoint.current, pt);
      lastPoint.current = pt;
    }
  };

  const onPointerUp = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    onChange?.(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setSigned(false);
    onChange?.('');
  };

  return (
    <div>
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ height, width: '100%', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {!signed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300 gap-2">
            <PenLine size={18} /> <span className="text-sm">Signer ici</span>
          </div>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-1 text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
        <Eraser size={12} /> Effacer
      </button>
    </div>
  );
};

export default SignaturePad;
