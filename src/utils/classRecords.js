// src/utils/classRecords.js
// A drug CLASS (e.g. "NSAIDs (e.g., Ibuprofen, Naproxen)", "ARBs", "Smoking
// Cessation Aids") is a heading, not a drug. Pasted lists and AI pipelines
// sometimes saved class names into the `drugs` collection, so they showed up
// as drug rows. This file is the single place that decides "is this record
// really a class?", and where a class's example drugs come from.
//
// Order of decision (isClassRecord):
//   1. record_type === 'drug'   -> always a drug (admin override for false positives)
//   2. record_type === 'class'  -> always a class (set from the admin panel)
//   3. heuristics               -> only strong signals, because brackets are
//      normal in real drug names ("Paracetamol (Acetaminophen)").
import { drugMatchKey } from './drugNameKey';

const GROUP_SUFFIX = /\b(agents?|drugs|medications|medicines|inhibitors|blockers|antagonists|agonists|analgesics|antibiotics|antibacterials|antihypertensives|antidiabetics|diuretics|corticosteroids|nsaids|class|classes|group|aids|antiplatelets|anticoagulants|statins|opioids|laxatives|antacids|antiemetics|antipsychotics|antidepressants|anticonvulsants|antihistamines|antivirals|antifungals|antimalarials|bronchodilators|vasodilators|sedatives|stimulants|relaxants|supplements|vitamins)$/i;

// Drop trailing "(...)" so "Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)"
// is tested as "Non-Steroidal Anti-Inflammatory Drugs".
const stripTrailingBrackets = (s) => s.replace(/\s*\([^)]*\)\s*$/g, '').trim();

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const EG_RE = /\b(?:e\.g\.|i\.e\.|such as|for example|including|incl\.)[,:]?\s*/i;

// "Angiotensin II Receptor Blockers / ARBs (e.g., Losartan, Valsartan)"
//   -> ['Losartan', 'Valsartan']
export function extractExampleNames(text) {
  const out = [];
  const s = String(text || '');
  const re = new RegExp(EG_RE.source, 'ig');
  let m;
  while ((m = re.exec(s))) {
    let seg = '', depth = 0;
    for (let i = m.index + m[0].length; i < s.length; i++) {
      const ch = s[i];
      if (ch === '(') depth++;
      else if (ch === ')') { if (depth === 0) break; depth--; }
      else if (ch === ';' || (ch === '.' && /\s/.test(s[i + 1] || ' ') && depth === 0)) break;
      seg += ch;
    }
    seg.split(/\s*(?:,|;|&|\/|\bor\b|\band\b)\s*/i).forEach(p => {
      const t = p.replace(/\([^)]*\)/g, '').replace(/\b(etc|others?|more)\b\.?/ig, '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
      if (t.length >= 3 && t.length <= 40 && t.split(' ').length <= 3) out.push(t.charAt(0).toUpperCase() + t.slice(1));
    });
  }
  return [...new Set(out)];
}

// Is `name` just a short label (abbreviation/alias) for the class described by
// `contextText`? e.g. name "ARBs" inside "Angiotensin II Receptor Blockers /
// ARBs (e.g., Losartan, Valsartan)" — the context lists examples, and the name
// is part of the class label, not one of the examples.
export function isClassAlias(name, contextText) {
  const n = norm(name);
  const ctx = String(contextText || '');
  if (!n || !ctx || !EG_RE.test(ctx)) return false;
  const examples = extractExampleNames(ctx).map(norm);
  if (examples.includes(n)) return false;
  const label = norm(ctx.split(EG_RE)[0]);
  return (' ' + label + ' ').includes(' ' + n + ' ');
}

const groupTexts = (drug) => Object.values(drug?.condition_groups || {})
  .flatMap(g => [g?.sub, g?.heading]).filter(Boolean);

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

  // The name is a short label for a class that lists example drugs, in the
  // record's own class fields or in the pasted sub-heading it sits under.
  const contexts = [drug.drug_class, drug.drug_subclass, ...groupTexts(drug)];
  if (contexts.some(c => isClassAlias(name, c))) return true;

  return false;
}

// Example drugs a class record names, from its name, class fields and the
// pasted headings it sits under.
export function classExampleNames(cls) {
  const texts = [cls.generic_name, cls.drug_class, cls.drug_subclass, ...groupTexts(cls)];
  return [...new Set(texts.flatMap(extractExampleNames))];
}

// Splits a raw drugs list into real drugs and class records.
//  - Class records are annotated with `_memberIds` (real drugs found by the
//    "(e.g., …)" names).
//  - Those member drugs inherit the class record's condition tags / roles /
//    pasted group, so a condition that listed "ARBs" now lists Losartan and
//    Valsartan instead. Nothing is written; this only changes what is shown.
export function splitDrugRecords(records) {
  const drugs = [];
  const classes = [];
  for (const r of records || []) (isClassRecord(r) ? classes : drugs).push(r);
  if (!classes.length) return { drugs, classes };

  const byKey = new Map();
  drugs.forEach((d, i) => { const k = drugMatchKey(d.generic_name); if (k && !byKey.has(k)) byKey.set(k, i); });

  const patched = new Map(); // index -> patched drug
  const annotated = classes.map(cls => {
    const memberIdx = [];
    for (const ex of classExampleNames(cls)) {
      const i = byKey.get(drugMatchKey(ex));
      if (i !== undefined && !memberIdx.includes(i)) memberIdx.push(i);
    }
    const tags = Array.isArray(cls.condition_tags) ? cls.condition_tags : [];
    for (const i of memberIdx) {
      const cur = patched.get(i) || drugs[i];
      const excluded = new Set(Array.isArray(cur.condition_excluded) ? cur.condition_excluded : []);
      const addTags = tags.filter(t => !excluded.has(t) && !(cur.condition_tags || []).includes(t));
      const addRoles = Object.entries(cls.condition_roles || {}).filter(([c]) => !excluded.has(c) && cur.condition_roles?.[c] === undefined);
      const addGroups = Object.entries(cls.condition_groups || {}).filter(([c]) => !excluded.has(c) && cur.condition_groups?.[c] === undefined);
      if (addTags.length || addRoles.length || addGroups.length) {
        patched.set(i, {
          ...cur,
          condition_tags: [...(cur.condition_tags || []), ...addTags],
          condition_roles: { ...(cur.condition_roles || {}), ...Object.fromEntries(addRoles) },
          condition_groups: { ...(cur.condition_groups || {}), ...Object.fromEntries(addGroups) },
        });
      }
    }
    return { ...cls, _memberIds: memberIdx.map(i => drugs[i].id) };
  });

  patched.forEach((d, i) => { drugs[i] = d; });
  return { drugs, classes: annotated };
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
