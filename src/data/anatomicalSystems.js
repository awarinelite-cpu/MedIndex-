// Canonical list of anatomical/physiological systems used for "Browse by
// Category" and the system-aggregation view. Each system has a set of
// keyword patterns matched (case-insensitive, substring) against a drug's
// drug_class and drug_subclass fields. A drug can belong to more than one
// system (e.g. an NSAID is both Musculoskeletal and Pain/Anesthetic) — that's
// intentional and medically reasonable, not a bug.
//
// icon is a lucide-react icon *name* (resolved where needed) rather than the
// component itself, so this file has no React/JSX dependency and can be
// safely imported from plain utility modules too.

export const ANATOMICAL_SYSTEMS = [
  {
    id: 'cardiovascular',
    name: 'Cardiovascular',
    icon: 'Heart',
    color: 'text-red-500',
    bg: 'bg-red-50',
    keywords: [
      'cardiac', 'cardio', 'antihypertensive', 'beta-blocker', 'beta blocker',
      'ace inhibitor', 'angiotensin', 'arb', 'calcium channel blocker',
      'diuretic', 'statin', 'antilipemic', 'lipid', 'anticoagulant',
      'antiplatelet', 'antiarrhythmic', 'nitrate', 'vasodilator', 'inotrope',
      'digoxin', 'cardiac glycoside', 'thrombolytic', 'antianginal',
    ],
  },
  {
    id: 'respiratory',
    name: 'Respiratory',
    icon: 'Stethoscope',
    color: 'text-teal-500',
    bg: 'bg-teal-50',
    keywords: [
      'respiratory', 'bronchodilator', 'beta-2 agonist', 'beta2 agonist',
      'inhaled corticosteroid', 'antitussive', 'expectorant', 'mucolytic',
      'antihistamine', 'decongestant', 'leukotriene', 'asthma', 'copd',
      'anti-asthmatic', 'xanthine',
    ],
  },
  {
    id: 'gastrointestinal',
    name: 'Gastrointestinal',
    icon: 'Soup',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    keywords: [
      'gastrointestinal', 'antacid', 'proton pump', 'ppi', 'h2 blocker',
      'h2-receptor', 'h2 receptor', 'antiemetic', 'antidiarrheal', 'laxative',
      'prokinetic', 'antiulcer', 'digestive enzyme', 'antispasmodic',
    ],
  },
  {
    id: 'renal',
    name: 'Renal & Genitourinary',
    icon: 'Droplets',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50',
    keywords: [
      'diuretic', 'urinary', 'genitourinary', 'renal', 'bph',
      'alpha-blocker', 'alpha blocker', 'overactive bladder',
      'phosphate binder', '5-alpha reductase',
    ],
  },
  {
    id: 'endocrine',
    name: 'Endocrine',
    icon: 'Activity',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    keywords: [
      'endocrine', 'antidiabetic', 'insulin', 'sulfonylurea', 'biguanide',
      'thyroid', 'antithyroid', 'corticosteroid', 'glucocorticoid',
      'hormone', 'contraceptive', 'sglt2', 'dpp-4', 'glp-1',
      'thiazolidinedione',
    ],
  },
  {
    id: 'neurological',
    name: 'Neurological',
    icon: 'Brain',
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    keywords: [
      'neurological', 'anticonvulsant', 'antiepileptic', 'antiparkinson',
      'migraine', 'sedative', 'hypnotic', 'nootropic', 'cns stimulant',
      'dementia', 'alzheimer', 'muscle relaxant (central)',
      'neuromuscular blocking',
    ],
  },
  {
    id: 'musculoskeletal',
    name: 'Musculoskeletal',
    icon: 'Bone',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    keywords: [
      'musculoskeletal', 'nsaid', 'muscle relaxant', 'bisphosphonate',
      'gout', 'uricosuric', 'anti-inflammatory', 'antirheumatic', 'dmard',
    ],
  },
  {
    id: 'psychiatric',
    name: 'Psychiatric & Mental Health',
    icon: 'HeartHandshake',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    keywords: [
      'antipsychotic', 'antidepressant', 'anxiolytic', 'benzodiazepine',
      'mood stabilizer', 'ssri', 'snri', 'tricyclic', 'adhd', 'stimulant',
      'maoi',
    ],
  },
  {
    id: 'dermatological',
    name: 'Dermatological',
    icon: 'Sparkle',
    color: 'text-pink-500',
    bg: 'bg-pink-50',
    keywords: [
      'dermatolog', 'topical', 'antifungal (topical)', 'acne', 'psoriasis',
      'eczema', 'wound care', 'skin', 'emollient', 'antiseptic',
    ],
  },
  {
    id: 'hematological',
    name: 'Hematological & Oncological',
    icon: 'Droplet',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    keywords: [
      'hematolog', 'anemia', 'iron', 'erythropoiet', 'chemotherapy',
      'antineoplastic', 'oncolog', 'hemostatic', 'colony-stimulating',
    ],
  },
  {
    id: 'infectious',
    name: 'Immune & Infectious Disease',
    icon: 'Shield',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    keywords: [
      'antibiotic', 'antibacterial', 'antiviral', 'antifungal',
      'antiparasitic', 'antimalarial', 'antitubercul', 'vaccine',
      'immunosuppress', 'immunoglobulin', 'antiretroviral', 'anthelmintic',
      'penicillin', 'cephalosporin', 'macrolide', 'fluoroquinolone',
      'aminoglycoside', 'tetracycline', 'sulfonamide',
    ],
  },
  {
    id: 'reproductive',
    name: 'Reproductive',
    icon: 'Baby',
    color: 'text-fuchsia-500',
    bg: 'bg-fuchsia-50',
    keywords: [
      'reproductive', 'contraceptive', 'fertility', 'obstetric',
      'uterotonic', 'tocolytic', 'erectile', 'hormone replacement',
      'estrogen', 'progestin', 'androgen', 'oxytocic',
    ],
  },
  {
    id: 'sensory',
    name: 'Eye, Ear & ENT',
    icon: 'Eye',
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    keywords: [
      'ophthalmic', 'otic', 'nasal', 'ent', 'glaucoma', 'mydriatic',
      'ear', 'eye',
    ],
  },
  {
    id: 'nutritional',
    name: 'Nutritional & Vitamins',
    icon: 'Apple',
    color: 'text-lime-500',
    bg: 'bg-lime-50',
    keywords: [
      'vitamin', 'mineral', 'electrolyte', 'nutritional', 'supplement',
    ],
  },
  {
    id: 'pain',
    name: 'Pain & Anesthesia',
    icon: 'Zap',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    keywords: [
      'analgesic', 'opioid', 'anesthetic', 'antipyretic',
      'local anesthetic', 'general anesthetic',
    ],
  },
  {
    id: 'emergency',
    name: 'Trauma & Emergency',
    icon: 'Siren',
    color: 'text-red-600',
    bg: 'bg-red-50',
    keywords: [
      'emergency', 'trauma', 'antidote', 'poisoning', 'toxin', 'overdose',
      'anaphylaxis', 'shock', 'burn', 'antivenom', 'resuscitation',
    ],
  },
];

// Systems pinned as their own dedicated homepage tile — the rest surface
// through the "More Systems" tile / index page instead of crowding the grid.
export const PINNED_SYSTEM_IDS = [
  'cardiovascular', 'endocrine', 'neurological', 'musculoskeletal', 'respiratory',
];

export function getSystemById(id) {
  return ANATOMICAL_SYSTEMS.find(s => s.id === id) || null;
}
