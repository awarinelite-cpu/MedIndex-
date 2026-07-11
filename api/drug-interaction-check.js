// api/drug-interaction-check.js
// Multi-provider Drug Compatibility Checker backend.
// Accepts { primaryDrug, selectedDrugs, provider } and calls whichever AI
// service the user has selected (gemini | claude | openai | deepseek | kimi).
// Returns { results: [...] } — a JSON array of interaction objects.

export const config = { runtime: 'edge', regions: ['iad1'] };

const PROMPT = (primaryName, primaryClass, drugList) =>
  `You are a clinical pharmacologist. Analyze drug interactions between "${primaryName}" (${primaryClass || 'drug class unknown'}) and each of the following drugs: ${drugList}.

For EACH drug, return a JSON array. Each element must have exactly these keys:
- "drug": the drug name exactly as given
- "severity": one of "safe", "monitor", "contraindicated", or "unknown"
- "mechanism": the pharmacokinetic or pharmacodynamic basis of the interaction (1-2 sentences)
- "effect": the clinical consequence if the drugs are combined (1-2 sentences)
- "recommendation": what a clinician should do in practice (1-2 sentences)

Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

const LIST_PROMPT = (primaryName, primaryClass) =>
  `You are a clinical pharmacologist. List the clinically significant drug interactions for "${primaryName}" (${primaryClass || 'drug class unknown'}) — medications or drug classes that are either contraindicated with it or require caution/monitoring when combined. Do not include drugs that are simply safe to combine; only list ones with a real interaction concern.

Return a JSON array, ordered most severe first. Each element must have exactly these keys:
- "drug": the specific generic drug name, or a well-known drug class if the interaction applies broadly to the class (e.g. "NSAIDs", "MAO inhibitors")
- "severity": "contraindicated" or "monitor" only — do not include "safe" or "unknown" entries in this list
- "mechanism": the pharmacokinetic or pharmacodynamic basis of the interaction (1-2 sentences)
- "effect": the clinical consequence if combined (1-2 sentences)
- "recommendation": what a clinician should do in practice (1-2 sentences)

Include roughly 6-15 entries covering the most clinically important interactions — do not pad with minor or theoretical ones. Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

// The positive counterpart to LIST_PROMPT: synergistic/complementary
// combination therapy, not interactions to avoid.
const SYNERGY_PROMPT = (primaryName, primaryClass) =>
  `You are a clinical pharmacologist. List drugs that are commonly and deliberately COMBINED with "${primaryName}" (${primaryClass || 'drug class unknown'}) for synergistic or complementary therapeutic benefit — established combination therapy regimens, NOT interactions to avoid. Think of the kind of combinations found in standard treatment guidelines: combination antihypertensive regimens, combination antimicrobial therapy to broaden coverage or reduce resistance, adjunct therapy that improves efficacy, reduces required dose, or reduces side effects of either drug alone.

Only include combinations with genuine clinical basis — do not include a drug just because it's commonly prescribed alongside this one for an unrelated, coincidental reason.

Return a JSON array. Each element must have exactly these keys:
- "drug": the specific generic drug name of the combination partner
- "indication": the clinical condition or scenario this combination is used for (1 sentence)
- "clinicalReason": the pharmacological or clinical rationale for combining them — why the combination works better than either drug alone (1-2 sentences)
- "dosage": typical dose of the COMBINATION PARTNER drug specifically when used in this combination
- "frequency": typical dosing frequency (e.g. "once daily", "twice daily", "every 8 hours")
- "duration": typical duration of the combined therapy (e.g. "7-10 days", "long-term/chronic", "until symptoms resolve")

Include roughly 6-15 entries covering the most clinically important and well-established combinations — do not pad with obscure or theoretical ones. Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

// A different shape from SYNERGY_PROMPT: this one starts from a CONDITION,
// not a specific drug, and returns whole combination REGIMENS (two or more
// drugs used together as a standard treatment approach for that condition),
// each with its own component drugs and doses — rather than one partner
// drug's dosing relative to a single starting drug.
const INDICATION_SYNERGY_PROMPT = (conditionLabel, systemName) =>
  `You are a clinical pharmacologist. List standard COMBINATION THERAPY regimens used to treat "${conditionLabel}"${systemName ? ` (within the ${systemName} system)` : ''} — established multi-drug regimens from treatment guidelines, where two or more drugs are used together deliberately for synergistic or complementary benefit (broader coverage, improved efficacy, dose reduction, or reduced resistance/side effects). This is NOT about interactions to avoid — only genuine combination treatment approaches.

Return a JSON array. Each element must have exactly these keys:
- "regimenName": a short name for the combination (e.g. "ACE Inhibitor + Thiazide Diuretic", "Triple Therapy for H. pylori")
- "indication": the specific clinical scenario this regimen is used for within "${conditionLabel}" (1 sentence) — e.g. first-line, resistant cases, a particular patient subgroup
- "clinicalReason": the pharmacological or clinical rationale for combining these specific drugs — why the combination works better than any one drug alone (1-2 sentences)
- "drugs": a JSON array of the component drugs in this regimen, each an object with exactly these keys: "name" (generic drug name), "dosage", "frequency" (e.g. "once daily", "twice daily"), and "duration" (e.g. "7-10 days", "long-term/chronic")

Include roughly 5-12 entries covering the most clinically important and well-established regimens for "${conditionLabel}" — do not pad with obscure or theoretical ones. If "${conditionLabel}" is not a recognized clinical condition or has no well-established combination regimens, return an empty array rather than inventing content. Return ONLY the JSON array. No markdown, no code fences, no preamble.`;

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
    prompt = LIST_PROMPT(primaryDrug.generic_name, primaryDrug.drug_class);
  } else if (mode === 'synergy') {
    if (!primaryDrug?.generic_name) return jsonResp({ error: 'primaryDrug is required.' }, 400);
    prompt = SYNERGY_PROMPT(primaryDrug.generic_name, primaryDrug.drug_class);
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
      primaryDrug.drug_class,
      selectedDrugs.map(d => `"${d.generic_name}"`).join(', ')
    );
  }

  // indication_synergy responses nest a "drugs" array inside every regimen
  // entry, so they run larger than the flat per-drug list modes.
  const maxTokens = mode === 'indication_synergy' ? 3000 : 2000;

  // ── Route to the right AI provider ──────────────────────────────────────────
  let aiRes;

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
    return jsonResp({ error: 'Could not reach the AI service. Please try again.' }, 502);
  }

  // ── Parse response ───────────────────────────────────────────────────────────
  if (!aiRes.ok) {
    let detail = '';
    try { detail = await aiRes.text(); } catch {}
    console.error(`[drug-interaction-check] ${provider} error ${aiRes.status}:`, detail);
    if (aiRes.status === 429) {
      return jsonResp({ error: 'AI rate limit reached. Please wait a moment and try again.' }, 429);
    }
    return jsonResp({ error: `AI service error (${aiRes.status}). Please try again.` }, 502);
  }

  let raw;
  try { raw = await aiRes.json(); }
  catch { return jsonResp({ error: 'Failed to parse AI response.' }, 502); }

  const text = extractText(raw, provider).trim();
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  let results;
  try {
    results = JSON.parse(clean);
    if (!Array.isArray(results)) throw new Error('Expected JSON array');
  } catch (e) {
    console.error('[drug-interaction-check] JSON parse failed:', e.message, '| raw text:', clean.slice(0, 300));
    return jsonResp({ error: 'AI returned an unexpected format. Please try again.' }, 502);
  }

  return jsonResp({ results });
}
