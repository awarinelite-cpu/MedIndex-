// api/ocr-drug-name.js — reads the drug name printed on a photographed
// package/label using Claude's vision input, for the Bulk Image Upload
// "Photos (auto-match)" flow.
//
// NODE.JS SERVERLESS FUNCTION (classic req/res), same convention as
// api/drug-ai-claude.js and api/imgchest-upload.js. Non-streaming — this
// only needs a single short JSON reply, not a long-form generation.
//
// Requires ANTHROPIC_API_KEY in Vercel environment variables.

const MAX_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' });
    return;
  }

  const { imageDataUrl } = req.body || {};
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    res.status(400).json({ error: 'imageDataUrl is required.' });
    return;
  }

  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'imageDataUrl must be a base64 data: URL for an image.' });
    return;
  }
  const mediaType = match[1];
  const base64 = match[2];
  if (Buffer.byteLength(base64, 'base64') > MAX_BYTES) {
    res.status(400).json({ error: 'Image is too large. Please use a photo under 8MB.' });
    return;
  }

  const prompt = `You are looking at a photo of a pharmaceutical drug package, box, blister strip, or label.
Identify the drug name printed on it. Prefer the generic/active-ingredient name if it is visible; otherwise use the brand name shown.
If the photo does not clearly show a drug name, respond with null instead of guessing.
Respond with ONLY a raw JSON object on a single line, no markdown fences, no explanation: {"name": "<drug name or null>"}`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await claudeRes.json().catch(() => ({}));
    if (!claudeRes.ok) {
      const detail = data?.error?.message || `Claude API error (${claudeRes.status}).`;
      res.status(claudeRes.status === 429 ? 429 : 502).json({ error: detail });
      return;
    }

    const text = (data?.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    let name = null;
    try {
      const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      name = (parsed?.name && parsed.name !== 'null') ? String(parsed.name).trim() : null;
    } catch {
      // Model didn't return clean JSON — fall back to treating the raw
      // text as the name if it looks short and plausible, else give up.
      if (text && text.length < 80 && !/\{|\}/.test(text)) name = text;
    }

    res.status(200).json({ name: name || null });
  } catch (err) {
    console.error('OCR drug name error:', err);
    res.status(500).json({ error: err.message || 'Unexpected error reading the image.' });
  }
}
