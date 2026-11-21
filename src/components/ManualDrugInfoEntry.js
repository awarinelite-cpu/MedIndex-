// Admin-only card: paste or upload CSV to fill in this drug's information by hand.
// Accepts either (a) a header row + one data row, or (b) two columns "field,value".
// Only non-empty known fields are merged onto the drug record.
import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import useAutoSaveOnPaste from '../utils/useAutoSaveOnPaste';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ClipboardPaste, Upload, Download, ChevronDown, Save, Loader2, Search, ExternalLink } from 'lucide-react';
import { db, auth } from '../firebase';
import { TAB_SECTIONS } from '../utils/aiSectionFill';
import { parseAiDrugDetail, stripCitations, normalizePlainHeadings } from '../utils/parseAiDrugDetail';

const FIELDS = [
  'drug_class', 'drug_subclass', 'prescription_status', 'nafdac_no', 'pronunciation', 'brand_names',
  'overview', 'strength', 'indications', 'off_label_use', 'therapeutic_note',
  'adult_dose', 'child_dose', 'renal_dose', 'administration', 'nstg_recommendations',
  'pharmacology', 'advice_to_patients', 'contraindications', 'precautions',
  'pregnancy_lactation', 'interaction', 'adverse_effect', 'nursing_action',
  'pharmacovigilance', 'product_description', 'storage_recommendations', 'pack_size_price',
];

// Each tab gets its own field set, so its Google search asks only for that tab's info.
export const TAB_FIELDS = {
  overview:     { label: 'Overview',      fields: ['drug_class', 'drug_subclass', 'prescription_status', 'nafdac_no', 'pronunciation', 'brand_names', 'overview', 'strength', 'indications', 'off_label_use', 'therapeutic_note'] },
  dosage:       { label: 'Dosage',        fields: ['adult_dose', 'child_dose', 'renal_dose', 'administration', 'nstg_recommendations'] },
  safety:       { label: 'Safety',        fields: ['contraindications', 'precautions', 'adverse_effect', 'pregnancy_lactation', 'advice_to_patients', 'pharmacovigilance'] },
  interactions: { label: 'Interactions',  fields: ['interaction'] },
  pharmacology: { label: 'Pharmacology',  fields: ['pharmacology', 'drug_class', 'drug_subclass', 'product_description', 'storage_recommendations', 'pack_size_price'] },
  nursing:      { label: 'Nursing Notes', fields: ['nursing_action'] },
};

// Google search for one tab. Same wording as the app's full AI drug prompt
// (api/drug-ai-details.js), limited to this tab's sections so the answer can
// be pasted straight back into the matching "Add ... information from Google".
const GOOGLE_SECTION_HINTS = {
  'Overview': 'use the Overview format given below',
  'Indications': 'primary approved uses',
  'Off-Label Therapeutic Use': 'clinically recognized off-label uses, each as a bullet with a brief rationale; if none, write "No well-established off-label uses"',
  'Therapeutic Note': 'clinically useful context: place in therapy, comparison to alternatives, key caveats',
  'Adult Dose': 'typical dosing, frequency, route(s) - PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD as applicable',
  'Child Dose': 'pediatric dosing where established; note if not recommended in children',
  'Renal Dose': 'adjustment for renal impairment',
  'Administration': 'practical administration instructions - timing with food, reconstitution, infusion rate, etc.',
  'NSTG Recommendations': 'Nigeria Standard Treatment Guidelines context if known; otherwise general standard-of-care guidance',
  'Pregnancy & Lactation': '',
  'Contraindications': '',
  'Precautions': '',
  'Adverse Effects': '',
  'Advice to Patients': 'patient counseling points',
  'Pharmacovigilance': 'notable safety signals, black box warnings, reporting considerations',
  'Interactions': 'important drug interactions, mechanism-level detail',
  'Mechanism of Action & Pharmacology': '',
  'Pharmacokinetics': 'absorption, distribution, metabolism, elimination, half-life',
  'Product Description': 'formulation/appearance if commonly known',
  'Storage Recommendations': '',
  'Pack Size & Price': 'general Nigerian market context if known; otherwise note this varies and should be verified locally',
  'Nursing Action': 'nursing-specific monitoring and administration responsibilities',
};

// Nursing tab only: the AI Insight's own drug prompt (api/drug-ai-details.js,
// default drug mode), word for word, with the saved fields filled in and the
// section list cut down to "Nursing Action" alone. The openFDA/RxNorm block is
// server-only, so it is not part of the Google version.
const KNOWN_DATA_LABELS = [
  ['overview', 'Overview'], ['strength', 'Strength'], ['indications', 'Indications'],
  ['therapeutic_note', 'Therapeutic Note'], ['pharmacology', 'Mechanism of Action & Pharmacology'],
  ['adult_dose', 'Adult Dose'], ['child_dose', 'Child Dose'], ['renal_dose', 'Renal Dose'],
  ['administration', 'Administration'], ['nstg_recommendations', 'NSTG Recommendations'],
  ['contraindications', 'Contraindications'], ['precautions', 'Precautions'],
  ['pregnancy_lactation', 'Pregnancy & Lactation'], ['interaction', 'Interaction'],
  ['adverse_effect', 'Adverse Effect'], ['advice_to_patients', 'Advice to Patients'],
  ['pharmacovigilance', 'Pharmacovigilance'],
  ['product_description', 'Product Description'], ['storage_recommendations', 'Storage Recommendations'],
  ['pack_size_price', 'Pack Size & Price'],
];

// "Overview: ... Strength: ..." from the drug's saved fields (Nursing Action is never listed, and the
// section being requested can be left out via excludeKeys so the prompt does not feed the answer back).
export function buildKnownDrugData(drug, perField = 250, total = 2500, excludeKeys = []) {
  let out = '';
  for (const [key, label] of KNOWN_DATA_LABELS) {
    if (excludeKeys.includes(key)) continue;
    const v = String(drug?.[key] || '').replace(/\s+/g, ' ').trim();
    if (!v) continue;
    const line = `${label}: ${v.length > perField ? v.slice(0, perField) + '...' : v}\n`;
    if (out.length + line.length > total) break;
    out += line;
  }
  return out.trim();
}

function nursingActionGoogleUrl(drugName, drugClass, brandNames, knownData) {
  const q = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.\n\n`
    + `Before writing your answer, use Google Search to verify this drug's current indications, dosing, contraindications, and interactions against up-to-date sources - do this even if you already feel confident about the drug, since training data can be outdated or subtly wrong. Reach your conclusions from what the search turns up, not from recall alone.\n\n`
    + `Drug: ${drugName}\n${brandNames ? `Known brand names: ${brandNames}\n` : ''}${drugClass ? `Drug class: ${drugClass}\n` : ''}\n`
    + (knownData ? `Existing reference data already shown to the nurse (do not simply repeat this - add depth, nuance, and anything missing):\n${knownData}\n\n` : '')
    + `Write ONLY the following section, using a clear markdown header (##) with exactly this name:\n- Nursing Action (nursing-specific monitoring and administration responsibilities)\n\n`
    + `Write the section in full - if not well established, write "Not well established / consult current prescribing information". Aim for genuine depth (roughly 3-6 sentences, or 4-8 bullet points where a list format fits better) rather than a one-line summary - a nurse should be able to rely on this section alone without needing to look elsewhere.\n\n`
    + `Bold sub-labels using **double asterisks** (e.g. "**Monitoring:** ...") so a nurse can scan the section quickly. Use bullet points (starting each line with "- ") for lists, and don't stop at 2-3 items when more genuinely apply.\n\n`
    + `Do not add any other sections, preamble, or closing text. Be precise, clinically accurate, and thorough. Do not fabricate specific numeric dosing if you are not confident - note where prescribing information should be consulted instead. This is reference material only, not a substitute for the current product monograph.`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// Overview tab: the full AI Insight prompt (api/drug-ai-details.js, default drug mode), word for word,
// with the saved fields filled in. Only additions: a Brand Names section and a "Class:/Subclass:" line format so the pasted answer can be saved.
function overviewGoogleUrl(drugName, drugClass, brandNames, knownData) {
  const q = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.\n\n`
    + `Before writing your answer, use Google Search to verify this drug's current indications, dosing, contraindications, and interactions against up-to-date sources - do this even if you already feel confident about the drug, since training data can be outdated or subtly wrong. Reach your conclusions from what the search turns up, not from recall alone.\n\n`
    + `Drug: ${drugName}\n${brandNames ? `Known brand names: ${brandNames}\n` : ''}${drugClass ? `Drug class: ${drugClass}\n` : ''}\n`
    + (knownData ? `Existing reference data already shown to the nurse (do not simply repeat this - add depth, nuance, and anything missing):\n${knownData}\n\n` : '')
    + `Structure your response with these sections, using clear markdown headers (##):\n- Overview (concise summary of what the drug is and its place in therapy)\n- Pronunciation (simple phonetic spelling, syllables separated by hyphens with the stressed syllable in CAPITALS - e.g. "am-ox-i-SIL-in" - no IPA symbols)\n- Drug Class & Subclass (write "Class: ..." and "Subclass: ..." each on its own line)\n- Brand Names (the common brand/trade names this drug is marketed under, in Nigeria and internationally, separated by commas)\n- Strength (the formulation strength(s) each dosage form usually comes in - e.g. "Tab: 500mg", "IV: 500mg/100mL", "Susp: 125mg/5mL" - list each route/form on its own line if there's more than one; this is about product strength, not the dosing regimen)\n- Indications (primary approved uses)\n- Therapeutic Note (clinically useful context: place in therapy, comparison to alternatives, key caveats)\n- Mechanism of Action & Pharmacology\n- Pharmacokinetics (absorption, distribution, metabolism, elimination, half-life)\n- Adult Dose (typical dosing, frequency, route(s) - PO/IV/IM/SC/SL/PR/INH/TOP/NAS/TD as applicable)\n- Child Dose (pediatric dosing where established; note if not recommended in children)\n- Renal Dose (adjustment for renal impairment)\n- Administration (practical administration instructions - timing with food, reconstitution, infusion rate, etc.)\n- NSTG Recommendations (Nigeria Standard Treatment Guidelines context if known; otherwise general standard-of-care guidance)\n- Contraindications\n- Precautions\n- Pregnancy & Lactation\n- Interaction (important drug interactions, mechanism-level detail)\n- Adverse Effect\n- Advice to Patients (patient counseling points)\n- Nursing Action (nursing-specific monitoring and administration responsibilities)\n- Pharmacovigilance (notable safety signals, black box warnings, reporting considerations)\n- Product Description (formulation/appearance if commonly known)\n- Storage Recommendations\n- Pack Size & Price (general Nigerian market context if known; otherwise note this varies and should be verified locally)\n- Prescription Status & NAFDAC Note (OTC / Prescription / Controlled; state that the NAFDAC registration number must be verified against the product label - never invent one)\n\nWrite every section listed above in full - if a section is not well established for this drug, write "Not well established / consult current prescribing information" rather than omitting it, so the response fully mirrors this reference schema. Aim for genuine depth in each section (roughly 3-6 sentences, or 4-8 bullet points where a list format fits better) rather than a one-line summary - a nurse should be able to rely on this section alone without needing to look elsewhere.\n\nWithin each section, bold any sub-labels using **double asterisks** (e.g. "**Absorption:** ...", "**Renal impairment:** ...") so a nurse can scan the section quickly. Use bullet points (starting each line with "- ") for lists of items like contraindications, adverse effects, or interactions, and don't stop at 2-3 items when more genuinely apply - list them thoroughly.\n\nBe precise, clinically accurate, and thorough within each section. Do not pad with filler or repeat yourself, but do not compress well-established clinical detail into a single sentence when it deserves more. Do not fabricate specific numeric dosing if you are not confident - note where prescribing information should be consulted instead. This is reference material only, not a substitute for the current product monograph.`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function googleDrugInfoUrl(drugName, tabId = 'overview', drugClass = '', brandNames = '', knownData = '') {
  if (tabId === 'nursing') return nursingActionGoogleUrl(drugName, drugClass, brandNames, knownData);
  if (tabId === 'overview') return overviewGoogleUrl(drugName, drugClass, brandNames, knownData);
  const cfg = TAB_SECTIONS[tabId] || TAB_SECTIONS.overview;
  const headerList = cfg.headers
    .map(h => `- ${h}${GOOGLE_SECTION_HINTS[h] ? ` (${GOOGLE_SECTION_HINTS[h]})` : ''}`)
    .join('\n');
  const overviewRule = cfg.headers.some(h => /^overview$/i.test(h))
    ? `Under Overview write ONE paragraph in exactly this pattern: "${drugName} is a prescription medication primarily used to treat <main indication> in <patient population>. It belongs to the class of <drug class (ABBREVIATION)>, which work by <plain-language mechanism>. ${drugName} is the generic name for medications previously marketed as <brand names>." (say "over-the-counter medication" if it is OTC). Example: "Vardenafil is a prescription medication primarily used to treat erectile dysfunction (ED) in adult men. It belongs to the class of phosphodiesterase type 5 (PDE5) inhibitors, which work by increasing blood flow to the penis, facilitating the achievement and maintenance of an erection during sexual stimulation. Vardenafil is the generic name for medications previously marketed as Levitra and Staxyn." Never start the Overview with pharmacologic action, mechanism or class, and do not use "Generic Name:/Drug Class:/Mechanism of Action:" labels.\n\n`
    : '';
  const q = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. Provide extensive, well-organized clinical reference information about the following medication for professional/educational use.\n\n`
    + `Before writing your answer, use Google Search to verify this drug's current indications, dosing, contraindications, and interactions against up-to-date sources - do this even if you already feel confident about the drug, since training data can be outdated or subtly wrong. Reach your conclusions from what the search turns up, not from recall alone.\n\n`
    + `Drug: ${drugName}\n${brandNames ? `Known brand names: ${brandNames}\n` : ''}${drugClass ? `Drug class: ${drugClass}\n` : ''}\n`
    + `Write ONLY the following sections, using clear markdown headers (##) with exactly these names, in this order:\n${headerList}\n\n`
    + overviewRule
    + `Write every section in full - if not well established, write "Not well established / consult current prescribing information". Aim for roughly 3-6 sentences, or 4-8 bullets, per section.\n\n`
    + `Bold sub-labels with **double asterisks**. Use "- " bullets for lists and don't stop at 2-3 items.\n\n`
    + `Do not add any other sections, preamble, or closing text. Be precise, clinically accurate, and thorough. Do not fabricate specific numeric dosing if you are not confident. Reference material only, not a substitute for the current product monograph.`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

const normKey = (k) => String(k || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

function normalizeStatus(val) {
  const v = String(val || '').toLowerCase();
  if (v.includes('otc') || v.includes('over the counter') || v.includes('over-the-counter')) return 'OTC';
  if (v.includes('controlled')) return 'Controlled';
  return 'Prescription';
}

// → { updates, ignored, csvName }
// Sometimes Google/AI answers with a Python script that builds the CSV
// (header = [...]; row = [...]) instead of the CSV itself. Pull the header and
// row lists out of it and rebuild a real CSV.
function csvFromPythonScript(text) {
  if (!/\bcsv\b|\bheader\s*=|\brow\s*=/.test(text) || !/^\s*\w+\s*=\s*\[/m.test(text)) return null;
  const lists = [];
  let i = 0;
  const n = text.length;
  const readString = () => {
    const q3 = text.startsWith('"""', i) ? '"""' : text.startsWith("'''", i) ? "'''" : null;
    if (q3) {
      const end = text.indexOf(q3, i + 3);
      if (end === -1) return null;
      const v = text.slice(i + 3, end); i = end + 3; return v;
    }
    const q = text[i];
    let v = ''; i++;
    while (i < n && text[i] !== q) {
      if (text[i] === '\\' && i + 1 < n) {
        const c = text[i + 1];
        v += c === 'n' ? '\n' : c === 't' ? '\t' : c; i += 2;
      } else { v += text[i++]; }
    }
    i++; return v;
  };
  while (i < n) {
    if (text[i] === '#') { while (i < n && text[i] !== '\n') i++; continue; }
    if (text[i] === '[') {
      i++;
      const items = [];
      while (i < n && text[i] !== ']') {
        if (text[i] === '"' || text[i] === "'") { const v = readString(); if (v === null) return null; items.push(v); }
        else i++;
      }
      i++;
      if (items.length >= 2) lists.push(items);
      continue;
    }
    if (text[i] === '"' || text[i] === "'") { if (readString() === null) return null; continue; }
    i++;
  }
  return lists.length >= 2 ? Papa.unparse([lists[0], lists[1]]) : null;
}

export function parseManualDrugCsv(text, allowed = FIELDS, tabLabel = '') {
  // Google often wraps the CSV in ```csv fences and uses curly quotes - normalise first.
  const cleaned = String(text || '')
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^\s*csv\s*\n/i, '')
    .trim();
  // Answer in the AI's markdown format ("## Header" sections): same parser the AI buttons use.
  const sectioned = normalizePlainHeadings(stripCitations(cleaned));
  if (/^\s*#{1,6}\s+\S/m.test(sectioned)) {
    const md = parseAiDrugDetail(sectioned);
    const mdUpdates = {};
    for (const [k, v] of Object.entries(md)) {
      if (allowed.includes(k) && String(v || '').trim()) mdUpdates[k] = k === 'prescription_status' ? normalizeStatus(v) : String(v).trim();
    }
    if (Object.keys(mdUpdates).length === 0) {
      throw new Error(`No ${tabLabel || 'matching'} sections found in the pasted text. Make sure the section titles (e.g. "Adult Dose") are included.`);
    }
    return { updates: mdUpdates, ignored: [], csvName: '' };
  }
  const res = Papa.parse(csvFromPythonScript(cleaned) || cleaned, { skipEmptyLines: 'greedy' });
  const rows = (res.data || []).filter(r => Array.isArray(r) && r.some(c => String(c).trim()));
  if (rows.length === 0) throw new Error('Nothing to read — paste or upload CSV first.');

  const pairs = [];
  const header = rows[0].map(normKey);
  const headerLooksLikeFields = header.filter(h => FIELDS.includes(h) || h === 'generic_name').length >= 2;
  const firstCell = normKey(rows[0][0]);
  const headerless = rows[0].length >= 2 && !FIELDS.includes(firstCell) && firstCell !== 'generic_name'
    && header.filter(h => FIELDS.includes(h)).length === 0;
  if (headerless) {
    // Data row only (Google dropped the header): map the values onto this tab's columns in order.
    const cols = rows[0].length === allowed.length ? allowed : ['generic_name', ...allowed];
    cols.forEach((h, i) => pairs.push([h, rows[0][i]]));
  } else if (rows[0].length > 2 || (headerLooksLikeFields && rows.length >= 2 && rows[0].length >= 2 && rows.length === 2)) {
    // header row + data row
    if (rows.length < 2) throw new Error('Found a header row but no data row beneath it.');
    header.forEach((h, i) => pairs.push([h, rows[1][i]]));
  } else {
    // field,value rows
    rows.forEach(r => pairs.push([normKey(r[0]), r.slice(1).join(',')]));
  }

  const updates = {};
  const ignored = [];
  let csvName = '';
  for (const [k, v] of pairs) {
    const val = String(v ?? '').trim();
    if (k === 'generic_name') { csvName = val; continue; }
    if (!allowed.includes(k)) { if (k) ignored.push(k); continue; }
    if (!val) continue;
    updates[k] = k === 'prescription_status' ? normalizeStatus(val) : val;
  }
  if (Object.keys(updates).length === 0) {
    throw new Error(ignored.length
      ? `None of these columns belong to ${tabLabel || 'this'} information (found: ${ignored.join(', ')}). Use the search on the tab they belong to.`
      : 'No recognised fields with content. Download the template to see the column names.');
  }
  return { updates, ignored, csvName };
}

export default function ManualDrugInfoEntry({ drug, onSaved, tabId = 'overview' }) {
  const tab = TAB_FIELDS[tabId] || TAB_FIELDS.overview;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const auto = useAutoSaveOnPaste(!!parsed);

  const reset = () => { setParsed(null); setError(''); setState('idle'); };

  const preview = (t) => {
    setText(t);
    setState('idle');
    try {
      setParsed(parseManualDrugCsv(t, tab.fields, tab.label));
      setError('');
    } catch (e) {
      setParsed(null);
      setError(e.message);
    }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) { auto.arm(); preview(await f.text()); }
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      auto.arm();
      preview(t);
    } catch {
      setError('Could not read the clipboard — long-press in the box below and choose Paste.');
    }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([['generic_name', ...tab.fields], [drug.generic_name || '', ...tab.fields.map(() => '')]]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `drug-info-${tabId}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (!parsed) return;
    setState('saving'); setError('');
    try {
      await auth.authStateReady();
      if (!auth.currentUser) throw new Error('You must be signed in as admin to save.');
      await setDoc(doc(db, 'drugs', drug.id), {
        ...parsed.updates,
        generic_name: drug.generic_name,
        drug_class:   parsed.updates.drug_class || drug.drug_class || 'Unknown',
        source:       drug.source || 'Admin',
        status:       drug.status || 'Active',
        last_updated: serverTimestamp(),
      }, { merge: true });
      onSaved?.(parsed.updates);
      setState('saved');
      setText(''); setParsed(null);
    } catch (e) {
      setState('error');
      setError(e.message || 'Save failed.');
    }
  };

  auto.saveRef.current = save;

  const nameMismatch = parsed?.csvName &&
    parsed.csvName.toLowerCase() !== String(drug.generic_name || '').toLowerCase();

  return (
    <>
    <div className="rounded-[10px] border border-violet-200 bg-violet-50/60 overflow-hidden mt-4">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <ClipboardPaste className="w-6 h-6 text-violet-600" />
        <span className="flex-1 text-base sm:text-lg font-extrabold text-violet-900">Add {tab.label.toLowerCase()} information from Google</span>
        <ChevronDown className={`w-5 h-5 text-violet-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-xs text-drug-muted">
            Paste Google's answer as it is (section titles like Adult Dose with their text), or a CSV, or upload a file. Citation links are removed automatically. Only filled fields are saved to <strong>{drug.generic_name}</strong>; empty ones are left as they are.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={pasteFromClipboard}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-400 text-violet-700 font-semibold text-sm">
              <ClipboardPaste className="w-4 h-4" /> Paste from Clipboard
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-400 text-violet-700 font-semibold text-sm">
              <Upload className="w-4 h-4" /> Upload CSV
            </button>
            <button type="button" onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">
              <Download className="w-4 h-4" /> Template
            </button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
          </div>
          <textarea value={text} onChange={e => preview(e.target.value)} onPaste={auto.arm} rows={5}
            placeholder={'generic_name,overview,adult_dose,...\nEpinephrine,"Overview text","Dose text",...'}
            className="w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-mono" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {parsed && (
            <div className="rounded-lg bg-white border border-violet-200 p-2 text-xs space-y-1">
              <p className="font-semibold text-violet-900">Preview — {Object.keys(parsed.updates).length} field(s) will be saved to {drug.generic_name}:</p>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {Object.entries(parsed.updates).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-violet-100 bg-violet-50/50 p-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">{k.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-drug-text whitespace-pre-line break-words">{v}</p>
                  </div>
                ))}
              </div>
              {nameMismatch && <p className="text-amber-700">CSV generic_name “{parsed.csvName}” differs from this drug — it is ignored; data saves to {drug.generic_name}.</p>}
              {parsed.ignored.length > 0 && <p className="text-amber-700">Ignored columns (not part of this tab): {parsed.ignored.join(', ')}</p>}
            </div>
          )}
          {state === 'saved' && <p className="text-sm font-semibold text-green-700">Saved to this drug.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={!parsed || state === 'saving'}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-sm disabled:opacity-50">
              {state === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save to this drug</>}
            </button>
            {(text || parsed) && (
              <button type="button" onClick={() => { setText(''); reset(); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
    <div className="mt-3 mb-4">
      <a href={googleDrugInfoUrl(drug.generic_name || '', tabId, drug.drug_class || '', drug.brand_names || '', buildKnownDrugData(drug, 250, 2500, tabId === 'overview' ? ['overview'] : []))} target="_blank" rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-violet-600 text-white font-semibold text-sm">
        <Search className="w-4 h-4" /> Get {drug.generic_name || 'drug'} {tab.label.toLowerCase()} on Google <ExternalLink className="w-4 h-4" />
      </a>
      <p className="mt-2 text-xs text-drug-muted">
        Opens Google with the same prompt the AI uses for the {tab.label} tab. Copy the answer, then paste it in “Add {tab.label.toLowerCase()} information from Google” above.
      </p>
    </div>
    </>
  );
}
