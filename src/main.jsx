import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

 const disablePinchZoomOnIOS = () => {
   try {
     const ua = String(navigator?.userAgent || '');
     const isIOS =
       /iP(ad|hone|od)/.test(ua) ||
       (ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document);

     if (!isIOS) return;
     if (window.__pinchZoomDisabled__) return;
     window.__pinchZoomDisabled__ = true;

     const prevent = (e) => {
       if (e?.cancelable) e.preventDefault();
     };

     document.addEventListener('gesturestart', prevent, { passive: false });
     document.addEventListener('gesturechange', prevent, { passive: false });
     document.addEventListener('gestureend', prevent, { passive: false });

     document.addEventListener(
       'touchmove',
       (e) => {
         if (typeof e?.scale === 'number' && e.scale !== 1) prevent(e);
       },
       { passive: false }
     );

     if (document?.documentElement?.style) {
       document.documentElement.style.touchAction = 'pan-x pan-y';
     }
     if (document?.body?.style) {
       document.body.style.touchAction = 'pan-x pan-y';
     }
   } catch {
     // ignore
   }
 };

 disablePinchZoomOnIOS();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const notifyUpdateReady = () => {
          try {
            window.dispatchEvent(new CustomEvent('pwa:update', { detail: { registration } }));
          } catch {
          }
        };

        if (registration.waiting) {
          notifyUpdateReady();
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdateReady();
            }
          });
        });
      })
      .catch(() => {});
  });
}
