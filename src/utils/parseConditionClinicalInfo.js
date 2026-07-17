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
};

export function parseConditionClinicalInfo(text) {
  const result = {
    introduction: '', types: '', organRelated: '', etiology: '',
    pathology: '', clinicalManifestation: '', diagnosis: '', management: '',
  };
  if (!text) return result;

  // Split on top-level ## headers only, keeping any ### sub-headers inside
  // each block's body intact for the section itself to render.
  const blocks = text.split(/\n(?=##\s+[^#])/g);
  for (const block of blocks) {
    const headerMatch = block.match(/^##\s+(.+)/);
    if (!headerMatch) continue;
    const header = headerMatch[1].trim().toLowerCase();
    const key = HEADER_TO_KEY[header];
    if (!key) continue;
    const body = block.replace(/^##\s+.+\n?/, '').trim();
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
