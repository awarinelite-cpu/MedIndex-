// MedIndex Service Worker
// Strategy: Cache-first for all app assets (everything is bundled locally —
// no API calls needed). All 280 drugs are embedded in the JS bundle via
// seedDrugs.json import, so the app works 100% offline after first load.

const CACHE_NAME    = 'medlookup-v1';
const OFFLINE_URL   = '/offline.html';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/browse',
  '/offline.html',
  '/manifest.json',
  '/icon-192x192.svg',
  '/icon-512x512.svg',
];

// ── Install: pre-cache shell assets ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, network fallback, offline fallback ─────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin or CDN assets
  if (event.request.method !== 'GET') return;

  // Skip Firebase/Firestore requests — they're no longer used but just in case
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Cache successful responses for same-origin requests
          if (response.ok && url.origin === self.location.origin) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Navigation requests → offline page
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

// ── Background sync: nothing to sync (all data is local) ───────────────────
// ── Push notifications: not implemented ────────────────────────────────────
