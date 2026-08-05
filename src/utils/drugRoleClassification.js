// src/utils/drugRoleClassification.js
//
// A condition card's drug list is still strictly tag-based (condition_tags
// decides WHETHER a drug shows up here at all — see groupDrugsByCondition in
// systemConditions.js). This file only decides WHICH of three labelled
// buckets an already-tagged drug is displayed under:
//
//   'main'        — the drug's OWN stated Indications text supports this
//                    condition directly. Strict on purpose: checked only
//                    against indications/primary_indications, never against
//                    drug_class, pharmacology, or subclass, so a drug that's
//                    merely "in the same family" doesn't get counted as a
//                    main indication for something it isn't actually used for.
//   'adjunct'      — tagged to this condition, but only supported by a
//                    broader signal (class, mechanism, an admin/AI note) —
//                    i.e. supportive, symptomatic, or off-label use rather
//                    than a first-line indication.
//   'combination'  — not a single drug at all: a saved multi-drug regimen
//                    (see IndicationCombinationPanel's Save button), flagged
//                    with is_combination_therapy on its own record.

const STOPWORDS = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'with', 'in', 'to', 'for']);

function hasPhrase(text, kw) {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

// Strict check: does the drug's OWN stated indications support this
// condition? Deliberately narrower than the general tag-matching used
// elsewhere (matchesConditionByKeyword in systemConditions.js), which also
// looks at overview/class/pharmacology — on purpose, since that broader
// check is for "does this belong on the card at all", while this one is for
// "is this a MAIN indication, or something more adjunct".
export function isMainIndication(drug, condition) {
  const text = [drug?.indications, drug?.primary_indications].filter(Boolean).join(' ').toLowerCase();
  if (!text) return false;
  const keywords = Array.isArray(condition?.keywords) ? condition.keywords : [];
  if (keywords.length === 0) return false;

  return keywords.some(kwRaw => {
    const kw = (kwRaw || '').trim().toLowerCase();
    if (kw.length < 3) return false;
    if (hasPhrase(text, kw)) return true;
    const words = kw.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
    if (words.length < 2) return false; // single-word keyword already tried as a phrase above
    return words.every(w => hasPhrase(text, w));
  });
}

export function getDrugTherapyRole(drug, condition) {
  if (drug?.is_combination_therapy) return 'combination';
  if (isMainIndication(drug, condition)) return 'main';
  return 'adjunct';
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
