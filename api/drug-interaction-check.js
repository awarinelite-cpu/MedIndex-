// api/drug-interaction-check.js
// Server-side proxy for the Drug Compatibility Checker.
// Calls the Anthropic API with ANTHROPIC_API_KEY and returns a JSON array
// of interaction results — one entry per drug pair.

export const config = { runtime: 'edge', regions: ['iad1'] };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request body.' }, 400); }

  const { primaryDrug, selectedDrugs } = body || {};
  if (!primaryDrug?.generic_name || !Array.isArray(selectedDrugs) || selectedDrugs.length === 0) {
    return json({ error: 'primaryDrug and selectedDrugs are required.' }, 400);
  }
  if (selectedDrugs.length > 15) {
    return json({ error: 'Maximum 15 drugs per check.' }, 400);
  }

  const drugList = selectedDrugs.map(d => `"${d.generic_name}"`).join(', ');
  const prompt = `You are a clinical pharmacologist. Analyze drug interactions between "${primaryDrug.generic_name}" (${primaryDrug.drug_class || 'drug class unknown'}) and each of the following drugs: ${drugList}.

For EACH drug, provide a JSON array. Each element must have exactly these keys:
- "drug": the drug name exactly as given
- "severity": one of "safe", "monitor", "contraindicated", or "unknown"
- "mechanism": the pharmacokinetic or pharmacodynamic basis of the interaction (1-2 sentences)
- "effect": the clinical consequence if the drugs are combined (1-2 sentences)
- "recommendation": what a clinician should do in practice (1-2 sentences)

Return ONLY the JSON array. No markdown, no code fences, no preamble, no explanation.`;

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  let claudeRes;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    console.error('Fetch to Anthropic failed:', err);
    return json({ error: 'Could not reach the AI service. Please try again.' }, 502);
  }

  if (!claudeRes.ok) {
    let detail = '';
    try { detail = await claudeRes.text(); } catch {}
    console.error('Anthropic error:', claudeRes.status, detail);
    if (claudeRes.status === 429) {
      return json({ error: 'AI rate limit reached. Please wait a moment and try again.' }, 429);
    }
    return json({ error: 'AI service returned an error. Please try again.' }, 502);
  }

  let data;
  try { data = await claudeRes.json(); }
  catch { return json({ error: 'Failed to parse AI response.' }, 502); }

  const text = (data.content || []).map(c => c.text || '').join('').trim();
  // Strip any accidental markdown fences
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  let results;
  try {
    results = JSON.parse(clean);
    if (!Array.isArray(results)) throw new Error('Expected array');
  } catch {
    console.error('Could not parse AI JSON:', clean);
    return json({ error: 'AI returned an unexpected format. Please try again.' }, 502);
  }

  return json({ results });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
