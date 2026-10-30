// src/hooks/useRecentlyViewed.js
// Remembers the last drugs a person opened, on this device, so the home
// dashboard can show a "Recently Viewed" list. Stored per signed-in user so
// a shared phone doesn't mix up two people's history.
import { useState, useEffect } from 'react';

const MAX_RECENT = 10;
const keyFor = (uid) => `medindex_recent_drugs:${uid || 'anon'}`;

function readIds(uid) {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(uid)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// Call when a drug detail page opens. Newest first, no duplicates.
export function recordRecentDrug(drugId, uid) {
  if (!drugId) return;
  try {
    const next = [drugId, ...readIds(uid).filter(id => id !== drugId)].slice(0, MAX_RECENT);
    localStorage.setItem(keyFor(uid), JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode / quota) — history is a nicety, never block on it.
  }
}

export function useRecentlyViewed(uid) {
  const [ids, setIds] = useState(() => readIds(uid));
  useEffect(() => {
    setIds(readIds(uid));
    const onStorage = () => setIds(readIds(uid));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [uid]);
  return ids;
}
