// Splits the markdown produced by the 'condition_clinical_info' AI mode into
// its 7 fixed sections. Mirrors parseConditionInsight's block-splitting
// approach, but also recognizes "### <Type Name>" sub-headers inside
// Clinical Manifestation and Medical Management, since those two sections
// are allowed to break down per condition-type (e.g. "Type 1 Diabetes
// Mellitus" vs "Type 2 Diabetes Mellitus") when the AI judges that useful.

const HEADER_TO_KEY = {
  'introduction': 'introduction',
  'types': 'types',
  'organ system involved': 'organRelated',
  'etiology': 'etiology',
  'pathophysiology': 'pathology',
  'clinical manifestation': 'clinicalManifestation',
  'diagnosis and investigation': 'diagnosis',
  'medical management': 'management',
  'surgical management': 'surgicalManagement',
  'nursing diagnosis': 'nursingDiagnosis',
  'nursing consideration': 'nursingConsideration',
};

export function parseConditionClinicalInfo(text) {
  const result = {
    introduction: '', types: '', organRelated: '', etiology: '',
    pathology: '', clinicalManifestation: '', diagnosis: '', management: '',
    surgicalManagement: '', nursingDiagnosis: '', nursingConsideration: '',
  };
  if (!text) return result;

  // Split on top-level ## headers only, keeping any ### sub-headers inside
  // each block's body intact for the section itself to render.
  const blocks = text.trim().split(/\n(?=##\s+[^#])/g);
  for (const block of blocks) {
    // Trim before matching — a leading blank line, space, or stray heartbeat
    // byte from the streaming source would otherwise defeat the anchored
    // header regex and silently drop that whole section (this previously
    // dropped "## Introduction" specifically, since it's always the first
    // block and therefore the one most exposed to leading whitespace).
    const trimmedBlock = block.trim();
    const headerMatch = trimmedBlock.match(/^##\s+(.+)/);
    if (!headerMatch) continue;
    const header = headerMatch[1].trim().toLowerCase();
    const key = HEADER_TO_KEY[header];
    if (!key) continue;
    const body = trimmedBlock.replace(/^##\s+.+\n?/, '').trim();
    result[key] = body;
  }
  return result;
}

// A condition with no clinically distinct types replies with this exact
// line under ## Types — used to decide whether to render a "Types" section
// at all or just skip it.
export function hasNoDistinctTypes(typesText) {
  if (!typesText) return true;
  return /no clinically distinct types/i.test(typesText);
}

// Mirrors hasNoDistinctTypes — a condition that's managed purely medically
// replies with a fixed placeholder line under ## Surgical Management, so a
// non-applicable section can be hidden rather than shown as empty/confusing.
export function hasNoSurgicalManagement(surgicalText) {
  if (!surgicalText) return true;
  return /surgical management is not (typically )?indicated/i.test(surgicalText);
}
