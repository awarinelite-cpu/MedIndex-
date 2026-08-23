// src/utils/procedureCategory.js
//
// Canonical taxonomy for the Procedures section, mirroring the pattern in
// drugCategory.js: a fixed master list plus an alias/normalization layer so
// existing free-text category values (AI-generated or admin-typed) fold into
// the right bucket instead of spawning near-duplicate categories like
// "Cardiac" / "Cardiology" / "Cardiovascular" side by side.
//
// Two groups, per standard classification of medical procedures:
//   A. By purpose or technique
//   B. By medical specialty / body system
//
// A single real-world procedure can belong to several of these at once
// (e.g. a laparoscopic appendectomy is diagnostic/therapeutic, surgical,
// invasive, minimally invasive, AND general surgical) — this file only
// fixes the canonical *label* for whichever single category a given
// procedure record is filed under; it doesn't restrict a procedure to one
// category conceptually.

export const PROCEDURE_CATEGORY_GROUPS = [
  {
    group: 'By Purpose or Technique',
    categories: [
      'Diagnostic Procedures',
      'Screening Procedures',
      'Laboratory Procedures',
      'Imaging Procedures',
      'Monitoring Procedures',
      'Therapeutic Procedures',
      'Surgical Procedures',
      'Interventional Procedures',
      'Minimally Invasive Procedures',
      'Non-Invasive Procedures',
      'Invasive Procedures',
      'Emergency Procedures',
      'Preventive Procedures',
      'Rehabilitative Procedures',
      'Palliative Procedures',
      'Anesthetic Procedures',
      'Critical Care Procedures',
      'Pain Management Procedures',
      'Cosmetic/Aesthetic Procedures',
      'Reconstructive Procedures',
      'Transplant Procedures',
      'Radiation Procedures',
      'Nuclear Medicine Procedures',
      'Pathology Procedures',
    ],
  },
  {
    group: 'By Medical Specialty/Body System',
    categories: [
      'General Surgical Procedures',
      'Cardiovascular Procedures',
      'Respiratory/Pulmonary Procedures',
      'Neurological/Neurosurgical Procedures',
      'Orthopedic Procedures',
      'Gastrointestinal Procedures',
      'Hepatobiliary Procedures',
      'Pancreatic Procedures',
      'Urological Procedures',
      'Nephrological/Renal Procedures',
      'Obstetric Procedures',
      'Gynecological Procedures',
      'Pediatric Procedures',
      'Ophthalmic Procedures',
      'Otolaryngology (ENT) Procedures',
      'Dermatological Procedures',
      'Dental/Oral and Maxillofacial Procedures',
      'Vascular Procedures',
      'Oncological Procedures',
      'Plastic and Reconstructive Surgical Procedures',
      'Endocrine Procedures',
      'Breast Procedures',
      'Colorectal Procedures',
      'Thoracic Procedures',
      'Bariatric/Metabolic Procedures',
      'Interventional Radiology Procedures',
      'Interventional Cardiology Procedures',
      'Infectious-Disease Procedures',
      'Hematological Procedures',
      'Immunological Procedures',
      'Geriatric Procedures',
      'Psychiatric Procedures',
      'Physical Medicine and Rehabilitation Procedures',
    ],
  },
];

// Flat ordered list — this is what powers the category <select> and the
// "existing categories" list handed to the AI insight components.
export const PROCEDURE_CATEGORIES = PROCEDURE_CATEGORY_GROUPS.flatMap(g => g.categories);

const CANONICAL_LOOKUP = new Map(PROCEDURE_CATEGORIES.map(c => [c.toLowerCase(), c]));
// Also index without the trailing " Procedures" so "Cardiovascular" alone matches.
for (const c of PROCEDURE_CATEGORIES) {
  const bare = c.replace(/\s*Procedures$/i, '').toLowerCase();
  if (!CANONICAL_LOOKUP.has(bare)) CANONICAL_LOOKUP.set(bare, c);
}

// Loose synonyms an existing record might already use, mapped onto the
// canonical label above. Ordered by specificity where overlap is possible —
// first match wins.
const ALIAS_RULES = [
  [/nursing procedure|clinical procedure|bedside procedure/i, 'Therapeutic Procedures'],
  [/general surger(y|ies)/i,                                  'General Surgical Procedures'],
  [/\bsurgery\b|\bsurgical\b|\boperative\b|\bop\b/i,           'Surgical Procedures'],
  [/\bcardiac\b|\bcardiology\b|\bheart\b|\bcardio\b/i,         'Cardiovascular Procedures'],
  [/interventional cardio/i,                                   'Interventional Cardiology Procedures'],
  [/interventional radio/i,                                    'Interventional Radiology Procedures'],
  [/\binterventional\b/i,                                      'Interventional Procedures'],
  [/\brespirat|pulmonary|\block\b|chest medicine/i,             'Respiratory/Pulmonary Procedures'],
  [/\bneuro(logy|logical|surgery|surgical)?\b/i,               'Neurological/Neurosurgical Procedures'],
  [/\bortho(pedic|paedic)?\b|\bbone\b|\bjoint\b/i,              'Orthopedic Procedures'],
  [/\bgi\b|gastro(intestinal)?|\bbowel\b|\bstomach\b/i,        'Gastrointestinal Procedures'],
  [/hepato-?biliary|\bliver\b|\bbile duct\b/i,                 'Hepatobiliary Procedures'],
  [/pancrea/i,                                                 'Pancreatic Procedures'],
  [/urolog|\bbladder\b|\bprostate\b/i,                          'Urological Procedures'],
  [/nephro|\brenal\b|\bkidney\b|dialysis/i,                    'Nephrological/Renal Procedures'],
  [/obstetric|\bpregnan|\bantenatal\b|\blabou?r\b|\bdelivery\b/i, 'Obstetric Procedures'],
  [/gynaecolog|gynecolog|\bob-?gyn\b/i,                        'Gynecological Procedures'],
  [/paediatric|pediatric|\bneonat/i,                           'Pediatric Procedures'],
  [/ophthalmic|\beye\b|\bocular\b/i,                            'Ophthalmic Procedures'],
  [/\bent\b|otolaryngolog|\bear\b|\bnose\b|\bthroat\b/i,       'Otolaryngology (ENT) Procedures'],
  [/dermatolog|\bskin\b/i,                                     'Dermatological Procedures'],
  [/\bdental\b|\boral\b|maxillofacial/i,                        'Dental/Oral and Maxillofacial Procedures'],
  [/\bvascular\b/i,                                             'Vascular Procedures'],
  [/oncolog|\bcancer\b|\btumou?r\b|chemotherapy administration/i, 'Oncological Procedures'],
  [/plastic surg|reconstructive surg/i,                         'Plastic and Reconstructive Surgical Procedures'],
  [/\breconstructive\b/i,                                       'Reconstructive Procedures'],
  [/endocrin|\bthyroid\b|\badrenal\b/i,                         'Endocrine Procedures'],
  [/\bbreast\b|\bmastectomy\b|mammograph/i,                    'Breast Procedures'],
  [/colorectal|\bcolon\b|\brectal\b/i,                          'Colorectal Procedures'],
  [/\bthoracic\b|\bthorax\b/i,                                  'Thoracic Procedures'],
  [/bariatric|weight loss surgery|metabolic surg/i,             'Bariatric/Metabolic Procedures'],
  [/infectious[\s-]?disease|infection control procedure/i,     'Infectious-Disease Procedures'],
  [/haematolog|hematolog|\bblood disorder/i,                    'Hematological Procedures'],
  [/immunolog|\ballerg(y|ic)\b/i,                               'Immunological Procedures'],
  [/geriatric|\belderly\b/i,                                    'Geriatric Procedures'],
  [/psychiatric|\bmental health\b/i,                            'Psychiatric Procedures'],
  [/physiotherapy|physical medicine|physical rehab/i,           'Physical Medicine and Rehabilitation Procedures'],
  [/\bscreening\b/i,                                            'Screening Procedures'],
  [/\blab(oratory)?\b/i,                                        'Laboratory Procedures'],
  [/imaging|\bx-?ray\b|\bmri\b|\bct scan\b|ultrasound|radiograph/i, 'Imaging Procedures'],
  [/\bmonitoring\b/i,                                           'Monitoring Procedures'],
  [/\bminimally invasive\b/i,                                   'Minimally Invasive Procedures'],
  [/\bnon-?invasive\b/i,                                        'Non-Invasive Procedures'],
  [/\binvasive\b/i,                                             'Invasive Procedures'],
  [/\bemergency\b|\bER\b|resuscitation|\bcpr\b/i,               'Emergency Procedures'],
  [/\bpreventive\b|\bprophylactic\b|vaccination/i,              'Preventive Procedures'],
  [/\brehabilitat/i,                                            'Rehabilitative Procedures'],
  [/\bpalliative\b|end of life|hospice/i,                        'Palliative Procedures'],
  [/\banesthe(sia|tic)|\banaesthe(sia|tic)/i,                    'Anesthetic Procedures'],
  [/critical care|\bicu\b|intensive care/i,                     'Critical Care Procedures'],
  [/pain management|analgesia procedure/i,                      'Pain Management Procedures'],
  [/cosmetic|aesthetic/i,                                       'Cosmetic/Aesthetic Procedures'],
  [/\btransplant\b/i,                                            'Transplant Procedures'],
  [/\bradiation\b|radiotherapy/i,                               'Radiation Procedures'],
  [/nuclear medicine/i,                                          'Nuclear Medicine Procedures'],
  [/patholog/i,                                                 'Pathology Procedures'],
  [/^diagnostic$|diagnostic procedure/i,                         'Diagnostic Procedures'],
  [/^therapeutic$|therapeutic procedure/i,                       'Therapeutic Procedures'],
];

/**
 * Normalize a raw category string (as stored on a procedure record) onto
 * the fixed taxonomy above. Falls back to the original (trimmed) value if
 * nothing matches, so nothing is silently dropped or overwritten in the
 * data — this is purely a display/grouping-time merge, not a rewrite.
 */
export function normalizeProcedureCategory(rawCategory) {
  const raw = (rawCategory || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase() === 'uncategorized') return raw;

  const exact = CANONICAL_LOOKUP.get(raw.toLowerCase());
  if (exact) return exact;

  for (const [pattern, canonical] of ALIAS_RULES) {
    if (pattern.test(raw)) return canonical;
  }

  return raw;
}
