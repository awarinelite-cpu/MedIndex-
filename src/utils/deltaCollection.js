// src/utils/deltaCollection.js
//
// "Only reload what changed" for big Firestore collections (drugs, procedures,
// condition notes).
//
// The old hooks opened one live listener on the WHOLE collection. Firestore
// bills one read per document, and when a listener is re-opened after more
// than ~30 minutes it re-sends every document — so each cold app start cost
// thousands of reads and the free daily quota ran out.
//
// How this works instead:
//   1. Start from the documents already saved on the device (Firestore's
//      persistent cache) — free, instant, works offline.
//   2. Open a live listener on ONLY the documents whose timestamp field is newer
//      than the last sync point. Changed documents arrive (from any device)
//      and are merged in, so the cost of a start is "documents changed since
//      last time", usually a handful.
//   3. Deleted documents are not visible to a "newer than" query, so:
//        - deletes made on this device call markDeleted() and disappear at once;
//        - at start (and when the app comes back after 30+ minutes) a cheap
//          COUNT query compares the server's document count with ours; if they
//          differ, one full re-sync repairs the list and remembers which ids
//          were removed so stale copies in the device cache stay hidden;
//        - a full re-sync also runs at most once every 7 days as a safety net.
//   4. The very first run on a device (nothing cached yet) does one full load.
//
// Every writer must bump the timestamp field (`last_updated` for drugs and
// procedures, `updatedAt` for condition notes) or other devices would not see
// the change until the next count check / weekly re-sync.

import {
  collection, query, where, orderBy, onSnapshot, Timestamp,
  getDocsFromCache, getDocsFromServer, getCountFromServer,
} from 'firebase/firestore';
import { db } from '../firebase';

const FULL_RESYNC_MS = 7 * 24 * 60 * 60 * 1000;   // safety-net full re-sync
const RECHECK_AFTER_MS = 30 * 60 * 1000;          // count check when the app returns after this long
const COUNT_SKIP_MS = 60 * 60 * 1000;             // back off if a re-sync still leaves a count mismatch

const stores = new Map(); // path -> store (so delete helpers can find it)

const loadMeta = (key) => {
  try { return JSON.parse(localStorage.getItem(`mi_sync_${key}_v1`)) || {}; } catch { return {}; }
};
const saveMeta = (key, meta) => {
  try { localStorage.setItem(`mi_sync_${key}_v1`, JSON.stringify(meta)); } catch { /* storage full / disabled */ }
};

const sortMillis = (docSnap, field) => {
  const t = field ? docSnap.get(field, { serverTimestamps: 'estimate' }) : null;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
};

/**
 * @param {object} o
 * @param {string} o.path   Firestore collection path
 * @param {string} o.field  Timestamp field bumped by every write (e.g. 'last_updated')
 * @param {string} [o.key]  localStorage key suffix (defaults to path)
 * @param {boolean} [o.sort] newest-first ordering of the emitted array (default true)
 * @param {boolean} [o.requireField] true (default): only documents that have `field` exist for the app
 *   (matches the old `orderBy(field)` listeners). false: every document counts, and `field` is only
 *   used to spot changes (older documents may not have it yet).
 */
export function createDeltaStore({ path, field, key = path, sort = true, requireField = true }) {
  const subscribers = new Set();
  const map = new Map();          // id -> { id, data, ms }
  let meta = loadMeta(key);
  let deleted = new Set(meta.deleted || []);
  let current = null;             // last emitted array
  let started = false;
  let emitTimer = null;
  let lastCheckAt = 0;
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });

  const colRef = () => collection(db, path);
  // `orderBy(field)` also means "only documents that have the field", which is
  // exactly what the app already showed before — and what COUNT must match.
  const allQuery = () => (field && requireField ? query(colRef(), orderBy(field, 'desc')) : colRef());

  const persist = () => {
    meta = { ...meta, deleted: [...deleted].slice(-2000) };
    saveMeta(key, meta);
  };

  const toEntry = (d) => ({ id: d.id, data: { id: d.id, ...d.data() }, ms: sortMillis(d, field) });

  const emit = () => {
    if (emitTimer) return;
    emitTimer = setTimeout(() => {
      emitTimer = null;
      const arr = [...map.values()];
      if (sort && field && requireField) arr.sort((a, b) => (b.ms || Number.MAX_SAFE_INTEGER) - (a.ms || Number.MAX_SAFE_INTEGER));
      current = arr.map((e) => e.data);
      subscribers.forEach((fn) => { try { fn(current); } catch (e) { console.error(e); } });
      readyResolve();
    }, 0);
  };

  const maxStamp = (docs, from) => {
    let best = from ? { s: from.s, n: from.n } : null;
    docs.forEach((d) => {
      if (d.metadata?.hasPendingWrites || !field) return;
      const t = d.get(field);
      if (t instanceof Timestamp && (!best || t.seconds > best.s || (t.seconds === best.s && t.nanoseconds > best.n))) {
        best = { s: t.seconds, n: t.nanoseconds };
      }
    });
    return best;
  };

  async function fullResync() {
    const [serverSnap, cacheSnap] = await Promise.all([
      getDocsFromServer(allQuery()),
      getDocsFromCache(allQuery()).catch(() => null),
    ]);
    const serverIds = new Set(serverSnap.docs.map((d) => d.id));
    // Anything we (or the device cache) held that the server no longer has was
    // deleted elsewhere. Remember it so a stale cached copy stays hidden.
    const known = new Set([...map.keys(), ...(cacheSnap ? cacheSnap.docs.map((d) => d.id) : [])]);
    known.forEach((id) => { if (!serverIds.has(id)) deleted.add(id); });
    serverIds.forEach((id) => deleted.delete(id));

    map.clear();
    serverSnap.docs.forEach((d) => map.set(d.id, toEntry(d)));
    meta = { ...meta, fullAt: Date.now(), wm: maxStamp(serverSnap.docs, null) };
    persist();
    emit();
  }

  async function countCheck(force = false) {
    if (!force && Date.now() < (meta.countSkipUntil || 0)) return;
    lastCheckAt = Date.now();
    try {
      if ([...map.values()].some((e) => e.pending)) return; // our own unsent writes would skew the count
      const agg = await getCountFromServer(allQuery());
      const serverCount = agg.data().count;
      if (serverCount === map.size) return;
      await fullResync();
      if (serverCount !== map.size) {
        meta = { ...meta, countSkipUntil: Date.now() + COUNT_SKIP_MS };
        persist();
      }
    } catch (e) {
      console.warn(`[delta:${path}] count check skipped:`, e.message);
    }
  }

  function attachListener() {
    const wm = meta.wm ? new Timestamp(meta.wm.s, meta.wm.n) : new Timestamp(0, 0);
    const q = field
      ? query(colRef(), where(field, '>', wm), orderBy(field))
      : colRef();
    onSnapshot(
      q,
      (snap) => {
        let changed = false;
        snap.docChanges().forEach((ch) => {
          const id = ch.doc.id;
          if (ch.type === 'removed') {
            if (map.delete(id)) changed = true;
          } else {
            const entry = toEntry(ch.doc);
            entry.pending = !!ch.doc.metadata.hasPendingWrites;
            map.set(id, entry);
            if (deleted.delete(id)) persist();
            changed = true;
          }
        });
        const advanced = maxStamp(snap.docs, meta.wm);
        if (advanced && (!meta.wm || advanced.s !== meta.wm.s || advanced.n !== meta.wm.n)) {
          meta = { ...meta, wm: advanced };
          persist();
        }
        if (changed) emit();
      },
      (err) => {
        console.warn(`[delta:${path}] listener error:`, err.message);
        subscribers.forEach((fn) => { try { fn(current, err); } catch (e) { console.error(e); } });
        readyResolve();
      }
    );
  }

  async function start() {
    if (started) return;
    started = true;
    try {
      let cacheDocs = [];
      try { cacheDocs = (await getDocsFromCache(allQuery())).docs; } catch { /* nothing cached */ }
      const visible = cacheDocs.filter((d) => !deleted.has(d.id));
      const stale = !meta.fullAt || Date.now() - meta.fullAt > FULL_RESYNC_MS;

      if (visible.length === 0 || !meta.fullAt) {
        await fullResync();                         // first run on this device
      } else {
        visible.forEach((d) => map.set(d.id, toEntry(d)));
        emit();                                     // instant, from the device
        if (stale) await fullResync();              // weekly safety net
      }
      attachListener();                             // + changed docs, live
      if (!stale) countCheck();                     // catches deletes made on other devices
    } catch (e) {
      console.warn(`[delta:${path}] start failed:`, e.message);
      subscribers.forEach((fn) => { try { fn(current, e); } catch (err) { console.error(err); } });
      readyResolve();
      if (!map.size) started = false;               // allow a retry on the next subscribe
    }
  }

  // Coming back to the app after a while: look for deletes made elsewhere.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && started && Date.now() - lastCheckAt > RECHECK_AFTER_MS) countCheck();
    });
  }

  const store = {
    subscribe(fn) {
      subscribers.add(fn);
      start();
      if (current) fn(current);
      return () => subscribers.delete(fn);
    },
    get: () => current,
    ready: () => { start(); return ready; },
    /** Call right after deleting a document so it disappears immediately. */
    markDeleted(id) {
      deleted.add(id);
      persist();
      if (map.delete(id)) emit();
    },
    /** Force a complete re-download (e.g. a "refresh everything" button). */
    async fullRefresh() { await start(); await fullResync(); },
  };
  stores.set(path, store);
  return store;
}

/** Tell the matching store a document was deleted (no-op if none is registered). */
export function markDeleted(path, id) {
  const s = stores.get(path);
  if (s) s.markDeleted(id);
  else {
    try {
      const m = JSON.parse(localStorage.getItem(`mi_sync_${path}_v1`)) || {};
      m.deleted = [...new Set([...(m.deleted || []), id])].slice(-2000);
      localStorage.setItem(`mi_sync_${path}_v1`, JSON.stringify(m));
    } catch { /* ignore */ }
  }
}

/** Current documents of a collection (starts it if needed). Used by one-off readers. */
export async function getStoreDocs(path) {
  const s = stores.get(path);
  if (!s) return null;
  await s.ready();
  return s.get() || [];
}
