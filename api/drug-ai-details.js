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
  } else if (mode === 'pronunciation') {
    if (!genericName || typeof genericName !== 'string') {
      return new Response(JSON.stringify({ error: 'genericName is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide ONLY a simple phonetic pronunciation guide for the medication name below, the way a nurse would sound it out loud.

Drug: ${genericName}

Reply with nothing but the phonetic spelling itself — syllables separated by hyphens, with the stressed syllable in CAPITAL letters. For example, for "amoxicillin" reply exactly:
am-ox-i-SIL-in

No headers, no quotes, no explanation, no IPA symbols — just the hyphenated phonetic line.`;
  } else if (mode === 'condition') {
    const { conditionLabel, systemName } = body || {};
    if (!conditionLabel || typeof conditionLabel !== 'string') {
      return new Response(JSON.stringify({ error: 'conditionLabel is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Bias this strongly toward genuinely NEW medications rather than the
    // same familiar shortlist every time. The old wording ("include them
    // anyway") actively encouraged recycling already-known drugs — several
    // of which weren't even properly indicated for the condition but got
    // added anyway just because the AI mentioned the name and it matched
    // something already in the database. Now the known list is framed as
    // "already covered, go beyond this" instead of "feel free to repeat".
    const knownList = Array.isArray(knownDrugNames) && knownDrugNames.length
      ? `\nThese generic names are ALREADY in the app's database and, in most cases, already linked to this condition — do NOT spend the list repeating them: ${knownDrugNames.join(', ')}\nOnly re-mention one of the above if it is such a standard first-line agent that leaving it out would be a glaring clinical omission — and even then, keep that to a small minority of the list. The large majority of your answer should be medications NOT in that list: additional generics, newer agents, less commonly listed but still genuinely indicated options, and different brand-name/trade products available in Nigeria for generics not already covered above.\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The nurse is looking at the clinical condition "${conditionLabel}"${systemName ? ` (within the ${systemName} system)` : ''} and wants to discover MORE medications used to treat or manage it — genuinely new entries for the database, not a repeat of what's already there.
${knownList}
Search broadly, the way a nurse would when checking multiple references and pharmacy stock lists — not just the handful of textbook first-line names. Think through generic names AND the brand/trade-name products marketed in Nigeria for this condition (e.g. a locally common trade name can point you to a generic that textbooks under-emphasize). Every medication you list must be GENUINELY indicated for "${conditionLabel}" specifically — do not include a drug just because it's well-known or commonly prescribed for other conditions; if you are not confident it treats THIS condition, leave it out rather than guessing.

List the medications (generic names) indicated for "${conditionLabel}", grouped by drug class using ## markdown headers (e.g. "## ACE Inhibitors", "## Thiazide Diuretics", "## Beta-Blockers") — a condition is usually treated by several different drug classes, so use as many class headers as are actually relevant.

For each medication, use a bullet point starting with the **generic name in bold**, followed by a brief note: typical route (PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD), a common Nigerian brand/trade name in parentheses if you know one, its role specifically for "${conditionLabel}" (first-line/adjunct/second-line, etc.), and any notable distinguishing feature. Example format:
- **Lisinopril** (Zestril) — PO; first-line for hypertension and heart failure with reduced ejection fraction; avoid in pregnancy.

Aim for a thorough, genuinely comprehensive list (roughly 15-30 medications across the relevant classes) that goes beyond the obvious/commonly-cited names, so the nurse gets real breadth — not just the same short list every time. If "${conditionLabel}" is not a recognized clinical condition or you're not confident it's real, say so clearly instead of inventing medications.

This is reference material only, not a substitute for the current product monograph or clinical guidelines — do not fabricate specific dosing figures.`;
  } else if (mode === 'condition_insight') {
    // Powers the search-page "condition insight" card: a nurse searches an
    // indication/disease name (not a drug name) and gets a clinical primer
    // plus a drug list, in one streamed response. Reuses the same drug-list
    // instructions as 'condition' mode so parseAiDrugList can parse the tail
    // of this response exactly like it does for that mode — it just adds
    // three clinical sections in front.
    const { conditionLabel } = body || {};
    if (!conditionLabel || typeof conditionLabel !== 'string') {
      return new Response(JSON.stringify({ error: 'conditionLabel is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const knownList = Array.isArray(knownDrugNames) && knownDrugNames.length
      ? `\nThese generic names are ALREADY in the app's database — do NOT spend the list repeating them unless one is such a standard first-line agent that leaving it out would be a glaring omission: ${knownDrugNames.join(', ')}\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The nurse has searched "${conditionLabel}" as a clinical condition/indication and wants a quick clinical primer plus the medications used to treat or manage it.

If "${conditionLabel}" is not a recognized clinical condition or you are not confident it is real, respond with only a single line: "Not a recognized clinical condition." and nothing else. Otherwise, respond with exactly four sections, using these exact markdown headers, in this order:

## Overview
2-4 sentences: what the condition is, in plain but clinically accurate language.

## Etiology
The main causes and risk factors, as concise bullet points (lines starting with "- ").

## Pathophysiology
A short paragraph (3-6 sentences) explaining the underlying disease mechanism a nurse should understand.

## Medications
${knownList}
List the medications (generic names) indicated for "${conditionLabel}", grouped by drug class using ### markdown sub-headers (e.g. "### ACE Inhibitors", "### Thiazide Diuretics") — use as many class sub-headers as are actually relevant. For each medication, use a bullet point starting with the **generic name in bold**, followed by a brief note: typical route (PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD), a common Nigerian brand/trade name in parentheses if known, its role (first-line/adjunct/second-line), and any notable distinguishing feature. Example:
- **Lisinopril** (Zestril) — PO; first-line for hypertension; avoid in pregnancy.

Include both medications likely already covered in a standard drug reference AND newer or less commonly listed agents that are still genuinely indicated — aim for a thorough, comprehensive list (roughly 15-30 medications). Every medication listed must be GENUINELY indicated for "${conditionLabel}" specifically; if you are not confident it treats this condition, leave it out rather than guessing.

This is reference material only, not a substitute for current clinical guidelines — do not fabricate specific dosing figures, and do not add any text before "## Overview" or after the medication list.`;
  } else if (mode === 'condition_clinical_info') {
    // Powers the admin "Add Clinical Info" panel on SystemPage: a structured
    // teaching summary for one condition, stored once in Firestore and
    // reused thereafter (not regenerated on every page view). Deliberately
    // asks for a "Types" section first so "Medical Management" can key its
    // own sub-headers off the same type names when management genuinely
    // differs by type (e.g. Diabetes Mellitus Type 1 vs Type 2) — and falls
    // back to a single flat section when the condition has no meaningful
    // subtypes (e.g. Hypertension).
    const { conditionLabel, systemName } = body || {};
    if (!conditionLabel || typeof conditionLabel !== 'string') {
      return new Response(JSON.stringify({ error: 'conditionLabel is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    prompt = `You are assisting a licensed nurse and nurse educator using a clinical drug reference app in Nigeria. Provide a structured clinical teaching summary of the condition "${conditionLabel}"${systemName ? ` (within the ${systemName} system)` : ''}, suitable for nursing education and quick clinical reference.

Respond with exactly these sections, using these exact markdown headers, in this order. Do not add any other sections, preamble, or closing text.

## Introduction
2-4 sentences: a clear definition of the condition and its clinical significance.

## Types
If "${conditionLabel}" has clinically distinct types, stages, or classifications, list each as a bullet point starting with the **type name in bold**, followed by a brief distinguishing note — for example "- **Type 1 Diabetes Mellitus** — autoimmune beta-cell destruction, absolute insulin deficiency, usually childhood/young-adult onset." If it does NOT have clinically distinct types, write exactly this line and nothing else: "No clinically distinct types — managed as a single clinical entity."

## Organ System Involved
The primary organ(s) or body system(s) affected, 1-2 sentences.

## Etiology
The causes and risk factors, as concise bullet points (lines starting with "- ").

## Pathophysiology
A short paragraph (3-6 sentences) explaining the underlying disease mechanism a nurse should understand.

## Clinical Manifestation
The signs and symptoms, as concise bullet points. If types were listed above and their manifestations meaningfully differ, group these under "### <Type Name>" sub-headers matching the type names used above exactly; otherwise give a single flat bullet list.

## Diagnosis and Investigation
The relevant history/examination findings, laboratory tests, and imaging or other investigations used to diagnose and work this condition up, as concise bullet points.

## Medical Management
The medical (pharmacological and general, non-surgical) management approach. If "${conditionLabel}" has clinically distinct types listed under ## Types that are genuinely managed differently, use a "### <Type Name>" sub-header for EACH type — matching the type names used above exactly — followed by that type's specific management as bullet points. If there are no clinically distinct types, or all types share essentially the same management approach, give a single flat bullet-point management section instead of sub-headers.

Within each section, bold sub-labels using **double asterisks** where useful, and use bullet points (lines starting with "- ") for lists. Be precise, clinically accurate, and concise — this is educational/reference material only, not a substitute for current clinical guidelines. Do not fabricate specific numeric dosing; refer to drug classes or first-line agent names only, since detailed dosing lives in this app's separate drug records.`;
  } else if (mode === 'classify_condition') {
    // Given a condition label the nurse searched (with no known category),
    // picks which anatomical system it best belongs under, so it can be
    // filed into the existing taxonomy instead of sitting unfiled. Kept
    // deliberately tiny/cheap — one classification call, not a full lookup.
    const { conditionLabel, systemOptions } = body || {};
    if (!conditionLabel || typeof conditionLabel !== 'string') {
      return new Response(JSON.stringify({ error: 'conditionLabel is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!Array.isArray(systemOptions) || systemOptions.length === 0) {
      return new Response(JSON.stringify({ error: 'systemOptions is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const optionsList = systemOptions.map(s => `${s.id} (${s.name})`).join(', ');

    prompt = `You are filing the clinical condition "${conditionLabel}" into a drug reference app's body-system taxonomy. Choose the ONE best-fitting system id from this exact list: ${optionsList}

Reply with EXACTLY these three lines and nothing else:
System: <the chosen system id, exactly as given above>
Icon: <a single relevant emoji for this condition>
Keywords: <6-10 comma-separated lowercase keyword phrases that would appear in a drug's indications text if it treats this condition>`;
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
List medications (generic names) that genuinely belong under "${className}" or one of its recognized subclasses. The test for including a medication is its INDICATION: include it only if it is actually used to treat, prevent, or manage a condition that falls under "${className}" (or one of its subclasses) — not just because its name or pharmacological label superficially resembles the class name. A medication can be indicated for conditions in more than one drug class; if so, it is correct for it to appear here as long as one of its real indications belongs under "${className}", even if its primary/best-known use lies in a different class elsewhere in the formulary.

Group them by subclass using ## markdown headers where subclasses exist (e.g. "## Beta-1 Selective Beta-Blockers"), otherwise use a single "## ${className}" header.

For each medication, use a bullet point starting with the **generic name in bold**, followed by a brief note: the specific indication that justifies its inclusion in this class/subclass, typical route (PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD), and any notable distinguishing feature versus others in the same subclass. Example format:
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
      ? `\nThis medication has not yet been uploaded to the app's verified drug database — this is a live, on-demand lookup. "${genericName}" may be entered as a generic name OR a brand/trade name (including branded combination packs, e.g. "Prevpac" = lansoprazole + amoxicillin + clarithromycin triple therapy for H. pylori). Use Google Search to look this up before concluding anything — check international and Nigerian brand/trade name references, manufacturer product pages, and pharmacy/drug-index listings, since many brand names (including regionally-marketed ones) will not be in your training data. If it is a recognized brand name or combination pack, silently resolve it to its actual generic ingredient(s) and proceed with the full breakdown AS THAT COMBINATION — state the resolved generic name(s) in the Overview so the nurse knows what was matched. Only say the medication is not real/recognized (at the very top of your response, instead of inventing information) if, after searching, you are still genuinely not confident it corresponds to any real generic drug, brand name, or combination product — do not decline just because the input looks like a brand name or an unfamiliar spelling.\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.
${notInDatabaseNote}
Drug: ${genericName}
${brandNames ? `Known brand names: ${brandNames}` : ''}
${drugClass ? `Drug class: ${drugClass}` : ''}
${knownData ? `\nExisting reference data already shown to the nurse (do not simply repeat this — add depth, nuance, and anything missing):\n${knownData}` : ''}

Structure your response with these sections, using clear markdown headers (##):
- Overview (concise summary of what the drug is and its place in therapy)
- Pronunciation (simple phonetic spelling, syllables separated by hyphens with the stressed syllable in CAPITALS — e.g. "am-ox-i-SIL-in" — no IPA symbols)
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
            generationConfig: { maxOutputTokens: mode === 'classify_condition' ? 200 : mode === 'condition_insight' ? 3800 : mode === 'condition_clinical_info' ? 3500 : (mode === 'class' || mode === 'condition' || mode === 'system_conditions') ? 3000 : (mode === 'strength' || mode === 'pronunciation') ? 150 : 2000 },
            // Google Search grounding — lets the model look up brand/trade
            // names (especially Nigerian-market ones) that aren't in its
            // training data instead of guessing or declaring "not found".
            // Supported on gemini-2.5-flash / flash-lite / pro.
            tools: [{ google_search: {} }],
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
