// src/utils/detectMiscategorizedProcedures.js
//
// Some entries were saved into the 'drugs' collection but are actually
// medical/nursing procedures (e.g. "Wound Dressing", "Urinary Catheterization"),
// not medications. This flags likely candidates for an admin to review and,
// on confirmation, move into the 'procedures' collection.
//
// Heuristic only — no AI call, runs instantly client-side over whatever's
// already loaded via useDrugs(). Every candidate still requires an explicit
// admin click to move; nothing here writes to Firestore on its own.

const PROCEDURE_KEYWORDS = [
  'procedure', 'surgical', 'surgery', 'operative', 'technique',
  'insertion', 'removal', 'catheterization', 'catheterisation', 'cannulation',
  'intubation', 'extubation', 'biopsy', 'endoscopy', 'colonoscopy', 'cystoscopy',
  'laparoscopy', 'laparotomy', 'thoracotomy', 'craniotomy', 'appendectomy',
  'tonsillectomy', 'hysterectomy', 'mastectomy', 'amputation', 'debridement',
  'suturing', 'suture', 'dressing change', 'wound care', 'wound dressing',
  'lumbar puncture', 'paracentesis', 'thoracentesis', 'venipuncture', 'phlebotomy',
  'resuscitation', 'cardiopulmonary resuscitation', 'defibrillation', 'tracheostomy',
  'colostomy', 'ileostomy', 'gastrostomy', 'nasogastric tube', 'ng tube insertion',
  'enema administration', 'bandaging', 'splinting', 'traction', 'physiotherapy',
  'circumcision', 'episiotomy', 'curettage', 'dilatation and curettage',
  'bone marrow aspiration', 'arterial line', 'central line insertion',
  'iv cannulation', 'blood transfusion procedure', 'vaccination technique',
  'nursing procedure', 'clinical procedure', 'bed bath', 'catheter care',
];

// Common medical-procedure name suffixes (-ectomy, -otomy, -oscopy, etc.)
const PROCEDURE_SUFFIX_RE = /(ectomy|otomy|oscopy|ostomy|plasty|centesis|graphy|pexy)\b/i;

const NUMBERED_STEPS_RE = /(^|\n)\s*(step\s*)?\d+[.)]\s+\S/im;

function textOf(...vals) {
  return vals.filter(Boolean).join(' ').toLowerCase();
}

export function looksLikeMiscategorizedProcedure(drug) {
  if (!drug || drug.procedure_check_dismissed) return false;

  const nameClass = textOf(drug.generic_name, drug.drug_class, drug.drug_subclass);
  const keywordHit = PROCEDURE_KEYWORDS.some(k => nameClass.includes(k));
  const suffixHit = PROCEDURE_SUFFIX_RE.test(drug.generic_name || '');

  if (keywordHit || suffixHit) return true;

  // Secondary signal: no dosing-related fields at all (real drugs almost
  // always have at least one), combined with numbered-step content that
  // reads like a procedure write-up rather than a drug monograph.
  const hasDosingInfo = !!(drug.adult_dose || drug.strength || drug.pack_size_price || drug.prescription_status);
  const stepLikeContent = NUMBERED_STEPS_RE.test(drug.administration || '') || NUMBERED_STEPS_RE.test(drug.nursing_action || '');

  return !hasDosingInfo && stepLikeContent;
}

// Best-effort mapping from a drug record's fields onto the procedure schema
// (see parseAiProcedureDetail.js). Fields with no reasonable drug-side
// equivalent are left blank — the admin can fill them in afterward via the
// procedure detail page's own AI regenerate option.
export function mapDrugToProcedureFields(drug) {
  return {
    overview: drug.overview || drug.therapeutic_note || '',
    category: drug.drug_class || 'Uncategorized',
    indications: drug.indications || '',
    equipment_needed: '',
    pre_procedure_care: drug.advice_to_patients || '',
    steps: drug.administration || '',
    post_procedure_care: drug.nursing_action || '',
    complications: drug.adverse_effect || '',
    contraindications: drug.contraindications || '',
  };
}
