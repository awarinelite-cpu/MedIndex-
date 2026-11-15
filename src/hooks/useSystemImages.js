import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { normalizeImageUrl } from '../utils/generateDrugImage';

// Pictures for each body system (Cardiovascular, Respiratory, ...). One small
// document, app_config/system_images, holding { images: { [systemId]: [{ url }] } }
// - covered by the existing app_config rules (public read, signed-in write).
const DOC_PATH = ['app_config', 'system_images'];

export function useSystemImages() {
  const [images, setImages] = useState({});
  useEffect(() => onSnapshot(
    doc(db, ...DOC_PATH),
    snap => setImages((snap.exists() && snap.data().images) || {}),
    err => console.error('[useSystemImages]', err.code, err.message),
  ), []);
  return images;
}

async function save(systemId, list) {
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Not signed in. Please sign in as admin and try again.');
  await setDoc(doc(db, ...DOC_PATH), { images: { [systemId]: list.map(i => ({ url: i.url })) } }, { merge: true });
}

export async function addSystemImageUrls({ systemId, urls, existingImages }) {
  const entries = (urls || [])
    .map(u => normalizeImageUrl((u || '').trim()))
    .filter(u => /^https?:\/\/.+/i.test(u))
    .map(url => ({ url }));
  if (!entries.length) return 0;
  await save(systemId, [...(existingImages || []), ...entries]);
  return entries.length;
}

export async function deleteSystemImage({ systemId, images, index }) {
  await save(systemId, (images || []).filter((_, i) => i !== index));
}
