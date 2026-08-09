// api/imgchest-upload.js — uploads an admin-picked photo to ImgChest and
// returns the direct, hotlink-able image URL.
//
// NODE.JS SERVERLESS FUNCTION (classic req/res), matching the pattern used
// by api/drug-ai-claude.js elsewhere in this project — not Edge.
//
// The browser sends the image as a base64 data URL in a JSON body (rather
// than multipart/form-data) so we don't need a multipart body parser on
// this end. We decode it here and re-encode it as multipart/form-data
// ourselves when calling ImgChest, since that's what their API requires.
//
// Requires IMGCHEST_API_KEY in Vercel environment variables (a personal
// access token from the account's Security tab — see
// https://imgchest.com/docs/api/1.0/general/overview).

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
    const { imageDataUrl, filename } = req.body || {};
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      res.status(400).json({ error: 'imageDataUrl is required.' });
      return;
    }

    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'imageDataUrl must be a base64 data: URL for an image.' });
      return;
    }
    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // 8MB cap to stay well under Vercel's request-body limit and ImgChest's
    // own per-file limit.
    const MAX_BYTES = 8 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      res.status(400).json({ error: 'Image is too large. Please use a photo under 8MB.' });
      return;
    }

    const extFromMime = mimeType.split('/')[1] || 'jpg';
    const safeName = (filename && String(filename).trim()) || `upload.${extFromMime}`;

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
