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

// ── Multi-image support ─────────────────────────────────────────────────
// Drugs can now carry several pictures (e.g. different pack sizes/brands).
// They're stored as an ordered array on the doc: images: [{ url, is_real,
// source, source_url, license, attribution }, ...]. The legacy single
// image_url / image_is_real / image_source* fields are kept in sync with
// images[0] so older parts of the app (home page thumbnails, prefetching,
// bulk CSV upload) that only know about image_url keep working untouched.

// Reads the current image list off a drug object, falling back to the old
// single-image fields for docs that haven't been touched since this array
// was introduced.
export function getDrugImages(drug) {
  if (!drug) return [];
  if (Array.isArray(drug.images) && drug.images.length) return drug.images;
  if (drug.image_url) {
    return [{
      url:         drug.image_url,
      is_real:     !!drug.image_is_real,
      source:      drug.image_source || null,
      source_url:  drug.image_source_url || null,
      license:     drug.image_license || null,
      attribution: drug.image_attribution || null,
    }];
  }
  return [];
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

// Overwrites the full images array (used for adding, deleting, and
// reordering) and keeps the legacy single-image fields pointed at
// images[0] so nothing else in the app needs to change.
export async function setDrugImages({ docId, images }) {
  await getAuthUser();
  const list = images || [];
  const first = list[0] || null;
  await updateDoc(doc(db, 'drugs', docId), {
    images: list.map(img => compact(img)),
    image_url:         first ? first.url : null,
    image_is_real:     first ? !!first.is_real : null,
    image_source:      first ? (first.source || null) : null,
    image_source_url:  first ? (first.source_url || null) : null,
    image_license:     first ? (first.license || null) : null,
    image_attribution: first ? (first.attribution || null) : null,
    last_updated:      serverTimestamp(),
  });
}

// Removes one image by index and re-saves the rest.
export async function deleteDrugImage({ docId, images, index }) {
  const next = (images || []).filter((_, i) => i !== index);
  await setDrugImages({ docId, images: next });
}

// Saves a real image found via findRealDrugImage() onto the drug's Firestore
// doc, appending it to the images array (along with source/license/
// attribution so the UI can display them) rather than replacing what's
// already there.
export async function saveFoundDrugImage({ docId, existingImages, found }) {
  const entry = {
    url:         found.imageUrl,
    is_real:     true,
    source:      found.source,
    source_url:  found.sourcePageUrl,
    license:     found.license,
    attribution: found.attribution,
  };
  await setDrugImages({ docId, images: [...(existingImages || []), entry] });
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

// Uploads a generated data: URL to Firebase Storage and appends the
// resulting download URL to the drug's images array. Pass a `slot` (image
// index) to overwrite/regenerate one particular picture instead of adding
// a new one.
export async function saveDrugImage({ docId, imageDataUrl, existingImages, slot }) {
  await getAuthUser();
  const list = existingImages || [];
  const isReplace = Number.isInteger(slot) && slot >= 0 && slot < list.length;
  const storageRef = ref(storage, `drug-images/${docId}-${isReplace ? slot : list.length}.png`);
  await uploadString(storageRef, imageDataUrl, 'data_url');
  const downloadUrl = await getDownloadURL(storageRef);

  const entry = { url: downloadUrl, is_real: false };
  const next = isReplace
    ? list.map((img, i) => (i === slot ? entry : img))
    : [...list, entry];
  await setDrugImages({ docId, images: next });

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
// image URL, or one just returned by uploadImageToImgChest) onto the drug's
// Firestore document — no re-upload to Firebase Storage needed since it's
// already hosted. Appends to the images array by default; pass a `slot`
// (image index) to replace one particular picture instead.
export async function saveDrugImageUrl({ docId, url, existingImages, slot }) {
  await getAuthUser();
  const trimmed = normalizeImageUrl((url || '').trim());
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('Please enter a valid image URL starting with http:// or https://');
  }

  const list = existingImages || [];
  const isReplace = Number.isInteger(slot) && slot >= 0 && slot < list.length;
  const entry = { url: trimmed, is_real: false };
  const next = isReplace
    ? list.map((img, i) => (i === slot ? entry : img))
    : [...list, entry];
  await setDrugImages({ docId, images: next });

  return trimmed;
}
