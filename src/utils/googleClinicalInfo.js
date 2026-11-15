// Admin tool: build a Google search that asks for a full, elaborate clinical
// note on a condition, then read whatever Google answers with back into the
// 11 fixed clinical-info sections (the same shape the AI generator saves).
//
// Mirrors what ManualDrugInfoEntry does for drugs (Google search -> paste ->
// preview -> save), but for a condition's clinical info.
import { parseConditionClinicalInfo } from './parseConditionClinicalInfo';

// Order matters: it is the order of the note (same as the MedIndex condition PDF).
export const CLINICAL_SECTIONS = [
  {
    key: 'introduction', header: 'Introduction', part: 1,
    ask: 'definition, epidemiology, burden, clinical significance and key facts (a full paragraph or more)',
  },
  {
    key: 'types', header: 'Types', part: 1,
    ask: 'EVERY type, stage, grade and classification as bullets with distinguishing features; if there are none write exactly: No clinically distinct types — managed as a single clinical entity.',
  },
  {
    key: 'organRelated', header: 'Organ System Involved', part: 1,
    ask: 'the organs and body systems affected and how',
  },
  {
    key: 'etiology', header: 'Etiology', part: 1,
    ask: 'ALL causes, risk factors, precipitating and predisposing factors as bullets',
  },
  {
    key: 'pathology', header: 'Pathophysiology', part: 1,
    ask: 'detailed step-by-step disease mechanism',
  },
  {
    key: 'clinicalManifestation', header: 'Clinical Manifestation', part: 1,
    ask: 'ALL signs and symptoms as bullets, atypical presentations, complications, grouped under ### type sub-headings where types differ',
  },
  {
    key: 'diagnosis', header: 'Diagnosis and Investigation', part: 2,
    ask: 'history, physical examination, EVERY laboratory test, imaging and other investigation, diagnostic criteria, differential diagnosis',
  },
  {
    key: 'management', header: 'Medical Management', part: 2,
    ask: 'non-pharmacological and pharmacological management with drug classes and named drugs, guideline-based, under ### type sub-headings where types are managed differently',
  },
  {
    key: 'surgicalManagement', header: 'Surgical Management', part: 2,
    ask: 'every surgical or interventional procedure and when it is indicated; if surgery is never indicated write exactly: Surgical management is not typically indicated for this condition — managed medically.',
  },
  {
    key: 'nursingDiagnosis', header: 'Nursing Diagnosis', part: 2,
    ask: '6-10 NANDA-style nursing diagnoses as bullets (Problem related to cause as evidenced by signs)',
  },
  {
    key: 'nursingConsideration', header: 'Nursing Consideration', part: 2,
    ask: 'assessment, monitoring, interventions, medication administration, positioning, safety, emotional support, patient and family education, discharge teaching and complications to watch for, as bullets',
  },
];

export const SECTION_LABEL = Object.fromEntries(CLINICAL_SECTIONS.map(s => [s.key, s.header]));

// part: 0 = everything, 1 = Introduction..Clinical Manifestation, 2 = Diagnosis..Nursing Consideration
export function googleClinicalInfoUrl(conditionLabel, systemName = '', part = 0) {
  const sections = CLINICAL_SECTIONS.filter(s => !part || s.part === part);
  const where = systemName ? ` (${systemName} system)` : '';
  const list = sections.map(s => `## ${s.header} (${s.ask})`).join(' ');
  const q = `Give me a COMPLETE and very detailed clinical note on ${conditionLabel}${where} for nursing and medical students, `
    + `with everything known and available online about it. Nothing summarised, shortened or skipped. `
    + `Use EXACTLY these markdown headings, in this order, each followed by thorough bullet-point content: ${list} `
    + `Output only the note as plain markdown text - no table, no introduction, no closing remarks, no sources list.`;
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
