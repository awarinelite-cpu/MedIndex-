import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';

const DOC_REF_PATH = ['app_config', 'system_conditions_extra'];

// Live-listener singleton, shared by every useCustomConditions() instance —
// mirrors the pattern in useDrugs.js so updates (e.g. an admin adding
// conditions on one device) show up everywhere else within about a second,
// with no reload needed.
let liveData    = null;
let unsubscribe = null;
const subscribers = new Set();

function notifyAll(data) {
  liveData = data;
  subscribers.forEach(fn => fn(data));
}

function ensureListener() {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(
    doc(db, ...DOC_REF_PATH),
    (snap) => {
      const val = snap.exists() ? (snap.data().systems || {}) : {};
      notifyAll(val);
    },
    (err) => {
      console.error('[useCustomConditions] listen error:', err.code, err.message);
      notifyAll(liveData || {});
    }
  );
}

// Kept for backward compatibility with existing callers — a no-op now,
// since the live listener means there's never a stale cache to invalidate.
export function invalidateCustomConditionsCache() {}

// Normalizes a label for duplicate comparison: case-insensitive, trimmed,
// whitespace-collapsed, and punctuation-insensitive (so "Osteoporosis" and
// "Osteoporosis." or "Osteoporosis  " are recognized as the same condition).
export function normalizeConditionLabel(label) {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?'"()/\\-]/g, '')
    .replace(/\s+/g, ' ');
}

// Returns { customConditionsBySystem: { [systemId]: [{id,label,icon,keywords}] }, loading }
export function useCustomConditions() {
  const [data, setData]       = useState(liveData || {});
  const [loading, setLoading] = useState(!liveData);

  useEffect(() => {
    ensureListener();
    if (liveData) setLoading(false);

    const setter = (d) => { setData(d); setLoading(false); };
    subscribers.add(setter);

    return () => {
      subscribers.delete(setter);
      if (subscribers.size === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        liveData = null;
      }
    };
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
    const baseForSystem     = SYSTEM_CONDITIONS[systemId] || [];

    // Identity set covers BOTH the static base conditions for this system
    // AND any custom conditions already saved to Firestore — a new
    // condition is a duplicate if it matches either by id or by label
    // (case/punctuation/whitespace-insensitive), so the AI suggesting
    // "Osteoporosis" again when the system already has a base condition
    // labeled "Osteoporosis" (under a different id) is correctly rejected.
    const existingIds    = new Set([...baseForSystem, ...existingForSystem].map(c => c.id));
    const existingLabels = new Set([...baseForSystem, ...existingForSystem].map(c => normalizeConditionLabel(c.label)));

    const deduped = [];
    const seenLabels = new Set(existingLabels);
    for (const c of newConditions) {
      const normLabel = normalizeConditionLabel(c.label);
      if (existingIds.has(c.id) || seenLabels.has(normLabel)) continue;
      seenLabels.add(normLabel); // also guards against duplicates within newConditions itself
      deduped.push(c);
    }

    if (deduped.length === 0) {
      return existingForSystem; // nothing new to add — all were duplicates
    }

    const merged = [...existingForSystem, ...deduped];

    console.log('[addCustomConditions] writing', merged.length, 'conditions to Firestore (', deduped.length, 'new,', newConditions.length - deduped.length, 'duplicates skipped)...');

    await setDoc(ref, {
      systems: { ...current, [systemId]: merged },
      last_updated: serverTimestamp(),
    }, { merge: true });

    console.log('[addCustomConditions] ✅ saved successfully');
    return merged;
  } catch (err) {
    console.error('[addCustomConditions] ❌ Firestore error:', err.code, err.message);
    throw err;
  }
}
