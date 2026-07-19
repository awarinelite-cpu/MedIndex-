// src/utils/findDuplicateDrugs.js
//
// Finds drugs that occupy more than one document in the `drugs` collection
// under (effectively) the same name. This is separate from — and doesn't
// touch — a drug appearing in multiple taxonomy classes/subclasses, which
// is normal and handled entirely by classifyDrugTaxonomyAll() reading a
// single drug document. What this file finds is genuine duplicate
// documents: the same drug saved more than once, usually because it was
// written by different pipelines (CSV import, AI class/subclass insight,
// AI search fallback, condition insight, etc.) that generate Firestore doc
// IDs slightly differently, so the same generic name ends up under two
// different doc IDs instead of updating the existing one.
//
// Two confidence tiers, deliberately conservative:
//   - `exact`  — names are identical once trivial formatting differences
//     (case, extra whitespace, accents, curly quotes/trademark symbols)
//     are normalized away. Safe to pre-select for auto-cleanup.
//   - `review` — names are close but not exact (e.g. a likely typo or a
//     genuinely different salt/formulation). Never pre-selected — an
//     admin has to look at each one and decide.
import { getMissingGroups, REQUIRED_FIELD_GROUPS } from './aiDrugSave';

// Conservative: only formatting noise, never anything that could change
// clinical meaning (so no stripping of salts, strengths, or dosage forms).
export function normalizeDrugKey(name) {
  return (name || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[®™©]/g, '')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'") // curly quotes -> straight
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Small, dependency-free Levenshtein distance for the review tier.
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[n];
}

// Higher = more complete / more trustworthy to keep as the survivor.
export function completenessScore(drug) {
  const filledGroups = REQUIRED_FIELD_GROUPS.length - getMissingGroups(drug).length;
  const seedPenalty = drug._seed ? -100 : 0;
  const extras = ['brand_names', 'nafdac_no', 'dosage_forms', 'pronunciation']
    .filter(f => drug[f] && String(drug[f]).trim()).length;
  const fieldCount = Object.keys(drug).filter(k => drug[k] != null && drug[k] !== '').length;
  return filledGroups * 100 + extras * 5 + fieldCount + seedPenalty;
}

// Sorts a group's drugs best-first (best = the one to keep).
function sortByKeepPriority(drugs) {
  return [...drugs].sort((a, b) => completenessScore(b) - completenessScore(a));
}

/**
 * @param {Array} drugs - drugs with a firestoreId (or id) field.
 * @returns {{ exact: Array<{key, drugs}>, review: Array<{key, drugs, reason}> }}
 */
export function findDuplicateDrugGroups(drugs) {
  const list = (drugs || []).filter(d => d.generic_name && (d.firestoreId || d.id));

  // ── Exact tier: group by normalized name ──────────────────────────────
  const byKey = new Map();
  for (const d of list) {
    const key = normalizeDrugKey(d.generic_name);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(d);
  }
  const exact = [];
  for (const [key, group] of byKey) {
    if (group.length > 1) exact.push({ key, drugs: sortByKeepPriority(group) });
  }
  exact.sort((a, b) => b.drugs.length - a.drugs.length);

  // ── Review tier: close-but-not-identical names, skipping anything
  // already grouped as an exact match. Only compares names of similar
  // length (avoids "B" matching "Bendroflumethiazide") and requires a
  // small edit distance relative to length so short names need a near
  // perfect match while long names tolerate a couple of character diffs.
  const singles = list.filter(d => byKey.get(normalizeDrugKey(d.generic_name))?.length === 1);
  const reviewed = new Set();
  const review = [];
  for (let i = 0; i < singles.length; i++) {
    if (reviewed.has(i)) continue;
    const a = singles[i];
    const keyA = normalizeDrugKey(a.generic_name);
    let cluster = null;
    for (let j = i + 1; j < singles.length; j++) {
      if (reviewed.has(j)) continue;
      const b = singles[j];
      const keyB = normalizeDrugKey(b.generic_name);
      const maxLen = Math.max(keyA.length, keyB.length);
      if (maxLen < 5) continue; // too short to compare safely
      const dist = levenshtein(keyA, keyB);
      const threshold = maxLen <= 8 ? 1 : maxLen <= 14 ? 2 : 3;
      if (dist > 0 && dist <= threshold) {
        if (!cluster) cluster = { key: keyA, drugs: [a], reason: 'Similar spelling' };
        cluster.drugs.push(b);
        reviewed.add(j);
      }
    }
    if (cluster) {
      reviewed.add(i);
      cluster.drugs = sortByKeepPriority(cluster.drugs);
      review.push(cluster);
    }
  }
  review.sort((a, b) => b.drugs.length - a.drugs.length);

  return { exact, review };
}
