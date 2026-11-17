// Admin-only card: paste or upload CSV to fill in this drug's information by hand.
// Accepts either (a) a header row + one data row, or (b) two columns "field,value".
// Only non-empty known fields are merged onto the drug record.
import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ClipboardPaste, Upload, Download, ChevronDown, Save, Loader2, Search, ExternalLink } from 'lucide-react';
import { db, auth } from '../firebase';
import { TAB_SECTIONS } from '../utils/aiSectionFill';
import { parseAiDrugDetail } from '../utils/parseAiDrugDetail';

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

// Google search for one tab: the exact short prompt the app's own AI uses to
// fill a tab (api/_lib/buildPrompt.js, mode "section"), not a bulky CSV request.
export function googleDrugInfoUrl(drugName, tabId = 'overview', drugClass = '') {
  const cfg = TAB_SECTIONS[tabId] || TAB_SECTIONS.overview;
  const headerList = cfg.headers.map(h => `## ${h}`).join('\n');
  const q = `You are assisting a licensed nurse using a clinical drug reference app in Nigeria. The app already has a record for the medication below, but its ${cfg.label} information is missing. Provide ONLY that information.\n\n`
    + `Drug: ${drugName}\n${drugClass ? `Drug class: ${drugClass}\n` : ''}\n`
    + `Write ONLY the following sections, using these exact markdown headers, in this order:\n${headerList}\n\n`
    + `Do not add any other sections, preamble, or closing text, start directly with the first header. Within each section, bold sub-labels using **double asterisks** and use bullet points (lines starting with "- ") for lists. `
    + `If a section is not well established for this drug, write "Not well established / consult current prescribing information" rather than omitting it.\n\n`
    + `Be precise, clinically accurate, and concise.`;
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
  if (/^\s*#{1,6}\s+\S/m.test(cleaned)) {
    const md = parseAiDrugDetail(cleaned);
    const mdUpdates = {};
    for (const [k, v] of Object.entries(md)) {
      if (allowed.includes(k) && String(v || '').trim()) mdUpdates[k] = k === 'prescription_status' ? normalizeStatus(v) : String(v).trim();
    }
    if (Object.keys(mdUpdates).length === 0) {
      throw new Error(`No ${tabLabel || 'matching'} sections found in the pasted text. Make sure the "## Header" lines are included.`);
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
    if (f) preview(await f.text());
  };

  const pasteFromClipboard = async () => {
    try {
      preview(await navigator.clipboard.readText());
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
            Paste Google's answer (the \"## Header\" sections), or a CSV, or upload a file.
            Only filled fields are saved to <strong>{drug.generic_name}</strong>; empty ones are left as they are.
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
          <textarea value={text} onChange={e => preview(e.target.value)} rows={5}
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
      <a href={googleDrugInfoUrl(drug.generic_name || '', tabId, drug.drug_class || '')} target="_blank" rel="noopener noreferrer"
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
