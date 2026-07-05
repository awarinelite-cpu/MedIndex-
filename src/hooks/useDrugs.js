// src/hooks/useDrugs.js
// Single source of truth for the drug list.
// Primary: Firestore 'drugs' collection (live, uploadable)
// Fallback: local seedDrugs.json (always available, 280 drugs)
// In-memory cache (5 min TTL) prevents redundant Firestore reads.

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
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

let cachedDrugs = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useDrugs() {
  const [drugs,   setDrugs]   = useState(cachedDrugs || []);
  const [loading, setLoading] = useState(!cachedDrugs);

  useEffect(() => {
    const now = Date.now();
    if (cachedDrugs && now - cacheTime < CACHE_TTL) {
      setDrugs(cachedDrugs);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'drugs'), orderBy('last_updated', 'desc'), limit(2000))
        );

        if (!snap.empty) {
          const live = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          cachedDrugs = live;
          cacheTime   = Date.now();
          setDrugs(live);
        } else {
          // Firestore empty — use local seed
          console.info('[useDrugs] Firestore empty — using local seed data');
          cachedDrugs = SEED_WITH_IDS;
          cacheTime   = Date.now();
          setDrugs(SEED_WITH_IDS);
        }
      } catch (e) {
        console.warn('[useDrugs] Firestore failed — using local seed data:', e.message);
        if (!cachedDrugs) {
          cachedDrugs = SEED_WITH_IDS;
          cacheTime   = Date.now();
        }
        setDrugs(cachedDrugs);
      }
      setLoading(false);
    })();
  }, []);

  function invalidateCache() {
    cachedDrugs = null;
    cacheTime   = 0;
  }

  return { drugs, loading, invalidateCache };
}
