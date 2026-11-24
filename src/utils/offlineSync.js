// src/utils/offlineSync.js
// "Download for offline": pulls every collection the app reads straight from
// the server so Firestore's persistent (IndexedDB) cache holds a complete,
// fresh copy, then optionally warms the image cache through the service
// worker. The live onSnapshot listeners keep working as before.
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const LAST_SYNC_KEY = 'mi_offline_last_sync_v1';

const COLLECTIONS = [
  { path: 'drugs',                   label: 'Drugs' },
  { path: 'procedures',              label: 'Procedures' },
  { path: 'condition_clinical_info', label: 'Condition notes' },
];

export function getLastSync() {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastSync(info) {
  try { localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(info)); } catch { /* storage full/blocked */ }
}

export async function getStorageEstimate() {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch { /* ignore */ }
  return null;
}

// Ask the browser not to evict our cache when the phone is low on space.
async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* ignore */ }
  return false;
}

function loadImage(url) {
  // An <img> load goes through the service worker's image route, which is
  // what stores it in the long-lived image cache.
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * @param {{ includeImages?: boolean, onProgress?: (p: object) => void, shouldCancel?: () => boolean }} opts
 * onProgress receives { phase, label, done, total, percent }
 */
export async function downloadForOffline({ includeImages = true, onProgress = () => {}, shouldCancel = () => false } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('You are offline. Connect to the internet to download.');
  }

  const persisted = await requestPersistence();
  const counts = {};
  const imageUrls = new Set();
  const totalSteps = COLLECTIONS.length + (includeImages ? 1 : 0);
  let step = 0;

  for (const { path, label } of COLLECTIONS) {
    if (shouldCancel()) throw new Error('Cancelled');
    onProgress({ phase: 'data', label: `Saving ${label.toLowerCase()}…`, done: step, total: totalSteps, percent: Math.round((step / totalSteps) * 100) });
    const snap = await getDocs(collection(db, path));
    counts[path] = snap.size;
    if (path === 'drugs') {
      snap.forEach(d => { const u = d.data().image_url; if (u) imageUrls.add(u); });
    }
    step += 1;
  }

  let imagesSaved = 0;
  const urls = [...imageUrls];
  if (includeImages && urls.length) {
    const CONCURRENCY = 4;
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      if (shouldCancel()) throw new Error('Cancelled');
      if (navigator.onLine === false) throw new Error('Connection lost while saving images. Data is saved; try again for the images.');
      const results = await Promise.all(urls.slice(i, i + CONCURRENCY).map(loadImage));
      imagesSaved += results.filter(Boolean).length;
      const frac = Math.min(1, (i + CONCURRENCY) / urls.length);
      onProgress({
        phase: 'images',
        label: `Saving images… ${Math.min(urls.length, i + CONCURRENCY)}/${urls.length}`,
        done: step + frac, total: totalSteps,
        percent: Math.round(((step + frac) / totalSteps) * 100),
      });
    }
  }

  const info = { at: Date.now(), counts, images: imagesSaved, imagesIncluded: includeImages, persisted };
  saveLastSync(info);
  onProgress({ phase: 'done', label: 'Ready for offline use', done: totalSteps, total: totalSteps, percent: 100 });
  return info;
}
