// src/data/drugClassTaxonomy.js
//
// The 21 top-level drug classes (and their first-level subclasses) used
// throughout the Nigerian Standard Treatment Guidelines / EMDEX formulary
// structure. This is the taxonomy the Browse Medications page groups
// existing drugs into, alongside a 22nd catch-all bucket for anything
// that doesn't confidently map to one of the 21.
//
// Each class/subclass carries a stable `id` (slug) so it can be used as a
// React key, a URL param, and a lookup key from classifyDrugTaxonomy.js.

export const DRUG_CLASS_TAXONOMY = [
  {
    id: 'cns',
    number: 1,
    name: 'Central Nervous System (CNS) Drugs',
    subclasses: [
      { id: 'cns-anxiety-sleep', name: 'Drugs used in anxiety and sleep disorders' },
      { id: 'cns-psychotic', name: 'Drugs used in psychotic disorders' },
      { id: 'cns-antipsychotic-antidotes', name: 'Antidotes to antipsychotic drugs' },
      { id: 'cns-mood', name: 'Drugs used in mood disorders' },
      { id: 'cns-ocd-panic', name: 'Obsessive-compulsive disorders and panic attacks' },
      { id: 'cns-parkinson', name: 'Anti-Parkinson drugs' },
      { id: 'cns-anticonvulsants', name: 'Anticonvulsants (Antiepileptics)' },
      { id: 'cns-analgesics', name: 'Analgesics' },
      { id: 'cns-migraine', name: 'Drugs used in migraine' },
      { id: 'cns-dementia', name: 'Anti-dementia drugs' },
      { id: 'cns-adhd', name: 'Attention deficit hyperactivity disorder (ADHD)' },
      { id: 'cns-substance-dependence', name: 'Drugs used in substance dependence programs' },
      { id: 'cns-antivertigo', name: 'Antivertigo preparations' },
      { id: 'cns-other', name: 'Other nervous system drugs' },
    ],
  },
  {
    id: 'musculoskeletal',
    number: 2,
    name: 'Drugs for Musculoskeletal and Joint Diseases',
    subclasses: [
      { id: 'msk-antirheumatic', name: 'Antirheumatic drugs' },
      { id: 'msk-gout', name: 'Drugs used in gout and hyperuricemia' },
      { id: 'msk-muscle-relaxants-central', name: 'Muscle relaxants (centrally acting), incl. combinations' },
      { id: 'msk-muscle-relaxants-peripheral', name: 'Muscle relaxants (peripherally acting) and cholinesterase inhibitors' },
      { id: 'msk-bone', name: 'Drugs affecting bone structure and mineralization' },
      { id: 'msk-topical-antirheumatic', name: 'Topical anti-rheumatic drugs' },
      { id: 'msk-enzymes', name: 'Enzymes and combination preparations' },
      { id: 'msk-other', name: 'Other drugs for disorders of the musculoskeletal system' },
    ],
  },
  {
    id: 'anaesthesia',
    number: 3,
    name: 'Drugs Used in Anaesthesia',
    subclasses: [
      { id: 'anaes-general', name: 'General anaesthetics and oxygen' },
      { id: 'anaes-preop', name: 'Preoperative medication and sedation for short-term procedures' },
      { id: 'anaes-muscle-relaxants', name: 'Muscle relaxants and cholinesterase inhibitors' },
      { id: 'anaes-local', name: 'Local anaesthetics' },
      { id: 'anaes-analgesics', name: 'Analgesics and opioid antagonists' },
      { id: 'anaes-blood-substitutes', name: 'Blood substitutes and solutions for correcting fluid imbalance' },
      { id: 'anaes-other', name: 'Other agents used during anaesthesia' },
    ],
  },
  {
    id: 'gastrointestinal',
    number: 4,
    name: 'Drugs Used in Gastrointestinal Diseases',
    subclasses: [
      { id: 'gi-antacids-ulcer', name: 'Antacids and ulcer healing drugs' },
      { id: 'gi-antispasmodic', name: 'Antispasmodic drugs' },
      { id: 'gi-diarrhoea', name: 'Drugs used in diarrhoea' },
      { id: 'gi-laxatives', name: 'Laxatives' },
      { id: 'gi-antiemetic', name: 'Antiemetic drugs' },
      { id: 'gi-haemorrhoidal', name: 'Anti-haemorrhoidal drugs' },
      { id: 'gi-anti-inflammatory', name: 'Anti-inflammatory drugs' },
      { id: 'gi-bile-liver', name: 'Bile and liver therapy' },
      { id: 'gi-misc', name: 'Miscellaneous' },
    ],
  },
  {
    id: 'cardiovascular',
    number: 5,
    name: 'Cardiovascular System Drugs',
    subclasses: [
      { id: 'cv-heart-failure', name: 'Drugs used in heart failure' },
      { id: 'cv-diuretics', name: 'Diuretics' },
      { id: 'cv-antihypertensive', name: 'Antihypertensive drugs' },
      { id: 'cv-hypotension', name: 'Drugs for hypotension' },
      { id: 'cv-antiarrhythmic', name: 'Anti-arrhythmic drugs' },
      { id: 'cv-antianginal', name: 'Anti-anginal drugs' },
      { id: 'cv-antithrombotic', name: 'Antithrombotic drugs and myocardial infarction' },
      { id: 'cv-lipid', name: 'Lipid-regulating drugs' },
      { id: 'cv-vasoprotectives', name: 'Vasoprotectives' },
      { id: 'cv-cardioplegia', name: 'Electrolyte solutions for cardioplegia' },
    ],
  },
  {
    id: 'blood-nutrition',
    number: 6,
    name: 'Drugs Affecting Blood and Nutrition',
    subclasses: [
      { id: 'bn-antianemic', name: 'Antianemic preparations' },
      { id: 'bn-coagulation', name: 'Drugs affecting coagulation' },
      { id: 'bn-blood-products', name: 'Blood products and plasma substitutes' },
      { id: 'bn-vitamins', name: 'Vitamins' },
      { id: 'bn-minerals', name: 'Minerals' },
      { id: 'bn-appetite', name: 'Appetite stimulants' },
      { id: 'bn-electrolyte-solutions', name: 'Solutions for correcting water, electrolyte and acid-base disturbances' },
      { id: 'bn-peritoneal-dialysis', name: 'Peritoneal dialysis solution' },
      { id: 'bn-parenteral-nutrition', name: 'Parenteral nutrition' },
    ],
  },
  {
    id: 'respiratory',
    number: 7,
    name: 'Drugs Acting on the Respiratory Tract',
    subclasses: [
      { id: 'resp-asthma-copd', name: 'Anti-asthmatic and drugs for chronic obstructive pulmonary disease' },
      { id: 'resp-expectorants', name: 'Expectorants, mucolytics and cough suppressants' },
      { id: 'resp-other', name: 'Other drugs acting on the respiratory tract' },
    ],
  },
  {
    id: 'antiallergics',
    number: 8,
    name: 'Antiallergics and Drugs Used in Anaphylaxis',
    subclasses: [
      { id: 'allergy-antihistamines', name: 'Antihistamines' },
      { id: 'allergy-sympathomimetics', name: 'Sympathomimetics' },
      { id: 'allergy-corticosteroids', name: 'Corticosteroids' },
    ],
  },
  {
    id: 'anti-infective',
    number: 9,
    name: 'Anti-Infective Drugs',
    subclasses: [
      { id: 'ai-antibacterial', name: 'Antibacterial drugs' },
      { id: 'ai-antifungal', name: 'Systemic antifungal drugs' },
      { id: 'ai-antiprotozoal', name: 'Antiprotozoal drugs' },
      { id: 'ai-anthelmintics', name: 'Anthelmintics' },
      { id: 'ai-antiviral', name: 'Antiviral drugs' },
    ],
  },
  {
    id: 'endocrine',
    number: 10,
    name: 'Endocrine System Drugs',
    subclasses: [
      { id: 'endo-antidiabetic', name: 'Antidiabetic drugs' },
      { id: 'endo-thyroid', name: 'Thyroid hormones and antithyroid drugs' },
      { id: 'endo-corticosteroids', name: 'Corticosteroids' },
      { id: 'endo-sex-hormones', name: 'Sex hormones' },
      { id: 'endo-pituitary', name: 'Pituitary and hypothalamic hormones and analogues' },
      { id: 'endo-other', name: 'Other endocrine drugs' },
    ],
  },
  {
    id: 'reproductive-urinary',
    number: 11,
    name: 'Drugs for Reproductive Health, Perinatal Care and Urinary-Tract Disorders',
    subclasses: [
      { id: 'repro-obstetrics-neonatal', name: 'Drugs used in obstetrics and neonatal care' },
      { id: 'repro-genital-antiinfectives', name: 'Genital anti-infectives' },
      { id: 'repro-contraceptives', name: 'Contraceptives' },
      { id: 'repro-genitourinary', name: 'Drugs for genito-urinary disorders' },
    ],
  },
  {
    id: 'oncology-immunosuppressive',
    number: 12,
    name: 'Antineoplastic and Immunosuppressive Drugs, and Drugs Used in Palliative Care',
    subclasses: [
      { id: 'onco-cytotoxic', name: 'Cytotoxic (antineoplastic) drugs' },
      { id: 'onco-immunosuppressive', name: 'Immunosuppressive drugs' },
      { id: 'onco-immunostimulants', name: 'Immunostimulants' },
      { id: 'onco-sex-hormones-malignant', name: 'Sex hormones and antagonists used in malignant diseases' },
      { id: 'onco-supportive-care', name: 'Supportive care therapy' },
    ],
  },
  {
    id: 'ophthalmological',
    number: 13,
    name: 'Ophthalmological Preparations',
    subclasses: [
      { id: 'eye-antiinfective', name: 'Anti-infective drugs' },
      { id: 'eye-antiinflam-antiallergic', name: 'Anti-inflammatory/Anti-allergic/Anti-infective drugs' },
      { id: 'eye-mydriatics', name: 'Mydriatics and cycloplegics' },
      { id: 'eye-antiglaucoma', name: 'Antiglaucoma drugs' },
      { id: 'eye-local-anaesthetics', name: 'Local anaesthetics' },
      { id: 'eye-misc', name: 'Miscellaneous eye preparations' },
    ],
  },
  {
    id: 'ent',
    number: 14,
    name: 'Ear, Nose and Throat (ENT) Drugs',
    subclasses: [
      { id: 'ent-ear', name: 'Ear drugs' },
      { id: 'ent-nasal', name: 'Nasal drugs' },
      { id: 'ent-throat', name: 'Throat drugs' },
    ],
  },
  {
    id: 'dermatological',
    number: 15,
    name: 'Dermatological Drugs',
    subclasses: [
      { id: 'derm-antiinfective', name: 'Anti-infective skin preparations' },
      { id: 'derm-antiinflam-antipruritic', name: 'Anti-inflammatory and antipruritic drugs' },
      { id: 'derm-astringents', name: 'Astringents, skin antiseptics & protectants' },
      { id: 'derm-acne', name: 'Preparations for acne' },
      { id: 'derm-psoriasis', name: 'Preparations for psoriasis' },
      { id: 'derm-actinic-keratosis', name: 'Preparations for actinic keratosis' },
      { id: 'derm-warts', name: 'Preparations for warts' },
      { id: 'derm-uv-blocking', name: 'Ultraviolet blocking agents' },
      { id: 'derm-hair-growth', name: 'Hair growth stimulants' },
      { id: 'derm-wound-dressings', name: 'Wound dressings' },
      { id: 'derm-other', name: 'Other dermatologicals' },
    ],
  },
  {
    id: 'disinfectants',
    number: 16,
    name: 'Disinfectants and Antiseptics',
    subclasses: [
      { id: 'disinf-alcohols', name: 'Alcohols' },
      { id: 'disinf-aldehydes', name: 'Aldehydes' },
      { id: 'disinf-cationic-surfactants', name: 'Cationic surfactants' },
      { id: 'disinf-chlorhexidine', name: 'Chlorhexidine salts' },
      { id: 'disinf-chlorine', name: 'Chlorine and its compounds' },
      { id: 'disinf-dyes', name: 'Dyes' },
      { id: 'disinf-hydrogen-peroxide', name: 'Hydrogen peroxide' },
      { id: 'disinf-iodine', name: 'Iodine' },
      { id: 'disinf-phenols', name: 'Phenols and related substances' },
      { id: 'disinf-potassium-permanganate', name: 'Potassium permanganate' },
    ],
  },
  {
    id: 'immunological',
    number: 17,
    name: 'Immunological Products and Vaccines',
    subclasses: [
      { id: 'immuno-vaccines', name: 'Vaccines (Active immunity)' },
      { id: 'immuno-sera', name: 'Sera and immunoglobulins (Passive immunity)' },
    ],
  },
  {
    id: 'dental',
    number: 18,
    name: 'Dental Formulary',
    subclasses: [
      { id: 'dental-local-anaesthetics', name: 'Local anaesthetics' },
      { id: 'dental-analgesics', name: 'Analgesics' },
      { id: 'dental-antiinfective', name: 'Anti-infective drugs' },
      { id: 'dental-mucosal', name: 'Agents for mucosal ulceration & inflammation' },
      { id: 'dental-orofacial-pain', name: 'Drugs used in treating orofacial pain' },
      { id: 'dental-dry-mouth', name: 'Agents for dry mouth & prevention of dental caries' },
      { id: 'dental-emergency', name: 'Suggested emergency drug list' },
    ],
  },
  {
    id: 'antidotes-poisoning',
    number: 19,
    name: 'Antidotes and Other Substances Used in Poisoning',
    subclasses: [
      { id: 'poison-general-care', name: 'General care and non-specific treatment' },
      { id: 'poison-specific-antidotes', name: 'Specific antidotes' },
    ],
  },
  {
    id: 'diagnostic-equipment',
    number: 20,
    name: 'Diagnostic Agents, Medical Consumables & Equipment',
    subclasses: [
      { id: 'diag-agents', name: 'Diagnostic Agents' },
      { id: 'diag-equipment', name: 'Medical Equipments' },
    ],
  },
  {
    id: 'natural-health',
    number: 21,
    name: 'Natural Health Products (NHPs)',
    subclasses: [
      { id: 'nhp-multivitamin-minerals', name: 'Multivitamin and Minerals with or without Amino Acids' },
      { id: 'nhp-diabetes-supplements', name: 'Dietary Supplements for Diabetes' },
      { id: 'nhp-herbal', name: 'Herbal preparations' },
    ],
  },
];

// Catch-all bucket (not one of the 21 official chapters) for drugs whose
// stored drug_class/drug_subclass can't be confidently mapped to any of
// the taxonomy entries above. Kept separate and clearly labelled so it's
// never mistaken for an official EMDEX chapter.
export const UNCLASSIFIED_BUCKET = {
  id: 'unclassified',
  number: null,
  name: 'Other / Not Yet Classified',
  subclasses: [
    { id: 'unclassified-general', name: 'Pending classification' },
  ],
};

export function findClassById(classId) {
  return DRUG_CLASS_TAXONOMY.find(c => c.id === classId) || (classId === UNCLASSIFIED_BUCKET.id ? UNCLASSIFIED_BUCKET : null);
}

export function findSubclassById(classId, subclassId) {
  const cls = findClassById(classId);
  if (!cls) return null;
  return cls.subclasses.find(s => s.id === subclassId) || null;
}
