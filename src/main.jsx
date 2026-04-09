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
    try {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          try {
            reg.update().catch(() => {});

            const maybeSkipWaiting = () => {
              try {
                const sw = reg.waiting;
                if (sw) sw.postMessage({ type: 'SKIP_WAITING' });
              } catch {
              }
            };

            maybeSkipWaiting();

            reg.addEventListener('updatefound', () => {
              try {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed') {
                    maybeSkipWaiting();
                  }
                });
              } catch {
              }
            });

            // Appliquer la nouvelle version dès qu'elle prend le contrôle
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              try {
                window.location.reload();
              } catch {
              }
            });
          } catch {
          }
        })
        .catch(() => {});
    } catch {
    }
  });
}
