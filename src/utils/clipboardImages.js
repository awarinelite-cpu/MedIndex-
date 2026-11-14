// Helpers for pulling EVERY image off the clipboard, not just the first.

const keyOf = (b) => `${b.size}-${b.type}-${b.lastModified || 0}`;

// For a paste event: prefer clipboardData.files (phones expose every copied
// photo there), fall back to clipboardData.items. De-duplicated.
export function imagesFromPasteEvent(e) {
  const dt = e.clipboardData;
  if (!dt) return [];
  const out = [];
  const seen = new Set();
  const add = (f) => {
    if (!f || !f.type?.startsWith('image/')) return;
    const k = keyOf(f);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  };
  Array.from(dt.files || []).forEach(add);
  if (out.length === 0) {
    for (const item of Array.from(dt.items || [])) {
      if (item.kind === 'file') add(item.getAsFile());
    }
  }
  return out;
}

// For the Paste button (Async Clipboard API): every clipboard item that
// holds an image, one image per item (an item can list the same picture in
// several formats, so only the first image type is taken).
export async function imagesFromClipboardApi() {
  if (!navigator.clipboard?.read) {
    throw new Error('Clipboard paste isn’t supported in this browser. Use Upload Photo(s) instead.');
  }
  const items = await navigator.clipboard.read();
  const blobs = [];
  for (const item of items) {
    const type = item.types.find(t => t.startsWith('image/'));
    if (type) blobs.push(await item.getType(type));
  }
  return blobs;
}

export const ONE_PICTURE_NOTE =
  'Only 1 picture was on your clipboard — most phones keep just the last copied picture. ' +
  'To add several at once, use Upload Photo(s) or the “Paste several” box below (long-press → Paste).';
