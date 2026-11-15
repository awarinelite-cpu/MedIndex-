// src/utils/loadExportImages.js
//
// Loads a condition's pictures for the Word / PDF exports. Each picture is
// redrawn onto a canvas, which (a) turns webp/gif/etc. into a JPEG both
// docx and jsPDF accept, (b) caps the size so the shared file stays small,
// and (c) never throws — a picture that can't be loaded (CORS, offline,
// dead link) is skipped so the export itself still works.

const MAX_DIM = 1400;

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

async function loadOne(url) {
  let img;
  try {
    img = await loadImg(url);
  } catch {
    // Retry through fetch → blob URL (some hosts only answer CORS fetches).
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const objUrl = URL.createObjectURL(await res.blob());
    try { img = await loadImg(objUrl); } finally { setTimeout(() => URL.revokeObjectURL(objUrl), 5000); }
  }

  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) throw new Error('empty image');
  const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88); // throws if canvas is tainted
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  return { dataUrl, data, width, height };
}

// images: [{ url }] (or plain url strings). Returns the ones that loaded,
// in order: [{ dataUrl, data (Uint8Array JPEG), width, height }].
export async function loadExportImages(images) {
  const urls = (Array.isArray(images) ? images : [])
    .map(i => (typeof i === 'string' ? i : i?.url))
    .filter(Boolean);
  const settled = await Promise.all(urls.map(u => loadOne(u).catch(() => null)));
  return settled.filter(Boolean);
}
