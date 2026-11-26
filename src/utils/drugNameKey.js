// src/utils/drugNameKey.js
// One shared way to decide "is this the same drug?" so the app stops saving
// "Nitroglycerin" and "Nitroglycerin (GTN)" as two drugs.
//
//   drugIdentityKey(name) - same drug, same formulation. Ignores case, accents,
//     punctuation, brackets that only hold an abbreviation or another name for
//     the same drug "(GTN)", "(Acetaminophen)", and known alternative names
//     (paracetamol = acetaminophen, adrenaline = epinephrine ...).
//     Salts are KEPT, so metoprolol tartrate and succinate stay separate.
//     Used by the duplicate finder.
//   drugMatchKey(name) - looser: also drops salt words (hydrochloride, sodium ...)
//     so a pasted name links to the drug already in the app instead of creating
//     another one. Used when adding or linking drugs.
//
// Brackets with other meaning ("Insulin (Regular)", "Insulin (NPH)") are kept.

const SYNONYMS = {
  acetaminophen: 'paracetamol', adrenaline: 'epinephrine', noradrenaline: 'norepinephrine',
  albuterol: 'salbutamol', gtn: 'nitroglycerin', nitroglycerine: 'nitroglycerin',
  'glyceryl trinitrate': 'nitroglycerin', frusemide: 'furosemide', lignocaine: 'lidocaine',
  rifampin: 'rifampicin', ciclosporin: 'cyclosporine', thyroxine: 'levothyroxine',
  pethidine: 'meperidine', sulphasalazine: 'sulfasalazine', amoxycillin: 'amoxicillin',
  cefalexin: 'cephalexin', isoprenaline: 'isoproterenol', glibenclamide: 'glyburide',
  'acetylsalicylic acid': 'aspirin', asa: 'aspirin', pcm: 'paracetamol', epi: 'epinephrine', nac: 'acetylcysteine', ntg: 'nitroglycerin', 'vitamin c': 'ascorbic acid',
  'vitamin b12': 'cyanocobalamin', 'vitamin d3': 'cholecalciferol', 'vitamin b1': 'thiamine',
  'vitamin b6': 'pyridoxine', 'vitamin b9': 'folic acid', 'vitamin e': 'tocopherol',
  'clavulanic acid': 'clavulanate', 'co trimoxazole': 'cotrimoxazole',
  paracetamol: 'paracetamol',
};
const SALT_RE = /\b(hydrochloride|hcl|sodium|potassium|sulfate|sulphate|phosphate|maleate|mesylate|besylate|succinate|tartrate|dihydrate|monohydrate)\b/g;

const clean = (s) => String(s || '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[®™©]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim().replace(/\s+/g, ' ');

const canon = (s) => {
  let c = clean(s).replace(/\bco (\w)/g, 'co$1');
  if (SYNONYMS[c]) return SYNONYMS[c];
  // Word-level synonyms ("lignocaine hydrochloride" -> "lidocaine hydrochloride").
  c = c.split(' ').map(w => (SYNONYMS[w] && !w.includes(' ') ? SYNONYMS[w] : w)).join(' ');
  return SYNONYMS[c] || c;
};


export function drugIdentityKey(name) {
  const raw = String(name || '');
  const brackets = [];
  const base = raw.replace(/[([]\s*([^)\]]*?)\s*[)\]]/g, (_, inner) => { brackets.push(inner); return ' '; });
  // "Nitroglycerin / GTN" -> parts; identical parts after synonyms collapse to one.
  const parts = base.split('/').map(canon).filter(Boolean);
  const uniq = [...new Set(parts)];
  const baseKey = uniq.join(' ');
  const extra = [];
  for (const b of brackets) {
    const k = canon(b);
    if (!k || k === baseKey || uniq.includes(k)) continue; // another name for the same drug
    extra.push(k);
  }
  return [baseKey, ...extra].join(' ').trim();
}

export function drugMatchKey(name) {
  return drugIdentityKey(name).replace(SALT_RE, '').replace(/\s+/g, ' ').trim();
}

// Keys a drug record can be found by: its own name plus each of its brand names.
export function drugLookupKeys(drug) {
  const keys = [drugMatchKey(drug?.generic_name)];
  const brands = Array.isArray(drug?.brand_names) ? drug.brand_names : String(drug?.brand_names || '').split(/[,;]/);
  brands.forEach(b => { const k = drugMatchKey(b); if (k) keys.push(k); });
  return keys.filter(Boolean);
}

// ── Manufacturer-branded records ─────────────────────────────────────────
// "Emzor Paracetamol", "Fidson Amoxicillin Capsules" are one maker's product of
// a generic drug, not a different drug. splitManufacturer() returns the maker
// and the rest of the name so the duplicate finder can offer to merge the
// record into the generic. Only well-known makers are listed, so an ordinary
// drug name that merely starts like a company never matches.
const MANUFACTURERS = [
  'may and baker', 'may baker', 'emzor', 'fidson', 'neimeth', 'swipha', 'bioraj', 'greenlife',
  'drugfield', 'mopson', 'juhel', 'evans', 'pfizer', 'gsk', 'glaxosmithkline', 'sanofi', 'novartis',
  'roche', 'bayer', 'abbott', 'cipla', 'ranbaxy', 'lupin', 'glenmark', 'teva', 'mylan', 'merck',
  'astrazeneca', 'novo nordisk', 'micro labs', 'ajanta',
].sort((a, b) => b.length - a.length);
const FORM_TAIL_RE = /\b(tablets?|tabs?|capsules?|caps|syrup|suspension|injection|cream|ointment|drops|oral)$/;

export function splitManufacturer(name) {
  const c = clean(String(name || '').replace(/[([][^)\]]*[)\]]/g, ' '));
  for (const m of MANUFACTURERS) {
    if (!c.startsWith(m + ' ')) continue;
    const rest = c.slice(m.length + 1).replace(FORM_TAIL_RE, '').trim();
    if (rest.length >= 3) return { manufacturer: m, rest };
  }
  return null;
}
