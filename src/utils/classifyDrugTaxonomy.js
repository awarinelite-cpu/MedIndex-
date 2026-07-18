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

import { UNCLASSIFIED_BUCKET } from '../data/drugClassTaxonomy';

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
  [/antispasmodic/, 'gastrointestinal', 'gi-antispasmodic'],

  // ── 6: Drugs affecting blood and nutrition ──────────────────────────
  [/iron-deficiency|antianemic|antianaemic|haematinic|haematopoietic growth factor|erythropoietin/, 'blood-nutrition', 'bn-antianemic'],
  [/^vitamin|multivitamin/, 'blood-nutrition', 'bn-vitamins'],
  [/mineral supplement|electrolyte supplement/, 'blood-nutrition', 'bn-minerals'],
  [/\biv fluid\b|intravenous fluid/, 'blood-nutrition', 'bn-electrolyte-solutions'],

  // ── 7: Drugs acting on the respiratory tract ────────────────────────
  [/anticholinergic \(inhaled\)|lama\b|laba\b|bronchodilator|beta-2 agonist|leukotriene receptor antagonist|corticosteroid.*inhaled/, 'respiratory', 'resp-asthma-copd'],
  [/expectorant|mucolytic|cough suppressant/, 'respiratory', 'resp-expectorants'],

  // ── 8: Antiallergics and drugs used in anaphylaxis ──────────────────
  [/antihistamine/, 'antiallergics', 'allergy-antihistamines'],

  // ── 10: Endocrine system drugs ──────────────────────────────────────
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
  [/antiglaucoma/, 'ophthalmological', 'eye-antiglaucoma'],

  // ── 17: Immunological products and vaccines ─────────────────────────
  [/vaccine/, 'immunological', 'immuno-vaccines'],
  [/immunoglobulin|antiserum|antitoxin/, 'immunological', 'immuno-sera'],

  // ── 19: Antidotes and other substances used in poisoning ────────────
  [/antidote|glutathione precursor|anticholinesterase.*reversal/, 'antidotes-poisoning', 'poison-specific-antidotes'],

  // ── 2: Musculoskeletal and joint diseases ───────────────────────────
  [/nsaid.*antirheumatic|dmard|antirheumatic/, 'musculoskeletal', 'msk-antirheumatic'],
  [/gout|hyperuricemia/, 'musculoskeletal', 'msk-gout'],

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

// Returns { classId, subclassId } for a given drug — always a valid pair,
// falling back to UNCLASSIFIED_BUCKET when nothing matches.
export function classifyDrugTaxonomy(drug) {
  if (!drug) return { classId: UNCLASSIFIED_BUCKET.id, subclassId: UNCLASSIFIED_BUCKET.subclasses[0].id };
  const haystack = buildHaystack(drug);
  if (!haystack) return { classId: UNCLASSIFIED_BUCKET.id, subclassId: UNCLASSIFIED_BUCKET.subclasses[0].id };

  for (const [pattern, classId, subclassId] of RULES) {
    if (pattern.test(haystack)) return { classId, subclassId };
  }
  return { classId: UNCLASSIFIED_BUCKET.id, subclassId: UNCLASSIFIED_BUCKET.subclasses[0].id };
}
