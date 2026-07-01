import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pill, ChevronRight, Grid3X3, List, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { renderAiText } from '../utils/renderAiText';
import { parseAiDrugList } from '../utils/parseAiDrugList';

/* ── AI fallback lookup for drugs not yet in the database ───────────────── */
function AiSearchFallback({ searchQuery }) {
  const [state, setState] = useState('idle'); // idle | loading | streaming | done | error
  const [text, setText]   = useState('');
  const [error, setError] = useState('');
  const [queriedFor, setQueriedFor] = useState('');

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
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
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
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

  // streaming or done — render text as it arrives
  return (
    <div className="mt-6 bg-white border border-drug-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-bold text-drug-text">AI Lookup: {queriedFor}</h2>
          {state === 'streaming' && (
            <RefreshCw className="w-3.5 h-3.5 text-primary-400 animate-spin" />
          )}
        </div>
        {state === 'done' && (
          <button
            onClick={runLookup}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
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
  const [state, setState] = useState('idle'); // idle | loading | streaming | done | error
  const [text, setText]   = useState('');
  const [error, setError] = useState('');
  const [queriedFor, setQueriedFor] = useState('');

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
          Only a few medications in "{className}" are in our database so far. Want the AI to list other
          medications in this class and its subclasses?
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
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-bold text-drug-text">AI: More in "{queriedFor}"</h2>
        </div>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
        </button>
      </div>

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
  const [searchParams]            = useSearchParams();
  const initialQ                  = searchParams.get('q') || condition || '';
  const initialClass              = searchParams.get('class') || '';

  const [searchQuery,  setSearchQuery]  = useState(initialQ);
  const [filterClass,  setFilterClass]  = useState(initialClass);
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode,     setViewMode]     = useState('grid');

  const filteredDrugs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fc = filterClass.trim().toLowerCase();
    return ALL_DRUGS.filter(drug => {
      const matchesSearch = !q ||
        drug.generic_name?.toLowerCase().includes(q) ||
        drug.drug_class?.toLowerCase().includes(q) ||
        drug.indications?.toLowerCase().includes(q) ||
        drug.overview?.toLowerCase().includes(q);
      const matchesClass  = !fc ||
        drug.drug_class?.toLowerCase() === fc ||
        drug.drug_subclass?.toLowerCase() === fc;
      const matchesStatus = !filterStatus || drug.prescription_status === filterStatus;
      return matchesSearch && matchesClass && matchesStatus;
    });
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
            placeholder="Search drugs by name, class, or indication..."
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
              <p className="text-sm text-drug-muted mt-2 line-clamp-2">{drug.indications}</p>
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
                <p className="text-sm text-primary-600 truncate">{drug.drug_class}</p>
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

      {/* Sparse class results — offer AI expansion even when 1-2 drugs already matched */}
      {filteredDrugs.length > 0 && filteredDrugs.length <= 2 && filterClass.trim() && (
        <AiClassFallback
          className={filterClass}
          knownDrugNames={filteredDrugs.map(d => d.generic_name).filter(Boolean)}
        />
      )}
    </div>
  );
}
