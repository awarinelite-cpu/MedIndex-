// api/ocr-drug-name.js — reads the drug name printed on a photographed
// package/label, for the Bulk Image Upload "Photos (auto-match)" flow.
//
// Supports three vision-capable providers (Claude, Gemini, ChatGPT) so it
// can follow whichever provider the admin has selected in Settings
// (see src/context/AiProviderContext.js) instead of being pinned to one.
// DeepSeek and Kimi are NOT included — the models this app has them
// configured with (deepseek-chat/reasoner, moonshot-v1-*) don't accept
// image input, so the client falls back to Gemini for those two.
//
// NODE.JS SERVERLESS FUNCTION (classic req/res), same convention as
// api/drug-ai-claude.js and api/imgchest-upload.js. Non-streaming — this
// only needs a single short JSON reply, not a long-form generation.
//
// Requires the matching env var for whichever provider is requested:
// ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.

const MAX_BYTES = 8 * 1024 * 1024;

const PROMPT = `You are looking at a photo of a pharmaceutical drug package, box, blister strip, or label.
Identify the drug name printed on it. Prefer the generic/active-ingredient name if it is visible; otherwise use the brand name shown.
If the photo does not clearly show a drug name, respond with null instead of guessing.
Respond with ONLY a raw JSON object on a single line, no markdown fences, no explanation: {"name": "<drug name or null>"}`;

function parseName(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return (parsed?.name && parsed.name !== 'null') ? String(parsed.name).trim() : null;
  } catch {
    if (text.length < 80 && !/\{|\}/.test(text)) return text.trim();
    return null;
  }
}

async function ocrWithClaude(mediaType, base64) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw { status: 500, message: 'Server is not configured with an ANTHROPIC_API_KEY.' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status === 429 ? 429 : 502, message: data?.error?.message || `Claude API error (${res.status}).` };

  const text = (data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  return parseName(text);
}

async function ocrWithGemini(mediaType, base64) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw { status: 500, message: 'Server is not configured with a GEMINI_API_KEY.' };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mediaType, data: base64 } }] }],
        generationConfig: { maxOutputTokens: 200 },
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status === 429 ? 429 : 502, message: data?.error?.message || `Gemini API error (${res.status}).` };

  const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  return parseName(text);
}

async function ocrWithOpenAI(mediaType, base64) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw { status: 500, message: 'Server is not configured with an OPENAI_API_KEY.' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
        ],
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status === 429 ? 429 : 502, message: data?.error?.message || `OpenAI API error (${res.status}).` };

  const text = data?.choices?.[0]?.message?.content || '';
  return parseName(text);
}

const HANDLERS = { claude: ocrWithClaude, gemini: ocrWithGemini, openai: ocrWithOpenAI };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { imageDataUrl, provider = 'gemini' } = req.body || {};
  const handlerFn = HANDLERS[provider];
  if (!handlerFn) {
    res.status(400).json({ error: `Provider "${provider}" does not support photo OCR. Use claude, gemini, or openai.` });
    return;
  }

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

  try {
    const name = await handlerFn(mediaType, base64);
    res.status(200).json({ name: name || null, provider });
  } catch (err) {
    console.error(`OCR drug name error (${provider}):`, err);
    res.status(err.status || 500).json({ error: err.message || 'Unexpected error reading the image.' });
  }
}
