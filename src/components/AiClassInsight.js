// src/components/AiClassInsight.js
//
// AI-powered drug discovery for a single drug class or subclass. Given a
// class/subclass name, asks the AI provider for medications that belong to
// it (matched by the class/subclass's own indications), diffs the result
// against what's already in the database, and — for admins — lets the new
// ones be saved in bulk or one at a time. Shared by BrowsePage's "All
// Classes" filter view and the per-class/per-subclass accordion in
// TaxonomyBrowser, so every class and subclass in the taxonomy gets the
// same "ask AI for more" affordance, not just the one selected in the
// top filter dropdown.
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Pill, ChevronRight, Sparkles, RefreshCw, AlertTriangle, Save, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { renderAiText } from '../utils/renderAiText';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { fetchAiDrugText, saveAiDrugToDatabase, isDrugComplete } from '../utils/aiDrugSave';

/* ── AI fallback for sparse class/subclass results ───────────────────────── */
function normalizeDrugName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function AiClassFallback({ className, existingDrugs, parentClassName, databaseDrugs }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  // IMPORTANT: drugs flagged _seed come from the bundled local seed file and
  // do NOT exist in Firestore. They must never count as "already in database" —
  // that was falsely blocking AI saves for drugs that were never actually saved.
  const dbDrugs = useMemo(() => existingDrugs.filter(d => !d._seed), [existingDrugs]);
  const incompleteExisting = useMemo(() => dbDrugs.filter(d => !isDrugComplete(d)), [dbDrugs]);

  // "Already in database" has to mean *anywhere* in the app's database, not
  // just "already filed under this exact class/subclass bucket" — a drug's
  // local taxonomy placement (via classifyDrugTaxonomyAll) can easily miss a
  // subclass that has no matching rule yet (e.g. a subclass with zero RULES
  // entries always looks empty), which previously made every AI suggestion
  // for that subclass look "new" even when the drug already existed in the
  // database under a different subclass. databaseDrugs — when supplied — is
  // the app's full unscoped drug list, so this check isn't limited by how
  // well the local taxonomy classified things. Falls back to the
  // class/subclass-scoped list when no global list was passed in (keeps the
  // original behavior for callers that don't supply one).
  const dedupSourceDrugs = useMemo(
    () => (databaseDrugs && databaseDrugs.length ? databaseDrugs.filter(d => !d._seed) : dbDrugs),
    [databaseDrugs, dbDrugs]
  );
  const knownDrugNames = useMemo(() => dedupSourceDrugs.map(d => d.generic_name).filter(Boolean), [dedupSourceDrugs]);
  const existingByName = useMemo(() => {
    const map = new Map();
    dedupSourceDrugs.forEach(d => {
      if (d.generic_name) map.set(normalizeDrugName(d.generic_name), d);
    });
    return map;
  }, [dedupSourceDrugs]);

  const cacheKey = `ai_class_${(parentClassName ? parentClassName.trim().toLowerCase() + '::' : '')}${className.trim().toLowerCase()}`;
  const [state, setState] = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]   = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError] = useState('');
  const [queriedFor, setQueriedFor] = useState(className);

  const [bulkState, setBulkState]       = useState('idle'); // idle | running | done
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [bulkResults, setBulkResults]   = useState(null); // { saved, skipped, errors: [{name, message}] }

  const [fixState, setFixState]       = useState('idle'); // idle | running | done
  const [fixProgress, setFixProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [fixResults, setFixResults]   = useState(null); // { fixed, errors: [{name, message}] }

  const saveAllToDatabase = async (items) => {
    setBulkState('running');
    setBulkResults(null);
    let saved = 0, incomplete = 0;
    const errors = [];

    // Upload every item the AI listed, overwriting whatever's already saved
    // under that name (if anything) with this fresh data — the local
    // "existing in this class" check is only used for the badges shown
    // above, not to silently skip saving here. overwrite: true is required
    // below — without it, saveAiDrugToDatabase's own internal existence
    // check (independent of class) would still silently skip.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setBulkProgress({ current: i + 1, total: items.length, currentName: item.name });
      const drugClassForItem = item.subclass || className;
      try {
        const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: drugClassForItem, endpoint: provider.endpoint });
        const result = await saveAiDrugToDatabase({
          genericName: item.name,
          drugClass: drugClassForItem,
          text: itemText,
          overwrite: true,
        });
        if (result.status === 'saved') saved += 1; else incomplete += 1;
      } catch (e) {
        errors.push({ name: item.name, message: e.message || 'Failed to save.' });
      }
      // Brief pause between requests to stay gentle on the AI provider's rate limits.
      await new Promise(r => setTimeout(r, 350));
    }

    setBulkResults({ saved, skipped: incomplete, errors });
    setBulkState('done');
  };

  // Regenerates existing drugs in this class that are missing required
  // fields. Saves always go through — even if the regenerated version is
  // still missing some fields, the newest AI result replaces the old entry.
  const fixIncompleteExisting = async () => {
    setFixState('running');
    setFixResults(null);
    let fixed = 0;
    const errors = [];

    for (let i = 0; i < incompleteExisting.length; i++) {
      const drug = incompleteExisting[i];
      setFixProgress({ current: i + 1, total: incompleteExisting.length, currentName: drug.generic_name });
      try {
        const itemText = await fetchAiDrugText({ genericName: drug.generic_name, drugClass: drug.drug_class || className, endpoint: provider.endpoint });
        const result = await saveAiDrugToDatabase({
          genericName: drug.generic_name,
          drugClass: drug.drug_class || className,
          text: itemText,
        });
        if (result.status === 'saved') fixed += 1;
      } catch (e) {
        errors.push({ name: drug.generic_name, message: e.message || 'Failed to regenerate.' });
      }
      await new Promise(r => setTimeout(r, 350));
    }

    setFixResults({ fixed, errors });
    setFixState('done');
  };

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setQueriedFor(className);
    try {
      const res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'class',
          className: className.trim(),
          parentClassName: parentClassName ? parentClassName.trim() : undefined,
          knownDrugNames,
        }),
      });

      if (!res.ok || !res.body) {
        let message = 'Something went wrong.';
        try { message = (await res.json()).error || message; } catch {}
        throw new Error(message);
      }

      setState('streaming');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }
      // Cache so Back button restores result instantly
      sessionStorage.setItem(cacheKey, full);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  if (!className.trim()) return null;

  const fixBanner = isAdmin && incompleteExisting.length > 0 && (
    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
      {fixState !== 'running' && fixState !== 'done' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-800">
            <strong>{incompleteExisting.length}</strong> existing drug{incompleteExisting.length !== 1 ? 's' : ''} in
            "{className}" {incompleteExisting.length !== 1 ? 'are' : 'is'} missing required info.
          </p>
          <button
            onClick={fixIncompleteExisting}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Complete Missing Info
          </button>
        </div>
      )}

      {fixState === 'running' && (
        <div>
          <div className="flex items-center gap-2 text-sm text-amber-800 mb-2">
            <RefreshCw className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
            <span className="truncate">
              Fixing {fixProgress.current} of {fixProgress.total} — {fixProgress.currentName}…
            </span>
          </div>
          <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${(fixProgress.current / Math.max(fixProgress.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {fixState === 'done' && fixResults && (
        <div>
          <div className="flex items-center gap-2 font-semibold text-sm text-amber-800">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Completed {fixResults.fixed} of {incompleteExisting.length}
            {fixResults.errors.length > 0 ? `, ${fixResults.errors.length} still need attention` : ''}.
          </div>
          {fixResults.errors.length > 0 && (
            <ul className="mt-2 text-xs text-amber-700 space-y-0.5">
              {fixResults.errors.map((err, i) => <li key={i}>• {err.name}: {err.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  let content;

  if (state === 'idle') {
    content = (
      <div className="mt-6 bg-primary-50 border border-primary-200 rounded-xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-primary-500 mx-auto mb-3" />
        <p className="text-sm text-drug-text mb-4">
          Want the AI to find other medications in "{className}" and its subclasses not yet in our database?
        </p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Ask AI for more in "{className}"
        </button>
      </div>
    );
  } else if (state === 'loading' || state === 'streaming') {
    content = (
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-8 text-center">
        <RefreshCw className="w-8 h-8 text-primary-400 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-drug-muted">Gathering medications in "{queriedFor}"…</p>
      </div>
    );
  } else if (state === 'error') {
    content = (
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  } else {
  // done — render as clickable rows matching the app's normal browse list
  const items = parseAiDrugList(text);

  content = (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-primary-500 flex-shrink-0" />
          <h2 className="text-lg font-bold text-drug-text truncate">AI: More in "{queriedFor}"</h2>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isAdmin && items.length > 0 && bulkState !== 'running' && (
            <button
              onClick={() => saveAllToDatabase(items)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg"
            >
              <Save className="w-3.5 h-3.5" /> Save All to Database
            </button>
          )}
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
            disabled={bulkState === 'running'}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      </div>

      {bulkState === 'running' && (
        <div className="mb-3 bg-primary-50 border border-primary-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-drug-text mb-2">
            <RefreshCw className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" />
            <span className="truncate">
              Saving {bulkProgress.current} of {bulkProgress.total} — {bulkProgress.currentName}…
            </span>
          </div>
          <div className="h-1.5 bg-primary-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100}%` }}
            />
          </div>
          <p className="text-xs text-drug-muted mt-2">
            This makes one AI request per medication, so it can take a while for a long list — feel free to
            stay on this screen until it finishes.
          </p>
        </div>
      )}

      {bulkState === 'done' && bulkResults && (
        <div className={`mb-3 rounded-xl p-4 border text-sm ${
          bulkResults.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className={`flex items-center gap-2 font-semibold ${
            bulkResults.errors.length > 0 ? 'text-amber-700' : 'text-green-700'
          }`}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Saved {bulkResults.saved}{bulkResults.skipped > 0 ? `, skipped ${bulkResults.skipped} (already in database)` : ''}
            {bulkResults.errors.length > 0 ? `, ${bulkResults.errors.length} failed` : ''}.
          </div>
          {bulkResults.errors.length > 0 && (
            <ul className="mt-2 text-xs text-amber-700 space-y-0.5">
              {bulkResults.errors.map((err, i) => (
                <li key={i}>• {err.name}: {err.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {items.length > 0 && (() => {
        const newCount = items.filter(item => !existingByName.has(normalizeDrugName(item.name))).length;
        const existingItems = items.filter(item => existingByName.has(normalizeDrugName(item.name)));
        const incompleteCount = existingItems.filter(item => !isDrugComplete(existingByName.get(normalizeDrugName(item.name)))).length;
        const completeCount = existingItems.length - incompleteCount;
        return (
          <div className="flex items-center gap-3 mb-3 text-xs font-semibold flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
              <Sparkles className="w-3 h-3" /> {newCount} new
            </span>
            {completeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" /> {completeCount} already in database
              </span>
            )}
            {incompleteCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="w-3 h-3" /> {incompleteCount} in database but incomplete
              </span>
            )}
          </div>
        );
      })()}

      {items.length > 0 ? (
        <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
          {items.map((item, i) => {
            const existing = existingByName.get(normalizeDrugName(item.name));
            const existingIncomplete = existing && !isDrugComplete(existing);
            return (
              <Link
                key={`${item.name}-${i}`}
                to={existing
                  ? `/drug/${existing.id || existing.firestoreId}`
                  : `/ai-drug/${encodeURIComponent(item.name)}?class=${encodeURIComponent(item.subclass || className)}`}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                  i !== items.length - 1 ? 'border-b border-drug-border' : ''
                }`}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  existingIncomplete ? 'bg-amber-50' : existing ? 'bg-green-50' : 'bg-primary-50'
                }`}>
                  <Pill className={`w-5 h-5 ${
                    existingIncomplete ? 'text-amber-600' : existing ? 'text-green-600' : 'text-primary-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{item.name}</h3>
                  <p className="text-sm text-primary-600 truncate">{item.subclass || className}</p>
                </div>
                {existingIncomplete ? (
                  <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 bg-amber-100 text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Needs Info
                  </span>
                ) : existing ? (
                  <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> In Database
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 bg-purple-100 text-purple-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      ) : (
        // Fallback if the response didn't follow the expected bullet format
        // (e.g. "this isn't a recognized drug class") — show the raw text instead.
        <div className="bg-white border border-drug-border rounded-xl p-6">
          {text
            ? renderAiText(text, {
                getLinkPath: (drugName) =>
                  `/ai-drug/${encodeURIComponent(drugName)}?class=${encodeURIComponent(className)}`,
              })
            : <p className="text-sm text-drug-muted">No results.</p>}
        </div>
      )}

      <div className="mt-3 text-xs text-drug-muted leading-relaxed px-1">
        These medications are AI-generated on demand and not yet verified in our database. Tap a name above
        for its full breakdown. Verify before applying to patient care.
      </div>
    </div>
  );
  }

  return (
    <>
      {fixBanner}
      {content}
    </>
  );
}


export default AiClassFallback;
