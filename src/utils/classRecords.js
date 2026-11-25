// src/utils/classRecords.js
// A drug CLASS (e.g. "NSAIDs (e.g., Ibuprofen, Naproxen)") is a heading, not a
// drug. Some import / AI pipelines saved class names into the `drugs`
// collection, so they showed up in search and lists as if they were drugs.
// This file is the single place that decides "is this record really a class?".
//
// Order of decision:
//   1. record_type === 'drug'   -> always a drug (admin override for false positives)
//   2. record_type === 'class'  -> always a class (set by scripts/flagClassRecords.js)
//   3. heuristics on the name   -> only strong signals, because brackets are
//      normal in real drug names ("Paracetamol (Acetaminophen)").

const GROUP_SUFFIX = /\b(agents?|drugs|medications|medicines|inhibitors|blockers|antagonists|agonists|analgesics|antibiotics|antibacterials|antihypertensives|antidiabetics|diuretics|corticosteroids|nsaids|class|classes|group)$/i;

// Drop trailing "(...)" so "Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)"
// is tested as "Non-Steroidal Anti-Inflammatory Drugs".
const stripTrailingBrackets = (s) => s.replace(/\s*\([^)]*\)\s*$/g, '').trim();

export function isClassRecord(drug) {
  if (!drug) return false;
  if (drug.record_type === 'drug') return false;
  if (drug.record_type === 'class' || drug.is_class === true) return true;

  const name = String(drug.generic_name || '').trim();
  if (!name) return false;

  // "NSAIDs (e.g., Ibuprofen, Naproxen)" — a name that lists examples is a group.
  if (/\be\.g\.|\bi\.e\.|\betc\b/i.test(name)) return true;

  // Plural / group nouns at the end of the name ("Pain Management Agents").
  if (GROUP_SUFFIX.test(stripTrailingBrackets(name))) return true;

  return false;
}

// Splits a raw drugs list into real drugs and class records.
export function splitDrugRecords(records) {
  const drugs = [];
  const classes = [];
  for (const r of records || []) (isClassRecord(r) ? classes : drugs).push(r);
  return { drugs, classes };
}

// Group an ordered drug list under class subheadings. Order of first
// appearance is kept, so relevance-sorted search results stay relevance-sorted.
export function groupByClass(drugs, getClass) {
  const order = [];
  const map = new Map();
  for (const d of drugs || []) {
    const heading = (getClass(d) || 'Other').trim() || 'Other';
    const key = heading.toLowerCase();
    if (!map.has(key)) { map.set(key, { heading, drugs: [] }); order.push(key); }
    map.get(key).drugs.push(d);
  }
  return order.map(k => map.get(k));
}
