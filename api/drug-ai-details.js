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

import { resolveModel } from './_lib/resolveModel.js';
import { withCors } from './_lib/cors.js';
import { fetchExternalDrugContext } from './_lib/externalDrugSources.js';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const ALLOWED_MODELS = new Set(['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']);

async function coreHandler(req) {
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

  const {
    mode = 'drug',
    genericName, brandNames, drugClass, knownData, notInDatabase,
    className, parentClassName, knownDrugNames,
    sectionHeaders, sectionLabel,
  } = body || {};

  // clinical_plan is pinned to DEFAULT_MODEL regardless of whatever the
  // admin panel has geminiModel set to for MedIndex's own reference
  // features, and skips the Firestore round-trip resolveModel() would
  // otherwise make. This mode is shared with NACON-EMR's patient-safety-
  // facing AI Drug Insight, which originally always ran on a hardcoded
  // gemini-2.5-flash-lite before this endpoint became the shared engine —
  // letting it silently inherit whatever model an admin picks for
  // unrelated MedIndex browsing features would change clinical-suggestion
  // behavior without anyone deciding that on purpose.
  const model = mode === 'clinical_plan'
    ? DEFAULT_MODEL
    : await resolveModel({
        field: 'geminiModel',
        allowed: ALLOWED_MODELS,
        envVar: 'GEMINI_MODEL',
        fallback: DEFAULT_MODEL,
      });

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
  } else if (mode === 'brands') {
    if (!genericName || typeof genericName !== 'string') {
      return new Response(JSON.stringify({ error: 'genericName is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. List the well-known trade/brand names this medication is sold under.

Drug (generic name): ${genericName}
${drugClass ? `Drug class: ${drugClass}` : ''}

Reply with nothing but a comma-separated list of brand names, prioritizing brands available in Nigeria or widely known internationally — for example:
Panadol, Calpol, Tylenol

No headers, no numbering, no explanation, no bullet points — just the comma-separated brand names. If you are not confident of any real brand name for this drug, reply with exactly: None known`;
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

Aim for a focused, high-value list of roughly 5-10 medications across the relevant classes — the most clinically important/commonly used ones a nurse would actually reach for, not an exhaustive catalog. If "${conditionLabel}" is not a recognized clinical condition or you're not confident it's real, say so clearly instead of inventing medications.

This is reference material only, not a substitute for the current product monograph or clinical guidelines — do not fabricate specific dosing figures.

Output nothing except the ## headers and bullet points themselves — no introductory sentence, no explanation of your reasoning, and no closing summary. Begin your reply immediately with the first "## " header. If there is genuinely nothing new to add beyond what's already covered, reply with a single line "No additional medications found." and nothing else — do not explain why.`;
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

Include both medications likely already covered in a standard drug reference AND newer or less commonly listed agents that are still genuinely indicated — aim for a focused, high-value list of roughly 5-10 medications, the ones a nurse would actually reach for first. Every medication listed must be GENUINELY indicated for "${conditionLabel}" specifically; if you are not confident it treats this condition, leave it out rather than guessing.

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

## Surgical Management
If "${conditionLabel}" is ever managed surgically (even only in specific cases, complications, or refractory disease), describe the surgical approach(es) as concise bullet points, noting when surgery vs medical management is chosen. If surgery is NOT a recognized part of managing this condition, write exactly this line and nothing else: "Surgical management is not typically indicated for this condition — managed medically."

## Nursing Diagnosis
List 4-8 relevant nursing diagnoses for a patient with this condition, as bullet points in standard NANDA-style format (e.g. "- Risk for [problem] related to [cause] as evidenced by [signs]" or "- [Problem] related to [cause]").

## Nursing Consideration
The key nursing considerations and interventions distinct from the medical management above — monitoring priorities, safety precautions, patient/family education points, and any condition-specific nursing care — as concise bullet points.

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

Some conditions plausibly fit more than one system — pick the single most clinically standard one anyway. Do not explain your reasoning, do not hedge, and do not add any text before or after the three lines below.

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

    // When this call is for a single subclass, its bare name is often
    // ambiguous on its own (e.g. "Alcohols" as a subclass of "Disinfectants
    // and Antiseptics" means topical/antiseptic alcohols — not medications
    // used for alcohol dependence, and not every drug with "alcohol" in its
    // name or description). Naming the parent chapter here disambiguates
    // that up front, before the strict-indication rule below reinforces it.
    const classLabel = parentClassName && typeof parentClassName === 'string' && parentClassName.trim()
      ? `the subclass "${className}" under the drug class "${parentClassName.trim()}"`
      : `the drug class "${className}"`;

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The nurse is browsing ${classLabel} and wants a broader list of medications within it beyond what's currently in the app's database.
${knownList}
List medications (generic names) that genuinely belong under ${classLabel}. The test for including a medication is its INDICATION: include it only if it is actually used to treat, prevent, or manage a condition that this specific class/subclass covers. Do NOT include a medication just because its generic name, brand name, or drug-class label happens to share a word with "${className}" — lexical overlap is not evidence of membership. For example, if the class/subclass is "Alcohols" under "Disinfectants and Antiseptics" (i.e. alcohols used topically as antiseptics, like isopropyl alcohol or ethanol swabs), do NOT include medications used to treat alcohol dependence/alcohol use disorder (e.g. disulfiram, acamprosate, naltrexone) — those belong to a completely different class and condition, despite the word "alcohol" appearing in both. Apply that same discipline to every class: match on real clinical indication, never on name resemblance.

A medication can legitimately be indicated for conditions in more than one drug class; if so, it is correct for it to appear here as long as one of its real indications belongs under ${classLabel}, even if its primary/best-known use lies in a different class elsewhere in the formulary.

Group them by subclass using ## markdown headers where subclasses exist (e.g. "## Beta-1 Selective Beta-Blockers"), otherwise use a single "## ${className}" header.

For each medication, use a bullet point starting with the **generic name in bold**, followed by a brief note: the specific indication that justifies its inclusion in this class/subclass, typical route (PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD), and any notable distinguishing feature versus others in the same subclass. Example format:
- **Metoprolol** — Beta-1 selective; PO/IV; hypertension, angina, arrhythmia; less bronchospasm risk than non-selective agents.

Aim for a reasonably thorough list (roughly 10-25 medications depending on how broad the class is) so the nurse gets real coverage of the class, not just one or two examples. If "${className}" is not a recognized drug class or you're not confident it's real, say so clearly instead of inventing medications.

This is reference material only, not a substitute for the current product monograph — do not fabricate specific dosing figures.

Output nothing except the ## headers and bullet points themselves — no introductory sentence, no explanation of your reasoning, and no closing summary. Begin your reply immediately with the first "## " header. If there is genuinely nothing new to add beyond what's already covered, reply with a single line "No additional medications found." and nothing else — do not explain why.`;
  } else if (mode === 'clinical_plan') {
    // Shared clinical decision-support engine: given a free-text
    // complaint/consultation note plus whatever patient context is
    // available, produce Diagnosis + Main/Adjunct/Combination Therapy +
    // Red Flags + Safety Note. This is the SAME prompt used by NACON-EMR's
    // patient-record consultation screen (src/lib/geminiInsights.js there)
    // — kept here as the single canonical copy so both apps' clinicians
    // get identical, independently-maintained-once clinical reasoning.
    // Grounding (MedIndex formulary matches, condition reference, allergy
    // exclusions) is prepared by the CALLER and passed in already-shaped —
    // this endpoint has no opinion on how a caller sources its own
    // formulary/allergy data, it just assembles the prompt from what it's
    // given.
    const {
      noteText, age, sex, primaryDiagnosis,
      allergyList, medIndexDrugs, medIndexExcluded, medIndexCondition,
    } = body || {};

    if (!noteText || typeof noteText !== 'string' || !noteText.trim()) {
      return new Response(JSON.stringify({ error: 'noteText is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── AI credits gate ──────────────────────────────────────────────────
    // This is the metered, patient-facing feature (AI Clinical Consult /
    // AI Drug Insight) — every other mode on this endpoint is content-
    // curation tooling and stays free. Delegates the actual charge to
    // /api/ai-credits, a Node.js function (this one runs on the Edge
    // runtime, which firebase-admin can't run on), forwarding the caller's
    // own Authorization header so the same identity/admin-exemption check
    // applies. Any caller of this endpoint — MedIndex or NACON-EMR, both
    // sharing the same Firebase project — goes through this same gate.
    {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Please sign in to use AI Clinical Consult.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      try {
        const creditsUrl = new URL('/api/ai-credits', req.url).toString();
        const creditRes = await fetch(creditsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ action: 'consume' }),
        });
        if (!creditRes.ok) {
          const creditErr = await creditRes.json().catch(() => ({}));
          return new Response(JSON.stringify({
            error: creditErr.error || 'Not enough AI credits. Buy more to continue.',
            balance: creditErr.balance,
            code: 'insufficient_credits',
          }), {
            status: creditRes.status === 402 ? 402 : creditRes.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Could not verify AI credits. Please try again.' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const contextLines = [
      age ? `Age: ${age}` : null,
      sex ? `Sex: ${sex}` : null,
      primaryDiagnosis ? `Primary diagnosis on file: ${primaryDiagnosis}` : null,
    ].filter(Boolean).join('\n');

    const hasAllergyHistory = Array.isArray(allergyList) && allergyList.length > 0;
    const allergyBlock = hasAllergyHistory
      ? `\nDOCUMENTED ALLERGIES (hard constraint — read before suggesting anything): ${allergyList.join(', ')}.
Do NOT suggest any of these drugs, or drugs in the same/cross-reactive class (e.g. cephalosporins if penicillin-allergic, other NSAIDs if aspirin-allergic). If the normal first-line/main therapy for this diagnosis is contraindicated by this allergy, do not suggest it — name the next-best alternative instead and explicitly say why the usual first-line choice was skipped.\n`
      : `\nAllergy history: none recorded for this patient. Do not assume "no allergies" — treat this as "not yet documented" and include a line reminding the clinician to confirm allergy status with the patient before prescribing.\n`;

    const medIndexDrugBlock = Array.isArray(medIndexDrugs) && medIndexDrugs.length
      ? `\nMedIndex reference formulary (authoritative for this facility, use these exact doses/considerations when one of these drugs applies; only reach beyond this list if nothing here fits):\n${medIndexDrugs.map(d =>
          `- ${d.generic_name} (${d.drug_class || 'class n/a'}): dosage: ${d.dosage || 'n/a'}; indications: ${d.primary_indications || 'n/a'}; contraindications: ${d.contraindications || 'n/a'}`
        ).join('\n')}\n`
      : '';

    const medIndexExcludedBlock = Array.isArray(medIndexExcluded) && medIndexExcluded.length
      ? `\nExcluded from consideration due to documented allergy (do not suggest these or mention them as options): ${medIndexExcluded.map(d => d.generic_name).join(', ')}.\n`
      : '';

    const medIndexConditionBlock = medIndexCondition
      ? `\nMedIndex clinical reference for "${primaryDiagnosis}":\n${[medIndexCondition.clinicalManifestation, medIndexCondition.management]
          .filter(Boolean).join('\n')}\n`
      : '';

    prompt = `You are a senior clinical decision-support assistant used inside a clinical/nursing app in Nigeria. Whoever is using this (doctor, nurse, or nursing/medical student) relies on your output to actually learn or apply correct, guideline-consistent management — so it must be clinically competent and specific, never generic or vague, and never a template with the blanks left unfilled.

Given the consultation note below, produce a structured management plan a clinician could consider. This is decision support only, not a final prescription — a licensed clinician always reviews before anything is prescribed.

Hard rule across every section below: never output the same drug name with the same dose/route/duration more than once anywhere in the entire response. Every bullet must represent a genuinely distinct clinical option — a different drug, a different regimen, or the same drug at a meaningfully different route/severity-tier (e.g. oral vs IV). If you cannot think of another genuinely distinct option, stop the list short rather than repeating one.

Patient context:
${contextLines}
${allergyBlock}${medIndexConditionBlock}${medIndexDrugBlock}${medIndexExcludedBlock}
Consultation note:
"""
${noteText}
"""

Respond using EXACTLY these section headers, in this order, each on its own line as shown (use "### " prefix):

### DIAGNOSIS
If the note already directly names a specific condition or diagnosis (e.g. just "Malaria", "gastric ulcer", "hypertension") rather than describing symptoms/findings to be worked up, treat that named condition itself as the working diagnosis and move straight to the therapy sections below — do not ask for more clinical detail in this case. The clinician is asking for the reference-level management of a known condition, not asking you to diagnose a patient from a symptom description, so state the diagnosis as given in one line and proceed.
Otherwise, read the C/O, O/E and any history in the note carefully and commit to the single most likely working diagnosis that actually matches those specific findings — do not default to a generic or textbook-common condition unless the presenting complaint genuinely fits it. Name real differentials (2-3) only if the presentation is genuinely ambiguous between them, and say in one clause why each differential is in play given THIS patient's findings. Only if the note describes a genuine symptom presentation that is too vague or sparse to safely commit to a working diagnosis from should you say exactly what missing history/exam/investigation is needed rather than guessing — this applies to underspecified symptom descriptions, not to notes that already state the diagnosis outright.

### MAIN THERAPY
The first-line drug(s) that directly treat the diagnosis above. Be thorough and exhaustive here, not conservative: actively enumerate every genuine, clinically-appropriate option real first-line/alternative-first-line practice supports for this condition — aim for at least 6, and up to 10, distinct options whenever the condition genuinely has that many real alternatives (many common conditions do, once you count different agents within a class, different drug classes entirely, and different routes/severity tiers). Only give fewer than 6 if the condition is genuinely narrow enough that real alternatives run out — never pad with fake options just to hit a number, but equally never stop early out of caution when more genuine options exist. Deliberately vary ROUTE across the list where real practice supports it: include oral options AND, where clinically appropriate for this condition/severity, IV, IM, SC, sublingual, rectal, or topical options too — do not default to oral-only if the condition is ever managed by other routes in real practice (e.g. an IV/IM option for the severe or vomiting/NPO patient who can't take oral therapy). "Different" means a different active drug/regimen, OR the same condition managed via a genuinely different route or severity tier (e.g. oral therapy for the uncomplicated/outpatient case vs IV/IM therapy for the severe/inpatient case) — never repeat the identical drug, dose, route and duration as a separate bullet; if you find yourself about to write the same line twice, drop the duplicate and move to a real alternative instead. Draw from BOTH the MedIndex reference formulary above AND your own broader clinical knowledge — do not limit yourself to only what's listed in MedIndex; where a drug appears in the MedIndex reference formulary, use its exact dosage and note "(MedIndex)" after the name, and add further genuine options beyond that list from standard clinical practice as needed to reach real, thorough coverage. If the usual first-line drug is excluded due to allergy, suggest the substitute here instead and say why.

Each line MUST be a real, named, specific drug (the actual generic drug name, e.g. "Omeprazole", never a therapeutic class alone like "Proton Pump Inhibitor" or "an antibiotic"), followed by REAL, FILLED-IN numbers and words for dose, route, frequency, and duration — never leave the literal words "dose", "route", "frequency", or "duration" in the output; if you are not confident of an exact figure, give the standard/typical value used in practice rather than omitting it. Format each line exactly as:
"- **<Generic drug name>** <dose e.g. 20 mg> <route e.g. oral> <frequency e.g. once daily> for <duration e.g. 4 weeks> — <1-line rationale>."
Example of a CORRECT line: "- **Omeprazole** 20 mg oral once daily for 4 weeks — first-line PPI to reduce gastric acid and allow ulcer healing."
Example of an INCORRECT line (never do this): "- **Proton Pump Inhibitor** dose, route, frequency, duration — first-line therapy."
Example of an INCORRECT list (never repeat a drug like this): five bullets that are all "Artemether-Lumefantrine 4 tablets oral at 0, 8, 24, 48, 72 hours" with only the rationale sentence reworded — that is ONE option, list it ONCE, then give real alternatives (e.g. a different oral ACT partner drug, or the IV/IM regimen used for severe disease) instead of repeating it.

### ADJUNCT THERAPY
Everything that supplements or supports the Main Therapy without treating the root cause itself — this is broader than just symptom-relief drugs. Be equally thorough here: aim for at least 6, and up to 10, genuinely distinct options whenever the condition realistically calls for that many, spanning as many of these categories as genuinely apply rather than picking just one or two:
- IV/oral fluids and electrolyte replacement (e.g. Normal Saline 0.9%, Dextrose Saline, 5%/10% Dextrose Water, Ringer's Lactate, ORS) — for dehydration, poor oral intake, fluid/electrolyte correction, or as a maintenance/rehydration line alongside Main Therapy.
- Vitamins and micronutrients (e.g. Vitamin C, Vitamin B-complex, Folic Acid, Vitamin K, Zinc) — where the diagnosis or patient state genuinely calls for supplementation (e.g. zinc alongside ORS for diarrhoea, folic acid in pregnancy/haemolysis, Vitamin K in bleeding risk).
- Dietary/nutritional supplements and general supportive advice (e.g. high-protein diet, small frequent meals, oral rehydration, rest) where relevant.
- Symptomatic medications (antipyretics, analgesics, antispasmodics, antiemetics, antacids, laxatives, cough preparations, etc.) — vary route here too where real practice supports it (e.g. an IV/IM antiemetic alongside an oral antipyretic), not oral-only by default.
Only give fewer than 6 if the condition genuinely doesn't need that much support — do not force irrelevant categories in. Use the exact same per-drug line format and specificity rules as Main Therapy above (real named product/drug, real filled-in dose/route/frequency/duration, no placeholders, no repeated drugs, drawing from both MedIndex and your own broader clinical knowledge) — fluids need a real volume, route and rate/duration too (e.g. "1000 mL IV over 8 hours"), not just a name. Omit this section header entirely (write nothing under it) if genuinely nothing adjunctive is indicated.

### COMBINATION THERAPY
Actively check whether standard practice/guidelines for this diagnosis include a real combination/multi-drug package before concluding none applies — this is a mandatory check, not an optional afterthought, and it is genuinely relevant for more conditions than it might first appear: (a) conditions needing two unrelated drug classes together (e.g. suspected sepsis needing dual antibiotic coverage, H. pylori triple/quadruple therapy, TB RHZE, dysentery with suspected bacterial or amoebic cause needing paired antimicrobial coverage), AND (b) fixed combination regimens that ARE the standard single-agent choice, such as an artemisinin-based combination therapy (ACT) for malaria (e.g. artemether + lumefantrine, or artesunate + amodiaquine as an alternative ACT) — in case (b), name the regimen and briefly state why it is a combination (e.g. pairing a fast-acting artemisinin component with a longer-acting partner drug to clear parasites quickly and prevent resistance). List every real-world regimen that applies (up to 5), using the same per-drug line format for every drug in the regimen, grouped and labelled by regimen name. Only write "Not applicable" if you have genuinely checked and standard practice for this specific diagnosis, at this presentation's severity, truly has no combination-regimen component — do not default to "not applicable" out of caution when a real one exists.

### RED FLAGS
Bullet list (max 5) of specific things to rule out or watch for, tied to this diagnosis and this patient's findings, not generic warnings.

### SAFETY NOTE
1-2 lines reminding the clinician to confirm against allergy history, exact local-protocol dosing, and contraindications before prescribing. If an allergy substitution was made above, restate it here explicitly.

Keep every section scannable but do not sacrifice clinical completeness or real drug specificity for brevity. Do not add any section not listed above. Never leave a placeholder unfilled.`;
  } else {
    if (!genericName || typeof genericName !== 'string') {
      return new Response(JSON.stringify({ error: 'genericName is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Best-effort, in addition to (not instead of) Google Search grounding
    // below. A slow/failed external lookup never blocks the AI call.
    const externalContext = await fetchExternalDrugContext(genericName);

    const notInDatabaseNote = notInDatabase
      ? `\nThis medication has not yet been uploaded to the app's verified drug database — this is a live, on-demand lookup. "${genericName}" may be entered as a generic name OR a brand/trade name (including branded combination packs, e.g. "Prevpac" = lansoprazole + amoxicillin + clarithromycin triple therapy for H. pylori). Check international and Nigerian brand/trade name references, manufacturer product pages, and pharmacy/drug-index listings, since many brand names (including regionally-marketed ones) will not be in your training data. If it is a recognized brand name or combination pack, silently resolve it to its actual generic ingredient(s) and proceed with the full breakdown AS THAT COMBINATION — state the resolved generic name(s) in the Overview so the nurse knows what was matched. Only say the medication is not real/recognized (at the very top of your response, instead of inventing information) if, after searching, you are still genuinely not confident it corresponds to any real generic drug, brand name, or combination product — do not decline just because the input looks like a brand name or an unfamiliar spelling.\n`
      : '';

    // Always search, on every lookup — not just when the drug is unfamiliar
    // or missing from the database. Left to its own judgment, the model
    // tends to skip searching for drugs it's "confident" about, which is
    // exactly where a stale or misremembered fact is most likely to slip
    // through uncaught. This makes the search step unconditional.
    const alwaysSearchNote = `\nBefore writing your answer, use Google Search to verify this drug's current indications, dosing, contraindications, and interactions against up-to-date sources — do this even if you already feel confident about the drug, since training data can be outdated or subtly wrong. Reach your conclusions from what the search turns up, not from recall alone.\n`;

    // Live grounding pre-fetched from openFDA/RxNorm just before this
    // prompt was built (see api/_lib/externalDrugSources.js) — the same
    // structured, fixed-source lookup used for the other four providers
    // (Claude/OpenAI/DeepSeek/Kimi), given here in addition to Gemini's
    // own open-ended Google Search grounding above, not instead of it.
    const externalNote = externalContext
      ? `\nVerified external reference data, fetched live from openFDA and RxNorm for this exact drug — prioritize this over your own training-data recall wherever the two conflict. Do not quote it verbatim; synthesize it into the sections below in your own words, and use it to sanity-check indications, contraindications, dosing, and interactions:\n${externalContext}\n`
      : '';

    prompt = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.
${alwaysSearchNote}${notInDatabaseNote}
Drug: ${genericName}
${brandNames ? `Known brand names: ${brandNames}` : ''}
${drugClass ? `Drug class: ${drugClass}` : ''}
${knownData ? `\nExisting reference data already shown to the nurse (do not simply repeat this — add depth, nuance, and anything missing):\n${knownData}` : ''}
${externalNote}
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

Write every section listed above in full — if a section is not well established for this drug, write "Not well established / consult current prescribing information" rather than omitting it, so the response fully mirrors this reference schema. Aim for genuine depth in each section (roughly 3-6 sentences, or 4-8 bullet points where a list format fits better) rather than a one-line summary — a nurse should be able to rely on this section alone without needing to look elsewhere.

Within each section, bold any sub-labels using **double asterisks** (e.g. "**Absorption:** ...", "**Renal impairment:** ...") so a nurse can scan the section quickly. Use bullet points (starting each line with "- ") for lists of items like contraindications, adverse effects, or interactions, and don't stop at 2-3 items when more genuinely apply — list them thoroughly.

Be precise, clinically accurate, and thorough within each section. Do not pad with filler or repeat yourself, but do not compress well-established clinical detail into a single sentence when it deserves more. Do not fabricate specific numeric dosing if you are not confident — note where prescribing information should be consulted instead. This is reference material only, not a substitute for the current product monograph.`;
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
            generationConfig: { maxOutputTokens: mode === 'classify_condition' ? 350 : mode === 'condition_insight' ? 3200 : mode === 'condition_clinical_info' ? 6000 : mode === 'condition' ? 2000 : mode === 'clinical_plan' ? 5500 : (mode === 'class' || mode === 'system_conditions') ? 4000 : (mode === 'strength' || mode === 'pronunciation' || mode === 'brands') ? 150 : 4000, ...(mode === 'clinical_plan' ? { temperature: 0.15 } : {}) },
            // Google Search grounding — the tool is attached for every mode
            // below (drug-detail lookups explicitly instruct the model to
            // always search before concluding, not just for unfamiliar
            // brand names — see alwaysSearchNote above), so the model can
            // verify against current sources rather than only reaching for
            // it when the drug is unfamiliar. Supported on gemini-2.5-flash
            // / flash-lite / pro.
            // Skipped for classify_condition: it's just picking from a fixed,
            // already-known list of system ids, never needs a web lookup —
            // and grounded responses tend to add search-planning/citation
            // preamble that eats into that mode's small token budget and can
            // push the required "System:" line past the truncation point.
            // Also skipped for clinical_plan: this mode reasons from the
            // supplied note + MedIndex formulary, not from live web lookups,
            // and grounding here risks pulling in ungoverned dosing info
            // from arbitrary sites for a decision-support clinical output.
            ...(mode !== 'classify_condition' && mode !== 'clinical_plan' ? { tools: [{ google_search: {} }] } : {}),
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

export default withCors(coreHandler);
