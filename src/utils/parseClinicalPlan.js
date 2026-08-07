// src/utils/parseClinicalPlan.js
//
// Parses the structured text the shared "clinical_plan" AI mode returns
// (### DIAGNOSIS / MAIN THERAPY / ADJUNCT THERAPY / COMBINATION THERAPY /
// RED FLAGS / SAFETY NOTE) into renderable sections plus individual drug
// rows (name/dose/frequency/duration) for the course-chart table. This is
// a direct port of NACON-EMR's AIDrugInsightPanel.jsx extraction logic —
// kept in sync manually since the two apps are separate codebases.

export const SECTION_META = {
  'DIAGNOSIS':           { label: 'Diagnosis' },
  'MAIN THERAPY':        { label: 'Main Therapy' },
  'ADJUNCT THERAPY':     { label: 'Adjunct Therapy' },
  'COMBINATION THERAPY': { label: 'Combination Therapy' },
  'RED FLAGS':           { label: 'Red Flags' },
  'SAFETY NOTE':         { label: 'Safety Note' },
};

// Splits the AI response into { header, lines[] } chunks based on the
// "### HEADER" markers the prompt requires. Anything before the first
// recognized header is dropped (shouldn't happen if the model follows
// instructions, but keeps rendering safe if it doesn't).
export function splitIntoSections(text) {
  const lines = (text || '').split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.trim().match(/^#{1,3}\s*(DIAGNOSIS|MAIN THERAPY|ADJUNCT THERAPY|COMBINATION THERAPY|RED FLAGS|SAFETY NOTE)\s*$/i);
    if (m) {
      current = { header: m[1].toUpperCase(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

const FREQUENCY_PHRASES = [
  'four times daily', 'three times daily', 'twice daily', 'once daily',
  'four times a day', 'three times a day', 'twice a day', 'once a day',
  'four times weekly', 'three times weekly', 'twice weekly', 'once weekly',
  'every 4 hours', 'every 6 hours', 'every 8 hours', 'every 12 hours',
  'every other day', 'at bedtime', 'as needed', 'stat', 'once off',
];

// Extracts drug rows from a block of lines, tagged with which clinical
// category they came from (main / adjunct / combination) so the UI and
// course chart can preserve that distinction instead of flattening
// everything into one undifferentiated list.
function extractDrugRows(lines, category) {
  const rows = [];
  lines.forEach(line => {
    const m = line.trim().match(/^[*-]\s+\*\*([^*]+)\*\*\s*(.*)$/);
    if (!m) return;
    const name = m[1].trim().replace(/:$/, '');
    if (!name) return;

    // Dosing info is everything before the first explanatory parenthesis.
    const dosingText = m[2].split('(')[0].replace(/\.\s*$/, '').trim();

    const doseMatch = dosingText.match(/\d+(?:\.\d+)?\s?(mg|g|mcg|µg|ml|l|units?|iu)\b/i);
    const dose = doseMatch ? doseMatch[0].replace(/\s+/, ' ').trim() : '';

    // Standard course durations ("for 4 weeks") and fluid infusion spans
    // ("over 8 hours") use different prepositions/units, so both are
    // matched — otherwise every IV fluid order (dextrose saline, normal
    // saline, etc.) comes through with a blank duration column.
    const durationMatch =
      dosingText.match(/\bfor\s+(\d+(?:\s*[-–]\s*\d+)?\s*(days|day|weeks|week|months|month|hours|hour))/i) ||
      dosingText.match(/\bover\s+(\d+(?:\s*[-–]\s*\d+)?\s*(hours|hour|minutes|minute|days|day))/i);
    const duration = durationMatch ? durationMatch[1].trim() : '';

    const lowerDosing = dosingText.toLowerCase();
    const freqPhrase = FREQUENCY_PHRASES.find(p => lowerDosing.includes(p));
    const frequency = freqPhrase || '';

    rows.push({ name, dose, frequency, duration, category });
  });
  return rows;
}

// Pulls drug rows out of every Main/Adjunct/Combination section found,
// deduping by name (keeps the first occurrence's category — Main wins over
// Adjunct/Combination if the same drug is listed in more than one section).
export function extractAllDrugRows(sections) {
  const order = ['MAIN THERAPY', 'ADJUNCT THERAPY', 'COMBINATION THERAPY'];
  const seen = new Set();
  const rows = [];
  for (const header of order) {
    const section = sections.find(s => s.header === header);
    if (!section) continue;
    for (const row of extractDrugRows(section.lines, header)) {
      const key = row.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}
