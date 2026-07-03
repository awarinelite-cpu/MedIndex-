// ── searchDrugs.js ────────────────────────────────────────────────────────
// Relevance-ranked drug search that matches across name, all indication
// fields (both AI schema + legacy CSV schema), drug class, and overview.
//
// Returns drugs sorted by match score, each annotated with:
//   _matchType    : 'name' | 'indication' | 'class' | 'overview'
//   _matchSnippet : short excerpt showing WHY the drug appeared
// ──────────────────────────────────────────────────────────────────────────

// All fields that contain indication / uses data.
// Both AI-generated schema (indications) and legacy CSV schema (primary_indications).
const INDICATION_FIELDS = ['indications', 'primary_indications', 'adult_dose'];
const OVERVIEW_FIELDS   = ['overview', 'pharmacology', 'mechanism', 'adverse_effect', 'side_effects'];

// Split a raw indication string into individual condition tokens.
function tokeniseIndications(text) {
  if (!text) return [];
  return text
    .split(/[,;\n•\-*/()]+/)
    .map(s => s.trim().replace(/^\d+\.\s*/, ''))
    .filter(s => s.length > 2 && s.length < 120);
}

// Extract a short snippet around a match in a longer text.
function snippet(text, q, radius = 60) {
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end   = Math.min(text.length, idx + q.length + radius);
  const raw   = text.slice(start, end).trim();
  return (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : '');
}

function scoreAndAnnotate(drug, q) {
  const name      = (drug.generic_name || '').toLowerCase();
  const drugClass = (drug.drug_class   || '').toLowerCase() + ' ' + (drug.drug_subclass || '').toLowerCase();

  let score       = 0;
  let matchType   = null;
  let matchSnippet = null;

  // ── 1. Name matches ──────────────────────────────────────────────────────
  if (name === q) {
    score += 120; matchType = 'name';
  } else if (name.startsWith(q)) {
    score += 90;  matchType = 'name';
  } else if (name.includes(q)) {
    score += 70;  matchType = 'name';
  } else if (q.split(' ').every(w => name.includes(w))) {
    // All words in query appear in name
    score += 60;  matchType = 'name';
  }

  // ── 2. Indication / uses matches (highest clinical relevance) ────────────
  for (const field of INDICATION_FIELDS) {
    const raw  = drug[field] || '';
    const text = raw.toLowerCase();
    if (!text) continue;

    // Check individual parsed conditions for precise match
    const conditions = tokeniseIndications(raw);
    for (const cond of conditions) {
      const cl = cond.toLowerCase();
      if (cl === q) {
        // Exact condition match — very high score
        score += 100; matchType = 'indication'; matchSnippet = cond;
        break;
      }
      if (cl.includes(q) || q.split(' ').every(w => cl.includes(w))) {
        // Query terms all appear in this condition
        score += 80; matchType = 'indication'; matchSnippet = cond;
        break;
      }
    }

    // Fallback: raw text contains query as substring
    if (!matchSnippet && text.includes(q)) {
      score += 60; matchType = 'indication';
      matchSnippet = snippet(raw, q);
    }

    if (matchSnippet) break; // found a good indication match, no need to check next field
  }

  // ── 3. Drug class match ─────────────────────────────────────────────────
  if (drugClass.includes(q)) {
    score += 30;
    if (!matchType) { matchType = 'class'; matchSnippet = drug.drug_class; }
  }

  // ── 4. Overview / pharmacology (contextual, lower weight) ────────────────
  for (const field of OVERVIEW_FIELDS) {
    const raw  = drug[field] || '';
    const text = raw.toLowerCase();
    if (text.includes(q)) {
      score += 15;
      if (!matchType) { matchType = 'overview'; matchSnippet = snippet(raw, q, 50); }
      break;
    }
  }

  return { score, matchType, matchSnippet };
}

// ── Public API ─────────────────────────────────────────────────────────────
export function searchDrugs(drugs, query) {
  const q = query.trim().toLowerCase();
  if (!q) return drugs.map(d => ({ ...d, _matchType: null, _matchSnippet: null }));

  return drugs
    .map(drug => {
      const { score, matchType, matchSnippet } = scoreAndAnnotate(drug, q);
      return { ...drug, _score: score, _matchType: matchType, _matchSnippet: matchSnippet };
    })
    .filter(d => d._score > 0)
    .sort((a, b) => b._score - a._score);
}

// Lightweight version for autocomplete dropdowns — returns top N results fast.
export function quickSearch(drugs, query, limit = 8) {
  return searchDrugs(drugs, query).slice(0, limit);
}
