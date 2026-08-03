import { useEffect, useRef } from 'react';

// Firestore sync gives us every drug's data (including its image_url field)
// instantly once persistence is on, but the actual image bytes behind that
// URL only get cached lazily — the first time that specific drug's detail
// page is opened (see the image route in service-worker.js). This walks
// the whole drug list right after login and quietly requests every image
// up front, so the WHOLE catalog is available offline after the first
// sync — not just the handful of drugs someone happened to open.
const CONCURRENCY = 4;
const BATCH_PAUSE_MS = 120;

export function usePrefetchDrugImages(drugs) {
  const doneRef = useRef(new Set());
  const runningRef = useRef(false);

  useEffect(() => {
    if (!drugs?.length) return;
    if (!('serviceWorker' in navigator)) return;
    // Respect data saver mode — don't burn someone's data plan pulling
    // down a whole drug image catalog in the background unasked.
    if (navigator.connection?.saveData) return;

    const urls = [...new Set(drugs.map(d => d.image_url).filter(Boolean))];
    const pending = urls.filter(u => !doneRef.current.has(u));
    if (!pending.length || runningRef.current) return;

    let cancelled = false;
    runningRef.current = true;

    (async () => {
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        if (cancelled || !navigator.onLine) break;
        const batch = pending.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (url) => {
          doneRef.current.add(url);
          try {
            // no-cors matches how an <img> tag requests these (many are
            // cross-origin: Firebase Storage, Wikimedia, openFDA, Imgur)
            // and produces the same opaque response the SW image route
            // already caches regardless of status.
            await fetch(url, { mode: 'no-cors', credentials: 'omit' });
          } catch {
            // Offline or blocked mid-prefetch — harmless, it'll just get
            // cached the normal lazy way whenever that drug is opened.
            doneRef.current.delete(url);
          }
        }));
        if (i + CONCURRENCY < pending.length) {
          await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
        }
      }
      runningRef.current = false;
    })();

    return () => { cancelled = true; };
  }, [drugs]);
}
