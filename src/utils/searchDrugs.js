// ── searchDrugs.js ────────────────────────────────────────────────────────
// Searches ONLY fields that describe what a drug TREATS or IS USED FOR:
//   - generic_name, drug_class, drug_subclass  (identity)
//   - indications, primary_indications         (what it treats — both schemas)
//   - overview                                 (general description)
//
// Deliberately EXCLUDES adverse_effect, side_effects, contraindications etc.
// so that "diarrhea" returns drugs that CURE diarrhea, not drugs that CAUSE it.
//
// Results are sorted by relevance score. Every drug with any match is returned.
// Each result is annotated with:
//   _matchType    : 'name' | 'indication' | 'class' | 'overview'
//   _matchSnippet : short excerpt showing WHERE the match was found
// ──────────────────────────────────────────────────────────────────────────

// Fields that describe what a drug treats / is indicated for
const INDICATION_FIELDS = ['indications', 'primary_indications'];

// Broader description fields that may mention conditions
const OVERVIEW_FIELDS = ['overview'];

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

function scoreAndAnnotate(drug, q) {
  const name  = (drug.generic_name  || '').toLowerCase();
  const cls   = ((drug.drug_class   || '') + ' ' + (drug.drug_subclass || '')).toLowerCase().trim();

  let score        = 0;
  let matchType    = null;
  let matchSnippet = null;

  // ── 1. Drug name ─────────────────────────────────────────────────────────
  if (name === q)              { score += 120; matchType = 'name'; }
  else if (name.startsWith(q)) { score +=  90; matchType = 'name'; }
  else if (name.includes(q))   { score +=  70; matchType = 'name'; }
  else if (q.split(' ').filter(Boolean).every(w => name.includes(w))) {
                                 score +=  60; matchType = 'name'; }

  // ── 2. Indications / Uses ─────────────────────────────────────────────────
  // This is the core of the feature: any drug that lists the searched condition
  // as one of its uses will be found here.
  for (const field of INDICATION_FIELDS) {
    const raw  = drug[field] || '';
    const text = raw.toLowerCase();
    if (!text) continue;

    // Check each individual parsed condition for a precise match
    const conditions = tokeniseIndications(raw);
    let foundCondition = null;

    for (const cond of conditions) {
      const cl = cond.toLowerCase();
      if (cl === q) {
        // Exact condition match
        score += 100; foundCondition = cond; break;
      }
      if (cl.includes(q)) {
        // Condition contains the query (e.g. "acute diarrhea" contains "diarrhea")
        score += 85; foundCondition = cond; break;
      }
      if (q.split(' ').filter(Boolean).every(w => cl.includes(w))) {
        // All query words appear in this condition
        score += 75; foundCondition = cond; break;
      }
    }

    if (foundCondition) {
      matchType    = 'indication';
      matchSnippet = foundCondition;
      break; // found in indications — no need to check other fields
    }

    // Fallback: raw indications text contains the query somewhere
    if (text.includes(q)) {
      score       += 60;
      matchType    = 'indication';
      matchSnippet = snippet(raw, q);
      break;
    }
  }

  // ── 3. Drug class ─────────────────────────────────────────────────────────
  if (cls.includes(q)) {
    score += 30;
    if (!matchType) { matchType = 'class'; matchSnippet = drug.drug_class; }
  }

  // ── 4. Overview (general description) ─────────────────────────────────────
  for (const field of OVERVIEW_FIELDS) {
    const raw  = drug[field] || '';
    const text = raw.toLowerCase();
    if (text.includes(q)) {
      score += 20;
      if (!matchType) { matchType = 'overview'; matchSnippet = snippet(raw, q, 50); }
      break;
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

  return drugs
    .map(drug => {
      const { score, matchType, matchSnippet } = scoreAndAnnotate(drug, q);
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
