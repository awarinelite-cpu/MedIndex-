import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

const DOC_REF_PATH = ['app_config', 'system_conditions_extra'];

let cache = null;
let cacheTime = 0;
const CACHE_MS = 5 * 60 * 1000;

// Wait for Firebase Auth to fully restore session before checking currentUser
async function getAuthUser() {
  // authStateReady() resolves once the initial auth state is known
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('You must be signed in as admin to save. Please sign in and try again.');
  }
  return auth.currentUser;
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
        console.log('[useCustomConditions] loaded systems:', Object.keys(val));
        cache = val;
        cacheTime = Date.now();
        if (alive) { setData(val); setLoading(false); }
      } catch (err) {
        console.error('[useCustomConditions] read error:', err.code, err.message);
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
  // Wait for Firebase Auth session to fully restore
  await auth.authStateReady();
  
  const user = auth.currentUser;
  console.log('[addCustomConditions] auth.currentUser:', user ? user.email : 'NULL');
  console.log('[addCustomConditions] systemId:', systemId);
  console.log('[addCustomConditions] conditions count:', newConditions.length);

  if (!user) {
    throw new Error('Not signed in. Please sign in as admin and try again.');
  }

  const ref = doc(db, ...DOC_REF_PATH);
  
  try {
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data().systems || {}) : {};
    const existingForSystem = current[systemId] || [];
    const existingIds = new Set(existingForSystem.map(c => c.id));
    const merged = [...existingForSystem, ...newConditions.filter(c => !existingIds.has(c.id))];

    console.log('[addCustomConditions] writing', merged.length, 'conditions to Firestore...');
    
    await setDoc(ref, {
      systems: { ...current, [systemId]: merged },
      last_updated: serverTimestamp(),
    }, { merge: true });

    console.log('[addCustomConditions] ✅ saved successfully');
    invalidateCustomConditionsCache();
    return merged;
  } catch (err) {
    console.error('[addCustomConditions] ❌ Firestore error:', err.code, err.message);
    throw err;
  }
}
