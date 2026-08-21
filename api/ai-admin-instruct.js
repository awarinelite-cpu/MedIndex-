// ── /api/ai-admin-instruct ────────────────────────────────────────────────
// Node.js serverless function (needs firebase-admin, so no `edge` runtime —
// same reasoning as api/admin/users.js).
//
// Powers the admin "AI Assistant" page: an admin types a plain-language
// instruction ("change ibuprofen's drug class to NSAID", "add the brand
// name Calpol to paracetamol", "rename Diazepam's off-label use section to
// mention alcohol withdrawal") and this endpoint turns it into a structured,
// reviewable list of field-level edits. It NEVER touches Firestore itself —
// it only proposes edits. The admin panel matches each proposed edit against
// the live drug list, shows a before/after diff, and only writes to
// Firestore once the admin explicitly clicks Apply. That write (and its
// audit trail) happens client-side via saveAiAdminEdit() in aiDrugSave.js,
// same as every other admin edit path in this app.
//
// Every request must carry the calling admin's Firebase ID token as
// `Authorization: Bearer <token>` — verified server-side against the
// `admins` Firestore collection before anything else runs.

const EDITABLE_FIELDS = [
  'generic_name', 'brand_names', 'drug_class', 'drug_subclass', 'strength',
  'indications', 'off_label_use', 'therapeutic_note', 'pharmacology',
  'adult_dose', 'child_dose', 'renal_dose', 'administration', 'nstg_recommendations',
  'contraindications', 'precautions', 'pregnancy_lactation', 'interaction',
  'adverse_effect', 'advice_to_patients', 'nursing_action', 'pharmacovigilance',
  'product_description', 'storage_recommendations', 'pack_size_price', 'prescription_status',
];

const SYSTEM_PROMPT = `You are a data-editing assistant for MedIndex, a clinical drug reference database used by nurses in Nigeria. An admin has typed a plain-language instruction describing one or more changes to make to drug records. Convert it into structured JSON describing the exact edit(s) to propose. You never apply anything yourself — you only propose edits for a human admin to review and confirm.

Respond with ONLY valid JSON, no markdown code fences, no extra text before or after, matching exactly this shape:
{
  "understood": boolean,
  "clarification": string or null,
  "edits": [
    {
      "drugName": string,
      "field": string,
      "changeType": "replace" or "append",
      "newValue": string,
      "explanation": string
    }
  ]
}

Field rules — "field" must be EXACTLY one of: ${EDITABLE_FIELDS.join(', ')}.
- generic_name: the drug's primary/generic name.
- brand_names: comma-separated trade names.
- prescription_status: must be exactly "OTC", "Prescription", or "Controlled".
- drug_class / drug_subclass / strength: short plain values.
- All other fields (indications, contraindications, precautions, adverse_effect, interaction, etc.): for list-style clinical content use "- " bullet points per line, one item per line, matching this app's normal reference formatting. For prose fields (overview-style, therapeutic_note, pharmacology) write 2-5 full sentences.

changeType rules:
- "append" when the instruction is clearly ADDING something without removing what's already there (e.g. "add the brand name X", "also list Y as a contraindication"). newValue in this case should be ONLY the new item(s) being added, not the whole field.
- "replace" for everything else, including renaming a drug, correcting a value, or rewriting a section.

Other rules:
- If the instruction covers multiple drugs and/or multiple fields, produce one entry per drug+field combination in "edits".
- If the instruction doesn't clearly say which drug it targets, or the requested change doesn't map to anything in the field list above, set "understood" to false and "clarification" to one short, specific question — do not guess.
- Never invent a NAFDAC registration number or a specific numeric dose you are not confident about.
- Keep every newValue concise, clinically accurate, and in the same professional tone as the rest of the reference. This is reference material only — not a substitute for current prescribing information.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let firebaseAdmin;
  try {
    firebaseAdmin = await import('./_lib/firebaseAdmin.js');
  } catch (e) {
    res.status(500).json({ error: 'Failed to load the Admin SDK module: ' + (e?.message || String(e)) });
    return;
  }
  const { requireAdmin } = firebaseAdmin;

  try {
    await requireAdmin(req);
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is not configured with a GEMINI_API_KEY.' });
    return;
  }

  const { instruction } = req.body || {};
  if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
    res.status(400).json({ error: 'instruction is required.' });
    return;
  }

  const { resolveModel } = await import('./_lib/resolveModel.js');
  const model = await resolveModel({
    field: 'geminiModel',
    allowed: new Set(['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']),
    envVar: 'GEMINI_MODEL',
    fallback: 'gemini-2.5-flash',
  });

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nAdmin instruction: "${instruction.trim()}"` }] }],
          generationConfig: { maxOutputTokens: 3000, temperature: 0.1, responseMimeType: 'application/json' },
        }),
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach the AI provider: ' + (err?.message || String(err)) });
    return;
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => '');
    res.status(502).json({ error: `AI provider returned an error (${geminiRes.status}): ${errText.slice(0, 300)}` });
    return;
  }

  let json;
  try {
    json = await geminiRes.json();
  } catch {
    res.status(502).json({ error: 'AI provider returned an unparseable response.' });
    return;
  }

  const rawText = json?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  let parsed;
  try {
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    parsed = JSON.parse(cleaned);
  } catch {
    res.status(502).json({ error: 'Could not parse the AI response as JSON.', raw: rawText.slice(0, 500) });
    return;
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.edits)) {
    res.status(502).json({ error: 'AI response did not match the expected shape.', raw: rawText.slice(0, 500) });
    return;
  }

  // Server-side guardrail: drop any edit targeting a field outside the
  // whitelist, rather than trusting the model's output blindly.
  parsed.edits = parsed.edits.filter(e => e && typeof e.field === 'string' && EDITABLE_FIELDS.includes(e.field));

  res.status(200).json(parsed);
}
