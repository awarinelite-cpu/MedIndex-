// MedIndex Service Worker
// Strategy: Network-first for HTML pages (always get latest),
// Cache-first for static assets (JS/CSS/icons — these have hashed filenames from CRA build)

const CACHE_VERSION = 'medindex-v5';
const IMAGE_CACHE    = 'medindex-images-v1'; // long-lived, NOT wiped on deploy — see activate below
const OFFLINE_URL   = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192x192.svg',
  '/icon-512x512.svg',
];

// ── Message handler: SKIP_WAITING sent by Layout's "Reload" button ─────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Install: pre-cache shell ────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately, don't wait for old tabs to close
  );
});

// ── Activate: wipe ALL old caches, claim all clients immediately ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== IMAGE_CACHE)
          .map(k => {
            console.log('[MedIndex SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim()) // take control of all open tabs immediately
      .then(() => {
        // Notify all open tabs to reload so they get the latest version
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept live Firestore/Auth/Functions traffic — the Firestore
  // SDK manages its own offline cache (IndexedDB) and intercepting these
  // requests here would fight with that, not help it. Note this is
  // deliberately narrower than "anything with 'firebase' or 'googleapis' in
  // the hostname" — that used to also match firebasestorage.googleapis.com
  // and silently skip caching every AI-generated drug image.
  if (
    url.hostname === 'firestore.googleapis.com' ||
    url.hostname === 'identitytoolkit.googleapis.com' ||
    url.hostname === 'securetoken.googleapis.com' ||
    url.hostname.endsWith('.cloudfunctions.net') ||
    url.hostname.endsWith('.firebaseio.com')
  ) return;

  // ── Drug images → Cache-first, any origin ──────────────────────────────
  // Sources vary: Firebase Storage (AI-generated), Wikimedia Commons,
  // openFDA, or an admin-pasted link (e.g. Imgur). Once a drug has a saved
  // image_url it's stable — regenerating writes a brand-new Storage path
  // rather than overwriting one — so a cached copy never goes stale.
  // Cross-origin <img> requests come back opaque (status 0); those are
  // still safe and useful to store, so cache regardless of status.
  if (event.request.destination === 'image' && url.pathname !== '/offline.html') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then(cache => cache.put(event.request, clone));
            return response;
          })
          .catch(() => cached); // offline and never cached — let the <img> fail naturally
      })
    );
    return;
  }

  // ── HTML navigation requests → Network-first ──────────────────────────
  // Always try network first so users get the latest deployed version.
  // Fall back to cache only if offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh HTML
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          // Offline — serve cached page or offline fallback
          const cached = await caches.match(event.request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // ── Static assets (JS/CSS/icons) → Cache-first, network fallback ─────
  // CRA hashes JS/CSS filenames on every build so stale cache is not a risk here.
  if (
    url.pathname.match(/\.(js|css|png|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Everything else → Network-first ──────────────────────────────────
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
