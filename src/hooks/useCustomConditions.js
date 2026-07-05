import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

// A single doc holds every system's custom (AI-suggested, admin-approved)
// conditions, keyed by systemId — cheap to read, and avoids needing a whole
// collection for what's normally a handful of extra entries per system.
const DOC_REF_PATH = ['app_config', 'system_conditions_extra'];

let cache = null;
let cacheTime = 0;
const CACHE_MS = 5 * 60 * 1000;

function requireAdminAuth() {
  if (!auth.currentUser) {
    throw new Error('You must be signed in as an admin to save conditions.');
  }
}

export function invalidateCustomConditionsCache() {
  cache = null;
}

// Returns { customConditionsBySystem: { [systemId]: [{id,label,icon,keywords}] }, loading }
export function useCustomConditions() {
  const [data, setData]       = useState(cache || {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (cache && Date.now() - cacheTime < CACHE_MS) {
        setData(cache);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, ...DOC_REF_PATH));
        const val  = snap.exists() ? (snap.data().systems || {}) : {};
        cache = val;
        cacheTime = Date.now();
        if (alive) { setData(val); setLoading(false); }
      } catch {
        if (alive) { setData({}); setLoading(false); }
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  return { customConditionsBySystem: data, loading };
}

export function slugifyConditionLabel(label) {
  return label.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
}

// Adds one or more new conditions to a system's extras, skipping any whose
// id already exists there (idempotent — safe to call again with overlap).
export async function addCustomConditions(systemId, newConditions) {
  requireAdminAuth();
  const ref  = doc(db, ...DOC_REF_PATH);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().systems || {}) : {};
  const existingForSystem = current[systemId] || [];
  const existingIds = new Set(existingForSystem.map(c => c.id));
  const merged = [...existingForSystem, ...newConditions.filter(c => !existingIds.has(c.id))];

  await setDoc(ref, {
    systems: { ...current, [systemId]: merged },
    last_updated: serverTimestamp(),
  }, { merge: true });

  invalidateCustomConditionsCache();
  return merged;
}
