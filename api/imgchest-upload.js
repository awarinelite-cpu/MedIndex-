// api/imgchest-upload.js — uploads an admin-picked photo to ImgChest and
// returns the direct, hotlink-able image URL.
//
// NODE.JS SERVERLESS FUNCTION (classic req/res), matching the pattern used
// by api/drug-ai-claude.js elsewhere in this project — not Edge.
//
// Accepts EITHER:
//   - imageDataUrl: a base64 data: URL, sent when the admin picked a file
//     from their device. We decode it here and re-encode it as
//     multipart/form-data ourselves when calling ImgChest, since that's
//     what their API requires.
//   - sourceUrl: an external image URL (e.g. copied from a website). We
//     fetch it server-side first — this avoids CORS issues a direct
//     browser fetch would hit, and keeps the ImgChest token off the
//     client — then upload the fetched bytes the same way.
//
// Requires IMGCHEST_API_KEY in Vercel environment variables (a personal
// access token from the account's Security tab — see
// https://imgchest.com/docs/api/1.0/general/overview).

const MAX_BYTES = 8 * 1024 * 1024; // stay under Vercel's body limit + ImgChest's own cap
const FETCH_TIMEOUT_MS = 15000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.IMGCHEST_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is not configured with an IMGCHEST_API_KEY.' });
    return;
  }

  try {
    const { imageDataUrl, sourceUrl, filename } = req.body || {};

    let mimeType, buffer, safeName;

    if (sourceUrl && typeof sourceUrl === 'string') {
      let parsed;
      try {
        parsed = new URL(sourceUrl.trim());
      } catch {
        res.status(400).json({ error: 'That doesn\u2019t look like a valid URL.' });
        return;
      }
      if (!/^https?:$/.test(parsed.protocol)) {
        res.status(400).json({ error: 'Only http:// or https:// URLs are supported.' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let fetchRes;
      try {
        fetchRes = await fetch(parsed.toString(), {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MedIndexImageFetcher/1.0)' },
        });
      } catch (err) {
        res.status(400).json({ error: err.name === 'AbortError' ? 'Timed out fetching that image URL.' : 'Could not fetch that image URL.' });
        return;
      } finally {
        clearTimeout(timeout);
      }

      if (!fetchRes.ok) {
        res.status(400).json({ error: `Could not fetch that image URL (${fetchRes.status}).` });
        return;
      }

      const contentType = fetchRes.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        res.status(400).json({ error: 'That URL did not point to an image.' });
        return;
      }
      mimeType = contentType.split(';')[0].trim();

      const arrayBuf = await fetchRes.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
      if (buffer.length > MAX_BYTES) {
        res.status(400).json({ error: 'That image is too large. Please use one under 8MB.' });
        return;
      }

      const extFromMime = mimeType.split('/')[1] || 'jpg';
      const pathName = parsed.pathname.split('/').pop();
      safeName = (pathName && pathName.includes('.')) ? pathName : `upload.${extFromMime}`;
    } else if (imageDataUrl && typeof imageDataUrl === 'string') {
      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'imageDataUrl must be a base64 data: URL for an image.' });
        return;
      }
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');

      if (buffer.length > MAX_BYTES) {
        res.status(400).json({ error: 'Image is too large. Please use a photo under 8MB.' });
        return;
      }

      const extFromMime = mimeType.split('/')[1] || 'jpg';
      safeName = (filename && String(filename).trim()) || `upload.${extFromMime}`;
    } else {
      res.status(400).json({ error: 'Either imageDataUrl or sourceUrl is required.' });
      return;
    }

    const form = new FormData();
    form.append('images[]', new Blob([buffer], { type: mimeType }), safeName);
    form.append('privacy', 'hidden'); // unlisted — not shown on ImgChest's public feed

    const uploadRes = await fetch('https://api.imgchest.com/v1/post', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const data = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      res.status(uploadRes.status).json({ error: data?.message || data?.error || 'ImgChest upload failed.' });
      return;
    }

    const link = data?.data?.images?.[0]?.link;
    if (!link) {
      res.status(502).json({ error: 'ImgChest did not return an image link.' });
      return;
    }

    res.status(200).json({ url: link });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected error uploading image.' });
  }
}
