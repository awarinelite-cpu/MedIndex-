// Parses the markdown produced by the "drug" mode of /api/drug-ai-details
// (## section headers, **bold** sub-labels, "- " bullets) into a flat object
// whose keys match the CSV/Firestore drug schema used by UploadPage.js and
// AdminPage.js. Used to let an admin save an AI-generated lookup as a real
// database entry.

const HEADER_FIELD_MAP = [
  [/^overview$/,                                   'overview'],
  [/^indications$/,                                'indications'],
  [/^therapeutic note$/,                           'therapeutic_note'],
  [/^(mechanism of action( ?& ?| and )pharmacology|pharmacology)$/, 'pharmacology'],
  [/^pharmacokinetics$/,                            '__pharmacokinetics'], // merged into pharmacology
  [/^adult dose$/,                                  'adult_dose'],
  [/^child dose$/,                                  'child_dose'],
  [/^renal dose$/,                                  'renal_dose'],
  [/^administration$/,                              'administration'],
  [/^nstg recommendations$/,                        'nstg_recommendations'],
  [/^contraindications$/,                           'contraindications'],
  [/^precautions$/,                                 'precautions'],
  [/^pregnancy( ?& ?| and )lactation$/,             'pregnancy_lactation'],
  [/^interaction(s)?$/,                             'interaction'],
  [/^adverse effect(s)?$/,                          'adverse_effect'],
  [/^advice to patients$/,                          'advice_to_patients'],
  [/^nursing action$/,                              'nursing_action'],
  [/^pharmacovigilance$/,                           'pharmacovigilance'],
  [/^product description$/,                         'product_description'],
  [/^storage recommendations$/,                     'storage_recommendations'],
  [/^pack size( ?& ?| and )price$/,                 'pack_size_price'],
  [/^drug class( ?& ?| and )subclass$/,             '__classSubclass'],
  [/^prescription status( ?& ?| and )nafdac note$/, '__prescriptionStatus'],
];

function normalizeHeader(h) {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Strip markdown bold markers and leading bullet dashes, keep line breaks.
function cleanBody(body) {
  return body
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[-*]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1'))
    .join('\n')
    .trim();
}

function normalizePrescriptionStatus(text) {
  if (!text) return 'Prescription';
  const v = text.toLowerCase();
  if (v.includes('otc') || v.includes('over the counter') || v.includes('over-the-counter')) return 'OTC';
  if (v.includes('controlled')) return 'Controlled';
  return 'Prescription';
}

export function parseAiDrugDetail(text) {
  const fields = {};
  if (!text) return fields;

  const blocks = text.split(/\n(?=#{1,6}\s)/g);
  for (const block of blocks) {
    const headerMatch = block.match(/^#{1,6}\s+(.+)/);
    if (!headerMatch) continue;
    const header = normalizeHeader(headerMatch[1]);
    const body = cleanBody(block.replace(/^#{1,6}\s+.+\n?/, ''));
    if (!body) continue;

    const entry = HEADER_FIELD_MAP.find(([re]) => re.test(header));
    if (!entry) continue;
    const [, fieldKey] = entry;

    if (fieldKey === '__pharmacokinetics') {
      fields.pharmacology = fields.pharmacology ? `${fields.pharmacology}\n\n${body}` : body;
    } else if (fieldKey === '__classSubclass') {
      const classMatch = body.match(/class:?\s*([^\n]+)/i);
      const subclassMatch = body.match(/subclass:?\s*([^\n]+)/i);
      if (classMatch) fields.drug_class = classMatch[1].trim();
      if (subclassMatch) fields.drug_subclass = subclassMatch[1].trim();
    } else if (fieldKey === '__prescriptionStatus') {
      fields.prescription_status = normalizePrescriptionStatus(body);
      // Never invent a NAFDAC number — intentionally left blank for manual entry.
    } else {
      fields[fieldKey] = body;
    }
  }

  return fields;
}
