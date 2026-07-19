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

// Same live-listener pattern as above, but for the "hidden" map — seeded
// (static) conditions an admin has deleted. Since the seeded list lives in
// systemConditions.js and can't be mutated at runtime, deleting one of those
// just records its id here so every consumer filters it out.
let liveHidden        = null;
let unsubscribeHidden = null; // reserved for symmetry; both maps share one Firestore doc/listener
const hiddenSubscribers = new Set();

function notifyAllHidden(data) {
  liveHidden = data;
  hiddenSubscribers.forEach(fn => fn(data));
}

function ensureListener() {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(
    doc(db, ...DOC_REF_PATH),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      notifyAll(data.systems || {});
      notifyAllHidden(data.hidden || {});
    },
    (err) => {
      console.error('[useCustomConditions] listen error:', err.code, err.message);
      notifyAll(liveData || {});
      notifyAllHidden(liveHidden || {});
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

// Returns { customConditionsBySystem: { [systemId]: [{id,label,icon,keywords}] },
//           hiddenConditionIdsBySystem: { [systemId]: [id, ...] }, loading }
export function useCustomConditions() {
  const [data, setData]           = useState(liveData || {});
  const [hidden, setHidden]       = useState(liveHidden || {});
  const [loading, setLoading]     = useState(!liveData);

  useEffect(() => {
    ensureListener();
    if (liveData) setLoading(false);

    const setter = (d) => { setData(d); setLoading(false); };
    const hiddenSetter = (h) => setHidden(h);
    subscribers.add(setter);
    hiddenSubscribers.add(hiddenSetter);

    return () => {
      subscribers.delete(setter);
      hiddenSubscribers.delete(hiddenSetter);
      if (subscribers.size === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        liveData = null;
        liveHidden = null;
      }
    };
  }, []);

  return { customConditionsBySystem: data, hiddenConditionIdsBySystem: hidden, loading };
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

// Deletes a condition from a system's taxonomy.
//   - If it's a custom (admin/AI-added) condition, it's removed outright
//     from the Firestore "systems" list.
//   - If it's one of the seeded conditions from systemConditions.js (which
//     can't be mutated at runtime), its id is instead recorded in a
//     Firestore "hidden" list for that system, so every consumer filters
//     it out of display, matching, and the clinical-info sweep.
// Either way this only affects the taxonomy entry itself — drugs keep their
// condition_tags untouched, so nothing is silently lost if the condition is
// ever un-hidden or re-added later.
export async function removeCondition(systemId, conditionId) {
  await auth.authStateReady();

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not signed in. Please sign in as admin and try again.');
  }

  const ref = doc(db, ...DOC_REF_PATH);

  try {
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data() : {};
    const systems = current.systems || {};
    const hidden  = current.hidden  || {};

    const existingForSystem = systems[systemId] || [];
    const isCustom = existingForSystem.some(c => c.id === conditionId);

    const update = {};
    if (isCustom) {
      update.systems = {
        ...systems,
        [systemId]: existingForSystem.filter(c => c.id !== conditionId),
      };
    } else {
      const existingHidden = hidden[systemId] || [];
      if (!existingHidden.includes(conditionId)) {
        update.hidden = {
          ...hidden,
          [systemId]: [...existingHidden, conditionId],
        };
      }
    }

    if (Object.keys(update).length === 0) return; // nothing to change

    await setDoc(ref, { ...update, last_updated: serverTimestamp() }, { merge: true });
    console.log('[removeCondition] ✅ removed', conditionId, 'from', systemId, isCustom ? '(custom, deleted)' : '(seeded, hidden)');
  } catch (err) {
    console.error('[removeCondition] ❌ Firestore error:', err.code, err.message);
    throw err;
  }
}
