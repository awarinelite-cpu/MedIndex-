// ── searchDrugs.js ────────────────────────────────────────────────────────
// Searches fields that describe what a drug TREATS or IS USED FOR:
//   - generic_name, drug_class, drug_subclass       (identity)
//   - indications, primary_indications              (what it treats — both schemas)
//   - therapeutic_note, nstg_recommendations        (clinical uses — AI schema)
//   - overview                                      (general description)
//
// Deliberately EXCLUDES adverse_effect, side_effects, contraindications etc.
// so that "diarrhea" returns drugs that CURE diarrhea, not drugs that CAUSE it.
//
// Condition search is synonym- and spelling-aware:
//   "high blood pressure" also matches "hypertension" / "antihypertensive",
//   "diarrhea" matches "diarrhoea" (UK spelling), "seizures" matches "seizure".
//
// Results are sorted by relevance score. Every drug with any match is returned.
// Each result is annotated with:
//   _matchType    : 'name' | 'indication' | 'class' | 'overview'
//   _matchSnippet : short excerpt showing WHERE the match was found
// ──────────────────────────────────────────────────────────────────────────

// Fields that describe what a drug treats / is indicated for
const INDICATION_FIELDS = ['indications', 'primary_indications'];

// Secondary "uses" fields — clinical notes that often name the conditions a
// drug is used for (AI-generated schema). Scored slightly below indications.
const USES_FIELDS = ['therapeutic_note', 'nstg_recommendations'];

// Broader description fields that may mention conditions
const OVERVIEW_FIELDS = ['overview'];

// ── Condition synonyms ─────────────────────────────────────────────────────
// Each group is a set of interchangeable terms. If the user's query matches
// any term in a group, ALL terms in the group are searched for. Includes both
// lay terms ("high blood pressure") and clinical terms ("hypertension"), plus
// drug-action words ("antihypertensive") that often appear in overviews.
const SYNONYM_GROUPS = [
  ['hypertension', 'high blood pressure', 'high bp', 'raised blood pressure', 'htn', 'antihypertensive'],
  ['diabetes', 'diabetes mellitus', 'high blood sugar', 'hyperglycemia', 'hyperglycaemia', 'antidiabetic', 'blood sugar'],
  ['pain', 'analgesic', 'analgesia', 'painkiller', 'ache'],
  ['fever', 'pyrexia', 'antipyretic', 'high temperature'],
  ['malaria', 'antimalarial'],
  ['infection', 'bacterial infection', 'antibacterial', 'antibiotic'],
  ['diarrhoea', 'diarrhea', 'loose stools', 'antidiarrhoeal', 'antidiarrheal'],
  ['ulcer', 'peptic ulcer', 'gastric ulcer', 'gerd', 'heartburn', 'acid reflux', 'gastritis'],
  ['asthma', 'bronchospasm', 'wheezing', 'bronchodilator'],
  ['seizure', 'epilepsy', 'convulsion', 'fits', 'anticonvulsant', 'antiepileptic'],
  ['depression', 'antidepressant', 'low mood'],
  ['anxiety', 'anxiolytic', 'panic disorder'],
  ['allergy', 'allergic', 'antihistamine', 'hay fever', 'allergic rhinitis'],
  ['vomiting', 'nausea', 'emesis', 'antiemetic'],
  ['cholesterol', 'hyperlipidemia', 'hyperlipidaemia', 'dyslipidemia', 'dyslipidaemia', 'high cholesterol', 'lipid'],
  ['blood clot', 'clot', 'thrombosis', 'embolism', 'anticoagulant', 'blood thinner'],
  ['inflammation', 'anti-inflammatory', 'swelling'],
  ['worm', 'worms', 'helminth', 'deworming', 'anthelmintic', 'antihelminthic'],
  ['fungal infection', 'fungal', 'fungus', 'antifungal', 'candidiasis', 'thrush', 'ringworm'],
  ['hiv', 'antiretroviral', 'aids'],
  ['tuberculosis', 'tb', 'antitubercular'],
  ['anaemia', 'anemia', 'iron deficiency'],
  ['constipation', 'laxative'],
  ['cough', 'antitussive', 'expectorant'],
  ['insomnia', 'sleeplessness', 'sedative', 'hypnotic'],
  ['contraception', 'contraceptive', 'birth control', 'family planning'],
  ['migraine', 'headache'],
  ['arthritis', 'joint pain', 'rheumatism'],
  ['heart failure', 'cardiac failure', 'chf'],
  ['angina', 'chest pain'],
  ['prostate', 'bph', 'benign prostatic hyperplasia'],
  ['gout', 'hyperuricemia', 'hyperuricaemia', 'uric acid'],
  ['typhoid', 'typhoid fever', 'enteric fever'],
  ['scabies', 'lice', 'antiparasitic'],
  ['glaucoma', 'eye pressure', 'intraocular pressure'],
];

// Strip a single trailing 's' for naive plural matching ("seizures" → "seizure")
function singular(w) {
  return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
}

// Normalise British ↔ American medical spellings for comparison
// (anaemia→anemia, oedema→edema, diarrhoea→diarrhea, paediatric→pediatric)
function normaliseSpelling(t) {
  return t.replace(/ae/g, 'e').replace(/oe/g, 'e');
}

// Expand the user's query into every variant worth searching for:
// the query itself, its singular form, its spelling-normalised form,
// and every term in any matching synonym group.
export function expandQuery(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const variants = new Set([q]);
  variants.add(singular(q));
  variants.add(normaliseSpelling(q));
  variants.add(singular(normaliseSpelling(q)));

  const probes = [...variants];
  for (const group of SYNONYM_GROUPS) {
    const hit = group.some(term =>
      probes.some(p => p === term || p === normaliseSpelling(term) || singular(term) === p)
    );
    if (hit) group.forEach(term => variants.add(term));
  }

  return [...variants].filter(Boolean);
}

// Split indication text into individual condition tokens
function tokeniseIndications(text) {
  if (!text) return [];
  return text
    .split(/[,;\n•\-*/]+/)
    .map(s => s.trim().replace(/^\d+\.\s*/, ''))
    .filter(s => s.length > 2 && s.length < 150);
}

// Extract a readable snippet around a match
function snippet(text, q, radius = 70) {
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end   = Math.min(text.length, idx + q.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

// Does `text` contain `variant`, allowing UK/US spelling differences?
function textIncludes(text, variant) {
  if (text.includes(variant)) return true;
  return normaliseSpelling(text).includes(normaliseSpelling(variant));
}

function scoreAndAnnotate(drug, q, variants) {
  const name  = (drug.generic_name  || '').toLowerCase();
  const cls   = ((drug.drug_class   || '') + ' ' + (drug.drug_subclass || '')).toLowerCase().trim();

  let score        = 0;
  let matchType    = null;
  let matchSnippet = null;

  // ── 1. Drug name ─────────────────────────────────────────────────────────
  // Only the literal query is used for name matching — synonyms are for
  // conditions, not drug names.
  if (name === q)              { score += 120; matchType = 'name'; }
  else if (name.startsWith(q)) { score +=  90; matchType = 'name'; }
  else if (name.includes(q))   { score +=  70; matchType = 'name'; }
  else if (q.split(' ').filter(Boolean).every(w => name.includes(w))) {
                                 score +=  60; matchType = 'name'; }

  // ── 2. Indications / Uses ─────────────────────────────────────────────────
  // The core of condition search: any drug listing the searched condition
  // (or any synonym / spelling variant of it) as one of its uses is found here.
  outer:
  for (const field of INDICATION_FIELDS) {
    const raw = drug[field] || '';
    if (!raw) continue;

    const conditions = tokeniseIndications(raw);

    for (const variant of variants) {
      for (const cond of conditions) {
        const cl = cond.toLowerCase();
        if (cl === variant || normaliseSpelling(cl) === normaliseSpelling(variant)) {
          score += 100; matchType = 'indication'; matchSnippet = cond; break outer;
        }
        if (textIncludes(cl, variant)) {
          score += 85; matchType = 'indication'; matchSnippet = cond; break outer;
        }
        if (variant.split(' ').filter(Boolean).every(w => textIncludes(cl, w))) {
          score += 75; matchType = 'indication'; matchSnippet = cond; break outer;
        }
      }
      // Fallback: raw indications text contains this variant somewhere
      if (textIncludes(raw.toLowerCase(), variant)) {
        score += 60; matchType = 'indication'; matchSnippet = snippet(raw, variant); break outer;
      }
    }
  }

  // ── 3. Therapeutic notes / NSTG uses ─────────────────────────────────────
  // Clinical "uses" text — treated as an indication match for the UI, scored
  // slightly lower than the structured indication fields.
  if (matchType !== 'indication') {
    usesLoop:
    for (const field of USES_FIELDS) {
      const raw = drug[field] || '';
      if (!raw) continue;
      const text = raw.toLowerCase();
      for (const variant of variants) {
        if (textIncludes(text, variant)) {
          score += 50;
          matchType    = 'indication';
          matchSnippet = snippet(raw, variant);
          break usesLoop;
        }
      }
    }
  }

  // ── 4. Drug class / subclass ────────────────────────────────────────────
  // Matches the combined "class + subclass" text. A full-phrase match scores
  // highest; a match where every word of the query appears somewhere in the
  // class/subclass text (any order) still counts, so a query like "beta
  // blocker" matches a subclass of "Beta-blockers" and a subclass search
  // works the same way a drug-name search does.
  classLoop:
  for (const variant of variants) {
    if (textIncludes(cls, variant)) {
      score += 30;
      if (!matchType) { matchType = 'class'; matchSnippet = drug.drug_class || drug.drug_subclass; }
      break classLoop;
    }
    const words = variant.split(' ').filter(Boolean);
    if (words.length > 1 && words.every(w => textIncludes(cls, w))) {
      score += 25;
      if (!matchType) { matchType = 'class'; matchSnippet = drug.drug_subclass || drug.drug_class; }
      break classLoop;
    }
  }

  // ── 5. Overview (general description) ─────────────────────────────────────
  overviewLoop:
  for (const field of OVERVIEW_FIELDS) {
    const raw  = drug[field] || '';
    const text = raw.toLowerCase();
    if (!text) continue;
    for (const variant of variants) {
      if (textIncludes(text, variant)) {
        score += 20;
        if (!matchType) { matchType = 'overview'; matchSnippet = snippet(raw, variant, 50); }
        break overviewLoop;
      }
    }
  }

  return { score, matchType, matchSnippet };
}

// ── Public API ─────────────────────────────────────────────────────────────

// Full search — returns ALL matching drugs sorted by relevance.
// Used by BrowsePage.
export function searchDrugs(drugs, query) {
  const q = query.trim().toLowerCase();
  if (!q) return drugs;

  const variants = expandQuery(q);

  return drugs
    .map(drug => {
      const { score, matchType, matchSnippet } = scoreAndAnnotate(drug, q, variants);
      return { ...drug, _score: score, _matchType: matchType, _matchSnippet: matchSnippet };
    })
    .filter(d => d._score > 0)
    .sort((a, b) => b._score - a._score);
}

// Quick search — top N results for autocomplete dropdowns.
// Used by HomePage.
export function quickSearch(drugs, query, limit = 8) {
  return searchDrugs(drugs, query).slice(0, limit);
}
