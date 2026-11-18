// Admin-only, shown inside the "Not in the system" panel on the home search.
// For when the searched term is a DRUG, not a condition: search Google with the
// same prompt the drug Overview tab uses, paste the answer, and save it as a
// new drug record (same fields/parser as ManualDrugInfoEntry).
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ClipboardPaste, ExternalLink, Loader2, Pill, Save, Upload } from 'lucide-react';
import { db, auth } from '../firebase';
import { googleDrugInfoUrl, parseManualDrugCsv, TAB_FIELDS } from './ManualDrugInfoEntry';

const linkCls = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold text-sm';
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// Same id convention as useDrugs' seed data: letters, digits, _ and - only.
const drugIdFor = (name) => String(name || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');

export default function NewDrugGoogleSearch({ label }) {
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const fileRef = useRef(null);

  const tab = TAB_FIELDS.overview;
  const drugName = String(label || '').trim();

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try { return { parsed: parseManualDrugCsv(text, tab.fields, tab.label) }; }
    catch (e) { return { error: e.message }; }
  }, [text, tab]);
  const parsed = result?.parsed || null;

  const change = (t) => { setText(t); setState('idle'); setError(''); };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) change(await f.text());
  };
  const paste = async () => {
    try { change(await navigator.clipboard.readText()); }
    catch { setError('Could not read the clipboard — long-press in the box below and choose Paste.'); }
  };

  const save = async () => {
    if (!parsed || state === 'saving') return;
    setState('saving'); setError('');
    try {
      await auth.authStateReady();
      if (!auth.currentUser) throw new Error('You must be signed in as admin to save.');
      const id = drugIdFor(drugName);
      if (!id) throw new Error('Drug name is empty.');
      await setDoc(doc(db, 'drugs', id), {
        ...parsed.updates,
        generic_name: drugName,
        drug_class: parsed.updates.drug_class || 'Unknown',
        source: 'Admin',
        status: 'Active',
        last_updated: serverTimestamp(),
      }, { merge: true });
      setSavedId(id);
      setState('saved');
      setText('');
    } catch (e) {
      setState('error');
      setError(e.message || 'Save failed.');
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <a href={googleDrugInfoUrl(drugName, 'overview')} target="_blank" rel="noopener noreferrer"
        className={`${linkCls} w-full px-4 py-3 bg-emerald-600 text-white`}>
        <Pill className="w-4 h-4" /> Get {drugName} drug info on Google <ExternalLink className="w-4 h-4" />
      </a>
      <p className="text-xs text-drug-muted">
        Is “{drugName}” a medicine, not a condition? Use this button — it opens Google with the same prompt as the drug Overview tab. Paste the answer below to add it as a new drug.
      </p>

      <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
          <Pill className="w-5 h-5 text-emerald-600" /> Paste Google's drug answer
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={paste}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400 text-emerald-700 font-semibold text-sm">
            <ClipboardPaste className="w-4 h-4" /> Paste from Clipboard
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400 text-emerald-700 font-semibold text-sm">
            <Upload className="w-4 h-4" /> Upload file
          </button>
          <input ref={fileRef} type="file" accept=".md,.markdown,.txt,.csv,text/plain,text/markdown,text/csv" className="hidden" onChange={onFile} />
        </div>
        <textarea value={text} onChange={e => change(e.target.value)} rows={6}
          placeholder={'## Overview\n...\n## Indications\n...'}
          className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-sm font-mono" />

        {(error || result?.error) && <p className="text-xs text-red-600">{error || result.error}</p>}

        {parsed && (
          <div className="rounded-lg bg-white border border-emerald-200 p-2 text-xs space-y-1">
            <p className="font-semibold text-emerald-900">{Object.keys(parsed.updates).length} field(s) found for {drugName}:</p>
            <p className="text-drug-muted">
              {Object.entries(parsed.updates).map(([k, v]) => `${k.replace(/_/g, ' ')} (${wordCount(v)} words)`).join(' · ')}
            </p>
          </div>
        )}

        {state === 'saved' && (
          <p className="text-sm font-semibold text-green-700">
            Saved — “{drugName}” is now in the system. <Link to={`/drug/${savedId}`} className="underline">Open drug</Link>
          </p>
        )}

        <button type="button" onClick={save} disabled={!parsed || state === 'saving'}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50">
          {state === 'saving'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Save className="w-4 h-4" /> Add drug &amp; save info</>}
        </button>
      </div>
    </div>
  );
}
