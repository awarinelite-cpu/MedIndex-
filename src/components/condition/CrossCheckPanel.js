// src/components/condition/CrossCheckPanel.js
//
// Admin-only "Cross-check" for a drug class (or the whole condition). No AI:
//  1. Auto check  – /api/indication-check compares every drug with its official
//     label indications (openFDA) and RxClass "may treat" data.
//  2. Google check – every drug has a Google button (opens a ready-made search)
//     so flagged drugs can be confirmed by eye.
//  3. Review – each drug can be kept, removed from this class, moved to another
//     class where it is indicated, or deleted. Nothing changes until "Apply".
import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ExternalLink, HelpCircle, Loader2, Search, X } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayRemove, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { apiUrl } from '../../config/apiBase';
import { deleteReviewedDrug } from '../../utils/aiDrugSave';
import { getDisplayDrugClass } from '../../utils/drugCategory';

const BATCH = 10;

const cleanLabel = (label) => String(label || '')
  .replace(/^(drugs?|medications?|antidotes?)\s+(used\s+)?(in|for|to)\s+/i, '')
  .trim();

const googleUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

const STATUS = {
  match:   { label: 'Matched',   cls: 'is-match',   Icon: CheckCircle2 },
  nomatch: { label: 'Not found', cls: 'is-nomatch', Icon: AlertTriangle },
  nodata:  { label: 'No data',   cls: 'is-nodata',  Icon: HelpCircle },
};

async function callCheck({ drugs, conditionLabel, keywords, candidates }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();
  const res = await fetch(apiUrl('/api/indication-check'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ drugs, condition: { label: conditionLabel, keywords }, candidates }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Check failed (${res.status})`);
  return data.results || [];
}

export default function CrossCheckPanel({ title, conditionId, conditionLabel, drugs, siblings, onClose }) {
  const [phase, setPhase] = useState('setup'); // setup | running | review | applying | done
  const [extra, setExtra] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState({});            // drugId -> result
  const [choices, setChoices] = useState({});            // drugId -> { action, target }
  const [visited, setVisited] = useState(() => new Set()); // drugs already opened on Google
  const [showMatched, setShowMatched] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const cancelRef = useRef(false);

  const { checkable, skipped } = useMemo(() => {
    const seen = new Set();
    const ok = [];
    let skip = 0;
    (drugs || []).forEach((d) => {
      if (!d || seen.has(d.id)) return;
      seen.add(d.id);
      if (d._seed) { skip += 1; return; }
      ok.push(d);
    });
    return { checkable: ok, skipped: skip };
  }, [drugs]);

  const byId = useMemo(() => new Map(checkable.map((d) => [d.id, d])), [checkable]);
  const topic = cleanLabel(conditionLabel) || conditionLabel;
  const keywords = extra.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const siblingList = useMemo(() => (siblings || []).map((s) => ({ id: s.id, label: s.label })), [siblings]);

  const run = async () => {
    setError('');
    setPhase('running');
    setProgress(0);
    cancelRef.current = false;
    const acc = {};
    try {
      for (let i = 0; i < checkable.length; i += BATCH) {
        if (cancelRef.current) break;
        const slice = checkable.slice(i, i + BATCH);
        const out = await callCheck({
          drugs: slice.map((d) => ({ id: d.id, name: d.generic_name })),
          conditionLabel,
          keywords,
          candidates: siblingList.map((s) => ({ id: s.id, label: s.label })),
        });
        out.forEach((r) => { acc[r.id] = r; });
        setProgress(Math.min(checkable.length, i + BATCH));
      }
      setResults(acc);
      setChoices({});
      setPhase('review');
    } catch (e) {
      setError(e.message || 'The check failed.');
      setResults(acc);
      setPhase(Object.keys(acc).length ? 'review' : 'setup');
    }
  };

  const setChoice = (id, patch) => setChoices((prev) => ({ ...prev, [id]: { action: 'keep', target: '', ...prev[id], ...patch } }));
  const choiceOf = (id) => choices[id] || { action: 'keep', target: '' };

  const flagged = Object.values(results).filter((r) => r.status !== 'match');
  const matched = Object.values(results).filter((r) => r.status === 'match');
  const nomatch = Object.values(results).filter((r) => r.status === 'nomatch');

  const pending = Object.entries(choices).filter(([, c]) =>
    c.action === 'remove' || c.action === 'delete' || (c.action === 'move' && c.target));
  const incompleteMoves = Object.values(choices).filter((c) => c.action === 'move' && !c.target).length;

  const bulkRemoveNotFound = () => {
    const next = { ...choices };
    nomatch.forEach((r) => { next[r.id] = { action: 'remove', target: '' }; });
    setChoices(next);
  };
  const bulkSuggested = () => {
    const next = { ...choices };
    nomatch.forEach((r) => {
      const s = r.suggestions?.[0];
      next[r.id] = s ? { action: 'move', target: s.id } : { action: 'remove', target: '' };
    });
    setChoices(next);
  };

  const apply = async () => {
    const deletes = pending.filter(([, c]) => c.action === 'delete').length;
    const msg = `Apply ${pending.length} change${pending.length === 1 ? '' : 's'}?` +
      (deletes ? `\n\n${deletes} drug${deletes === 1 ? '' : 's'} will be permanently deleted from the whole app.` : '');
    if (!window.confirm(msg)) return;
    setPhase('applying');
    let done = 0;
    const failed = [];
    for (const [id, c] of pending) {
      const d = byId.get(id);
      try {
        if (c.action === 'delete') {
          await deleteReviewedDrug({ id });
        } else {
          if (c.action === 'move') {
            await updateDoc(doc(db, 'drugs', id), {
              condition_tags: arrayUnion(c.target),
              condition_excluded: arrayRemove(c.target),
              last_updated: serverTimestamp(),
            });
          }
          await updateDoc(doc(db, 'drugs', id), {
            condition_tags: arrayRemove(conditionId),
            pending_condition_tags: arrayRemove(conditionId),
            condition_excluded: arrayUnion(conditionId),
            last_updated: serverTimestamp(),
          });
        }
        done += 1;
      } catch (e) {
        failed.push(`${d?.generic_name || id}: ${e.message || e}`);
      }
    }
    setOutcome({ done, failed });
    setPhase('done');
  };

  const openGoogle = (d) => {
    setVisited((prev) => new Set(prev).add(d.id));
    window.open(googleUrl(`${d.generic_name} indications ${topic}`), '_blank', 'noopener,noreferrer');
  };

  const renderRow = (r) => {
    const d = byId.get(r.id);
    if (!d) return null;
    const st = STATUS[r.status] || STATUS.nodata;
    const c = choiceOf(r.id);
    const targets = [
      ...(r.suggestions || []).map((s) => ({ id: s.id, label: `${s.label} ✓` })),
      ...siblingList.filter((s) => !(r.suggestions || []).some((x) => x.id === s.id)),
    ];
    return (
      <div key={r.id} className={`cc-row ${c.action !== 'keep' ? 'is-changed' : ''}`}>
        <div className="cc-row-top">
          <div className="cc-row-name">
            <b>{d.generic_name}</b>
            <span>{d.drug_subclass || getDisplayDrugClass(d)}</span>
          </div>
          <span className={`cc-chip ${st.cls}`}><st.Icon size={14} strokeWidth={2.6} /> {st.label}</span>
        </div>

        <p className="cc-evidence">
          {r.status === 'match' && (
            <>
              {r.matchedBy === 'label' ? 'Official label: ' : 'RxClass lists it for: '}
              <i>{r.matchedBy === 'label' ? r.excerpt : r.concept}</i>
            </>
          )}
          {r.status === 'nomatch' && (
            <>
              Reference data does not mention “{topic}”.
              {r.rxConditions?.length > 0 && <> It lists: <i>{r.rxConditions.slice(0, 5).join(', ')}</i>.</>}
              {!r.rxConditions?.length && r.excerpt && <> Label says: <i>{r.excerpt}</i></>}
            </>
          )}
          {r.status === 'nodata' && 'No label or RxClass data found for this name. Check it on Google.'}
        </p>
        {r.status === 'nomatch' && r.suggestions?.length > 0 && (
          <p className="cc-suggest">May fit: {r.suggestions.map((s) => s.label).join(' • ')}</p>
        )}

        <div className="cc-row-actions">
          <button type="button" className={`cc-google ${visited.has(r.id) ? 'is-visited' : ''}`} onClick={() => openGoogle(d)}>
            {visited.has(r.id) ? <Check size={15} strokeWidth={3} /> : <Search size={15} strokeWidth={2.6} />} Google
          </button>
          <select className="cc-select" value={c.action} onChange={(e) => setChoice(r.id, { action: e.target.value, target: e.target.value === 'move' ? (r.suggestions?.[0]?.id || c.target || '') : '' })}>
            <option value="keep">Keep</option>
            <option value="remove">Remove from this class</option>
            <option value="move">Move to another class…</option>
            <option value="delete">Delete drug</option>
          </select>
          {c.action === 'move' && (
            <select className="cc-select" value={c.target} onChange={(e) => setChoice(r.id, { target: e.target.value })}>
              <option value="">Choose class…</option>
              {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cc-overlay cp-vars" role="dialog" aria-modal="true" aria-label="Cross-check drugs">
      <div className="cc-sheet">
        <header className="cc-head">
          <div>
            <h3>Cross-check: {title}</h3>
            <p>{checkable.length} drug{checkable.length === 1 ? '' : 's'} • {topic}</p>
          </div>
          <button type="button" className="cc-x" onClick={() => { cancelRef.current = true; onClose(); }} aria-label="Close"><X size={22} strokeWidth={2.6} /></button>
        </header>

        <div className="cc-body">
          {phase === 'setup' && (
            <>
              <p className="cc-text">
                Step 1 compares each drug with its official label and RxClass data (no AI). Step 2: open any drug on Google to
                confirm. Then choose Keep, Remove, Move or Delete. Nothing changes until you tap Apply.
              </p>
              <label className="cc-label" htmlFor="cc-extra">Extra words to match (optional)</label>
              <input id="cc-extra" className="cc-input" value={extra} onChange={(e) => setExtra(e.target.value)}
                placeholder="e.g. insomnia, panic disorder" />
              <p className="cc-hint">Add other names for this condition so label wording like “insomnia” counts as a match.</p>
              <a className="cc-google-wide" href={googleUrl(`${topic} drugs list`)} target="_blank" rel="noopener noreferrer">
                <Search size={17} strokeWidth={2.6} /> Search this class on Google <ExternalLink size={15} strokeWidth={2.6} />
              </a>
              {skipped > 0 && <p className="cc-hint">{skipped} built-in sample drug{skipped === 1 ? '' : 's'} skipped (cannot be edited).</p>}
              {error && <p className="cc-error" role="alert">{error}</p>}
              <button type="button" className="cc-primary" disabled={!checkable.length} onClick={run}>
                Run database check ({checkable.length})
              </button>
            </>
          )}

          {phase === 'running' && (
            <div className="cc-running">
              <Loader2 className="cc-spin" size={30} strokeWidth={2.4} />
              <p>Checking {progress} of {checkable.length}…</p>
              <div className="cc-bar"><span style={{ width: `${checkable.length ? (progress / checkable.length) * 100 : 0}%` }} /></div>
              <button type="button" className="cc-ghost" onClick={() => { cancelRef.current = true; }}>Stop and show what's done</button>
            </div>
          )}

          {(phase === 'review' || phase === 'applying') && (
            <>
              {error && <p className="cc-error" role="alert">{error}</p>}
              <div className="cc-summary">
                <span className="cc-chip is-match">{matched.length} matched</span>
                <span className="cc-chip is-nomatch">{nomatch.length} not found</span>
                <span className="cc-chip is-nodata">{flagged.length - nomatch.length} no data</span>
              </div>
              {nomatch.length > 0 && (
                <div className="cc-bulk">
                  <button type="button" onClick={bulkSuggested} disabled={phase === 'applying'}>Move to suggested class, else remove</button>
                  <button type="button" onClick={bulkRemoveNotFound} disabled={phase === 'applying'}>Remove all “not found”</button>
                  <button type="button" onClick={() => setChoices({})} disabled={phase === 'applying'}>Reset</button>
                </div>
              )}
              <h4 className="cc-sec">Needs review ({flagged.length})</h4>
              {flagged.length === 0 && <p className="cc-text">Every drug in this class matched its reference data.</p>}
              {flagged.sort((a, b) => (a.status === b.status ? 0 : a.status === 'nomatch' ? -1 : 1)).map(renderRow)}
              {matched.length > 0 && (
                <>
                  <button type="button" className="cc-sec cc-toggle" onClick={() => setShowMatched((v) => !v)}>
                    Matched ({matched.length}) {showMatched ? '▲' : '▼'}
                  </button>
                  {showMatched && matched.map(renderRow)}
                </>
              )}
            </>
          )}

          {phase === 'done' && outcome && (
            <div className="cc-done">
              <CheckCircle2 size={34} strokeWidth={2.2} />
              <p><b>{outcome.done}</b> change{outcome.done === 1 ? '' : 's'} applied.</p>
              {outcome.failed.length > 0 && (
                <p className="cc-error" role="alert">{outcome.failed.length} failed:<br />{outcome.failed.slice(0, 5).join('\n')}</p>
              )}
              <button type="button" className="cc-primary" onClick={onClose}>Done</button>
            </div>
          )}
        </div>

        {(phase === 'review' || phase === 'applying') && (
          <footer className="cc-foot">
            {incompleteMoves > 0 && <span className="cc-hint">{incompleteMoves} move{incompleteMoves === 1 ? '' : 's'} need a class chosen.</span>}
            <button type="button" className="cc-ghost" onClick={onClose} disabled={phase === 'applying'}>Close</button>
            <button type="button" className="cc-primary" onClick={apply} disabled={!pending.length || phase === 'applying'}>
              {phase === 'applying' ? 'Applying…' : `Apply ${pending.length} change${pending.length === 1 ? '' : 's'}`}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
