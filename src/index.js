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

// ── PWA Service Worker Registration ─────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(reg => {
        console.log('[MedIndex SW] Registered, scope:', reg.scope);

        // When a new SW is found, activate it immediately
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[MedIndex SW] New version installed — reloading now.');
              // Force reload all tabs to serve the latest version immediately
              window.location.reload();
            }
          });
        });
      })
      .catch(err => console.warn('[MedIndex SW] Registration failed:', err));

    // Listen for SW_UPDATED message sent from the new service worker on activate
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[MedIndex SW] Received SW_UPDATED — reloading.');
        window.location.reload();
      }
    });

    // If the SW controller changes (new SW took over), reload immediately
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[MedIndex SW] Controller changed — reloading.');
        window.location.reload();
      }
    });
  });
}
