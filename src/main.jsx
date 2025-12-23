import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

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
