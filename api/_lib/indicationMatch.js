// api/_lib/indicationMatch.js
//
// Pure, dependency-free matching used by /api/indication-check. No AI is
// involved: a condition label (plus any admin-supplied extra keywords) is
// turned into a few "concepts"; a drug "matches" when any concept appears in
// the drug's official label indications text (openFDA) or in the conditions
// RxClass says it may treat / may prevent.
//
// A concept is a list of significant word stems that must ALL appear (in any
// order) in the text. "Drugs used in anxiety and sleep disorders" becomes two
// concepts, [anxiet] and [sleep], so a drug matches if either appears.

const STOP = new Set([
  'drug', 'drugs', 'used', 'use', 'in', 'for', 'of', 'the', 'a', 'an', 'to', 'with', 'by', 'on', 'as',
  'treatment', 'treatments', 'management', 'therapy', 'therapies', 'agent', 'agents', 'medication',
  'medications', 'disorder', 'disorders', 'disease', 'diseases', 'syndrome', 'syndromes', 'condition',
  'conditions', 'related', 'induced', 'associated', 'antidote', 'antidotes', 'other', 'and', 'or',
  'general', 'prophylaxis', 'prevention', 'symptoms', 'symptom', 'type', 'types',
]);

// Small built-in synonym table so common short labels still match official
// label wording. Keys are lower-case words/abbreviations found in a concept.
const SYNONYMS = {
  acs: ['acute coronary syndrome', 'myocardial infarction', 'unstable angina'],
  mi: ['myocardial infarction'],
  htn: ['hypertension'],
  dm: ['diabetes mellitus'],
  t2dm: ['type 2 diabetes'],
  gerd: ['gastroesophageal reflux', 'erosive esophagitis'],
  copd: ['chronic obstructive pulmonary disease'],
  uti: ['urinary tract infection'],
  chf: ['heart failure'],
  af: ['atrial fibrillation'],
  dvt: ['deep vein thrombosis'],
  pe: ['pulmonary embolism'],
  ckd: ['chronic kidney disease'],
  adhd: ['attention deficit'],
  ptsd: ['posttraumatic stress', 'post-traumatic stress'],
  ocd: ['obsessive compulsive', 'obsessive-compulsive'],
  sleep: ['insomnia'],
  psychotic: ['schizophrenia', 'psychosis'],
  psychosis: ['schizophrenia'],
  mood: ['depression', 'bipolar', 'mania'],
  depressive: ['depression'],
  anxiety: ['panic disorder'],
  seizure: ['epilepsy'],
  seizures: ['epilepsy'],
  epilepsy: ['seizures'],
  pain: ['analgesia'],
  nausea: ['vomiting'],
  tumor: ['cancer', 'carcinoma'],
  neuroma: ['schwannoma'],
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function stem(word) {
  const w = word.toLowerCase();
  return w.length >= 6 ? w.slice(0, -2) : w.length === 5 ? w.slice(0, -1) : w;
}

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
}

function concept(words) {
  const sig = words.filter((w) => w && !STOP.has(w));
  if (!sig.length) return null;
  return sig.map((w) => new RegExp(`\\b${escapeRe(stem(w))}`, 'i'));
}

/**
 * Turns a label like "Drugs used in anxiety and sleep disorders" plus optional
 * extra keywords into a list of concepts: [{ text, regexes:[RegExp...] }].
 */
export function buildConcepts(label, extraKeywords = []) {
  const out = [];
  const seen = new Set();
  const push = (text, regexes) => {
    if (!regexes || !regexes.length) return;
    const key = regexes.map((r) => r.source).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, regexes });
  };

  const parts = String(label || '')
    .replace(/\(([^)]*)\)/g, ', $1 ,') // pull abbreviations in brackets out as their own part
    .split(/\band\/or\b|\b(?:and|or)\b|[,/&;]/i)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const p of parts) {
    const words = tokens(p);
    push(p, concept(words));
    for (const w of words) {
      (SYNONYMS[w] || []).forEach((syn) => push(syn, concept(tokens(syn))));
    }
  }
  // Whole label as a phrase too, e.g. "acute coronary syndrome" stays strict.
  for (const kw of extraKeywords) {
    const t = String(kw || '').trim();
    if (!t) continue;
    push(t, concept(tokens(t)) || concept(tokens(t).map((w) => w)));
    tokens(t).forEach((w) => (SYNONYMS[w] || []).forEach((syn) => push(syn, concept(tokens(syn)))));
  }
  return out;
}

/** First concept that matches `text`, with a short excerpt, or null. */
export function findMatch(concepts, text) {
  const hay = String(text || '');
  if (!hay) return null;
  for (const c of concepts) {
    if (c.regexes.every((re) => re.test(hay))) {
      const m = hay.match(c.regexes[0]);
      const at = m ? m.index : 0;
      const start = Math.max(0, at - 90);
      const end = Math.min(hay.length, at + 150);
      const excerpt = `${start > 0 ? '…' : ''}${hay.slice(start, end).replace(/\s+/g, ' ').trim()}${end < hay.length ? '…' : ''}`;
      return { concept: c.text, excerpt };
    }
  }
  return null;
}

const SALT_WORDS = new Set([
  'hydrochloride', 'hcl', 'sodium', 'potassium', 'calcium', 'sulfate', 'sulphate', 'tartrate', 'maleate',
  'mesylate', 'besylate', 'succinate', 'fumarate', 'acetate', 'citrate', 'phosphate', 'bromide', 'nitrate',
  'hydrobromide', 'dihydrate', 'monohydrate', 'anhydrous',
]);

/** "Zolpidem tartrate" -> "zolpidem" (used only as a second lookup attempt). */
export function stripSalt(name) {
  const w = String(name || '').trim().split(/\s+/);
  while (w.length > 1 && SALT_WORDS.has(w[w.length - 1].toLowerCase())) w.pop();
  return w.join(' ');
}
