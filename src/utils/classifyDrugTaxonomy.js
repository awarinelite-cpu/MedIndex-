// src/utils/classifyDrugTaxonomy.js
//
// Maps a drug's existing free-text `drug_class` / `drug_subclass` /
// `indications` fields onto the 21-chapter formulary taxonomy defined in
// ../data/drugClassTaxonomy.js. Every drug already in the app (Firestore
// or the local seed file) has a pharmacologically specific drug_class
// string (e.g. "ACE Inhibitor", "Benzodiazepine", "Antibiotic") rather
// than the formulary chapter/subclass names verbatim, so this file is a
// keyword-rule translation layer between the two.
//
// Rules are ordered from most specific to most general — the first rule
// whose pattern matches wins. Anything that matches nothing at all falls
// into the UNCLASSIFIED_BUCKET rather than being guessed at.

import { DRUG_CLASS_TAXONOMY, UNCLASSIFIED_BUCKET } from '../data/drugClassTaxonomy';

// Each rule tests against a single combined lowercase string built from
// drug_class + drug_subclass (+ indications as a last-resort signal).
const RULES = [
  // ── 9: Anti-infective drugs ──────────────────────────────────────────
  [/aminoglycoside/, 'anti-infective', 'ai-antibacterial'],
  [/cephalosporin/, 'anti-infective', 'ai-antibacterial'],
  [/penicillin|aminopenicillin|amoxicillin/, 'anti-infective', 'ai-antibacterial'],
  [/fluoroquinolone|quinolone/, 'anti-infective', 'ai-antibacterial'],
  [/macrolide/, 'anti-infective', 'ai-antibacterial'],
  [/tetracycline/, 'anti-infective', 'ai-antibacterial'],
  [/glycopeptide|vancomycin/, 'anti-infective', 'ai-antibacterial'],
  [/lincosamide|clindamycin/, 'anti-infective', 'ai-antibacterial'],
  [/sulfonamide|sulphonamide|trimethoprim/, 'anti-infective', 'ai-antibacterial'],
  [/nitroimidazole|metronidazole/, 'anti-infective', 'ai-antibacterial'],
  [/chloramphenicol/, 'anti-infective', 'ai-antibacterial'],
  [/antitubercular|antituberculosis|rifamycin|isoniazid/, 'anti-infective', 'ai-antibacterial'],
  [/antileprosy/, 'anti-infective', 'ai-antibacterial'],
  [/\bantibiotic\b/, 'anti-infective', 'ai-antibacterial'],
  [/antifungal/, 'anti-infective', 'ai-antifungal'],
  [/antimalarial/, 'anti-infective', 'ai-antiprotozoal'],
  [/antiprotozoal|antiamoebic|antigiardial|antitrichomonal|antileishmanial|antitrypanosomal/, 'anti-infective', 'ai-antiprotozoal'],
  [/anthelmintic|antifilarial|antitrematode/, 'anti-infective', 'ai-anthelmintics'],
  [/antiretroviral|nrti|nnrtis?|nucleoside reverse|integrase strand|protease inhibitor.*hiv/, 'anti-infective', 'ai-antiviral'],
  [/antiviral|neuraminidase inhibitor/, 'anti-infective', 'ai-antiviral'],

  // ── 5: Cardiovascular system drugs ──────────────────────────────────
  [/ace inhibitor|angiotensin[- ]converting/, 'cardiovascular', 'cv-antihypertensive'],
  [/arb\b|angiotensin receptor blocker/, 'cardiovascular', 'cv-antihypertensive'],
  [/arni|neprilysin/, 'cardiovascular', 'cv-heart-failure'],
  [/calcium channel blocker/, 'cardiovascular', 'cv-antihypertensive'],
  [/centrally acting antihypertensive/, 'cardiovascular', 'cv-antihypertensive'],
  [/alpha-blocker|alpha[- ]adrenoceptor/, 'cardiovascular', 'cv-antihypertensive'],
  [/direct vasodilator/, 'cardiovascular', 'cv-antihypertensive'],
  [/beta-blocker|beta[- ]adrenoceptor/, 'cardiovascular', 'cv-antihypertensive'],
  [/thiazide|loop diuretic|potassium-sparing diuretic|osmotic diuretic|mineralocorticoid receptor antagonist/, 'cardiovascular', 'cv-diuretics'],
  [/\bdiuretic\b/, 'cardiovascular', 'cv-diuretics'],
  [/sglt2 inhibitor.*heart failure|heart failure/, 'cardiovascular', 'cv-heart-failure'],
  [/antiarrhythmic/, 'cardiovascular', 'cv-antiarrhythmic'],
  [/nitrate\b|anti-?anginal/, 'cardiovascular', 'cv-antianginal'],
  [/anticoagulant|doac\b|vitamin k antagonist|heparin/, 'cardiovascular', 'cv-antithrombotic'],
  [/antiplatelet/, 'cardiovascular', 'cv-antithrombotic'],
  [/fibrinolytic|thrombolytic/, 'cardiovascular', 'cv-antithrombotic'],
  [/statin|hmg-coa|pcsk9|fibrate|bile acid sequestrant|lipid-lowering|lipid-regulating/, 'cardiovascular', 'cv-lipid'],
  [/vasopressor|inotrope|catecholamine/, 'cardiovascular', 'cv-hypotension'],
  [/soluble guanylate cyclase/, 'cardiovascular', 'cv-antihypertensive'],

  // ── 1: Central Nervous System (CNS) drugs ───────────────────────────
  [/benzodiazepine|non-benzodiazepine hypnotic|z-drug|azapirone/, 'cns', 'cns-anxiety-sleep'],
  [/atypical antipsychotic|typical antipsychotic|antipsychotic/, 'cns', 'cns-psychotic'],
  [/mood stabiliser|mood stabilizer/, 'cns', 'cns-mood'],
  [/tricyclic antidepressant|\btca\b|ssri|snri|maoi|nassa|\brima\b|\bsari\b|antidepressant/, 'cns', 'cns-mood'],
  [/anti-parkinson|dopamine agonist|comt inhibitor|mao-b inhibitor/, 'cns', 'cns-parkinson'],
  [/anticonvulsant|antiepileptic/, 'cns', 'cns-anticonvulsants'],
  [/opioid analgesic|opioid antagonist|partial opioid agonist|non-opioid analgesic|nsaid|analgesic/, 'cns', 'cns-analgesics'],
  [/triptan|migraine/, 'cns', 'cns-migraine'],
  [/acetylcholinesterase inhibitor|anti-dementia/, 'cns', 'cns-dementia'],
  [/cns stimulant|adhd|\bnri\b/, 'cns', 'cns-adhd'],
  [/smoking cessation|alcohol deterrent|anti-craving|substance dependence/, 'cns', 'cns-substance-dependence'],
  [/antivertigo|antiemetic.*vertigo/, 'cns', 'cns-antivertigo'],

  // ── 3: Drugs used in anaesthesia ────────────────────────────────────
  [/iv general anaesthetic|inhalational anaesthetic|general anaesthetic/, 'anaesthesia', 'anaes-general'],
  [/non-depolarising neuromuscular blocker|neuromuscular blocking|neuromuscular blocker|nmb reversal/, 'anaesthesia', 'anaes-muscle-relaxants'],
  [/local anaesthetic/, 'anaesthesia', 'anaes-local'],

  // ── 4: Drugs used in gastrointestinal diseases ──────────────────────
  [/proton pump inhibitor|ppi\b|h2-receptor antagonist|antacid/, 'gastrointestinal', 'gi-antacids-ulcer'],
  [/antiemetic|prokinetic/, 'gastrointestinal', 'gi-antiemetic'],
  [/laxative/, 'gastrointestinal', 'gi-laxatives'],
  [/antidiarrhoeal|antidiarrheal/, 'gastrointestinal', 'gi-diarrhoea'],
  [/antispasmodic|spasmolytic/, 'gastrointestinal', 'gi-antispasmodic'],

  // ── 6: Drugs affecting blood and nutrition ──────────────────────────
  [/iron-deficiency|antianemic|antianaemic|haematinic|haematopoietic growth factor|erythropoietin/, 'blood-nutrition', 'bn-antianemic'],
  [/^vitamin|multivitamin/, 'blood-nutrition', 'bn-vitamins'],
  [/mineral supplement|electrolyte supplement/, 'blood-nutrition', 'bn-minerals'],
  [/\biv fluid\b|intravenous fluid/, 'blood-nutrition', 'bn-electrolyte-solutions'],

  // ── 7: Drugs acting on the respiratory tract ────────────────────────
  [/anticholinergic \(inhaled\)|lama\b|laba\b|bronchodilator|beta-2 agonist|leukotriene receptor antagonist|corticosteroid.*inhaled/, 'respiratory', 'resp-asthma-copd'],
  [/expectorant|mucolytic|cough suppressant|antitussive/, 'respiratory', 'resp-expectorants'],
  [/decongestant/, 'ent', 'ent-nasal'],

  // ── 8: Antiallergics and drugs used in anaphylaxis ──────────────────
  [/antihistamine/, 'antiallergics', 'allergy-antihistamines'],

  // ── 10: Endocrine system drugs ──────────────────────────────────────
  // ── Site-specific corticosteroids — must precede the generic
  // "corticosteroid" → systemic (endocrine) rule below, since a topical,
  // intranasal, inhaled, or ophthalmic corticosteroid belongs to that
  // site's own chapter, not chapter 10:3. ─────────────────────────────
  [/intranasal corticosteroid|nasal corticosteroid/, 'ent', 'ent-nasal'],
  [/ophthalmic corticosteroid|corticosteroid.*eye/, 'ophthalmological', 'eye-antiinflam-antiallergic'],
  [/topical corticosteroid|dermatological corticosteroid/, 'dermatological', 'derm-antiinflam-antipruritic'],

  // ── 15: Dermatological drugs (site-specific skin conditions) ────────
  [/scabicide|pediculicide/, 'dermatological', 'derm-antiinfective'],
  [/topical antifungal|dermatophyte/, 'dermatological', 'derm-antiinfective'],
  [/\bwart\b/, 'dermatological', 'derm-warts'],
  [/psoriasis/, 'dermatological', 'derm-psoriasis'],
  [/\bacne\b/, 'dermatological', 'derm-acne'],
  [/actinic keratosis/, 'dermatological', 'derm-actinic-keratosis'],

  [/insulin|sulfonylurea|sulphonylurea|biguanide|thiazolidinedione|dpp-4|sglt2 inhibitor|alpha glucosidase|antidiabetic/, 'endocrine', 'endo-antidiabetic'],
  [/antithyroid|thyroid hormone/, 'endocrine', 'endo-thyroid'],
  [/corticosteroid/, 'endocrine', 'endo-corticosteroids'],
  [/estrogen|progestogen|androgen|sex hormone/, 'endocrine', 'endo-sex-hormones'],
  [/pituitary|gonadotropin|somatostatin/, 'endocrine', 'endo-pituitary'],

  // ── 11: Reproductive health, perinatal care, urinary tract ──────────
  [/uterotonic|tocolytic|neonatal/, 'reproductive-urinary', 'repro-obstetrics-neonatal'],
  [/contracept/, 'reproductive-urinary', 'repro-contraceptives'],
  [/benign prostatic|erectile dysfunction|overactive bladder|urological/, 'reproductive-urinary', 'repro-genitourinary'],

  // ── 12: Antineoplastic / immunosuppressive / palliative ─────────────
  [/cytotoxic|antineoplastic|alkylating|monoclonal antibod|protein kinase inhibitor|taxane|topoisomerase/, 'oncology-immunosuppressive', 'onco-cytotoxic'],
  [/immunosuppress|calcineurin inhibitor|tnf-alpha inhibitor/, 'oncology-immunosuppressive', 'onco-immunosuppressive'],
  [/immunostimulant|interferon|colony stimulating factor/, 'oncology-immunosuppressive', 'onco-immunostimulants'],

  // ── 13: Ophthalmological preparations ────────────────────────────────
  [/anticholinergic \(ophthalmic\)|mydriatic|cycloplegic/, 'ophthalmological', 'eye-mydriatics'],
  [/antiglaucoma|\bmiotic\b/, 'ophthalmological', 'eye-antiglaucoma'],

  // ── 17: Immunological products and vaccines ─────────────────────────
  [/vaccine/, 'immunological', 'immuno-vaccines'],
  [/immunoglobulin|antiserum|antitoxin/, 'immunological', 'immuno-sera'],

  // ── 19: Antidotes and other substances used in poisoning ────────────
  [/antidote|glutathione precursor|anticholinesterase.*reversal/, 'antidotes-poisoning', 'poison-specific-antidotes'],

  // ── 2: Musculoskeletal and joint diseases ───────────────────────────
  [/nsaid.*antirheumatic|dmard|antirheumatic/, 'musculoskeletal', 'msk-antirheumatic'],
  [/gout|hyperuricemia/, 'musculoskeletal', 'msk-gout'],

  // ── 15: Dermatological drugs ─────────────────────────────────────────
  [/wound dressing/, 'dermatological', 'derm-wound-dressings'],
  [/ultraviolet blocking|sunscreen/, 'dermatological', 'derm-uv-blocking'],
  [/skin antiseptic|astringent/, 'dermatological', 'derm-astringents'],

  // ── 20: Diagnostic agents, medical consumables & equipment ──────────
  [/radiocontrast|contrast media/, 'diagnostic-equipment', 'diag-agents'],

  // ── 21: Natural health products ─────────────────────────────────────
  [/herbal/, 'natural-health', 'nhp-herbal'],

  // ── Generic fallbacks — broad terms only reached if nothing more
  // specific above matched first. ───────────────────────────────────
  [/antiparasitic/, 'dermatological', 'derm-antiinfective'],
  [/anticholinergic/, 'gastrointestinal', 'gi-antispasmodic'],
];

function buildHaystack(drug) {
  return [drug.drug_class, drug.drug_subclass, drug.indications, drug.primary_indications]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
}

// ── Fallback layer: generic token-overlap match against the taxonomy's
// own subclass (and parent class) names ─────────────────────────────
// The explicit RULES above cover the pharmacological terms actually seen
// in this app's drug_class/drug_subclass data. But new drugs — especially
// ones added later through the CSV import pipeline — may already carry a
// drug_class/drug_subclass string that closely resembles an EMDEX
// subclass name itself (e.g. "Beta-adrenoceptor blockers, Selective",
// "Osmotic laxatives", "Nasal decongestants"). Rather than requiring a
// hand-written rule for every such phrase, this pass tokenizes the
// drug's class/subclass text and the taxonomy's own subclass/class
// names, and picks whichever subclass shares the most meaningful words.
// It only runs when nothing in RULES matched, and only commits to a
// match when there's at least one real (non-generic) word in common.
const STOPWORDS = new Set([
  'and', 'or', 'the', 'of', 'a', 'an', 'for', 'used', 'in', 'drugs', 'drug',
  'agents', 'agent', 'preparation', 'preparations', 'other', 'with',
  'without', 'system', 'disorders', 'disorder', 'products', 'product',
]);

function tokenize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[(),./-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

// Built once at module load: every subclass paired with the token set of
// its own name plus its parent chapter's name.
const SUBCLASS_TOKEN_INDEX = DRUG_CLASS_TAXONOMY.flatMap(cls =>
  cls.subclasses.map(sub => ({
    classId: cls.id,
    subclassId: sub.id,
    tokens: new Set([...tokenize(sub.name), ...tokenize(cls.name)]),
  }))
);

function fuzzyClassify(haystack) {
  const drugTokens = tokenize(haystack);
  if (drugTokens.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const entry of SUBCLASS_TOKEN_INDEX) {
    let overlap = 0;
    for (const t of drugTokens) if (entry.tokens.has(t)) overlap++;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = entry;
    }
  }
  return bestScore >= 1 ? best : null;
}

// Returns { classId, subclassId } for a given drug — always a valid pair,
// falling back to UNCLASSIFIED_BUCKET only when nothing matches at all.
export function classifyDrugTaxonomy(drug) {
  if (!drug) return { classId: UNCLASSIFIED_BUCKET.id, subclassId: UNCLASSIFIED_BUCKET.subclasses[0].id };
  const haystack = buildHaystack(drug);
  if (!haystack) return { classId: UNCLASSIFIED_BUCKET.id, subclassId: UNCLASSIFIED_BUCKET.subclasses[0].id };

  for (const [pattern, classId, subclassId] of RULES) {
    if (pattern.test(haystack)) return { classId, subclassId };
  }

  // Nothing in the explicit rule list matched — try the generic
  // subclass-name fuzzy match, preferring the most specific field
  // (drug_subclass, then drug_class) before falling back to everything
  // combined (indications included).
  const fuzzy =
    fuzzyClassify((drug.drug_subclass || '').toLowerCase()) ||
    fuzzyClassify((drug.drug_class || '').toLowerCase()) ||
    fuzzyClassify(haystack);
  if (fuzzy) return { classId: fuzzy.classId, subclassId: fuzzy.subclassId };

  return { classId: UNCLASSIFIED_BUCKET.id, subclassId: UNCLASSIFIED_BUCKET.subclasses[0].id };
}

// ── Multi-placement classification ──────────────────────────────────────
// A drug's pharmacological identity (drug_class/drug_subclass) puts it in
// exactly one "home" bucket via classifyDrugTaxonomy above. But a single
// drug can be *indicated* for conditions that belong to several different
// formulary chapters (e.g. a corticosteroid also indicated for a
// dermatological condition, or an NSAID also indicated for migraine).
// This scans the drug's own indications text — independently of its
// declared class — against every RULES pattern, so it only ever adds a
// chapter/subclass the drug is actually indicated for, and it naturally
// lets the same drug surface in every subclass its indications support.
function indicationMatches(drug) {
  const indicationText = [drug.indications, drug.primary_indications]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
  if (!indicationText) return [];

  const hits = [];
  const seen = new Set();
  for (const [pattern, classId, subclassId] of RULES) {
    if (pattern.test(indicationText)) {
      const key = `${classId}::${subclassId}`;
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({ classId, subclassId });
      }
    }
  }
  return hits;
}

// Returns every { classId, subclassId } pair a drug should appear under:
// its primary (pharmacological) placement plus any additional chapters its
// stated indications match. Always includes at least the primary pair.
//
// A drug can also carry an `extra_subclasses` field: an array of
// "classId::subclassId" strings written by the AI class/subclass insight
// panel's "Save All to Database" / "Add" actions when an admin confirms an
// *already-in-database* drug also belongs to a subclass being browsed.
// This exists because RULES-based matching (above) only covers subclasses
// that have an explicit keyword rule — a subclass with none (e.g. one added
// to the taxonomy without ever getting a RULES entry) can never be reached
// by classifyDrugTaxonomy/indicationMatches no matter what the drug's own
// text says, so there has to be a way to place a drug there directly. It's
// additive only — never overrides or removes the primary/indication-based
// placements above — and duplicate-safe since it's merged through the same
// `seen` dedup as everything else here.
export function classifyDrugTaxonomyAll(drug) {
  const primary = classifyDrugTaxonomy(drug);
  if (!drug) return [primary];

  const all = [primary];
  const seen = new Set([`${primary.classId}::${primary.subclassId}`]);

  for (const hit of indicationMatches(drug)) {
    const key = `${hit.classId}::${hit.subclassId}`;
    if (!seen.has(key)) {
      seen.add(key);
      all.push(hit);
    }
  }

  if (Array.isArray(drug.extra_subclasses)) {
    for (const entry of drug.extra_subclasses) {
      if (typeof entry !== 'string' || !entry.includes('::')) continue;
      const [classId, subclassId] = entry.split('::');
      if (!classId || !subclassId) continue;
      const key = `${classId}::${subclassId}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push({ classId, subclassId });
      }
    }
  }

  return all;
}
