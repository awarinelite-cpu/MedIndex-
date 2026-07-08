// api/_lib/buildPrompt.js
// Shared prompt builder used by all AI provider endpoints.
// Returns a { prompt, maxTokens } object given the request body.

export function buildPrompt(body) {
  const {
    mode = 'drug',
    genericName, brandNames, drugClass, knownData, notInDatabase,
    className, knownDrugNames,
    sectionHeaders, sectionLabel,
    conditionLabel, systemName,
    existingLabels,
  } = body || {};

  if (mode === 'section') {
    if (!genericName) throw { status: 400, error: 'genericName is required.' };
    if (!Array.isArray(sectionHeaders) || sectionHeaders.length === 0)
      throw { status: 400, error: 'sectionHeaders is required for section mode.' };
    const headerList = sectionHeaders.slice(0, 12).map(h => `## ${String(h).slice(0, 60)}`).join('\n');
    return {
      maxTokens: 2000,
      prompt: `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The app already has a record for the medication below, but its ${sectionLabel || 'requested'} information is missing. Provide ONLY that information.\n\nDrug: ${genericName}\n${drugClass ? `Drug class: ${drugClass}` : ''}\n\nWrite ONLY the following sections, using these exact markdown headers, in this order:\n${headerList}\n\nDo not add any other sections, preamble, or closing text — start directly with the first header. Within each section, bold sub-labels using **double asterisks** and use bullet points (lines starting with "- ") for lists. If a section is not well established for this drug, write "Not well established / consult current prescribing information" rather than omitting it.\n\nBe precise, clinically accurate, and concise.`,
    };
  }

  if (mode === 'strength') {
    if (!genericName) throw { status: 400, error: 'genericName is required.' };
    return {
      maxTokens: 150,
      prompt: `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. For the medication below, state ONLY the formulation strength(s) it usually comes in.\n\nDrug: ${genericName}\n${drugClass ? `Drug class: ${drugClass}` : ''}\n\nReply with nothing but one line per formulation, in the format "Form: strength" — for example:\nTab: 500mg\nIV: 500mg/100mL\nSusp: 125mg/5mL\n\nList every commonly available formulation/route. Do not add headers, bullets, explanations, or any other text — only the strength lines themselves.`,
    };
  }

  if (mode === 'condition') {
    if (!conditionLabel) throw { status: 400, error: 'conditionLabel is required.' };
    const knownList = Array.isArray(knownDrugNames) && knownDrugNames.length
      ? `\nSome of these medications may already be in the app's database; include them anyway if they are used for this condition. When a medication matches one of the following, use this exact spelling: ${knownDrugNames.join(', ')}\n`
      : '';
    return {
      maxTokens: 3000,
      prompt: `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The nurse is looking at the clinical condition "${conditionLabel}"${systemName ? ` (within the ${systemName} system)` : ''} and wants the full list of medications used to treat or manage it.\n${knownList}\nList the commonly used medications (generic names) indicated for "${conditionLabel}" — the COMPLETE clinical picture. Group them by drug class using ## markdown headers.\n\nFor each medication, use a bullet point starting with the **generic name in bold**, followed by a brief note: typical route (PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD), its role (first-line/adjunct/second-line, etc.), and any notable distinguishing feature.\n\nAim for roughly 10-25 medications across the relevant classes. This is reference material only.`,
    };
  }

  if (mode === 'system_conditions') {
    if (!systemName) throw { status: 400, error: 'systemName is required.' };
    const knownList = Array.isArray(existingLabels) && existingLabels.length
      ? `\nConditions already covered (do not repeat these):\n${existingLabels.join(', ')}\n`
      : '';
    return {
      maxTokens: 3000,
      prompt: `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Suggest additional clinically distinct conditions commonly managed within the "${systemName}" system.\n${knownList}\nFor each one, output exactly this 3-line block, with a blank line between blocks:\n\n### <Condition Label>\nIcon: <single relevant emoji>\nKeywords: <6-10 comma-separated lowercase keyword phrases>\n\nSuggest around 5-10 additional conditions. Output nothing except the blocks themselves — no preamble or closing text.`,
    };
  }

  if (mode === 'class') {
    if (!className) throw { status: 400, error: 'className is required.' };
    const knownList = Array.isArray(knownDrugNames) && knownDrugNames.length
      ? `\nMedications already in the app's database for this class (do not repeat these):\n${knownDrugNames.join(', ')}\n`
      : '';
    return {
      maxTokens: 3000,
      prompt: `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. List commonly used medications (generic names) that belong to the drug class "${className}" or its recognized subclasses.\n${knownList}\nGroup them by subclass using ## markdown headers where subclasses exist. For each medication, use a bullet point starting with the **generic name in bold**, followed by: primary indication, typical route, and any notable distinguishing feature.\n\nAim for roughly 10-25 medications. This is reference material only.`,
    };
  }

  // Default: full drug mode
  if (!genericName) throw { status: 400, error: 'genericName is required.' };
  const notInDatabaseNote = notInDatabase
    ? `\nThis medication has not yet been uploaded to the app's verified drug database — this is a live, on-demand lookup. "${genericName}" may be a generic name OR a brand/trade name. If it is a recognized brand name or combination pack, silently resolve it to its actual generic ingredient(s) and proceed — state the resolved generic name(s) in the Overview. Only say the medication is not real/recognized if you are genuinely not confident it corresponds to any real drug.\n`
    : '';

  return {
    maxTokens: 2000,
    prompt: `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.\n${notInDatabaseNote}\nDrug: ${genericName}\n${brandNames ? `Known brand names: ${brandNames}` : ''}\n${drugClass ? `Drug class: ${drugClass}` : ''}\n${knownData ? `\nExisting reference data already shown to the nurse (do not simply repeat this — add depth, nuance, and anything missing):\n${knownData}` : ''}\n\nStructure your response with these sections, using clear markdown headers (##):\n- Overview\n- Drug Class & Subclass\n- Strength\n- Indications\n- Therapeutic Note\n- Mechanism of Action & Pharmacology\n- Pharmacokinetics\n- Adult Dose\n- Child Dose\n- Renal Dose\n- Administration\n- NSTG Recommendations\n- Contraindications\n- Precautions\n- Pregnancy & Lactation\n- Interaction\n- Adverse Effect\n- Advice to Patients\n- Nursing Action\n- Pharmacovigilance\n- Product Description\n- Storage Recommendations\n- Pack Size & Price\n- Prescription Status & NAFDAC Note\n\nWrite every section listed above, even briefly — if a section is not well established for this drug, write "Not well established / consult current prescribing information" rather than omitting it.\n\nWithin each section, bold any sub-labels using **double asterisks**. Use bullet points (starting each line with "- ") for lists.\n\nBe precise, clinically accurate, and concise. Do not fabricate specific numeric dosing if not confident.`,
  };
}
