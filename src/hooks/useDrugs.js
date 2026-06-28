// src/hooks/useDrugs.js
// Single source of truth for the drug list.
// Seeds instantly from static JSON on first paint (no loading flash),
// then REPLACES with live Firestore data once it arrives.
//
// IMPORTANT: Firestore is the source of truth. The static seedDrugs.json
// is only a placeholder shown before Firestore responds — once Firestore
// data loads, it fully replaces the seed (so deletions in admin are
// reflected everywhere, not just in the admin table).

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import seedData from '../data/seedDrugs.json';

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
        const live = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Firestore is the source of truth — replace seed entirely,
        // even if Firestore is now empty (e.g. after admin Delete All).
        cachedDrugs = live;
        cacheTime   = Date.now();
        setDrugs(live);
      } catch (e) {
        console.warn('[useDrugs] Firestore failed, falling back to seed data:', e.message);
        // Only fall back to the static seed if Firestore itself is unreachable —
        // never silently merge it back in alongside live data.
        setDrugs(seedData);
      }
      setLoading(false);
    })();
  }, []);

  return { drugs, loading };
}

