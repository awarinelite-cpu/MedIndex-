// Vercel Edge Function — streams the AI response back as plain text so the
// UI can render it progressively instead of waiting for the full completion.
// Calls the Gemini API server-side so the API key is never exposed to the client.
// Requires a GEMINI_API_KEY environment variable set in the Vercel project settings.
// Optionally set GEMINI_MODEL to override the default (e.g. "gemini-2.5-flash"
// for higher quality, vs the default "gemini-2.5-flash-lite" for lowest cost).

// Pinned to iad1 (US East) rather than left to auto-select the region nearest
// the client: Gemini's free tier rejects requests from some regions (notably
// EU-adjacent ones) with "User location is not supported for the API use",
// and Vercel Edge Functions otherwise execute nearest the connecting client —
// which for Nigeria-origin traffic can land in a blocked region.
export const config = { runtime: 'edge', regions: ['iad1'] };

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

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

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    mode = 'drug',
    genericName, brandNames, drugClass, knownData, notInDatabase,
    className, knownDrugNames,
  } = body || {};

  let prompt;

  if (mode === 'class') {
    if (!className || typeof className !== 'string') {
      return new Response(JSON.stringify({ error: 'className is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const knownList = Array.isArray(knownDrugNames) && knownDrugNames.length
      ? `\nMedications already in the app's database for this class (do not repeat these — focus on other medications in the same class and its subclasses):\n${knownDrugNames.join(', ')}\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The nurse is browsing the drug class "${className}" and wants a broader list of medications within this class and its subclasses beyond what's currently in the app's database.
${knownList}
List commonly used medications (generic names) that belong to the drug class "${className}" or its recognized subclasses. Group them by subclass using ## markdown headers where subclasses exist (e.g. "## Beta-1 Selective Beta-Blockers"), otherwise use a single "## ${className}" header.

For each medication, use a bullet point starting with the **generic name in bold**, followed by a brief note: primary indication, typical route (PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD), and any notable distinguishing feature versus others in the same subclass. Example format:
- **Metoprolol** — Beta-1 selective; PO/IV; hypertension, angina, arrhythmia; less bronchospasm risk than non-selective agents.

Aim for a reasonably thorough list (roughly 10-25 medications depending on how broad the class is) so the nurse gets real coverage of the class, not just one or two examples. If "${className}" is not a recognized drug class or you're not confident it's real, say so clearly instead of inventing medications.

This is reference material only, not a substitute for the current product monograph — do not fabricate specific dosing figures.`;
  } else {
    if (!genericName || typeof genericName !== 'string') {
      return new Response(JSON.stringify({ error: 'genericName is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const notInDatabaseNote = notInDatabase
      ? `\nThis medication has not yet been uploaded to the app's verified drug database — this is a live, on-demand lookup. If "${genericName}" is not a real or recognized medication (e.g. it's a typo, a non-drug term, or you are not confident it exists), say so clearly at the very top of your response instead of inventing information. Only proceed with the full structured breakdown if you are reasonably confident this is a genuine medication.\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.
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
  }

  let geminiRes;
  let attempts = 0;
  const MAX_RETRIES = 3;

  while (attempts <= MAX_RETRIES) {
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: mode === 'class' ? 3000 : 2000 },
          }),
        }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Unexpected server error.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (geminiRes.status === 429 && attempts < MAX_RETRIES) {
      // Parse the retry delay Gemini tells us to wait
      let waitMs = 60000; // default 60s
      try {
        const errBody = await geminiRes.clone().json();
        const retryInfo = errBody?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
          const secs = parseFloat(retryInfo.retryDelay.replace('s', ''));
          if (!isNaN(secs)) waitMs = Math.ceil(secs * 1000) + 500;
        }
      } catch {}
      await new Promise(r => setTimeout(r, waitMs));
      attempts++;
      continue;
    }

    break;
  }

  if (!geminiRes.ok || !geminiRes.body) {
    let detail = '';
    try { detail = await geminiRes.text(); } catch {}
    console.error('Gemini API error:', geminiRes.status, detail);
    const isQuota = geminiRes.status === 429;
    return new Response(JSON.stringify({
      error: isQuota
        ? 'AI quota exceeded. The free tier allows 20 requests/day. Upgrade your Gemini API key at aistudio.google.com, or try again tomorrow.'
        : 'Failed to reach the AI service.',
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse the Gemini SSE stream and re-emit just the text deltas as plain text.
  // Each SSE "data:" line is a full GenerateContentResponse JSON object; the
  // text lives at candidates[0].content.parts[*].text.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = geminiRes.body.getReader();

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
              const parts = evt?.candidates?.[0]?.content?.parts;
              if (Array.isArray(parts)) {
                for (const part of parts) {
                  if (typeof part.text === 'string') {
                    controller.enqueue(encoder.encode(part.text));
                  }
                }
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
