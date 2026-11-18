// Admin-only, shown under the home search bar when the searched condition is
// NOT in the system yet: search Google for its full clinical note, paste the
// answer, pick the body system, and save — which adds the condition and its
// clinical info in one go.
import React, { useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ClipboardPaste, ExternalLink, Loader2, Save, Search, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { addCustomConditions, slugifyConditionLabel } from '../hooks/useCustomConditions';
import { saveConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import NewDrugGoogleSearch from './NewDrugGoogleSearch';
import { CLINICAL_SECTIONS, googleClinicalInfoUrl, parseGoogleClinicalInfo } from '../utils/googleClinicalInfo';

const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const linkCls = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold text-sm';

export default function NewConditionGoogleSearch({ query }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [systemId, setSystemId] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const label = String(query || '').trim();

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try { return { parsed: parseGoogleClinicalInfo(text) }; }
    catch (e) { return { error: e.message }; }
  }, [text]);

  if (!isAdmin || !label) return null;
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
    if (!parsed || !systemId || state === 'saving') return;
    setState('saving'); setError('');
    try {
      const id = slugifyConditionLabel(label);
      await addCustomConditions(systemId, [{ id, label, icon: '🩺', keywords: [] }]);
      await saveConditionClinicalInfo(id, parsed.updates);
      setState('saved');
      setText('');
    } catch (e) {
      setState('error');
      setError(e.message || 'Save failed.');
    }
  };

  const sysName = ANATOMICAL_SYSTEMS.find(s => s.id === systemId)?.name || '';

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 rounded-xl bg-[#E4EEFF] border border-[#C9DAF6] px-3 py-2.5 text-[15px] font-semibold text-[#0A1F5C]"
      >
        <Search className="w-5 h-5 text-primary-600 flex-shrink-0" />
        <span className="flex-1 min-w-0 text-left">Not in the system — search Google for “{label}”</span>
        {open ? <ChevronUp className="w-5 h-5 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 flex-shrink-0" />}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <a href={googleClinicalInfoUrl(label, sysName, 0)} target="_blank" rel="noopener noreferrer"
            className={`${linkCls} w-full px-4 py-3 bg-violet-600 text-white`}>
            <Search className="w-4 h-4" /> Get {label} clinical info on Google <ExternalLink className="w-4 h-4" />
          </a>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-drug-muted">Google cut the answer short? Search in two parts:</span>
            <a href={googleClinicalInfoUrl(label, sysName, 1)} target="_blank" rel="noopener noreferrer"
              className={`${linkCls} px-3 py-1.5 border border-violet-400 text-violet-700`}>Part 1 <ExternalLink className="w-3.5 h-3.5" /></a>
            <a href={googleClinicalInfoUrl(label, sysName, 2)} target="_blank" rel="noopener noreferrer"
              className={`${linkCls} px-3 py-1.5 border border-violet-400 text-violet-700`}>Part 2 <ExternalLink className="w-3.5 h-3.5" /></a>
          </div>

          <div className="rounded-[10px] border border-violet-200 bg-violet-50/60 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-violet-900">
              <BookOpen className="w-5 h-5 text-violet-600" /> Paste Google's answer
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={paste}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-400 text-violet-700 font-semibold text-sm">
                <ClipboardPaste className="w-4 h-4" /> Paste from Clipboard
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-400 text-violet-700 font-semibold text-sm">
                <Upload className="w-4 h-4" /> Upload file
              </button>
              <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden" onChange={onFile} />
            </div>
            <textarea value={text} onChange={e => change(e.target.value)} rows={6}
              placeholder={'## Introduction\n...\n## Types\n...'}
              className="w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-mono" />

            {(error || result?.error) && <p className="text-xs text-red-600">{error || result.error}</p>}

            {parsed && (
              <div className="rounded-lg bg-white border border-violet-200 p-2 text-xs space-y-1">
                <p className="font-semibold text-violet-900">
                  {parsed.found.length} of {CLINICAL_SECTIONS.length} sections found:
                </p>
                <p className="text-drug-muted">
                  {CLINICAL_SECTIONS.filter(s => parsed.updates[s.key]).map(s => `${s.header} (${wordCount(parsed.updates[s.key])} words)`).join(' · ')}
                </p>
              </div>
            )}

            <label className="block text-xs font-semibold text-violet-900">
              Add “{label}” under which body system?
              <select value={systemId} onChange={e => setSystemId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-normal text-drug-text">
                <option value="">Select a system…</option>
                {ANATOMICAL_SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            {state === 'saved' && <p className="text-sm font-semibold text-green-700">Saved — “{label}” is now in the system.</p>}

            <button type="button" onClick={save} disabled={!parsed || !systemId || state === 'saving'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-sm disabled:opacity-50">
              {state === 'saving'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Add condition &amp; save clinical info</>}
            </button>
          </div>

          {/* Searched term is a medicine, not a condition */}
          <NewDrugGoogleSearch label={label} />
        </div>
      )}
    </div>
  );
}
