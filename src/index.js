import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// ── PWA Service Worker ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' }).then(reg => {
      console.log('[MedLookup SW] Registered:', reg.scope);

      // ── When the SW sends SW_UPDATED (it claimed all clients after activate),
      //    reload immediately so the user gets the latest build. ─────────────
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'SW_UPDATED') {
          console.log('[MedLookup SW] New version active — reloading.');
          window.location.reload();
        }
      });

      // ── If a new SW is found while the app is open, show the update banner
      //    dispatched as a custom DOM event that Layout.js listens for. ──────
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW installed and waiting — let the user choose to reload
            window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
              detail: { worker: newWorker }
            }));
          }
        });
      });

    }).catch(err => console.warn('[MedLookup SW] Registration failed:', err));
  });
}
