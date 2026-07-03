// Vercel Edge Function — generates an illustrative drug image using Gemini's
// image-generation model ("Nano Banana" / gemini-2.5-flash-image). Uses the
// same GEMINI_API_KEY already configured for text generation — no separate
// credential needed.
//
// This deliberately generates an AI illustration rather than fetching a real
// product photo from the web: real packaging photography belongs to the
// manufacturer and pulling it automatically into a public-facing app raises
// copyright/trademark problems we can't verify per-drug. An AI illustration
// sidesteps that entirely, at the cost of not being the literal real-world
// packaging — the UI must make that distinction clear to whoever views it.

export const config = { runtime: 'edge', regions: ['iad1'] };

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured with a GEMINI_API_KEY.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { genericName, drugClass, strength } = body || {};
  if (!genericName || typeof genericName !== 'string') {
    return new Response(JSON.stringify({ error: 'genericName is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = `Create a clean, professional pharmaceutical reference illustration representing the medication "${genericName}"${drugClass ? ` (${drugClass})` : ''}${strength ? `, commonly available as ${strength.split('\n')[0]}` : ''}.

Style: flat-lay product illustration on a plain white or very light neutral background, soft studio lighting, the kind of generic packaging art used in clinical reference apps and pharmacy education materials — a simple labeled box or blister pack and/or tablet/capsule/vial, whichever best fits how this medication is typically dispensed.

Strict requirements:
- Do NOT depict any real, existing brand's exact packaging design, logo, trademark, or trade dress. This must be an original, generic-looking illustration, not a recreation of a specific manufacturer's actual product photo.
- Any text/label rendered on the packaging in the image should show only the generic drug name in plain type — no invented brand names presented as if real, no fake NAFDAC or registration numbers, no manufacturer logos.
- No people, no hands, no clinical setting — just the product illustration itself, centered, well-lit, on a plain background suitable for a reference app.`;

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!geminiRes.ok) {
    let detail = '';
    try { detail = await geminiRes.text(); } catch {}
    console.error('Gemini image API error:', geminiRes.status, detail);
    const isQuota = geminiRes.status === 429;
    return new Response(JSON.stringify({
      error: isQuota
        ? 'AI image quota exceeded. Try again later.'
        : 'Failed to generate an image.',
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let data;
  try {
    data = await geminiRes.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Malformed response from AI service.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.data);

  if (!imagePart) {
    return new Response(JSON.stringify({ error: 'AI did not return an image. Try regenerating.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  const dataUrl  = `data:${mimeType};base64,${imagePart.inlineData.data}`;

  return new Response(JSON.stringify({ imageDataUrl: dataUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
