import { useEffect, useState } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { normalizeImageUrl } from '../utils/generateDrugImage';

// One document per condition (doc ID = conditionId), NOT one giant document
// holding every condition as a map field. The old shape — a single
// app_config/condition_clinical_info doc with a `conditions` map — hit
// Firestore's 1 MB per-document limit once enough conditions had clinical
// info generated for them. See migrateConditionClinicalInfo() below for the
// one-time move of whatever made it into that old doc before it started
// failing.
//
// Condition pictures live in the same per-condition document, in an `images`
// array of { url } entries, so the existing Firestore rules (public read,
// signed-in write) already cover them. The live listener below splits
// `images` out of each doc: `clinicalInfoByCondition` only ever contains the
// clinical-info text fields, and a condition that has pictures but no
// clinical info yet is NOT treated as "has clinical info" anywhere in the
// app (sweeps, "missing info" counts, the info panel, PDF export).
const COLLECTION_PATH = 'condition_clinical_info';
export const LEGACY_DOC_REF_PATH = ['app_config', 'condition_clinical_info'];

// Live-listener singleton, same pattern as useCustomConditions.js — one
// admin generating clinical info on one device shows up for everyone else
// within about a second, no reload needed.
let liveData    = null; // { info: {[id]: fields}, images: {[id]: [{url}]} }
let unsubscribe = null;
const subscribers = new Set();

function notifyAll(data) {
  liveData = data;
  subscribers.forEach(fn => fn(data));
}

function hasInfoFields(fields) {
  return Object.keys(fields).length > 0;
}

function ensureListener() {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(
    collection(db, COLLECTION_PATH),
    (snap) => {
      const info = {};
      const images = {};
      snap.forEach(d => {
        const { images: imgs, ...fields } = d.data();
        if (Array.isArray(imgs) && imgs.length > 0) images[d.id] = imgs;
        if (hasInfoFields(fields)) info[d.id] = fields;
      });
      notifyAll({ info, images });
    },
    (err) => {
      console.error('[useConditionClinicalInfo] listen error:', err.code, err.message);
      notifyAll(liveData || { info: {}, images: {} });
    }
  );
}

// Returns { clinicalInfoByCondition: { [conditionId]: {introduction, types,
// organRelated, etiology, pathology, clinicalManifestation, diagnosis,
// management, surgicalManagement, nursingDiagnosis, nursingConsideration,
// generatedAt} }, imagesByCondition: { [conditionId]: [{ url }] }, loading }
export function useConditionClinicalInfo() {
  const [data, setData]       = useState(liveData || { info: {}, images: {} });
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

  return { clinicalInfoByCondition: data.info, imagesByCondition: data.images, loading };
}

async function requireSignedIn() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please sign in as admin and try again.');
  return user;
}

// Saves (or overwrites, on regenerate) clinical info for one condition —
// its own document, so it's nowhere near the 1 MB limit regardless of how
// many other conditions have clinical info saved. Merges, so any pictures
// already saved on the condition survive a regenerate / CSV re-import.
export async function saveConditionClinicalInfo(conditionId, info) {
  await requireSignedIn();

  const ref = doc(db, COLLECTION_PATH, conditionId);
  await setDoc(ref, { ...info, generatedAt: serverTimestamp() }, { merge: true });
}

// Removes clinical info for one condition — best-effort; a no-op if the
// document doesn't exist. If the condition has pictures, only the clinical
// text is cleared and the pictures are kept.
export async function removeConditionClinicalInfo(conditionId) {
  await requireSignedIn();

  const ref = doc(db, COLLECTION_PATH, conditionId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const images = snap.data().images;
    if (Array.isArray(images) && images.length > 0) {
      await setDoc(ref, { images }); // no merge: drops every other field
    } else {
      await deleteDoc(ref);
    }
  } catch {
    // Doc doesn't exist yet — nothing to remove.
  }
}

// Overwrites the condition's full picture list (used for adding and
// deleting). Leaves the clinical-info fields alone; if that empties the
// list and there's no clinical info either, the doc is removed entirely.
export async function setConditionImages(conditionId, images) {
  await requireSignedIn();

  const ref = doc(db, COLLECTION_PATH, conditionId);
  const list = (images || []).map(img => ({ url: img.url }));
  if (list.length === 0) {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const { images: _drop, ...rest } = snap.data();
    if (!hasInfoFields(rest)) { await deleteDoc(ref); return; }
    await setDoc(ref, { images: [] }, { merge: true });
    return;
  }
  await setDoc(ref, { images: list }, { merge: true });
}

// Appends an already-hosted image link (e.g. the ImgChest URL returned for a
// pasted clipboard image) to the condition's pictures.
export async function addConditionImageUrl({ conditionId, url, existingImages }) {
  const trimmed = normalizeImageUrl((url || '').trim());
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('The uploaded image did not return a valid link.');
  }
  await setConditionImages(conditionId, [...(existingImages || []), { url: trimmed }]);
  return trimmed;
}

// Removes one picture by index and re-saves the rest.
export async function deleteConditionImage({ conditionId, images, index }) {
  const next = (images || []).filter((_, i) => i !== index);
  await setConditionImages(conditionId, next);
}
