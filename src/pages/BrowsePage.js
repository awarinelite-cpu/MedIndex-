import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pill, ChevronRight, Grid3X3, List, Sparkles, RefreshCw, AlertTriangle, Save, CheckCircle } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { renderAiText } from '../utils/renderAiText';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { searchDrugs } from '../utils/searchDrugs';
import { fetchAiDrugText, saveAiDrugToDatabase, fetchStrengthText, saveStrengthOnly, needsStrengthOnly, isDrugComplete, isDrugNotFoundText } from '../utils/aiDrugSave';
import { logSearch } from '../utils/logSearch';
import { getDisplayDrugClass } from '../utils/drugCategory';

/* ── AI fallback lookup for drugs not yet in the database ───────────────── */
function AiSearchFallback({ searchQuery }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const cacheKey = `ai_search_${searchQuery.trim().toLowerCase()}`;

  const [state, setState]         = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]           = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError]         = useState('');
  const [queriedFor, setQueriedFor] = useState(searchQuery);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [notFound, setNotFound]   = useState(() => {
    const cached = sessionStorage.getItem(cacheKey);
    return cached ? isDrugNotFoundText(cached) : false;
  });

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setSaveState('idle');
    setNotFound(false);
    setQueriedFor(searchQuery);
    try {
      const res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genericName: searchQuery.trim(), notInDatabase: true }),
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
      sessionStorage.setItem(cacheKey, full);
      setState('done');
      const failedLookup = isDrugNotFoundText(full);
      setNotFound(failedLookup);

      // Non-admins never see a save control or the "✓ Saved" badge — but
      // every AI lookup they run still quietly adds/refreshes this drug in
      // the shared database in the background. Deliberately does NOT touch
      // saveState/saveError, since those drive UI (including the "✓ Saved
      // to database" badge above) that must stay invisible to them.
      // A lookup that didn't actually resolve to a real drug is never saved.
      if (!isAdmin && !failedLookup) {
        saveAiDrugToDatabase({ genericName: searchQuery.trim(), drugClass: '', text: full }).catch(() => {
          // Intentionally silent — this must never surface to the user.
        });
      }
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaveState('saving');
    setSaveError('');
    try {
      // Always save AI search results — replaces any existing entry with the
      // same name. Duplicate cleanup will be handled in the admin page later.
      await saveAiDrugToDatabase({
        genericName: queriedFor.trim(),
        drugClass:   '',
        text,
      });
      setSaveState('saved');
    } catch (e) {
      setSaveError(e.message || 'Failed to save this drug.');
      setSaveState('error');
    }
  };

  if (!searchQuery.trim()) return null;

  if (state === 'idle') {
    return (
      <div className="mt-6 bg-primary-50 border border-primary-200 rounded-xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-primary-500 mx-auto mb-3" />
        <p className="text-sm text-drug-text mb-4">
          "{searchQuery}" isn't in our database yet. Want the AI to look it up — dosage, route of
          administration, and full clinical details — on the spot?
        </p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Ask AI about "{searchQuery}"
        </button>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-8 text-center">
        <RefreshCw className="w-8 h-8 text-primary-400 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-drug-muted">Looking up "{queriedFor}"…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
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
  }

  // streaming or done
  return (
    <div className="mt-6 bg-white border border-drug-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-bold text-drug-text">AI Lookup: {queriedFor}</h2>
          {state === 'streaming' && (
            <RefreshCw className="w-3.5 h-3.5 text-primary-400 animate-spin" />
          )}
          {saveState === 'saved' && (
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              ✓ Saved to database
            </span>
          )}
        </div>

        {state === 'done' && (
          <div className="flex items-center gap-2">
            {/* Save to Database — admin only, and only for a resolved drug */}
            {isAdmin && !notFound && saveState !== 'saved' && (
              <button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: saveState === 'error' ? '#FEF2F2' : '#1e40af',
                  color: saveState === 'error' ? '#DC2626' : '#fff',
                  border: saveState === 'error' ? '1px solid #FECACA' : 'none',
                  cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveState === 'saving' ? 0.7 : 1,
                }}
              >
                {saveState === 'saving' ? (
                  <><RefreshCw style={{ width: 13, height: 13 }} /> Saving…</>
                ) : saveState === 'error' ? (
                  <>⚠ {saveError || 'Failed'} — Retry</>
                ) : (
                  <><Save style={{ width: 13, height: 13 }} /> Save to Database</>
                )}
              </button>
            )}
            <button
              onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
        )}
      </div>

      {state === 'done' && notFound ? (
        <div className="text-center py-6">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-drug-text mb-1">
            Couldn't confirm "{queriedFor}" as a real generic or brand-name drug.
          </p>
          <p className="text-xs text-drug-muted mb-4">
            Nothing was saved to the database. Check the spelling, or try the full name if this was an
            abbreviation.
          </p>
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      ) : (
        text
          ? renderAiText(text)
          : <p className="text-sm text-drug-muted">Starting…</p>
      )}

      {state === 'done' && !notFound && (
        <div className="mt-6 pt-4 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
          This drug is not yet in the verified database — the above is AI-generated on demand and not a
          substitute for the current product monograph or clinical judgment. Verify before applying to patient care.
        </div>
      )}
    </div>
  );
}

/* ── AI fallback for sparse class/subclass results ───────────────────────── */
function normalizeDrugName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function AiClassFallback({ className, existingDrugs }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  // IMPORTANT: drugs flagged _seed come from the bundled local seed file and
  // do NOT exist in Firestore. They must never count as "already in database" —
  // that was falsely blocking AI saves for drugs that were never actually saved.
  const dbDrugs = useMemo(() => existingDrugs.filter(d => !d._seed), [existingDrugs]);
  const knownDrugNames = useMemo(() => dbDrugs.map(d => d.generic_name).filter(Boolean), [dbDrugs]);
  const incompleteExisting = useMemo(() => dbDrugs.filter(d => !isDrugComplete(d)), [dbDrugs]);
  const existingByName = useMemo(() => {
    const map = new Map();
    dbDrugs.forEach(d => {
      if (d.generic_name) map.set(normalizeDrugName(d.generic_name), d);
    });
    return map;
  }, [dbDrugs]);

  const cacheKey = `ai_class_${className.trim().toLowerCase()}`;
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
        body: JSON.stringify({ mode: 'class', className: className.trim(), knownDrugNames }),
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

/* ── Bulk fast Strength fill for an already-populated class ─────────────── */
function BulkStrengthUpdate({ drugsMissingStrength, className, onDone }) {
  const [bulkState, setBulkState]       = useState('idle'); // idle | running | done
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [bulkResults, setBulkResults]   = useState(null); // { updated, errors: [{name, message}] }

  const runBulkUpdate = async () => {
    setBulkState('running');
    setBulkResults(null);
    let updated = 0;
    const errors = [];

    for (let i = 0; i < drugsMissingStrength.length; i++) {
      const drug = drugsMissingStrength[i];
      setBulkProgress({ current: i + 1, total: drugsMissingStrength.length, currentName: drug.generic_name });
      try {
        const strengthText = await fetchStrengthText({ genericName: drug.generic_name, drugClass: drug.drug_class });
        await saveStrengthOnly({ docId: drug.firestoreId || drug.id, strengthText });
        updated += 1;
      } catch (e) {
        errors.push({ name: drug.generic_name, message: e.message || 'Failed to update.' });
      }
      // Brief pause between requests to stay gentle on the AI provider's rate limits.
      await new Promise(r => setTimeout(r, 250));
    }

    setBulkResults({ updated, errors });
    setBulkState('done');
    onDone?.();
  };

  if (bulkState === 'idle') {
    return (
      <div className="mt-6 bg-violet-50 border border-violet-200 rounded-xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-violet-500 mx-auto mb-3" />
        <p className="text-sm text-drug-text mb-4">
          {drugsMissingStrength.length} drug{drugsMissingStrength.length === 1 ? '' : 's'} in "{className}"
          {drugsMissingStrength.length === 1 ? ' is' : ' are'} otherwise complete but missing Strength.
          Fill {drugsMissingStrength.length === 1 ? 'it' : 'them'} in with a fast, strength-only AI lookup?
        </p>
        <button
          onClick={runBulkUpdate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Fill in Strength for {drugsMissingStrength.length} drug{drugsMissingStrength.length === 1 ? '' : 's'}
        </button>
      </div>
    );
  }

  if (bulkState === 'running') {
    return (
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-5 h-5 text-violet-500 animate-spin" />
          <h3 className="font-bold text-drug-text">
            Updating strength — {bulkProgress.current}/{bulkProgress.total}
          </h3>
        </div>
        <p className="text-sm text-drug-muted mb-3">Currently: {bulkProgress.currentName}</p>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-violet-500 h-2 rounded-full transition-all"
            style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="mt-6 bg-white border border-drug-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <h3 className="font-bold text-drug-text">Strength update complete</h3>
      </div>
      <p className="text-sm text-drug-muted mb-2">
        {bulkResults.updated} of {drugsMissingStrength.length} drug{drugsMissingStrength.length === 1 ? '' : 's'} updated.
        {bulkResults.errors.length > 0 && ` ${bulkResults.errors.length} failed.`}
      </p>
      {bulkResults.errors.length > 0 && (
        <ul className="text-xs text-red-600 space-y-1 mt-2">
          {bulkResults.errors.map((e, i) => <li key={i}>{e.name}: {e.message}</li>)}
        </ul>
      )}
      <p className="text-xs text-drug-muted mt-3">Refresh the page to see the updated Strength badges.</p>
    </div>
  );
}

export default function BrowsePage() {
  const { drugs: ALL_DRUGS, loading, invalidateCache } = useDrugs();
  const { isAdmin, user } = useAuth();
  const ALL_CLASSES = useMemo(() => [...new Set(ALL_DRUGS.map(d => d.drug_class).filter(Boolean))].sort(), [ALL_DRUGS]);

  const { condition }             = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ                  = searchParams.get('q') || condition || '';
  const initialClass              = searchParams.get('class') || '';
  const initialStatus             = searchParams.get('status') || '';
  const initialView               = searchParams.get('view') || 'grid';

  const [searchQuery,  setSearchQuery]  = useState(initialQ);
  const [filterClass,  setFilterClass]  = useState(initialClass);
  const [filterStatus, setFilterStatus] = useState(initialStatus);
  const [viewMode,     setViewMode]     = useState(initialView);

  // Restore scroll position when returning via Back button
  const SCROLL_KEY = 'browse_scroll_y';
  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
      sessionStorage.removeItem(SCROLL_KEY);
    }
  }, []);
  useEffect(() => {
    const save = () => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    window.addEventListener('beforeunload', save);
    // Also save on any link click (SPA navigation)
    document.addEventListener('click', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('click', save);
    };
  }, []);

  // Keep the URL in sync with the current filters (replacing, not pushing, so
  // this doesn't spam the history stack). This way, if the user navigates
  // away — e.g. tapping into a drug's overview — and then presses back, the
  // page they land back on still has the exact same search/filter/view state.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchQuery)  next.set('q', searchQuery);
    if (filterClass)  next.set('class', filterClass);
    if (filterStatus) next.set('status', filterStatus);
    if (viewMode !== 'grid') next.set('view', viewMode);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterClass, filterStatus, viewMode]);

  const filteredDrugs = useMemo(() => {
    const fc = filterClass.trim().toLowerCase();

    // First apply class + status filters
    let pool = ALL_DRUGS.filter(drug => {
      const matchesClass  = !fc ||
        drug.drug_class?.toLowerCase() === fc ||
        drug.drug_subclass?.toLowerCase() === fc;
      const matchesStatus = !filterStatus || drug.prescription_status === filterStatus;
      return matchesClass && matchesStatus;
    });

    // Then apply relevance-ranked search (searches name, ALL indication fields,
    // class, and overview — both AI and legacy CSV schemas)
    if (searchQuery.trim()) {
      pool = searchDrugs(pool, searchQuery);
    }

    return pool;
  }, [ALL_DRUGS, searchQuery, filterClass, filterStatus]);

  // Log this search for the admin panel's per-user search history (skipped
  // for signed-out visitors and for empty queries; debounced inside logSearch
  // so it only fires once typing pauses, not on every keystroke).
  useEffect(() => {
    if (searchQuery.trim()) {
      logSearch({ user, query: searchQuery, resultCount: filteredDrugs.length });
    }
  }, [user, searchQuery, filteredDrugs.length]);

  // Full roster of drugs in the currently filtered class, independent of any
  // search/status narrowing — used so the AI class-expansion knows about
  // every existing drug in the class (not just whichever ones are currently
  // visible), so it never suggests duplicates of a drug that's simply
  // filtered out of view right now.
  const classDrugs = useMemo(() => {
    const fc = filterClass.trim().toLowerCase();
    if (!fc) return [];
    return ALL_DRUGS.filter(drug =>
      drug.drug_class?.toLowerCase() === fc || drug.drug_subclass?.toLowerCase() === fc
    );
  }, [ALL_DRUGS, filterClass]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Browse Medications</h1>
          <p className="text-drug-muted mt-1">{loading ? 'Loading…' : `${filteredDrugs.length} of ${ALL_DRUGS.length} drugs`}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-drug-border rounded-lg p-1">
            <button onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-drug-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, condition, indication, drug class…"
            className="flex-1 px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Classes</option>
            {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Status</option>
            <option value="OTC">OTC</option>
            <option value="Prescription">Prescription</option>
            <option value="Controlled">Controlled</option>
          </select>
        </div>
      </div>

      {/* Results — always instant */}
      {filteredDrugs.length === 0 ? (
        <div className="text-center py-20">
          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-drug-muted text-lg">No drugs match your search.</p>
          <button onClick={() => { setSearchQuery(''); setFilterClass(''); setFilterStatus(''); }}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
            Clear filters
          </button>
          {filterClass.trim()
            ? <AiClassFallback className={filterClass} existingDrugs={classDrugs} />
            : <AiSearchFallback searchQuery={searchQuery} />}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrugs.map(drug => (
            <Link key={drug.id} to={`/drug/${drug.id}`}
                  className="group bg-white border border-drug-border rounded-xl p-5 hover:border-primary-300 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Pill className="w-5 h-5 text-primary-600" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                  drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                               'bg-blue-100 text-blue-700'
                }`}>
                  {drug.prescription_status}
                </span>
              </div>
              <h3 className="text-lg font-bold group-hover:text-primary-700 transition-colors">{drug.generic_name}</h3>
              <p className="text-sm text-primary-600 font-medium mt-1">{getDisplayDrugClass(drug)}</p>

              {/* Show WHY this drug appeared when searching by indication */}
              {drug._matchType === 'indication' && drug._matchSnippet ? (
                <div className="mt-2">
                  <span className="inline-block text-xs font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded mb-1">
                    ✓ Indicated for
                  </span>
                  <p className="text-sm text-drug-muted line-clamp-2 italic">"{drug._matchSnippet}"</p>
                </div>
              ) : (
                <p className="text-sm text-drug-muted mt-2 line-clamp-2">
                  {drug.indications || drug.primary_indications}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
          {filteredDrugs.map((drug, i) => (
            <Link key={drug.id} to={`/drug/${drug.id}`}
                  className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                    i !== filteredDrugs.length - 1 ? 'border-b border-drug-border' : ''
                  }`}>
              <div className="p-2 bg-primary-50 rounded-lg">
                <Pill className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{drug.generic_name}</h3>
                {drug._matchType === 'indication' && drug._matchSnippet ? (
                  <p className="text-sm text-teal-600 truncate">✓ {drug._matchSnippet}</p>
                ) : (
                  <p className="text-sm text-primary-600 truncate">{getDisplayDrugClass(drug)}</p>
                )}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                             'bg-blue-100 text-blue-700'
              }`}>
                {drug.prescription_status}
              </span>
              <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* AI expansion — always show when browsing a specific class */}
      {filteredDrugs.length > 0 && filterClass.trim() && (
        <AiClassFallback
          className={filterClass}
          existingDrugs={classDrugs}
        />
      )}

      {/* Bulk fast Strength fill — admin only, for classes that are otherwise complete */}
      {isAdmin && filterClass.trim() && (() => {
        const missingStrength = filteredDrugs.filter(needsStrengthOnly);
        return missingStrength.length > 0 ? (
          <BulkStrengthUpdate
            key={filterClass}
            drugsMissingStrength={missingStrength}
            className={filterClass}
            onDone={invalidateCache}
          />
        ) : null;
      })()}
    </div>
  );
}
