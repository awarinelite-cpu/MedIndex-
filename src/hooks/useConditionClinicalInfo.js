import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

// One document per condition (doc ID = conditionId), NOT one giant document
// holding every condition as a map field. The old shape — a single
// app_config/condition_clinical_info doc with a `conditions` map — hit
// Firestore's 1 MB per-document limit once enough conditions had clinical
// info generated for them. See migrateConditionClinicalInfo() below for the
// one-time move of whatever made it into that old doc before it started
// failing.
const COLLECTION_PATH = 'condition_clinical_info';
export const LEGACY_DOC_REF_PATH = ['app_config', 'condition_clinical_info'];

// Live-listener singleton, same pattern as useCustomConditions.js — one
// admin generating clinical info on one device shows up for everyone else
// within about a second, no reload needed.
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
    collection(db, COLLECTION_PATH),
    (snap) => {
      const val = {};
      snap.forEach(d => { val[d.id] = d.data(); });
      notifyAll(val);
    },
    (err) => {
      console.error('[useConditionClinicalInfo] listen error:', err.code, err.message);
      notifyAll(liveData || {});
    }
  );
}

// Returns { clinicalInfoByCondition: { [conditionId]: {introduction, types,
// organRelated, etiology, pathology, clinicalManifestation, diagnosis,
// management, generatedAt} }, loading }
export function useConditionClinicalInfo() {
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

  return { clinicalInfoByCondition: data, loading };
}

// Saves (or overwrites, on regenerate) clinical info for one condition —
// its own document, so it's nowhere near the 1 MB limit regardless of how
// many other conditions have clinical info saved.
export async function saveConditionClinicalInfo(conditionId, info) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please sign in as admin and try again.');

  const ref = doc(db, COLLECTION_PATH, conditionId);
  await setDoc(ref, { ...info, generatedAt: serverTimestamp() });
}

// Removes clinical info for one condition — best-effort; a no-op if the
// document doesn't exist.
export async function removeConditionClinicalInfo(conditionId) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please sign in as admin and try again.');

  const ref = doc(db, COLLECTION_PATH, conditionId);
  try {
    await deleteDoc(ref);
  } catch {
    // Doc doesn't exist yet — nothing to remove.
  }
}
