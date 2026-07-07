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
    sectionHeaders, sectionLabel,
  } = body || {};

  let prompt;

  if (mode === 'section') {
    // Generates ONLY the requested sections for one drug, using the exact
    // ## header names the client's parseAiDrugDetail understands, so the
    // result can be parsed and saved field-by-field into the drug record.
    if (!genericName || typeof genericName !== 'string') {
      return new Response(JSON.stringify({ error: 'genericName is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!Array.isArray(sectionHeaders) || sectionHeaders.length === 0) {
      return new Response(JSON.stringify({ error: 'sectionHeaders is required for section mode.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headerList = sectionHeaders.slice(0, 12).map(h => `## ${String(h).slice(0, 60)}`).join('\n');

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The app already has a record for the medication below, but its ${sectionLabel || 'requested'} information is missing. Provide ONLY that information.

Drug: ${genericName}
${drugClass ? `Drug class: ${drugClass}` : ''}

Write ONLY the following sections, using these exact markdown headers, in this order:
${headerList}

Do not add any other sections, preamble, or closing text — start directly with the first header. Within each section, bold sub-labels using **double asterisks** (e.g. "**Renal impairment:** ...") and use bullet points (lines starting with "- ") for lists such as contraindications, adverse effects, or interactions. If a section is not well established for this drug, write "Not well established / consult current prescribing information" rather than omitting it.

Be precise, clinically accurate, and concise. Do not fabricate specific numeric dosing if you are not confident — note where prescribing information should be consulted instead. This is reference material only, not a substitute for the current product monograph.`;
  } else if (mode === 'strength') {
    if (!genericName || typeof genericName !== 'string') {
      return new Response(JSON.stringify({ error: 'genericName is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. For the medication below, state ONLY the formulation strength(s) it usually comes in — the product strength, not the dosing regimen.

Drug: ${genericName}
${drugClass ? `Drug class: ${drugClass}` : ''}

Reply with nothing but one line per formulation, in the format "Form: strength" — for example:
Tab: 500mg
IV: 500mg/100mL
Susp: 125mg/5mL

List every commonly available formulation/route. Do not add headers, bullets, explanations, or any other text — only the strength lines themselves. If you are not confident of exact figures, give the most commonly cited strength(s) and do not fabricate implausible values.`;
  } else if (mode === 'condition') {
    const { conditionLabel, systemName } = body || {};
    if (!conditionLabel || typeof conditionLabel !== 'string') {
      return new Response(JSON.stringify({ error: 'conditionLabel is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // We intentionally DO NOT tell the AI to exclude drugs already in the
    // database. Existing drugs are still used for this condition and must
    // appear in the list so they get linked to it — the client reuses their
    // existing information (no regeneration) rather than generating anew.
    // We still pass the known names as a hint so the AI prefers the exact
    // same generic-name spelling, which lets the client match them reliably.
    const knownList = Array.isArray(knownDrugNames) && knownDrugNames.length
      ? `\nSome of these medications may already be in the app's database; include them anyway if they are used for this condition. When a medication matches one of the following, use this exact spelling of its generic name so it can be recognised: ${knownDrugNames.join(', ')}\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The nurse is looking at the clinical condition "${conditionLabel}"${systemName ? ` (within the ${systemName} system)` : ''} and wants the full list of medications used to treat or manage it.
${knownList}
List the commonly used medications (generic names) indicated for "${conditionLabel}" — the COMPLETE clinical picture, including well-known first-line agents even if they might already be in the database. Group them by drug class using ## markdown headers (e.g. "## ACE Inhibitors", "## Thiazide Diuretics", "## Beta-Blockers") — a condition is usually treated by several different drug classes, so use as many class headers as are actually relevant.

For each medication, use a bullet point starting with the **generic name in bold**, followed by a brief note: typical route (PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD), its role specifically for "${conditionLabel}" (first-line/adjunct/second-line, etc.), and any notable distinguishing feature. Example format:
- **Lisinopril** — PO; first-line for hypertension and heart failure with reduced ejection fraction; avoid in pregnancy.

Aim for a reasonably thorough list (roughly 10-25 medications across the relevant classes) so the nurse gets real coverage of how this condition is managed, not just one or two examples. If "${conditionLabel}" is not a recognized clinical condition or you're not confident it's real, say so clearly instead of inventing medications.

This is reference material only, not a substitute for the current product monograph or clinical guidelines — do not fabricate specific dosing figures.`;
  } else if (mode === 'system_conditions') {
    const { systemName: sysName, existingLabels } = body || {};
    if (!sysName || typeof sysName !== 'string') {
      return new Response(JSON.stringify({ error: 'systemName is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const knownList = Array.isArray(existingLabels) && existingLabels.length
      ? `\nConditions already covered for this system (do not repeat these or close synonyms of them):\n${existingLabels.join(', ')}\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The app organizes medications by body system, and within each system, by the specific clinical conditions treated there. The nurse is looking at the "${sysName}" system and wants more condition categories added to it beyond what's already there.
${knownList}
Suggest additional clinically distinct conditions commonly managed within the "${sysName}" system that are NOT already covered. For each one, output exactly this 3-line block, with a blank line between blocks:

### <Condition Label>
Icon: <single relevant emoji>
Keywords: <6-10 comma-separated lowercase keyword phrases that would appear in a drug's indications/overview text if that drug treats this condition — think of terms a clinical reference would actually use, e.g. for "Migraine" you might use: migraine, triptan, cluster headache, preventive migraine>

Suggest around 5-10 additional conditions if the system reasonably supports that many being clinically distinct; suggest fewer if the system is narrow. Do not invent an implausible condition just to hit a number, and do not duplicate or closely overlap with the conditions already covered above. Output nothing except the blocks themselves — no preamble or closing text.`;
  } else if (mode === 'class') {
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
      ? `\nThis medication has not yet been uploaded to the app's verified drug database — this is a live, on-demand lookup. "${genericName}" may be entered as a generic name OR a brand/trade name (including branded combination packs, e.g. "Prevpac" = lansoprazole + amoxicillin + clarithromycin triple therapy for H. pylori). If it is a recognized brand name or combination pack, silently resolve it to its actual generic ingredient(s) and proceed with the full breakdown AS THAT COMBINATION — state the resolved generic name(s) in the Overview so the nurse knows what was matched. Only say the medication is not real/recognized (at the very top of your response, instead of inventing information) if you are genuinely not confident it corresponds to any real generic drug, brand name, or combination product — do not decline just because the input looks like a brand name or an unfamiliar spelling.\n`
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
- Strength (the formulation strength(s) each dosage form usually comes in — e.g. "Tab: 500mg", "IV: 500mg/100mL", "Susp: 125mg/5mL" — list each route/form on its own line if there's more than one; this is about product strength, not the dosing regimen)
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
            generationConfig: { maxOutputTokens: (mode === 'class' || mode === 'condition' || mode === 'system_conditions') ? 3000 : mode === 'strength' ? 150 : 2000 },
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
