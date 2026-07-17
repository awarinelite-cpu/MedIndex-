import { useEffect, useState } from 'react';
import { doc, setDoc, updateDoc, deleteField, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

const DOC_REF_PATH = ['app_config', 'condition_clinical_info'];

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
    doc(db, ...DOC_REF_PATH),
    (snap) => {
      const val = snap.exists() ? (snap.data().conditions || {}) : {};
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

// Saves (or overwrites, on regenerate) clinical info for one condition.
export async function saveConditionClinicalInfo(conditionId, info) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please sign in as admin and try again.');

  const ref = doc(db, ...DOC_REF_PATH);
  await setDoc(ref, {
    conditions: { [conditionId]: { ...info, generatedAt: serverTimestamp() } },
  }, { merge: true });
}

// Removes clinical info for one condition — best-effort; a no-op if the
// doc or field doesn't exist yet.
export async function removeConditionClinicalInfo(conditionId) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please sign in as admin and try again.');

  const ref = doc(db, ...DOC_REF_PATH);
  try {
    await updateDoc(ref, { [`conditions.${conditionId}`]: deleteField() });
  } catch {
    // Doc doesn't exist yet — nothing to remove.
  }
}
