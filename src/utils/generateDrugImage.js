import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { apiUrl } from '../config/apiBase';

async function getAuthUser() {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('You must be signed in as admin to save drug images.');
  }
  return auth.currentUser;
}

// Looks for a real, freely-licensed image (Wikimedia Commons / openFDA)
// before anyone resorts to an AI illustration. Returns null if nothing
// licensed turns up — callers should fall back to generateDrugImage() in
// that case, not to an unlicensed web image.
export async function findRealDrugImage({ genericName }) {
  const res = await fetch(apiUrl('/api/find-drug-image'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genericName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to search for an image.');
  return data.found ? data : null;
}

// Saves a real image found via findRealDrugImage() onto the drug's Firestore
// doc, along with its source/license/attribution so the UI can display them.
export async function saveFoundDrugImage({ docId, found }) {
  await getAuthUser();
  await updateDoc(doc(db, 'drugs', docId), {
    image_url:         found.imageUrl,
    image_source:      found.source,
    image_source_url:  found.sourcePageUrl,
    image_license:     found.license,
    image_attribution: found.attribution,
    image_is_real:     true,
    last_updated:      serverTimestamp(),
  });
}

// Calls the Nano Banana (Gemini image) endpoint and returns a data: URL.
export async function generateDrugImage({ genericName, drugClass, strength }) {
  const res = await fetch(apiUrl('/api/generate-drug-image'), {
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

// Reads a File (from an <input type="file">) into a base64 data: URL.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

// Shared call to our serverless proxy — posts a base64 data: URL and
// returns the ImgChest-hosted link.
async function postImageDataUrl(imageDataUrl, filename) {
  const res = await fetch(apiUrl('/api/imgchest-upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, filename }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to upload image.');
  if (!data.url) throw new Error('Upload succeeded but no image link was returned.');
  return data.url;
}

// Uploads a photo the admin picked from their device to ImgChest (via our
// serverless proxy, so the ImgChest token stays server-side) and returns the
// direct image link. Second option alongside pasting an existing link.
export async function uploadImageToImgChest({ file }) {
  if (!file) throw new Error('No file selected.');
  if (!file.type?.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const imageDataUrl = await fileToDataUrl(file);
  return postImageDataUrl(imageDataUrl, file.name);
}

// Uploads an image copied to the clipboard (e.g. "Copy Image" on a website,
// or a screenshot) — no file dialog or URL needed at all.
export async function uploadClipboardImageToImgChest({ blob }) {
  if (!blob) throw new Error('No image found on the clipboard.');
  if (!blob.type?.startsWith('image/')) {
    throw new Error('Clipboard content is not an image.');
  }
  const imageDataUrl = await fileToDataUrl(blob); // FileReader accepts any Blob
  const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
  return postImageDataUrl(imageDataUrl, `pasted.${ext}`);
}

// Same idea, but for a picture URL copied from a website — the server
// fetches it and re-hosts it on ImgChest, so the admin doesn't have to
// download the picture first and then pick it from a file dialog.
export async function uploadImageUrlToImgChest({ sourceUrl }) {
  const trimmed = (sourceUrl || '').trim();
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('Please enter a valid image URL starting with http:// or https://');
  }

  const res = await fetch(apiUrl('/api/imgchest-upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceUrl: trimmed }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch and upload that image.');
  if (!data.url) throw new Error('Upload succeeded but no image link was returned.');
  return data.url;
}

// Saves an admin-supplied externally-hosted image link (e.g. an Imgur direct
// image URL, or one just returned by uploadImageToImgChest) straight onto
// the drug's Firestore document — no re-upload to Firebase Storage needed
// since it's already hosted.
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
