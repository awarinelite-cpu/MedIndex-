// src/hooks/useDrugs.js
// Single source of truth for the drug list.
// Seeds instantly from static JSON (no loading flash on first paint),
// then hydrates with live Firestore data so admin-uploaded drugs appear.

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import seedData from '../data/seedDrugs.json';

function mergeById(seed, live) {
  const map = {};
  seed.forEach(d => { map[d.id] = d; });
  live.forEach(d => { map[d.id] = d; }); // Firestore wins on same id
  return Object.values(map);
}

let cachedDrugs = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useDrugs() {
  const [drugs,   setDrugs]   = useState(cachedDrugs || seedData);
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
        const live   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const merged = mergeById(seedData, live);
        cachedDrugs  = merged;
        cacheTime    = Date.now();
        setDrugs(merged);
      } catch (e) {
        console.warn('[useDrugs] Firestore failed, using seed data:', e.message);
      }
      setLoading(false);
    })();
  }, []);

  return { drugs, loading };
}
