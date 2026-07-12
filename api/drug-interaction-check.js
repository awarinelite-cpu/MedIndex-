// api/drug-interaction-check.js
// Multi-provider Drug Compatibility Checker backend.
// Accepts { primaryDrug, selectedDrugs, provider } and calls whichever AI
// service the user has selected (gemini | claude | openai | deepseek | kimi).
// Returns { results: [...] } — a JSON array of interaction objects.

export const config = { runtime: 'edge', regions: ['iad1'] };

const PROMPT = (primaryName, drugList) =>
  `You are a clinical pharmacologist. Analyze drug interactions between "${primaryName}" and each of the following drugs: ${drugList}.

Identify "${primaryName}"'s drug class yourself from your own clinical knowledge — do not assume any class hint that may be provided elsewhere is complete or correct.

For EACH drug, return a JSON array. Each element must have exactly these keys:
- "drug": the drug name exactly as given
- "severity": one of "safe", "monitor", "contraindicated", or "unknown"
- "mechanism": the pharmacokinetic or pharmacodynamic basis of the interaction (1-2 sentences)
- "effect": the clinical consequence if the drugs are combined (1-2 sentences)
- "recommendation": what a clinician should do in practice (1-2 sentences)

Be thorough and err toward caution: if there is a well-documented interaction concern (including IV compatibility issues like precipitate formation, not just pharmacokinetic/pharmacodynamic interactions), flag it — do not default to "safe" unless you are genuinely confident there is no clinically meaningful concern.

Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

const LIST_PROMPT = (primaryName) =>
  `You are a clinical pharmacologist. Identify "${primaryName}"'s drug class yourself from your own clinical knowledge, then list the clinically significant drug interactions for it — medications or drug classes that are either contraindicated with it or require caution/monitoring when combined, including IV compatibility issues (e.g. precipitate formation) as well as pharmacokinetic/pharmacodynamic interactions. Do not include drugs that are simply safe to combine; only list ones with a real interaction concern.

Return a JSON array, ordered most severe first. Each element must have exactly these keys:
- "drug": the specific generic drug name, or a well-known drug class if the interaction applies broadly to the class (e.g. "NSAIDs", "MAO inhibitors")
- "severity": "contraindicated" or "monitor" only — do not include "safe" or "unknown" entries in this list
- "mechanism": the pharmacokinetic or pharmacodynamic basis of the interaction (1-2 sentences)
- "effect": the clinical consequence if combined (1-2 sentences)
- "recommendation": what a clinician should do in practice (1-2 sentences)

Include roughly 6-15 entries covering the most clinically important interactions — do not pad with minor or theoretical ones. Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

// FIX (2026-07, round 2): the cautionNote field (added above) surfaced known
// risks inline instead of hiding them, but the product decision is stricter
// than that -- a "Combination Therapy" list should never include a drug that
// carries a real, documented reason it can't be safely combined, even with a
// caveat attached. A nursing student skimming this list for a fast answer
// may not open every entry to read the fine print, so anything flagged here
// needs to just not be on the list at all. The prompt below now asks the AI
// to only return genuinely clean combinations; cautionNote is kept as a
// belt-and-suspenders field (see the server-side filter after JSON parsing
// below) since LLMs don't reliably follow "exclude if risky" instructions
// 100% of the time on every call -- the actual guarantee is the filter, not
// the prompt wording.
const SYNERGY_PROMPT = (primaryName) =>
  `You are a clinical pharmacologist. Identify "${primaryName}"'s drug class yourself from your own clinical knowledge, then list drugs that are commonly and deliberately COMBINED with it for synergistic or complementary therapeutic benefit — established combination therapy regimens, NOT interactions to avoid. Think of the kind of combinations found in standard treatment guidelines: combination antihypertensive regimens, combination antimicrobial therapy to broaden coverage or reduce resistance, adjunct therapy that improves efficacy, reduces required dose, or reduces side effects of either drug alone.

Only include combinations with genuine clinical basis — do not include a drug just because it's commonly prescribed alongside this one for an unrelated, coincidental reason.

CRITICAL — only list combinations that are clean: if a candidate combination partner has a well-documented safety concern with "${primaryName}" (for example, additive QT-interval prolongation, additive CNS/respiratory depression, increased bleeding risk, a contraindication in some patient group, or any other real pharmacological caution), DO NOT include that drug in this list at all, even if it is otherwise a recognized combination partner in some clinical contexts. This list should only contain drugs you would recommend combining without a special safety caveat. If you are genuinely unsure whether a concern exists, leave it out of the list rather than guessing. In the rare case a returned entry does have such a concern, set "cautionNote" so it can still be filtered out downstream — but the goal is for "cautionNote" to be null on every entry you return.

Return a JSON array. Each element must have exactly these keys:
- "drug": the specific generic drug name of the combination partner
- "indication": the clinical condition or scenario this combination is used for (1 sentence)
- "clinicalReason": the pharmacological or clinical rationale for combining them — why the combination works better than either drug alone (1-2 sentences)
- "dosage": typical dose of the COMBINATION PARTNER drug specifically when used in this combination
- "frequency": typical dosing frequency (e.g. "once daily", "twice daily", "every 8 hours")
- "duration": typical duration of the combined therapy (e.g. "7-10 days", "long-term/chronic", "until symptoms resolve")
- "cautionNote": null in almost all cases (see above) — only non-null if, despite your best judgment, you could not find a way to exclude a concerning entry

Include roughly 6-15 entries covering the most clinically important and well-established combinations — do not pad with obscure or theoretical ones. Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

// A different shape from SYNERGY_PROMPT: this one starts from a CONDITION,
// not a specific drug, and returns whole combination REGIMENS (two or more
// drugs used together as a standard treatment approach for that condition),
// each with its own component drugs and doses — rather than one partner
// drug's dosing relative to a single starting drug.
const INDICATION_SYNERGY_PROMPT = (conditionLabel, systemName) =>
  `You are a clinical pharmacologist. List standard COMBINATION THERAPY regimens used to treat "${conditionLabel}"${systemName ? ` (within the ${systemName} system)` : ''} — established multi-drug regimens from treatment guidelines, where two or more drugs are used together deliberately for synergistic or complementary benefit (broader coverage, improved efficacy, dose reduction, or reduced resistance/side effects). This is NOT about interactions to avoid — only genuine combination treatment approaches.

CRITICAL — only list regimens that are clean: if the component drugs of a candidate regimen have a well-documented safety concern between them (for example, additive QT-interval prolongation, additive CNS/respiratory depression, or a real contraindication), DO NOT include that regimen at all, even if it is otherwise a recognized approach in some clinical contexts. This list should only contain regimens you would recommend without a special safety caveat. If unsure, leave it out rather than guessing. In the rare case a returned entry does have such a concern, set "cautionNote" so it can still be filtered out downstream — but the goal is for "cautionNote" to be null on every entry you return.

Return a JSON array. Each element must have exactly these keys:
- "regimenName": a short name for the combination (e.g. "ACE Inhibitor + Thiazide Diuretic", "Triple Therapy for H. pylori")
- "indication": the specific clinical scenario this regimen is used for within "${conditionLabel}" (1 sentence) — e.g. first-line, resistant cases, a particular patient subgroup
- "clinicalReason": the pharmacological or clinical rationale for combining these specific drugs — why the combination works better than any one drug alone (1-2 sentences)
- "drugs": a JSON array of the component drugs in this regimen, each an object with exactly these keys: "name" (generic drug name), "dosage", "frequency" (e.g. "once daily", "twice daily"), and "duration" (e.g. "7-10 days", "long-term/chronic")
- "cautionNote": null in almost all cases (see above) — only non-null if, despite your best judgment, you could not find a way to exclude a concerning entry

Include roughly 5-12 entries covering the most clinically important and well-established regimens for "${conditionLabel}" — do not pad with obscure or theoretical ones. If "${conditionLabel}" is not a recognized clinical condition or has no well-established combination regimens, return an empty array rather than inventing content. Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

// ── Deterministic safety net for classic, high-stakes absolute contraindications ──
// AI calls carry irreducible variance — the exact same prompt can occasionally
// return a different answer on different calls, or when a stale/incomplete
// stored drug_class biases the framing. For a short list of extremely
// well-established, universally-taught "never combine" pairs, we do NOT rely
// on the AI at all: these are enforced here in code, so this specific class of
// dangerous inconsistency (e.g. Ceftriaxone + a calcium-containing IV fluid
// coming back "safe" on one call) cannot happen regardless of model, provider,
// prompt wording, or luck. This list is intentionally short and only contains
// pairs with essentially universal clinical consensus — it is a floor under
// the AI's judgment, not a replacement for it.
function normalizeDrugToken(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ABSOLUTE_CONTRAINDICATIONS = [
  {
    a: ['ceftriaxone', 'rocephin'],
    b: ['ringerslactate', 'lactatedringers', 'lactatedringer', 'hartmannssolution', 'calciumgluconate', 'calciumchloride', 'calcium'],
    mechanism: 'Ceftriaxone forms an insoluble calcium-ceftriaxone precipitate when mixed, co-infused, or given via the same IV line as a calcium-containing solution (including Ringer\'s Lactate/Hartmann\'s solution, calcium gluconate, and calcium chloride).',
    effect: 'The precipitate can form in the lungs and kidneys and has caused documented fatalities in neonates — the FDA carries a boxed warning specifically prohibiting this combination in neonates. The precipitation risk is also established in older children and adults, though the fatal neonatal cases are the best-documented outcome.',
    recommendation: 'Do NOT co-administer, admix, or infuse through the same line, even sequentially, without a thorough flush of a compatible fluid in between. In neonates (≤28 days), do not use concomitantly at all, via any route, even with separate lines.',
  },
];

function checkAbsoluteContraindication(nameA, nameB) {
  const tokA = normalizeDrugToken(nameA);
  const tokB = normalizeDrugToken(nameB);
  for (const rule of ABSOLUTE_CONTRAINDICATIONS) {
    const aHitsA = rule.a.some(t => tokA.includes(t));
    const bHitsB = rule.b.some(t => tokB.includes(t));
    const aHitsB = rule.a.some(t => tokB.includes(t));
    const bHitsA = rule.b.some(t => tokA.includes(t));
    if ((aHitsA && bHitsB) || (aHitsB && bHitsA)) return rule;
  }
  return null;
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extractText(raw, provider) {
  try {
    if (provider === 'gemini') {
      return (raw?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    }
    if (provider === 'claude') {
      return (raw?.content || []).map(c => c.text || '').join('');
    }
    // openai / deepseek / kimi — all OpenAI-compatible
    return raw?.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  let body;
  try { body = await req.json(); }
  catch { return jsonResp({ error: 'Invalid request body.' }, 400); }

  const { primaryDrug, selectedDrugs, conditionLabel, systemName, provider = 'gemini', mode = 'pair' } = body || {};

  let prompt;
  if (mode === 'indication_synergy') {
    if (!conditionLabel || typeof conditionLabel !== 'string') {
      return jsonResp({ error: 'conditionLabel is required.' }, 400);
    }
    prompt = INDICATION_SYNERGY_PROMPT(conditionLabel, systemName);
  } else if (mode === 'list') {
    if (!primaryDrug?.generic_name) return jsonResp({ error: 'primaryDrug is required.' }, 400);
    prompt = LIST_PROMPT(primaryDrug.generic_name);
  } else if (mode === 'synergy') {
    if (!primaryDrug?.generic_name) return jsonResp({ error: 'primaryDrug is required.' }, 400);
    prompt = SYNERGY_PROMPT(primaryDrug.generic_name);
  } else {
    if (!primaryDrug?.generic_name) return jsonResp({ error: 'primaryDrug is required.' }, 400);
    if (!Array.isArray(selectedDrugs) || selectedDrugs.length === 0) {
      return jsonResp({ error: 'selectedDrugs is required.' }, 400);
    }
    if (selectedDrugs.length > 15) {
      return jsonResp({ error: 'Maximum 15 drugs per check.' }, 400);
    }
    prompt = PROMPT(
      primaryDrug.generic_name,
      selectedDrugs.map(d => `"${d.generic_name}"`).join(', ')
    );
  }

  // indication_synergy responses nest a "drugs" array inside every regimen
  // entry, so they run larger than the flat per-drug list modes.
  const maxTokens = mode === 'indication_synergy' ? 3000 : 2000;

  // ── Route to the right AI provider ──────────────────────────────────────────
  let aiRes;
  let aiUnavailable = false;
  let aiFailureMessage = '';

  try {
    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return jsonResp({ error: 'Server is not configured with a GEMINI_API_KEY.' }, 500);
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
      aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      );

    } else if (provider === 'claude') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return jsonResp({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' }, 500);
      const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
      aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'messages-2023-12-15',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

    } else if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return jsonResp({ error: 'Server is not configured with an OPENAI_API_KEY.' }, 500);
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      });

    } else if (provider === 'deepseek') {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) return jsonResp({ error: 'Server is not configured with a DEEPSEEK_API_KEY.' }, 500);
      const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      });

    } else if (provider === 'kimi') {
      const apiKey = process.env.KIMI_API_KEY;
      if (!apiKey) return jsonResp({ error: 'Server is not configured with a KIMI_API_KEY.' }, 500);
      const model = process.env.KIMI_MODEL || 'moonshot-v1-8k';
      aiRes = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      });

    } else {
      return jsonResp({ error: `Unknown provider: ${provider}` }, 400);
    }

  } catch (err) {
    console.error(`[drug-interaction-check] fetch to ${provider} failed:`, err);
    aiUnavailable = true;
    aiFailureMessage = 'Could not reach the AI service.';
  }

  // ── Parse response ───────────────────────────────────────────────────────────
  let text = '';
  if (!aiUnavailable) {
    if (!aiRes.ok) {
      let detail = '';
      try { detail = await aiRes.text(); } catch {}
      console.error(`[drug-interaction-check] ${provider} error ${aiRes.status}:`, detail);
      aiUnavailable = true;
      aiFailureMessage = aiRes.status === 429
        ? 'AI rate limit reached.'
        : `AI service error (${aiRes.status}).`;
    } else {
      let raw;
      try { raw = await aiRes.json(); }
      catch { aiUnavailable = true; aiFailureMessage = 'Failed to parse AI response.'; }
      if (raw) text = extractText(raw, provider).trim();
    }
  }

  let results = [];
  if (!aiUnavailable) {
    const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      results = JSON.parse(clean);
      if (!Array.isArray(results)) throw new Error('Expected JSON array');
    } catch (e) {
      console.error('[drug-interaction-check] JSON parse failed:', e.message, '| raw text:', clean.slice(0, 300));
      aiUnavailable = true;
      aiFailureMessage = 'AI returned an unexpected format.';
    }
  }

  // ── If the AI is genuinely unreachable, degrade instead of returning
  // nothing. This ONLY has real content to fall back to in 'pair' mode
  // (via ABSOLUTE_CONTRAINDICATIONS below) — 'list', 'synergy', and
  // 'indication_synergy' generate open-ended content from the AI's own
  // knowledge with no equivalent offline dataset, so there is nothing
  // honest to return for those; they still hard-error.
  const hasOfflineFallback = mode !== 'list' && mode !== 'synergy' && mode !== 'indication_synergy';
  if (aiUnavailable && !hasOfflineFallback) {
    return jsonResp({ error: aiFailureMessage + ' Please try again.' }, 502);
  }

  // ── Deterministic safety filter for synergy/regimen modes ─────────────────
  // The prompts above ask the model to only return "clean" combinations
  // (nothing with a known safety concern), but LLM instruction-following
  // isn't 100% reliable on every call. Rather than trust the prompt alone
  // to keep a "Combination Therapy" list free of flagged drugs, strip any
  // entry that still comes back with a non-empty cautionNote here, in code,
  // where it's guaranteed rather than merely requested. This is what
  // actually enforces "never show a combination with a known reason it
  // can't be combined" -- the prompt wording is best-effort, this is the
  // real guarantee.
  if (mode === 'synergy' || mode === 'indication_synergy') {
    const hasCaution = (note) => typeof note === 'string' && note.trim().length > 0;
    results = results.filter(r => !hasCaution(r.cautionNote));
  }

  // ── Deterministic safety net: classic absolute contraindications ──────────
  // Applied AFTER the AI call, overriding whatever it said. This is the real
  // guarantee for the short list of pairs in ABSOLUTE_CONTRAINDICATIONS — see
  // the comment on that list above for why this exists as code, not just
  // prompt wording.
  if (mode !== 'list' && mode !== 'synergy' && mode !== 'indication_synergy') {
    // Default/'pair' mode (and anything else, matching the fallback branch
    // above): force-correct or inject an entry for any selected drug that
    // forms a known absolute contraindication with the primary drug.
    for (const sel of selectedDrugs) {
      const rule = checkAbsoluteContraindication(primaryDrug.generic_name, sel.generic_name);
      if (rule) {
        const forced = {
          drug: sel.generic_name,
          severity: 'contraindicated',
          mechanism: rule.mechanism,
          effect: rule.effect,
          recommendation: '⚠ VERIFIED CONTRAINDICATION: ' + rule.recommendation,
        };
        const idx = results.findIndex(r => normalizeDrugToken(r.drug) === normalizeDrugToken(sel.generic_name));
        if (idx >= 0) results[idx] = forced; else results.push(forced);
      } else if (aiUnavailable) {
        // AI is down and this specific pair isn't one of the small set of
        // universally-agreed contraindications we can verify without it —
        // say so honestly rather than silently omitting it or guessing.
        results.push({
          drug: sel.generic_name,
          severity: 'unknown',
          mechanism: null,
          effect: null,
          recommendation:
            'Cannot be checked right now — the AI service is unavailable, so only the small set of universally ' +
            'verified classic contraindications (checked without AI) could be applied here. Try again once the ' +
            'AI service is back, or switch AI provider in the dropdown above.',
        });
      }
    }
  } else if (mode === 'synergy') {
    results = results.filter(r => !checkAbsoluteContraindication(primaryDrug.generic_name, r.drug));
  } else if (mode === 'indication_synergy') {
    results = results.filter(regimen => {
      const names = Array.isArray(regimen.drugs) ? regimen.drugs.map(d => d.name) : [];
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          if (checkAbsoluteContraindication(names[i], names[j])) return false;
        }
      }
      return true;
    });
  }

  return jsonResp({ results, aiUnavailable: aiUnavailable || undefined });
}
