// src/utils/medicationText.js
// Reads a pasted Google/AI answer about a condition's medications and returns
// ordered entries: { type: 'heading' | 'sub' | 'drug', text, underSub? }.
// Headings ("1. Bronchodilators (To Open Airways)") and class labels
// ("Short-acting beta-agonists (SABAs)") are recognised as groups, NOT drugs;
// the drug names mentioned under them are pulled out ("such as albuterol ...").

const GENERIC = new Set(('options option agents agent drugs drug medications medication medicines medicine steroids inhalers inhaler ' +
  'treatments treatment therapies therapy antibiotics others other classes class types type regimens supplements products ' +
  'formulations combinations immunizations vaccines vaccine symptoms infections infection cough coughing wheezing mucus ' +
  'examples example etc issues issue problems problem forms form relief control management').split(' '));
const PLACES = new Set(['china', 'india', 'nigeria', 'japan', 'europe', 'africa', 'asia', 'usa', 'uk', 'us', 'canada', 'germany', 'france', 'brazil', 'russia']);
const DISEASE_RE = /(osis|pathy|itis|emia|syndrome|disease|diseases|disorder|failure|cancer|fibrosis|asthma|copd|tuberculosis|tb|pneumonia|lupus|gout|arthritis|pleurisy|sepsis|inflammation|pain|fever|infection|infections|injury|trauma|cough|swelling|edema|effusion|embolism|thrombosis|clots?|stroke|attack)$/i;
const DRUG_WORD_RE = /\b[A-Za-z]{3,}(?:profen|oxicam|olol|pril|sartan|statin|azole|mycin|cillin|floxacin|cycline|prazole|tidine|dipine|thiazide|sone|solone|olone|formin|gliptin|gliflozin|glutide|parin|xaban|afil|triptan|setron|zolam|azepam|barbital|caine|terol|tropium|navir|vudine)\b|\b(?:naproxen|diclofenac|aspirin|paracetamol|acetaminophen|codeine|morphine|tramadol|colchicine|warfarin|heparin|insulin|metformin|ibuprofen|indomethacin|celecoxib|oxycodone|fentanyl|furosemide|spironolactone|amiodarone|digoxin|atenolol)\b/gi;
const BAD_START_RE = /^(the|a|an|many|some|these|those|various|several|specific|both|certain|most|each|any|all|this|that|such|your|their)\b/i;
const CLASS_RE = /(agonists?|antagonists?|anticholinergics?|corticosteroids?|steroids?|antibiotics?|antibacterials?|antifungals?|antivirals?|antitubercular|anti-?tb|drugs?|medications?|medicines?|vaccines?|immunizations?|mucolytics?|bronchodilators?|inhibitors?|blockers?|diuretics?|analgesics?|inhalers?|therapies|therapy|agents?|supplements?|antihistamines?|expectorants?|antitussives?|regimens?|sabas?|labas?|samas?|lamas?|anti[a-z-]+)$/i;
const CLASS_EXTRA_RE = /(modulators?|relaxants?|spasmodics?|depressants?|sedatives?|anxiolytics?|nitrates?|laxatives?|stimulants?|prokinetics?|antacids?|stabili[sz]ers?|chelators?|binders?|alkaloids?|anesthetics?|anaesthetics?|relievers?|softeners?|emollients?|lubricants?|protectants?|astringents?|decongestants?|antiseptics?|thinners?|vitamins?|electrolytes?|hormones?|[a-z]{3,}ics|[a-z]{4,}ants)$/i;
const isClassLabel = (t) => {
  const s = String(t || '').trim();
  const test = x => CLASS_RE.test(x.trim()) || CLASS_EXTRA_RE.test(x.trim());
  return test(s) || s.split(/\s+or\s+/i).some(test);
};
// Inside a "such as ..." list a lone brand-like word (e.g. "Antivert") is a drug; only plural or multi-word labels count as classes.
const looksLikeClassInList = (t) => isClassLabel(t) && (/\s/.test(t.trim()) || /s$/i.test(t.trim()));
const MODIFIER_RE = /^(?:(?:short|long|rapid|ultra-long)-acting|oral|inhaled|systemic|intravenous|injectable|topical|medical|newer|older|other|others|more|and|or|etc\.?)\s+/i;
const TRIGGER_RE = /(?:\bsuch as|\bincluding|\bfor example|\bnamely|\be\.g\.,?|\blike)\s+/gi;
const STOP_RE = /\s(?:are|is|may|might|can|could|which|that|used|often|who|will|should|must|help|helps|when|during|if|with|for|in|as|to|by|from|on|of|than|also|but|while|because)\s/i;

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const key = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function stripParens(s) {
  let out = '', d = 0;
  for (const ch of s) {
    if (ch === '(') d++;
    else if (ch === ')') d = Math.max(0, d - 1);
    else if (!d) out += ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function stripCitations(text) {
  return String(text || '').replace(/\r/g, '\n')
    .replace(/\[\d+\]\s*\(\s*https?:\/\/[^)]*\)/g, '')
    .replace(/\(\s*https?:\/\/[^)\s]*\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[\d+\]/g, '')
    .split('\n')
    .map(l => l.replace(/[\s,]+$/, '').replace(/[ \t]{2,}/g, ' ').trim());
}

function cleanTerm(raw) {
  let t = raw.trim();
  for (let i = 0; i < 3; i++) t = t.replace(MODIFIER_RE, '');
  t = t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
  if (!t || t.length < 3 || t.length > 40) return null;
  if (!/^\p{L}[\p{L}\p{N}'\- ]*$/u.test(t)) return null;
  const words = t.split(' ');
  if (words.length > 3 || BAD_START_RE.test(t)) return null;
  const last = words[words.length - 1].toLowerCase();
  if (GENERIC.has(last) || PLACES.has(last) || DISEASE_RE.test(last)) return null;
  return cap(t);
}

function splitLeadDesc(text) {
  let d = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') d++;
    else if (ch === ')') d = Math.max(0, d - 1);
    else if (!d && (ch === '.' || ch === ':') && i > 0 && /\s/.test(text[i + 1] || ' ')) {
      return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
    }
  }
  return [text.replace(/[.:]+$/, '').trim(), ''];
}

function drugsFromDescription(desc) {
  const found = [];
  let m;
  TRIGGER_RE.lastIndex = 0;
  while ((m = TRIGGER_RE.exec(desc))) {
    const before = desc.slice(0, m.index);
    if (/(countries|regions|places|areas|cities|states|nations|conditions?|infections?|diseases?|illness(?:es)?|disorders?|causes?|cases?|symptoms?|problems?|types?|treat|treating|treats|for)\s*$/i.test(before)) continue;
    const depth0 = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
    let d = depth0, seg = '';
    for (let i = m.index + m[0].length; i < desc.length; i++) {
      const ch = desc[i];
      if (ch === '(') d++;
      else if (ch === ')') { if (d <= depth0 && depth0 > 0) break; d--; }
      else if (depth0 === 0 && d === 0 && (ch === ';' || (ch === '.' && /\s/.test(desc[i + 1] || ' ')))) break;
      seg += ch;
    }
    seg = stripParens(seg).replace(/\b(?:like|such as|including|e\.g\.,?)\s+/gi, ', ');
    const cut = seg.split(STOP_RE)[0];
    cut.split(/\s*(?:,|;|&|\bor\b|\band\b)\s*/i).forEach(p => { const n = cleanTerm(p); if (n) found.push(n); });
  }
  if (!found.length) (desc.match(DRUG_WORD_RE) || []).forEach(w => { const n = cleanTerm(w); if (n) found.push(n); });
  return found;
}

function headingText(line) {
  const num = line.match(/^\s*\d+[.)]\s+(.+)$/);
  const t = (num ? num[1] : line).replace(/:$/, '').trim();
  if (!t || /[.?!]$/.test(t)) return null;
  const words = t.split(/\s+/).length;
  if (num) return t.length <= 90 && words <= 12 ? t : null;
  return /^[A-Z0-9]/.test(t) && t.length <= 70 && words <= 8 ? t : null;
}

// fallback(text) -> string[] is the plain one-name-per-line parser.
export function parseMedicationEntries(text, fallback) {
  const lines = stripCitations(text).filter(Boolean);
  const bulletRe = /^[\u2022\u00b7*-]\s*/;
  const hasDescription = l => bulletRe.test(l) && /[.:]\s+\S/.test(l.replace(bulletRe, '').replace(/\([^)]*\)/g, ''));
  const rich = lines.some(l => l.length > 100 || hasDescription(l));
  // One name per line. A line that is a drug class / group (e.g. "Anesthetics",
  // "Pain Relievers") is a subheading and the names after it belong under it.
  const plain = () => {
    const names = fallback ? fallback(text) : [];
    const out = [];
    let sub = null, found = false;
    names.forEach(n => {
      const t = String(n || '').trim();
      if (t.split(/\s+/).length <= 5 && looksLikeClassInList(t)) { found = true; sub = t; out.push({ type: 'sub', text: t }); return; }
      out.push({ type: 'drug', text: n, underSub: !!sub, heading: '', sub: sub || '', hOrder: 0, order: out.length });
    });
    return found ? out : names.map(n => ({ type: 'drug', text: n }));
  };
  if (!rich) return plain();

  const entries = [], seen = new Set();
  let sub = null, heading = '', hOrder = -1;
  let sticky = false; // a bare group label ("Anesthetics") keeps the plain bullets after it
  const addDrug = (n, underSub) => {
    const k = key(n);
    if (!k || seen.has(k)) return;
    seen.add(k);
    entries.push({ type: 'drug', text: n, underSub, heading, sub: underSub ? (sub || '') : '', hOrder: Math.max(hOrder, 0), order: entries.length });
  };

  for (const line of lines) {
    const isBullet = bulletRe.test(line);
    if (!isBullet) {
      const h = headingText(line);
      if (h) { entries.push({ type: 'heading', text: h }); heading = h; hOrder += 1; sub = null; sticky = false; }
      continue; // prose lines hold no drugs
    }
    const body = line.replace(bulletRe, '').trim();
    if (!body || /\?$/.test(body)) continue;
    const [lead, desc] = splitLeadDesc(body);
    const terms = stripParens(lead).split(/\s*(?:&|\band\b|\/|,)\s*/i).filter(Boolean);
    const isClass = terms.some(t => isClassLabel(t));
    // A label with a description after it and no usable drug name ("Motility issues: ...") is a group, not a drug.
    const isLabelOnly = !isClass && !!desc && terms.length > 0 && terms.every(t => !cleanTerm(t));
    if (isClass || isLabelOnly) {
      sub = lead;
      sticky = !desc;
      entries.push({ type: 'sub', text: lead });
      terms.filter(t => !isClassLabel(t)).forEach(t => { const n = cleanTerm(t); if (n) addDrug(n, true); });
    } else {
      // Plain drug bullets right after a bare group label stay under that label.
      if (!(sticky && sub && !desc)) { sub = null; sticky = false; }
      const nest = !!sub;
      terms.forEach(t => { const n = cleanTerm(t); if (n) addDrug(n, nest); });
    }
    const nested = !!sub;
    let inGroup = nested;
    for (const n of drugsFromDescription(desc)) {
      if (looksLikeClassInList(n)) { sub = n; inGroup = true; entries.push({ type: 'sub', text: n }); continue; }
      addDrug(n, inGroup);
    }
  }
  return entries.some(e => e.type === 'drug') ? entries : plain();
}
