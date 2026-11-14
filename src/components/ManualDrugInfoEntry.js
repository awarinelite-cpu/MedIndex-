// Admin-only card: paste or upload CSV to fill in this drug's information by hand.
// Accepts either (a) a header row + one data row, or (b) two columns "field,value".
// Only non-empty known fields are merged onto the drug record.
import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ClipboardPaste, Upload, Download, ChevronDown, Save, Loader2, Search, ExternalLink } from 'lucide-react';
import { db, auth } from '../firebase';

const FIELDS = [
  'drug_class', 'drug_subclass', 'prescription_status', 'nafdac_no', 'pronunciation', 'brand_names',
  'overview', 'strength', 'indications', 'off_label_use', 'therapeutic_note',
  'adult_dose', 'child_dose', 'renal_dose', 'administration', 'nstg_recommendations',
  'pharmacology', 'advice_to_patients', 'contraindications', 'precautions',
  'pregnancy_lactation', 'interaction', 'adverse_effect', 'nursing_action',
  'pharmacovigilance', 'product_description', 'storage_recommendations', 'pack_size_price',
];

// Builds the Google search that carries the CSV template plus the instruction
// to return the answer as a downloadable CSV file.
export function googleDrugInfoUrl(drugName) {
  const header = ['generic_name', ...FIELDS].join(',');
  const q = `Give me complete drug information for ${drugName} as a CSV file I can download or copy. `
    + `Use exactly this header row: ${header} . `
    + `Then ONE data row for ${drugName} with every value in double quotes and empty if unknown. Output only the CSV.`;
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
export function parseManualDrugCsv(text) {
  const res = Papa.parse(String(text || '').trim(), { skipEmptyLines: 'greedy' });
  const rows = (res.data || []).filter(r => Array.isArray(r) && r.some(c => String(c).trim()));
  if (rows.length === 0) throw new Error('Nothing to read — paste or upload CSV first.');

  const pairs = [];
  const header = rows[0].map(normKey);
  const headerLooksLikeFields = header.filter(h => FIELDS.includes(h) || h === 'generic_name').length >= 2;
  if (rows[0].length > 2 || (headerLooksLikeFields && rows.length >= 2 && rows[0].length >= 2 && rows.length === 2)) {
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
    if (!FIELDS.includes(k)) { if (k) ignored.push(k); continue; }
    if (!val) continue;
    updates[k] = k === 'prescription_status' ? normalizeStatus(val) : val;
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('No recognised fields with content. Download the template to see the column names.');
  }
  return { updates, ignored, csvName };
}

export default function ManualDrugInfoEntry({ drug, onSaved }) {
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
      setParsed(parseManualDrugCsv(t));
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
    const csv = Papa.unparse([['generic_name', ...FIELDS], [drug.generic_name || '', ...FIELDS.map(() => '')]]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'drug-info-template.csv'; a.click();
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
        <span className="flex-1 text-base sm:text-lg font-extrabold text-violet-900">Add drug information (CSV)</span>
        <ChevronDown className={`w-5 h-5 text-violet-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-xs text-drug-muted">
            Paste CSV or upload a file. Use a header row + one data row, or two columns (field, value).
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
              {parsed.ignored.length > 0 && <p className="text-amber-700">Ignored unknown columns: {parsed.ignored.join(', ')}</p>}
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
    <div className="mt-3 mb-24">
      <a href={googleDrugInfoUrl(drug.generic_name || '')} target="_blank" rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-violet-600 text-white font-semibold text-sm">
        <Search className="w-4 h-4" /> Get {drug.generic_name || 'drug'} information on Google <ExternalLink className="w-4 h-4" />
      </a>
      <p className="mt-2 text-xs text-drug-muted">
        Opens Google with the CSV template already filled in and asks for the answer as a CSV file. Copy or download the result, then use “Add drug information (CSV)” above to paste or upload it.
      </p>
    </div>
    </>
  );
}
