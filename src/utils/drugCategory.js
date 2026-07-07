// When the AI can't pin a single pharmacological class — most often for
// combination packs like Prevpac (a PPI + two antibiotics bundled together)
// — it sometimes returns "Unknown" for drug_class. Rather than surface that
// literally, fall back to a category derived from what the drug is actually
// used FOR (its indications), so Prevpac shows as an ulcer/H. pylori therapy
// instead of "Unknown".

const PLACEHOLDER_CLASS_VALUES = new Set([
  '', 'unknown', 'n/a', 'na', 'none', 'not specified', 'not available',
  'combination', 'combination product', 'various', 'multiple',
]);

function isPlaceholderClass(value) {
  if (!value) return true;
  return PLACEHOLDER_CLASS_VALUES.has(String(value).trim().toLowerCase());
}

// Ordered from most specific to most general — first match wins.
const INDICATION_CATEGORY_RULES = [
  [/h\.?\s?pylori|helicobacter/i,                          'Antiulcer / H. pylori Eradication Therapy'],
  [/duodenal ulcer|gastric ulcer|peptic ulcer/i,           'Antiulcer Agent'],
  [/gastro-?oesophageal reflux|\bgerd\b|\breflux\b/i,      'Antiulcer / Anti-reflux Agent'],
  [/type 2 diabetes|type 1 diabetes|glycemic control|diabetes mellitus/i, 'Antidiabetic Agent'],
  [/hypertension|blood pressure/i,                         'Antihypertensive Agent'],
  [/heart failure/i,                                       'Heart Failure Therapy'],
  [/arrhythmia|atrial fibrillation/i,                       'Antiarrhythmic Agent'],
  [/dyslipidemia|cholesterol|hyperlipidemia/i,             'Lipid-Lowering Agent'],
  [/anticoagul|thrombo(sis|embolism|prophylaxis)|blood clot/i, 'Anticoagulant / Antithrombotic'],
  [/bacterial infection|antibacterial|antibiotic/i,        'Anti-infective (Antibacterial)'],
  [/fungal infection|antifungal|dermatophyte|candidiasis/i, 'Antifungal Agent'],
  [/viral infection|antiviral|hepatitis|hiv\b/i,           'Antiviral Agent'],
  [/malaria/i,                                             'Antimalarial Agent'],
  [/tuberculosis|\btb\b/i,                                 'Antituberculosis Agent'],
  [/seizure|epilepsy/i,                                    'Antiepileptic Agent'],
  [/depression|anxiety|psychosis|schizophrenia|bipolar/i,  'Psychiatric / CNS Agent'],
  [/asthma|bronchospasm|copd|respiratory/i,                'Respiratory Agent'],
  [/allerg|antihistamine|urticaria/i,                      'Antihistamine / Allergy Agent'],
  [/pain relief|analgesi|inflammation|fever/i,             'Analgesic / Anti-inflammatory'],
  [/nausea|vomiting|antiemetic/i,                          'Antiemetic Agent'],
  [/contracept|pregnancy prevention/i,                     'Contraceptive'],
  [/vitamin|deficiency|supplement/i,                       'Vitamin / Supplement'],
];

function categoryFromIndications(indications) {
  if (!indications) return '';
  for (const [pattern, label] of INDICATION_CATEGORY_RULES) {
    if (pattern.test(indications)) return label;
  }
  return '';
}

// Returns the best available label for display: the stored drug_class if
// it's a real value, otherwise a category derived from indications,
// otherwise a generic "Combination Therapy" label, otherwise ''.
export function getDisplayDrugClass(drug) {
  if (!drug) return '';
  if (!isPlaceholderClass(drug.drug_class)) return drug.drug_class;

  const fromIndications = categoryFromIndications(drug.indications);
  if (fromIndications) return fromIndications;

  // Combination packs (e.g. "Prevpac") often have a slash, plus sign, or
  // the word "pack"/"combination" in the name even when indications don't
  // match a known category above.
  const name = `${drug.generic_name || ''} ${drug.drug_subclass || ''}`;
  if (/\/|\+|\bpack\b|\bcombination\b/i.test(name)) return 'Combination Therapy';

  return '';
}
