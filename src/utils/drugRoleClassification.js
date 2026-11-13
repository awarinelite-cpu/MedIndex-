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
// Strength 2 and 3 are Main. Strength 1 is always Adjunct: a drug that only
// mentions the condition in passing (e.g. an antibiotic that lists "malaria
// prophylaxis" fourth, a paracetamol label that says "fever, e.g. in
// malaria") is never a main treatment, even when the condition has no
// dedicated drugs.

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

// Drop a "with … activity" qualifier from class names: "Antibiotics with
// Antimalarial Activity" is an antibiotic class, not an antimalarial one.
function identityText(drug) {
  const strip = (t) => String(t || '').replace(/\(?\s*\bwith\b[^)]*\)?/gi, ' ');
  return [strip(drug?.drug_class), strip(drug?.drug_subclass), drug?.generic_name]
    .filter(Boolean).join(' ').toLowerCase();
}

export function getMainIndicationStrength(drug, condition) {
  return explainMatch(drug, condition).strength;
}

// Same scoring as above, but also says WHICH keyword matched and where, so an
// admin can spot a bad keyword. Returns { strength, keyword, where }.
export function explainMatch(drug, condition) {
  const keywords = conditionKeywords(condition);
  const none = { strength: 0, keyword: null, where: null };
  if (keywords.length === 0) return none;
  const firstHit = (text) => keywords.find(kw => matchesAnyKeyword(text, [kw])) || null;

  const identity = identityText(drug);
  const idHit = firstHit(identity);
  if (idHit) return { strength: 3, keyword: idHit, where: 'class/name' };

  const indications = [drug?.indications, drug?.primary_indications]
    .filter(Boolean).join(' ').toLowerCase();
  if (!indications) return none;
  const anyHit = firstHit(indications);
  if (!anyHit) return none;

  // Strength 2 if the keyword shows up in the leading indication of either
  // field (they can hold different text), otherwise it's an incidental mention.
  const leading = [drug?.indications, drug?.primary_indications]
    .filter(Boolean).map(t => leadingIndication(String(t).toLowerCase()));
  const leadHit = leading.map(firstHit).find(Boolean);
  return leadHit
    ? { strength: 2, keyword: leadHit, where: 'first indication' }
    : { strength: 1, keyword: anyHit, where: 'passing mention in indications' };
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
  for (const drug of drugs) {
    let s = drug?.is_combination_therapy ? 0 : getMainIndicationStrength(drug, condition);
    const stored = ignoreStored || drug?.is_combination_therapy ? null : getStoredRole(drug, condition);
    storedByDrug.set(drug, stored);
    if (stored === 'main') s = Math.max(s, 2); // keeps a manually-placed Main drug above incidental ones
    strengthByDrug.set(drug, s);
  }

  const buckets = { main: [], adjunct: [], combination: [] };
  for (const drug of drugs) {
    if (drug?.is_combination_therapy) { buckets.combination.push(drug); continue; }
    const s = strengthByDrug.get(drug);
    const stored = storedByDrug.get(drug);
    // A passing mention (strength 1) is never Main, even if the condition has no dedicated drugs.
    const isMain = stored ? stored === 'main' : s >= 2;
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

// Does free text (e.g. the AI's one-line justification) mention any keyword?
export function textMatchesKeywords(text, keywords) {
  const kws = (Array.isArray(keywords) ? keywords : [])
    .map(k => (k || '').trim().toLowerCase()).filter(k => k.length >= 3);
  return matchesAnyKeyword(String(text || '').toLowerCase(), kws);
}


// ── Treatment-category grouping (Condition Profile) ─────────────────────────
// Maps a drug to a treatment category from its existing class / subclass /
// generic name. Returns null when no category keyword matches — the caller
// then falls back to the drug's own class, so conditions are never forced
// into categories that don't fit them.
export const TREATMENT_CATEGORY_ORDER = [
  'Targeted therapies',
  'Monoclonal antibodies',
  'Immunotherapy',
  'Chemotherapy',
  'Hormonal therapies',
  'Corticosteroids',
  'Antibiotics',
  'Antivirals',
  'Antifungals',
  'Antiparasitics',
];

const TREATMENT_CATEGORY_RULES = [
  ['Monoclonal antibodies', /monoclonal|\bantibody\b|\bmab\b/i],
  ['Immunotherapy',         /checkpoint|immunotherap|interferon|interleukin|car-?t\b/i],
  ['Targeted therapies',    /kinase|\bbtk\b|bcl-?2|\bparp\b|proteasome|\bmtor\b|\bcdk\s?4|\begfr\b|\bher2\b|\bbraf\b|\balk\b|pi3k|\bhdac\b|\bflt3\b|\bidh\d?\b|targeted/i],
  ['Chemotherapy',          /chemotherap|antineoplastic|alkylating|antimetabolite|nucleoside analog|purine analog|anthracycline|vinca|taxane|platinum|cytotoxic|topoisomerase/i],
  ['Hormonal therapies',    /hormon|aromatase|anti-?androgen|anti-?estrogen|\bserm\b|\bgnrh\b|androgen|estrogen|progest/i],
  ['Corticosteroids',       /corticosteroid|glucocorticoid/i],
  ['Antibiotics',           /antibiotic|antibacterial|penicillin|cephalosporin|macrolide|fluoroquinolone|aminoglycoside|tetracycline|carbapenem/i],
  ['Antivirals',            /antiviral|antiretroviral|nucleoside reverse|protease inhibitor|integrase/i],
  ['Antifungals',           /antifungal|azole antifungal|echinocandin/i],
  ['Antiparasitics',        /antimalarial|anthelmintic|antiparasitic|antiprotozoal/i],
];

export function getTreatmentCategory(drug) {
  const name = String(drug?.generic_name || '').trim();
  // Antibody names end in "-mab" (rituximab, obinutuzumab…).
  if (/mab$/i.test(name.split(/\s+/)[0] || '')) return 'Monoclonal antibodies';
  const text = `${drug?.drug_class || ''} ${drug?.drug_subclass || ''}`;
  for (const [label, re] of TREATMENT_CATEGORY_RULES) {
    if (re.test(text)) return label;
  }
  return null;
}
