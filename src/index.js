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
// Only registers in production (localhost is excluded automatically).
// CRA serves the SW from /service-worker.js via the public/ folder.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(reg => {
        console.log('[MedIndex SW] Registered, scope:', reg.scope);

        // Check for updates every time the app loads
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available — show a toast or just auto-reload
              console.log('[MedIndex SW] Update available — reloading.');
              // Optional: dispatch a custom event for an "Update available" banner
              window.dispatchEvent(new CustomEvent('swUpdateAvailable'));
            }
          });
        });
      })
      .catch(err => console.warn('[MedIndex SW] Registration failed:', err));
  });
}
