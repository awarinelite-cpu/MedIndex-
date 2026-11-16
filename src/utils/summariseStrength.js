// src/utils/summariseStrength.js
//
// The AI-written "strength" field is a long run-on paragraph per dosage form
// ("Concentrate for … Infusion (Vials/Ampoules): 250 mg/20 mL (12.5 mg/mL)
// single-dose vials (standard international and Nigerian NHIA formulary
// presentation); … Premixed … Bags: …"). This turns it into a short, scannable
// structure: one entry per dosage form with its strengths as sub-items, and the
// commentary (availability notes, brand examples, formulary remarks) removed.
//
// Returns: [{ form: string|null, items: string[] }]

const COMMENTARY = /\b(standard|widely|stocked|formulary|hospital|pharmac|e\.g\.|i\.e\.|international|Nigeria|NHIA|NAFDAC|common|available|marketed|presentation|brand)\w*/i;

function cleanItem(raw) {
  let t = String(raw || '').trim();
  // Drop trailing ", e.g., …" brand/availability tails.
  t = t.replace(/,?\s*\be\.g\.,?.*$/i, '');
  // Parentheticals: drop commentary ones; for "(1,000 mcg/mL or 1 mg/mL)" keep the last alternative.
  t = t.replace(/\(([^()]*)\)/g, (m, inner) => {
    if (COMMENTARY.test(inner) && !/^\s*[\d.,]+\s?(mg|mcg|µg|g|IU|%)/i.test(inner)) return '';
    if (COMMENTARY.test(inner)) return '';
    if (/\s+or\s+/i.test(inner)) return `(${inner.split(/\s+or\s+/i).pop().trim()})`;
    return m;
  });
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.;)])/g, '$1').trim();
  // Keep "strength (equivalent)" plus a short descriptor; drop long descriptive tails.
  const m = t.match(/^(\d[\d.,]*\s?(?:mg|mcg|µg|g|IU|units?|%|mEq|mmol)(?:\s?\/\s?[\d.,]*\s?(?:m[lL]|L|g|mg|dose|actuation))?(?:\s*\([^)]*\))?)\s*(.*)$/i);
  if (m) {
    const tail = m[2].replace(/^[,;\-–\s]+/, '').trim();
    const words = tail ? tail.split(/\s+/).length : 0;
    t = words > 0 && words <= 3 ? `${m[1]} ${tail}` : m[1];
  }
  return t.replace(/[.;,\s]+$/, '').trim();
}

function splitSegments(line) {
  // Sentence boundaries between dosage forms: ". Capital" (not inside "e.g.")
  return line.split(/(?<=[a-z0-9)%])\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
}

export function summariseStrength(strength) {
  if (!strength) return [];
  const lines = String(strength).replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  lines.forEach(line => {
    splitSegments(line.replace(/^\s*(?:[-•*]|\d{1,2}[.)])\s+/, '')).forEach(seg => {
      const c = seg.indexOf(':');
      if (c > 0 && c <= 140 && !/\d\s?:\s?\d/.test(seg.slice(Math.max(0, c - 2), c + 3))) {
        const form = seg.slice(0, c).trim();
        const items = seg.slice(c + 1).split(/;\s*/).map(cleanItem).filter(Boolean);
        out.push({ form, items });
      } else {
        out.push({ form: null, items: [cleanItem(seg) || seg] });
      }
    });
  });
  // Merge consecutive form-less entries into one list.
  return out.reduce((acc, e) => {
    const last = acc[acc.length - 1];
    if (!e.form && last && !last.form) last.items.push(...e.items);
    else acc.push(e);
    return acc;
  }, []);
}
