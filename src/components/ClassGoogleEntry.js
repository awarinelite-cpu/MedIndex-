// src/components/ClassGoogleEntry.js
//
// Admin-only. Same flow as the per-drug Google entry (ManualDrugInfoEntry),
// but for a whole class/subclass: the Google search asks for the drugs in the
// class as a CSV, the admin pastes (or uploads) the result here, previews the
// drugs found, and saves them into the class. Drugs already in the database
// are only linked into the class; new ones are created as name-level records
// (flagged info_pending) that "Complete Missing Info" can fill in later.
import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { doc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { ClipboardPaste, Upload, Download, ChevronDown, Save, Loader2, Search, ExternalLink } from 'lucide-react';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { slugifyDrugName, normalizeDrugNameForMatch } from '../utils/aiDrugSave';
import { resolveSubclassId } from './AiClassInsight';

const COLUMNS = ['generic_name', 'drug_subclass', 'prescription_status', 'strength', 'indications'];

export function googleClassDrugsUrl(className, parentClassName) {
  const label = parentClassName ? `${className} (${parentClassName})` : className;
  const q = `Give me a list of ALL drugs in the drug class "${label}" available in Nigeria as a CSV file I can download or copy. `
    + `Line 1 MUST be this header row, exactly and only: ${COLUMNS.join(',')} . `
    + `Column contents: generic_name = generic (international non-proprietary) drug name only; drug_subclass = subclass; `
    + `prescription_status = Prescription, OTC or Controlled; strength = available strengths and dosage forms; indications = main licensed uses. `
    + `Then ONE row per drug with every value in double quotes. Output only the plain CSV text - no code, no Python script, no explanation.`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

const normKey = k => String(k || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const NAME_KEYS = ['generic_name', 'drug_name', 'name', 'drug', 'medication', 'generic'];

function normalizeStatus(val) {
  const v = String(val || '').toLowerCase();
  if (v.includes('otc') || v.includes('over the counter') || v.includes('over-the-counter')) return 'OTC';
  if (v.includes('controlled')) return 'Controlled';
  return 'Prescription';
}

function cleanName(raw) {
  return String(raw || '')
    .replace(/^\s*(?:[-*•\u2022]+|\d+[.)])\s*/, '')   // bullets / numbering
    .replace(/\*\*/g, '')
    .replace(/\s*[\u2013\u2014:].*$/, '')               // "Name - description"
    .replace(/\s+\(.*\)\s*$/, '')                       // trailing "(note)"
    .trim();
}

// -> [{ name, subclass, status, strength, indications }]
export function parseClassDrugCsv(text) {
  const cleaned = String(text || '')
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^\s*csv\s*\n/i, '')
    .trim();
  const res = Papa.parse(cleaned, { skipEmptyLines: 'greedy' });
  const rows = (res.data || []).filter(r => Array.isArray(r) && r.some(c => String(c).trim()));
  if (rows.length === 0) throw new Error('Nothing to read. Paste or upload the Google result first.');

  const header = rows[0].map(normKey);
  const nameIdx = header.findIndex(h => NAME_KEYS.includes(h));
  const out = [];
  if (nameIdx !== -1) {
    const col = k => header.indexOf(k);
    for (const r of rows.slice(1)) {
      const name = cleanName(r[nameIdx]);
      if (!name || name.length > 80) continue;
      out.push({
        name,
        subclass: String(r[col('drug_subclass')] ?? r[col('subclass')] ?? '').trim(),
        status: normalizeStatus(r[col('prescription_status')]),
        strength: String(r[col('strength')] ?? '').trim(),
        indications: String(r[col('indications')] ?? '').trim(),
      });
    }
  } else {
    // No header: treat each line as a drug name (first cell), skipping prose.
    for (const r of rows) {
      const name = cleanName(r[0]);
      if (!name || name.length > 60 || name.split(/\s+/).length > 6) continue;
      out.push({ name, subclass: '', status: 'Prescription', strength: '', indications: '' });
    }
  }
  const seen = new Set();
  const unique = out.filter(d => {
    const k = normalizeDrugNameForMatch(d.name);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) throw new Error('No drug names found. Use the Template button to see the columns.');
  return unique;
}

export default function ClassGoogleEntry({
  className, parentClassName, classId, subclassId, subclasses, databaseDrugs = [],
}) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [items, setItems] = useState(null);
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const byName = useMemo(() => {
    const m = new Map();
    for (const d of databaseDrugs) m.set(normalizeDrugNameForMatch(d.generic_name), d);
    return m;
  }, [databaseDrugs]);

  const targetFor = item => subclassId || resolveSubclassId(item.subclass || className, subclasses);

  const preview = t => {
    setText(t); setState('idle'); setResult(null);
    try { setItems(parseClassDrugCsv(t)); setError(''); }
    catch (e) { setItems(null); setError(e.message); }
  };

  const onFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) preview(await f.text());
  };

  const pasteFromClipboard = async () => {
    try { preview(await navigator.clipboard.readText()); }
    catch { setError('Could not read the clipboard. Long-press in the box below and choose Paste.'); }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([COLUMNS, ['Diazepam', 'Benzodiazepines', 'Controlled', '2 mg, 5 mg tablets', 'Anxiety']]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'class-drugs-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (!items) return;
    setState('saving'); setError('');
    let added = 0, linked = 0;
    const failed = [];
    try {
      await auth.authStateReady();
      if (!auth.currentUser) throw new Error('You must be signed in as admin to save.');
      for (const item of items) {
        const targetSub = targetFor(item);
        if (!targetSub) { failed.push(`${item.name}: no matching subclass`); continue; }
        const tag = `${classId}::${targetSub}`;
        const existing = byName.get(normalizeDrugNameForMatch(item.name));
        try {
          if (existing && !existing._seed) {
            await updateDoc(doc(db, 'drugs', existing.firestoreId || existing.id), { extra_subclasses: arrayUnion(tag) });
            linked += 1;
          } else {
            const data = {
              generic_name: item.name,
              drug_class: item.subclass || className,
              prescription_status: item.status,
              source: 'Admin (Google paste)',
              status: 'Active',
              info_pending: true,
              extra_subclasses: arrayUnion(tag),
              last_updated: serverTimestamp(),
            };
            if (item.strength) data.strength = item.strength;
            if (item.indications) data.indications = item.indications;
            await setDoc(doc(db, 'drugs', slugifyDrugName(item.name)), data, { merge: true });
            added += 1;
          }
        } catch (e) {
          failed.push(`${item.name}: ${e.message || 'failed'}`);
        }
      }
      setResult({ added, linked, failed });
      setState('saved');
      setText(''); setItems(null);
    } catch (e) {
      setState('error');
      setError(e.message || 'Save failed.');
    }
  };

  return (
    <div className="space-y-2">
      {isAdmin && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 overflow-hidden">
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="w-full flex items-center gap-3 px-4 py-3 text-left">
            <ClipboardPaste className="w-5 h-5 text-violet-600 flex-shrink-0" />
            <span className="flex-1 min-w-0 text-sm font-bold text-violet-900">Add drugs from Google (CSV)</span>
            <ChevronDown className={`w-4 h-4 text-violet-700 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="px-3 pb-3 space-y-3">
              <p className="text-xs text-drug-muted">
                Paste the CSV Google gave you, or upload it. Drugs already in the database are linked to
                <strong> {className}</strong>; new ones are added with their name and basic details.
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
                placeholder={'generic_name,drug_subclass,prescription_status,strength,indications\nDiazepam,"Benzodiazepines",Controlled,"2 mg, 5 mg tablets","Anxiety"'}
                className="w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-mono" />
              {error && <p className="text-xs text-red-600">{error}</p>}
              {items && (
                <div className="rounded-lg bg-white border border-violet-200 p-2 text-xs space-y-1">
                  <p className="font-semibold text-violet-900">Preview: {items.length} drug{items.length === 1 ? '' : 's'} found</p>
                  <div className="max-h-64 overflow-y-auto divide-y divide-violet-100">
                    {items.map(it => {
                      const ex = byName.get(normalizeDrugNameForMatch(it.name));
                      const isLinked = ex && !ex._seed;
                      return (
                        <div key={it.name} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="text-sm text-drug-text truncate">{it.name}</span>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full font-semibold ${isLinked ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                            {isLinked ? 'in database, will link' : 'new'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {state === 'saved' && result && (
                <div className="text-sm">
                  <p className="font-semibold text-green-700">
                    Added {result.added} new, linked {result.linked} existing.
                  </p>
                  {result.failed.length > 0 && (
                    <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
                      {result.failed.map((f, i) => <li key={i}>• {f}</li>)}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={!items || state === 'saving'}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-sm disabled:opacity-50">
                  {state === 'saving'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4" /> Save {items ? items.length : ''} to this class</>}
                </button>
                {(text || items) && (
                  <button type="button" onClick={() => { setText(''); setItems(null); setError(''); setState('idle'); }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">Clear</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <a href={googleClassDrugsUrl(className, parentClassName)} target="_blank" rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-violet-600 text-white font-semibold text-sm">
        <Search className="w-4 h-4" /> Get drugs in this class on Google <ExternalLink className="w-4 h-4" />
      </a>
      {isAdmin && (
        <p className="text-xs text-drug-muted">
          Opens Google with the CSV columns already filled in. Copy or download the result, then paste or upload it in
          “Add drugs from Google (CSV)” above.
        </p>
      )}
    </div>
  );
}
