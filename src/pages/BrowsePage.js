import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pill, ChevronRight, Grid3X3, List, Sparkles, RefreshCw, AlertTriangle, Save, CheckCircle } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { renderAiText } from '../utils/renderAiText';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { searchDrugs } from '../utils/searchDrugs';
import { fetchAiDrugText, saveAiDrugToDatabase } from '../utils/aiDrugSave';

/* ── AI fallback lookup for drugs not yet in the database ───────────────── */
function AiSearchFallback({ searchQuery }) {
  const { isAdmin } = useAuth();
  const cacheKey = `ai_search_${searchQuery.trim().toLowerCase()}`;

  const [state, setState]         = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]           = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError]         = useState('');
  const [queriedFor, setQueriedFor] = useState(searchQuery);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setSaveState('idle');
    setQueriedFor(searchQuery);
    try {
      const res = await fetch('/api/drug-ai-details', {
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
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaveState('saving');
    try {
      const result = await saveAiDrugToDatabase({
        genericName: queriedFor.trim(),
        drugClass:   '',
        text,
        overwrite:   false,
      });
      if (result.status === 'incomplete') {
        // Some fields missing but save the best we have anyway
        await saveAiDrugToDatabase({
          genericName: queriedFor.trim(),
          drugClass:   '',
          text,
          overwrite:   true,
        });
      }
      setSaveState('saved');
    } catch (e) {
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
            {/* Save to Database — admin only */}
            {isAdmin && saveState !== 'saved' && (
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
                  <>⚠ Failed — Retry</>
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

      {text
        ? renderAiText(text)
        : <p className="text-sm text-drug-muted">Starting…</p>}

      {state === 'done' && (
        <div className="mt-6 pt-4 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
          This drug is not yet in the verified database — the above is AI-generated on demand and not a
          substitute for the current product monograph or clinical judgment. Verify before applying to patient care.
        </div>
      )}
    </div>
  );
}

/* ── AI fallback for sparse class/subclass results ───────────────────────── */
function AiClassFallback({ className, knownDrugNames }) {
  const { isAdmin } = useAuth();
  const cacheKey = `ai_class_${className.trim().toLowerCase()}`;
  const [state, setState] = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]   = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError] = useState('');
  const [queriedFor, setQueriedFor] = useState(className);

  const [bulkState, setBulkState]       = useState('idle'); // idle | running | done
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [bulkResults, setBulkResults]   = useState(null); // { saved, skipped, errors: [{name, message}] }

  const saveAllToDatabase = async (items) => {
    setBulkState('running');
    setBulkResults(null);
    let saved = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setBulkProgress({ current: i + 1, total: items.length, currentName: item.name });
      const drugClassForItem = item.subclass || className;
      try {
        const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: drugClassForItem });
        const result = await saveAiDrugToDatabase({ genericName: item.name, drugClass: drugClassForItem, text: itemText });
        if (result.status === 'saved') saved += 1; else skipped += 1;
      } catch (e) {
        errors.push({ name: item.name, message: e.message || 'Failed to save.' });
      }
      // Brief pause between requests to stay gentle on the AI provider's rate limits.
      await new Promise(r => setTimeout(r, 350));
    }

    setBulkResults({ saved, skipped, errors });
    setBulkState('done');
  };

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setQueriedFor(className);
    try {
      const res = await fetch('/api/drug-ai-details', {
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

  if (state === 'idle') {
    return (
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
  }

  if (state === 'loading' || state === 'streaming') {
    return (
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-8 text-center">
        <RefreshCw className="w-8 h-8 text-primary-400 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-drug-muted">Gathering medications in "{queriedFor}"…</p>
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

  // done — render as clickable rows matching the app's normal browse list
  const items = parseAiDrugList(text);

  return (
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

      {items.length > 0 ? (
        <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
          {items.map((item, i) => (
            <Link
              key={`${item.name}-${i}`}
              to={`/ai-drug/${encodeURIComponent(item.name)}?class=${encodeURIComponent(item.subclass || className)}`}
              className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                i !== items.length - 1 ? 'border-b border-drug-border' : ''
              }`}
            >
              <div className="p-2 bg-primary-50 rounded-lg flex-shrink-0">
                <Pill className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{item.name}</h3>
                <p className="text-sm text-primary-600 truncate">{item.subclass || className}</p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 bg-purple-100 text-purple-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI
              </span>
              <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
            </Link>
          ))}
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

export default function BrowsePage() {
  const { drugs: ALL_DRUGS, loading } = useDrugs();
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
            ? <AiClassFallback className={filterClass} knownDrugNames={[]} />
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
              <p className="text-sm text-primary-600 font-medium mt-1">{drug.drug_class}</p>

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
                  <p className="text-sm text-primary-600 truncate">{drug.drug_class}</p>
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
          knownDrugNames={filteredDrugs.map(d => d.generic_name).filter(Boolean)}
        />
      )}
    </div>
  );
}
