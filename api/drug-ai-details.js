// Vercel Edge Function — streams the AI response back as plain text so the
// UI can render it progressively instead of waiting for the full completion.
// Calls the Anthropic API server-side so the API key is never exposed to the client.
// Requires an ANTHROPIC_API_KEY environment variable set in the Vercel project settings.

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' }), {
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

  const { genericName, brandNames, drugClass, knownData, notInDatabase } = body || {};

  if (!genericName || typeof genericName !== 'string') {
    return new Response(JSON.stringify({ error: 'genericName is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const notInDatabaseNote = notInDatabase
    ? `\nThis medication has not yet been uploaded to the app's verified drug database — this is a live, on-demand lookup. If "${genericName}" is not a real or recognized medication (e.g. it's a typo, a non-drug term, or you are not confident it exists), say so clearly at the very top of your response instead of inventing information. Only proceed with the full structured breakdown if you are reasonably confident this is a genuine medication.\n`
    : '';

  const prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.
${notInDatabaseNote}
Drug: ${genericName}
${brandNames ? `Known brand names: ${brandNames}` : ''}
${drugClass ? `Drug class: ${drugClass}` : ''}
${knownData ? `\nExisting reference data already shown to the nurse (do not simply repeat this — add depth, nuance, and anything missing):\n${knownData}` : ''}

Structure your response with these sections, using clear markdown headers (##):
- Overview (concise summary of what the drug is and its place in therapy)
- Drug Class & Subclass
- Indications (primary approved uses)
- Therapeutic Note (clinically useful context: place in therapy, comparison to alternatives, key caveats)
- Mechanism of Action & Pharmacology
- Pharmacokinetics (absorption, distribution, metabolism, elimination, half-life)
- Adult Dose (typical dosing, frequency, route(s) — PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD as applicable)
- Child Dose (pediatric dosing where established; note if not recommended in children)
- Renal Dose (adjustment for renal impairment)
- Administration (practical administration instructions — timing with food, reconstitution, infusion rate, etc.)
- NSTG Recommendations (Nigeria Standard Treatment Guidelines context if known; otherwise general standard-of-care guidance)
- Contraindications
- Precautions
- Pregnancy & Lactation
- Interaction (important drug interactions, mechanism-level detail)
- Adverse Effect
- Advice to Patients (patient counseling points)
- Nursing Action (nursing-specific monitoring and administration responsibilities)
- Pharmacovigilance (notable safety signals, black box warnings, reporting considerations)
- Product Description (formulation/appearance if commonly known)
- Storage Recommendations
- Pack Size & Price (general Nigerian market context if known; otherwise note this varies and should be verified locally)
- Prescription Status & NAFDAC Note (OTC / Prescription / Controlled; state that the NAFDAC registration number must be verified against the product label — never invent one)

Write every section listed above, even briefly — if a section is not well established for this drug, write "Not well established / consult current prescribing information" rather than omitting it, so the response fully mirrors this reference schema.

Within each section, bold any sub-labels using **double asterisks** (e.g. "**Absorption:** ...", "**Renal impairment:** ...") so a nurse can scan the section quickly. Use bullet points (starting each line with "- ") for lists of items like contraindications, adverse effects, or interactions.

Be precise, clinically accurate, and concise within each section. Do not fabricate specific numeric dosing if you are not confident — note where prescribing information should be consulted instead. This is reference material only, not a substitute for the current product monograph.`;

  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!anthropicRes.ok || !anthropicRes.body) {
    let detail = '';
    try { detail = await anthropicRes.text(); } catch {}
    console.error('Anthropic API error:', anthropicRes.status, detail);
    return new Response(JSON.stringify({ error: 'Failed to reach the AI service.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse the Anthropic SSE stream and re-emit just the text deltas as plain text.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = anthropicRes.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const evt = JSON.parse(dataStr);
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(evt.delta.text));
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } catch (err) {
        console.error('Stream read error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
