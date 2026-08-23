// Parses the markdown produced by the "procedure" mode of
// /api/drug-ai-details (## section headers, **bold** sub-labels, "- "/"1. "
// bullets) into a flat object matching the Firestore 'procedures' schema.
// Mirrors parseAiDrugDetail.js.

const HEADER_FIELD_MAP = [
  [/^overview$/,                 'overview'],
  [/^category$/,                 'category'],
  [/^indications?$/,             'indications'],
  [/^equipment needed$/,         'equipment_needed'],
  [/^pre-?procedure care$/,      'pre_procedure_care'],
  [/^procedure steps?$/,         'steps'],
  [/^post-?procedure care$/,     'post_procedure_care'],
  [/^complications?$/,           'complications'],
  [/^contraindications?$/,       'contraindications'],
];

function normalizeHeader(h) {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Strip markdown bold markers and leading bullet/number markers, keep line breaks.
function cleanBody(body) {
  return body
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1'))
    .join('\n')
    .trim();
}

// Category comes back as free text (e.g. "Surgical" or "Category: Surgical")
// — pull just the label out, capped to a short value.
function cleanCategory(body) {
  const clean = cleanBody(body).split('\n')[0] || '';
  return clean.replace(/^category:?\s*/i, '').trim().slice(0, 60);
}

export function parseAiProcedureDetail(text) {
  const fields = {};
  if (!text) return fields;

  const blocks = text.split(/\n(?=#{1,6}\s)/g);
  for (const block of blocks) {
    const headerMatch = block.match(/^#{1,6}\s+(.+)/);
    if (!headerMatch) continue;
    const header = normalizeHeader(headerMatch[1]);
    const rawBody = block.replace(/^#{1,6}\s+.+\n?/, '');

    const entry = HEADER_FIELD_MAP.find(([re]) => re.test(header));
    if (!entry) continue;
    const [, fieldKey] = entry;

    if (fieldKey === 'category') {
      const cat = cleanCategory(rawBody);
      if (cat) fields.category = cat;
    } else {
      const body = cleanBody(rawBody);
      if (body) fields[fieldKey] = body;
    }
  }

  return fields;
}

// Same "not found" detection used for drugs — a refusal is stated up front
// rather than buried, so checking the first ~600 chars (plus a full-text
// fallback) is enough.
const NOT_FOUND_PATTERNS = [
  /\bnot\s+(a\s+)?(recognized|real|known|valid)\b.{0,40}\b(procedure|technique)\b/i,
  /\bnot\s+confident\b.{0,80}\b(real|corresponds?|procedure)\b/i,
  /\b(does not|doesn'?t)\s+(correspond|match)\b.{0,60}\b(any|a)\b.{0,20}\b(real|known|recognized)\b/i,
  /\b(could not|couldn'?t|cannot|can'?t|unable to)\s+(find|identify|locate|confirm)\b.{0,60}\b(procedure|technique|information)\b/i,
  /\bno\s+(reliable\s+)?information\s+(found|available)\b.{0,40}\b(procedure|technique)\b/i,
  /^\s*(not available|not known|unknown|unrecognized|no data)\s*$/im,
];

export function isProcedureNotFoundText(text) {
  if (!text || !text.trim()) return true;
  const head = text.slice(0, 600);
  return NOT_FOUND_PATTERNS.some(re => re.test(head)) || NOT_FOUND_PATTERNS.some(re => re.test(text));
}
