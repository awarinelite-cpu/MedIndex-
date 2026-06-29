// src/hooks/useDrugs.js
// Single source of truth for the drug list.
// Loads from Firestore only — no static seed fallback shown to users.
// In-memory cache (5 min TTL) prevents redundant Firestore reads within a session.

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

let cachedDrugs = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useDrugs() {
  // Start with empty array — never show stale seed data
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
        const live = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cachedDrugs = live;
        cacheTime   = Date.now();
        setDrugs(live);
      } catch (e) {
        console.warn('[useDrugs] Firestore failed:', e.message);
        // Don't fall back to stale seed — just leave as empty so UI shows 0, not wrong number
        setDrugs([]);
      }
      setLoading(false);
    })();
  }, []);

  // Invalidate cache so next call to useDrugs() fetches fresh data
  function invalidateCache() {
    cachedDrugs = null;
    cacheTime   = 0;
  }

  return { drugs, loading, invalidateCache };
}
