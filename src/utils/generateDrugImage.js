import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';

async function getAuthUser() {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('You must be signed in as admin to save drug images.');
  }
  return auth.currentUser;
}

// Calls the Nano Banana (Gemini image) endpoint and returns a data: URL.
export async function generateDrugImage({ genericName, drugClass, strength }) {
  const res = await fetch('/api/generate-drug-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genericName, drugClass: drugClass || undefined, strength: strength || undefined }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to generate an image.');
  if (!data.imageDataUrl) throw new Error('AI did not return an image.');
  return data.imageDataUrl;
}

// Uploads a generated data: URL to Firebase Storage and saves the resulting
// download URL onto the drug's Firestore document.
export async function saveDrugImage({ docId, imageDataUrl }) {
  await getAuthUser();
  const storageRef = ref(storage, `drug-images/${docId}.png`);
  await uploadString(storageRef, imageDataUrl, 'data_url');
  const downloadUrl = await getDownloadURL(storageRef);

  await updateDoc(doc(db, 'drugs', docId), {
    image_url:    downloadUrl,
    last_updated: serverTimestamp(),
  });

  return downloadUrl;
}

// Imgur page links (e.g. https://imgur.com/aBcD123) don't render in an
// <img> tag — only the direct i.imgur.com link does. If an admin pastes the
// ordinary page link for a single image, convert it automatically.
export function normalizeImageUrl(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/);
  if (m) return `https://i.imgur.com/${m[1]}.jpg`;
  return url;
}

// Saves an admin-supplied externally-hosted image link (e.g. an Imgur direct
// image URL) straight onto the drug's Firestore document — no re-upload to
// Firebase Storage needed since it's already hosted.
export async function saveDrugImageUrl({ docId, url }) {
  await getAuthUser();
  const trimmed = normalizeImageUrl((url || '').trim());
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('Please enter a valid image URL starting with http:// or https://');
  }

  await updateDoc(doc(db, 'drugs', docId), {
    image_url:    trimmed,
    last_updated: serverTimestamp(),
  });

  return trimmed;
}
