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
