// Admin tool: build a Google search that asks for a full, elaborate clinical
// note on a condition, then read whatever Google answers with back into the
// 11 fixed clinical-info sections (the same shape the AI generator saves).
//
// Mirrors what ManualDrugInfoEntry does for drugs (Google search -> paste ->
// preview -> save), but for a condition's clinical info.
import { parseConditionClinicalInfo } from './parseConditionClinicalInfo';

// Order matters: it is the order of the note (same as the MedIndex condition PDF).
// `prompt(label)` is the exact per-section instruction the app's own AI uses
// (mode "condition_clinical_info" in api/_lib/buildPrompt.js), so the Google
// search carries the same short prompt instead of a bulky custom one.
const EM = '\u2014';
export const CLINICAL_SECTIONS = [
  {
    key: 'introduction', header: 'Introduction', part: 1,
    prompt: () => '2-4 sentences: a clear definition of the condition and its clinical significance.',
  },
  {
    key: 'types', header: 'Types', part: 1,
    prompt: c => `If "${c}" has clinically distinct types, stages, or classifications, list each as a bullet point starting with the **type name in bold**, followed by a brief distinguishing note ${EM} for example "- **Type 1 Diabetes Mellitus** ${EM} autoimmune beta-cell destruction, absolute insulin deficiency, usually childhood/young-adult onset." If it does NOT have clinically distinct types, write exactly this line and nothing else: "No clinically distinct types ${EM} managed as a single clinical entity."`,
  },
  {
    key: 'organRelated', header: 'Organ System Involved', part: 1,
    prompt: () => 'The primary organ(s) or body system(s) affected, 1-2 sentences.',
  },
  {
    key: 'etiology', header: 'Etiology', part: 1,
    prompt: () => 'The causes and risk factors, as concise bullet points (lines starting with "- ").',
  },
  {
    key: 'pathology', header: 'Pathophysiology', part: 1,
    prompt: () => 'A short paragraph (3-6 sentences) explaining the underlying disease mechanism a nurse should understand.',
  },
  {
    key: 'clinicalManifestation', header: 'Clinical Manifestation', part: 1,
    prompt: () => 'The signs and symptoms, as concise bullet points. If types were listed above and their manifestations meaningfully differ, group these under "### <Type Name>" sub-headers matching the type names used above exactly; otherwise give a single flat bullet list.',
  },
  {
    key: 'diagnosis', header: 'Diagnosis and Investigation', part: 2,
    prompt: () => 'The relevant history/examination findings, laboratory tests, and imaging or other investigations used to diagnose and work this condition up, as concise bullet points.',
  },
  {
    key: 'management', header: 'Medical Management', part: 2,
    prompt: c => `The medical (pharmacological and general, non-surgical) management approach. If "${c}" has clinically distinct types listed under ## Types that are genuinely managed differently, use a "### <Type Name>" sub-header for EACH type ${EM} matching the type names used above exactly ${EM} followed by that type's specific management as bullet points. If there are no clinically distinct types, or all types share essentially the same management approach, give a single flat bullet-point management section instead of sub-headers.`,
  },
  {
    key: 'surgicalManagement', header: 'Surgical Management', part: 2,
    prompt: c => `If "${c}" is ever managed surgically (even only in specific cases, complications, or refractory disease), describe the surgical approach(es) as concise bullet points, noting when surgery vs medical management is chosen. If surgery is NOT a recognized part of managing this condition, write exactly this line and nothing else: "Surgical management is not typically indicated for this condition ${EM} managed medically."`,
  },
  {
    key: 'nursingDiagnosis', header: 'Nursing Diagnosis', part: 2,
    prompt: () => 'List 4-8 relevant nursing diagnoses for a patient with this condition, as bullet points in standard NANDA-style format (e.g. "- Risk for [problem] related to [cause] as evidenced by [signs]" or "- [Problem] related to [cause]").',
  },
  {
    key: 'nursingConsideration', header: 'Nursing Consideration', part: 2,
    prompt: () => `The key nursing considerations and interventions distinct from the medical management above ${EM} monitoring priorities, safety precautions, patient/family education points, and any condition-specific nursing care ${EM} as concise bullet points.`,
  },
];

export const SECTION_LABEL = Object.fromEntries(CLINICAL_SECTIONS.map(s => [s.key, s.header]));

// part: 0 = everything, 1 = Introduction..Clinical Manifestation, 2 = Diagnosis..Nursing Consideration
export function googleClinicalInfoUrl(conditionLabel, systemName = '', part = 0) {
  const sections = CLINICAL_SECTIONS.filter(s => !part || s.part === part);
  const where = systemName ? ` (within the ${systemName} system)` : '';
  const body = sections.map(s => `## ${s.header}\n${s.prompt(conditionLabel)}`).join('\n\n');
  const q = `You are assisting a licensed nurse and nurse educator using a clinical drug reference app in Nigeria. `
    + `Provide a structured clinical teaching summary of the condition "${conditionLabel}"${where}, suitable for nursing education and quick clinical reference.\n\n`
    + `Respond with exactly these sections, using these exact markdown headers, in this order. Do not add any other sections, preamble, or closing text.\n\n`
    + `${body}\n\n`
    + `Within each section, bold sub-labels using **double asterisks** where useful, and use bullet points (lines starting with "- ") for lists. `
    + `Be precise, clinically accurate, and concise ${EM} this is educational/reference material only, not a substitute for current clinical guidelines. `
    + `Do not fabricate specific numeric dosing; refer to drug classes or first-line agent names only.`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// ── Reading Google's answer back ────────────────────────────────────────────
// Google/AI answers rarely use the exact "## Header" lines we asked for: they
// bold the heading, number it, add a colon, use "#" or "###", or say "Signs and
// Symptoms" instead of "Clinical Manifestation". Normalise all of that to the
// canonical "## Header" lines first, then reuse the app's own section parser.
const ALIASES = [
  [/^(introduction|overview|definition|introduction and definition)$/, 'introduction'],
  [/^(types|type|classification|classifications|types and classification|classification and types|types and stages|types and subtypes)$/, 'types'],
  [/^(organ system involved|organ systems involved|organ system|organ system affected|organ systems affected|system involved|organs involved)$/, 'organRelated'],
  [/^(etiology|aetiology|causes|causes and risk factors|etiology and risk factors|aetiology and risk factors)$/, 'etiology'],
  [/^(pathophysiology|pathology|pathogenesis)$/, 'pathology'],
  [/^(clinical manifestations?|signs and symptoms|clinical features|clinical presentation)$/, 'clinicalManifestation'],
  [/^(diagnosis and investigations?|diagnosis|investigations?|diagnostic evaluation|diagnostic work-?up)$/, 'diagnosis'],
  [/^(medical management|medical treatment|medical and pharmacological management|pharmacological management|management|treatment)$/, 'management'],
  [/^(surgical management|surgical treatment|surgical interventions?|surgery)$/, 'surgicalManagement'],
  [/^(nursing diagnosis|nursing diagnoses)$/, 'nursingDiagnosis'],
  [/^(nursing considerations?|nursing management|nursing care|nursing interventions|nursing care and considerations)$/, 'nursingConsideration'],
];

const HEADING_LINE = /^\s*(#{1,6})?\s*(?:\d+[.)]\s*)?(?:\*\*|__)?\s*(.+?)\s*(?:\*\*|__)?\s*:?\s*$/;

function sectionKeyFor(rawText) {
  const t = String(rawText || '')
    .replace(/[*_`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .replace(/[:.]+$/, '')
    .trim()
    .toLowerCase();
  if (!t || t.length > 60) return null;
  const hit = ALIASES.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}

export function normalizeGoogleClinicalText(text) {
  const cleaned = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/^\s*(markdown|md)\s*\n/i, '')
    .trim();

  const seen = new Set();
  let inSection = false;
  const out = [];
  for (const line of cleaned.split('\n')) {
    const m = line.match(HEADING_LINE);
    const hashes = m?.[1] || '';
    const key = m && !/^\s*[-•*]\s/.test(line) ? sectionKeyFor(m[2]) : null;
    if (key && !seen.has(key)) {
      seen.add(key);
      inSection = true;
      out.push(`## ${SECTION_LABEL[key]}`);
    } else if (hashes && inSection) {
      // A heading that is not one of the 11 sections (e.g. a type name) must
      // stay INSIDE the section it belongs to, so demote it to "###".
      out.push(`### ${m[2].replace(/[*_]/g, '').trim()}`);
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

// → { updates, found: [keys], missing: [keys] }. Only non-empty sections are
// returned, so saving merges onto what is already there and never blanks a
// section the pasted text did not cover (that is what lets Part 1 / Part 2 be
// pasted one after the other).
export function parseGoogleClinicalInfo(text) {
  if (!String(text || '').trim()) throw new Error('Nothing to read — paste Google’s answer first.');
  const parsed = parseConditionClinicalInfo(normalizeGoogleClinicalText(text));
  const updates = {};
  CLINICAL_SECTIONS.forEach(({ key }) => { if (parsed[key]) updates[key] = parsed[key]; });
  const found = Object.keys(updates);
  if (found.length === 0) {
    throw new Error('No clinical sections found. The answer needs headings like Introduction, Etiology, Pathophysiology… Search again with the button above and paste the full answer.');
  }
  const missing = CLINICAL_SECTIONS.map(s => s.key).filter(k => !updates[k]);
  return { updates, found, missing };
}
