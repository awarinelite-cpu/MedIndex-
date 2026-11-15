// Admin-only drop-down on every condition: search Google for the condition's
// complete clinical note (Introduction → Nursing Consideration), paste or upload
// the answer, preview the sections it was split into, and save them.
// Works the same way as the Google search on a drug's information tabs.
import React, { useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ClipboardPaste, ExternalLink, Loader2, Save, Search, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saveConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import {
  CLINICAL_SECTIONS, SECTION_LABEL, googleClinicalInfoUrl, parseGoogleClinicalInfo,
} from '../utils/googleClinicalInfo';

const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

export default function ConditionGoogleInfo({ condition, systemName = '', existingInfo = null, onSaved, className = 'px-4 pb-3' }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try { return { parsed: parseGoogleClinicalInfo(text) }; }
    catch (e) { return { error: e.message }; }
  }, [text]);

  if (!isAdmin || !condition?.label) return null;

  const label = condition.label;
  const parsed = result?.parsed || null;

  const change = (t) => { setText(t); setState('idle'); setError(''); };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) change(await f.text());
  };

  const pasteFromClipboard = async () => {
    try {
      change(await navigator.clipboard.readText());
    } catch {
      setError('Could not read the clipboard — long-press in the box below and choose Paste.');
    }
  };

  const save = async () => {
    if (!parsed || state === 'saving') return;
    setState('saving'); setError('');
    try {
      await saveConditionClinicalInfo(condition.id, parsed.updates);
      onSaved?.(parsed.updates);
      setState('saved');
      setText('');
    } catch (e) {
      setState('error');
      setError(e.message || 'Save failed.');
    }
  };

  const linkCls = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold text-sm';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 rounded-xl bg-[#E4EEFF] border border-[#C9DAF6] px-3 py-2.5 text-[15px] font-semibold text-[#0A1F5C]"
      >
        <span className="text-primary-600 flex-shrink-0"><Search className="w-5 h-5" /></span>
        <span className="flex-1 min-w-0 text-left">Search Google for clinical info</span>
        {open ? <ChevronUp className="w-5 h-5 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 flex-shrink-0" />}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <a
            href={googleClinicalInfoUrl(label, systemName, 0)}
            target="_blank" rel="noopener noreferrer"
            className={`${linkCls} w-full px-4 py-3 bg-violet-600 text-white`}
          >
            <Search className="w-4 h-4" /> Get {label} clinical info on Google <ExternalLink className="w-4 h-4" />
          </a>
          <p className="text-xs text-drug-muted">
            Opens Google asking for the complete note on <strong>{label}</strong>: Introduction, Types, Organ System, Etiology,
            Pathophysiology, Clinical Manifestation, Diagnosis and Investigation, Medical and Surgical Management,
            Nursing Diagnosis and Nursing Consideration, as detailed as possible. Copy the answer, then paste it below.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-drug-muted">Google cut the answer short? Search in two parts:</span>
            <a href={googleClinicalInfoUrl(label, systemName, 1)} target="_blank" rel="noopener noreferrer"
              className={`${linkCls} px-3 py-1.5 border border-violet-400 text-violet-700`}>
              Part 1 <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a href={googleClinicalInfoUrl(label, systemName, 2)} target="_blank" rel="noopener noreferrer"
              className={`${linkCls} px-3 py-1.5 border border-violet-400 text-violet-700`}>
              Part 2 <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <span className="text-xs text-drug-muted">Paste and save each part one after the other; saved sections are kept.</span>
          </div>

          <div className="rounded-[10px] border border-violet-200 bg-violet-50/60 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-violet-900">
              <BookOpen className="w-5 h-5 text-violet-600" /> Paste Google's answer
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={pasteFromClipboard}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-400 text-violet-700 font-semibold text-sm">
                <ClipboardPaste className="w-4 h-4" /> Paste from Clipboard
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-400 text-violet-700 font-semibold text-sm">
                <Upload className="w-4 h-4" /> Upload file
              </button>
              <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden" onChange={onFile} />
            </div>
            <textarea
              value={text}
              onChange={e => change(e.target.value)}
              rows={6}
              placeholder={'## Introduction\n...\n## Types\n...\n## Etiology\n...'}
              className="w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-mono"
            />

            {(error || result?.error) && <p className="text-xs text-red-600">{error || result.error}</p>}

            {parsed && (
              <div className="rounded-lg bg-white border border-violet-200 p-2 text-xs space-y-2">
                <p className="font-semibold text-violet-900">
                  Preview — {parsed.found.length} of {CLINICAL_SECTIONS.length} sections will be saved to {label}:
                </p>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {CLINICAL_SECTIONS.filter(s => parsed.updates[s.key]).map(({ key, header }) => (
                    <div key={key} className="rounded-md border border-violet-100 bg-violet-50/50 p-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                        {header} · {wordCount(parsed.updates[key])} words
                        {existingInfo?.[key] ? <span className="text-amber-700 normal-case font-semibold"> · replaces existing</span> : null}
                      </p>
                      <p className="text-sm text-drug-text whitespace-pre-line break-words line-clamp-4">{parsed.updates[key]}</p>
                    </div>
                  ))}
                </div>
                {parsed.missing.length > 0 && (
                  <p className="text-amber-700">
                    Not found in this answer (left as they are): {parsed.missing.map(k => SECTION_LABEL[k]).join(', ')}.
                  </p>
                )}
              </div>
            )}

            {state === 'saved' && <p className="text-sm font-semibold text-green-700">Saved to {label}.</p>}

            <div className="flex gap-2">
              <button type="button" onClick={save} disabled={!parsed || state === 'saving'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold text-sm disabled:opacity-50">
                {state === 'saving'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save clinical info</>}
              </button>
              {text && (
                <button type="button" onClick={() => change('')}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm">Clear</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
