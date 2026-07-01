// Vercel serverless function (Node.js runtime).
// Calls the Anthropic API server-side so the API key is never exposed to the client.
// Requires an ANTHROPIC_API_KEY environment variable set in the Vercel project settings.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' });
  }

  const { genericName, brandNames, drugClass, knownData, notInDatabase } = req.body || {};

  if (!genericName || typeof genericName !== 'string') {
    return res.status(400).json({ error: 'genericName is required.' });
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
- Mechanism of Action
- Pharmacokinetics (absorption, distribution, metabolism, elimination, half-life)
- Clinical Uses (including any notable off-label uses)
- Dosage & Route of Administration (typical adult dosing, route(s) — PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD as applicable — frequency, and any renal/hepatic dose adjustment)
- Dosage Considerations & Special Populations (renal/hepatic impairment, elderly, pediatric, pregnancy/lactation nuance)
- Important Drug Interactions (mechanism-level detail, not just a list)
- Monitoring Parameters
- Patient/Nursing Education Points
- Notable Clinical Pearls or Recent Practice Updates

Be precise, clinically accurate, and concise within each section. Do not fabricate specific numeric dosing if you are not confident — note where prescribing information should be consulted instead. This is reference material only, not a substitute for the current product monograph.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'Failed to reach the AI service.' });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return res.status(200).json({ text });
  } catch (err) {
    console.error('drug-ai-details error:', err);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}
