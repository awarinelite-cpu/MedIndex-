// src/utils/drugRoleClassification.js
//
// A condition card's drug list is still strictly tag-based (condition_tags
// decides WHETHER a drug shows up here at all — see groupDrugsByCondition in
// systemConditions.js). This file only decides WHICH of three labelled
// buckets an already-tagged drug is displayed under:
//
//   'main'        — the drug is a core treatment for this condition: either
//                    it IS the condition's drug (its class, subclass or
//                    generic name matches one of the condition's keywords —
//                    e.g. an "Antimalarial" under Malaria), or its own
//                    stated Indications lead with the condition.
//   'adjunct'      — tagged to this condition, but only supported by a
//                    weaker signal — the condition is mentioned somewhere in
//                    the drug's indications without being its main use
//                    (supportive, symptomatic or off-label use).
//   'combination'  — not a single drug at all: a saved multi-drug regimen
//                    (see IndicationCombinationPanel's Save button), flagged
//                    with is_combination_therapy on its own record.
//
// How strongly a drug belongs to a condition is scored 0–3 by
// getMainIndicationStrength():
//
//   3 — class / subclass / generic name matches a condition keyword
//   2 — the FIRST thing in the drug's indications matches a keyword
//   1 — a keyword appears later in the indications (an incidental mention)
//   0 — no match
//
// Strength 2 and 3 are always Main. Strength 1 is Main too, UNLESS the
// condition has at least one strength-3 drug in its list — then the
// condition clearly has dedicated drugs, and a drug that only mentions it in
// passing (e.g. an antibiotic that lists "malaria prophylaxis" fourth, a
// paracetamol label that says "fever, e.g. in malaria") drops to Adjunct.
// Conditions whose keywords never match any drug's class or name (most of
// them) have no strength-3 drugs, so nothing changes for those.

const STOPWORDS = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'with', 'in', 'to', 'for']);

function hasPhrase(text, kw) {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Optional plural so "Antimalarials" / "Artemisinins" match "antimalarial" / "artemisinin".
  return new RegExp(`(^|[^a-z0-9])${escaped}(s|es)?([^a-z0-9]|$)`, 'i').test(text);
}

function conditionKeywords(condition) {
  const list = Array.isArray(condition?.keywords) ? condition.keywords : [];
  return list.map(k => (k || '').trim().toLowerCase()).filter(k => k.length >= 3);
}

// Does `text` support one of the keywords — as the whole phrase, or (for a
// multi-word keyword) with every significant word present somewhere?
function matchesAnyKeyword(text, keywords) {
  if (!text) return false;
  return keywords.some(kw => {
    if (hasPhrase(text, kw)) return true;
    const words = kw.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
    if (words.length < 2) return false; // single-word keyword already tried as a phrase above
    return words.every(w => hasPhrase(text, w));
  });
}

// The leading indication: everything before the first comma, semicolon,
// newline, bullet or sentence end of the drug's indications text.
function leadingIndication(text) {
  const first = text.split(/[,;\n•]|\.\s/)[0] || '';
  return first.trim();
}

export function getMainIndicationStrength(drug, condition) {
  const keywords = conditionKeywords(condition);
  if (keywords.length === 0) return 0;

  // Drop a "with … activity" qualifier from class names: "Antibiotics with
  // Antimalarial Activity" is an antibiotic class, not an antimalarial one.
  const stripQualifier = (t) => String(t).replace(/\(?\s*\bwith\b[^)]*\)?/gi, ' ');
  const identity = [stripQualifier(drug?.drug_class || ''), stripQualifier(drug?.drug_subclass || ''), drug?.generic_name]
    .filter(Boolean).join(' ').toLowerCase();
  if (matchesAnyKeyword(identity, keywords)) return 3;

  const indications = [drug?.indications, drug?.primary_indications]
    .filter(Boolean).join(' ').toLowerCase();
  if (!indications) return 0;
  if (!matchesAnyKeyword(indications, keywords)) return 0;

  // Strength 2 if the keyword shows up in the leading indication of either
  // field (they can hold different text), otherwise it's an incidental mention.
  const leading = [drug?.indications, drug?.primary_indications]
    .filter(Boolean).map(t => leadingIndication(String(t).toLowerCase()));
  return leading.some(l => matchesAnyKeyword(l, keywords)) ? 2 : 1;
}

// Kept for any caller that just wants a yes/no: any supporting signal at all.
export function isMainIndication(drug, condition) {
  return getMainIndicationStrength(drug, condition) > 0;
}

// Single-drug role, without knowing what else is on the card. Prefer
// classifyDrugsByRole() when you have the whole list — it also demotes
// incidental mentions once the condition has dedicated drugs.
export function getDrugTherapyRole(drug, condition) {
  if (drug?.is_combination_therapy) return 'combination';
  return getMainIndicationStrength(drug, condition) > 0 ? 'main' : 'adjunct';
}

// Admin-saved role for this drug under this condition, written by the
// "Re-sort drugs" button (drug.condition_roles[conditionId] = 'main' | 'adjunct').
// When present it wins over the automatic score, so a re-sort sticks.
export function getStoredRole(drug, condition) {
  const r = drug?.condition_roles?.[condition?.id];
  return r === 'main' || r === 'adjunct' ? r : null;
}

// Splits a condition's drugs into the three buckets. The Main bucket is
// sorted strongest first (dedicated drugs, then drugs that lead with the
// condition, then the rest), alphabetically within a tier. `strengthByDrug`
// maps each drug object to its score, for ordering groups on screen.
// Pass { ignoreStored: true } to get the purely automatic result (used by
// the Re-sort button to decide what to save).
export function classifyDrugsByRole(drugs, condition, { ignoreStored = false } = {}) {
  const strengthByDrug = new Map();
  const storedByDrug = new Map();
  let hasDedicated = false;
  for (const drug of drugs) {
    let s = drug?.is_combination_therapy ? 0 : getMainIndicationStrength(drug, condition);
    const stored = ignoreStored || drug?.is_combination_therapy ? null : getStoredRole(drug, condition);
    storedByDrug.set(drug, stored);
    if (stored === 'main') s = Math.max(s, 2); // keeps a manually-placed Main drug above incidental ones
    strengthByDrug.set(drug, s);
    if (s === 3) hasDedicated = true;
  }

  const buckets = { main: [], adjunct: [], combination: [] };
  for (const drug of drugs) {
    if (drug?.is_combination_therapy) { buckets.combination.push(drug); continue; }
    const s = strengthByDrug.get(drug);
    const stored = storedByDrug.get(drug);
    const isMain = stored ? stored === 'main' : (s >= 2 || (s === 1 && !hasDedicated));
    buckets[isMain ? 'main' : 'adjunct'].push(drug);
  }

  const byName = (a, b) => (a.generic_name || '').localeCompare(b.generic_name || '', 'en', { sensitivity: 'base' });
  buckets.main.sort((a, b) => (strengthByDrug.get(b) - strengthByDrug.get(a)) || byName(a, b));

  return { ...buckets, strengthByDrug };
}

// Heading styling per bucket. Main is intentionally bold + dark army green
// per house style; the other two get their own distinct colors so the three
// sections are easy to tell apart at a glance.
export const THERAPY_ROLE_META = {
  main: {
    label: 'Main Indicated Drugs',
    color: '#3F4B23', // dark army green
    bg: '#F2F4EA',
    border: '#D7DCC2',
  },
  adjunct: {
    label: 'Adjunct Therapy Drugs',
    color: '#6D28D9', // violet
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  combination: {
    label: 'Combination Therapy Drugs',
    color: '#065F46', // emerald — matches the combination-regimen panel below
    bg: '#ECFDF5',
    border: '#6EE7B7',
  },
};

export const THERAPY_ROLE_ORDER = ['main', 'adjunct', 'combination'];
