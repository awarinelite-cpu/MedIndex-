// src/hooks/useDrugs.js
// Single source of truth for the drug list.
// Primary: Firestore 'drugs' collection, kept live via onSnapshot — any
// write (admin save, AI insight save, bulk upload, image link, etc.) from
// anywhere in the app is pushed to every screen using this hook within
// about a second, with no page reload needed.
// Fallback: local seedDrugs.json (used only if Firestore is empty or
// unreachable).
//
// One shared listener (singleton) backs every component that calls
// useDrugs() — Home, Browse, System, and Drug Detail all stay in sync off
// the same live snapshot instead of each doing their own fetch.

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import SEED_DRUGS from '../data/seedDrugs.json';

// Pre-process seed data once — give each drug a stable id
const SEED_WITH_IDS = SEED_DRUGS.map(d => ({
  ...d,
  id: d.generic_name.replace(/[^a-zA-Z0-9_-]/g, '_'),
  // Map seed field names → app field names
  indications: d.primary_indications || d.indications || '',
  // Marks this drug as coming from the bundled local seed file, NOT Firestore.
  // Existence checks (e.g. "already in database" in AI class save) must ignore
  // seed drugs — they are display-only fallbacks and do not exist in the DB.
  _seed: true,
}));

let liveDrugs   = null;   // most recent snapshot data, shared by all hook instances
let unsubscribe = null;   // the active onSnapshot teardown fn, or null if not listening
const subscribers = new Set(); // setState functions from every mounted useDrugs() instance

function notifyAll(drugs) {
  liveDrugs = drugs;
  subscribers.forEach(fn => fn(drugs));
}

function ensureListener() {
  if (unsubscribe) return; // already listening — reuse it
  const q = query(collection(db, 'drugs'), orderBy('last_updated', 'desc'), limit(2000));
  unsubscribe = onSnapshot(
    q,
    (snap) => {
      if (!snap.empty) {
        notifyAll(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        console.info('[useDrugs] Firestore empty — using local seed data');
        notifyAll(SEED_WITH_IDS);
      }
    },
    (err) => {
      console.warn('[useDrugs] onSnapshot failed — using local seed data:', err.message);
      notifyAll(liveDrugs || SEED_WITH_IDS);
    }
  );
}

export function useDrugs() {
  const [drugs,   setDrugs]   = useState(liveDrugs || []);
  const [loading, setLoading] = useState(!liveDrugs);

  useEffect(() => {
    ensureListener();
    if (liveDrugs) setLoading(false);

    const setter = (d) => { setDrugs(d); setLoading(false); };
    subscribers.add(setter);

    return () => {
      subscribers.delete(setter);
      // Tear down the Firestore listener once nobody's using it anymore,
      // so it doesn't keep billing reads for a screen no one is viewing.
      if (subscribers.size === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        liveDrugs = null;
      }
    };
  }, []);

  // Kept for backward compatibility with existing callers — a no-op now,
  // since the live listener means there's never a stale cache to invalidate.
  function invalidateCache() {}

  return { drugs, loading, invalidateCache };
}
