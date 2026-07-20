import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Pill, Sparkles, RefreshCw, CheckCircle } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { fetchStrengthText, saveStrengthOnly, needsStrengthOnly } from '../utils/aiDrugSave';
import { logSearch } from '../utils/logSearch';
import TaxonomyBrowser from '../components/TaxonomyBrowser';
import AiClassFallback from '../components/AiClassInsight';
import { DRUG_CLASS_TAXONOMY, UNCLASSIFIED_BUCKET } from '../data/drugClassTaxonomy';
import { classifyDrugTaxonomyAll } from '../utils/classifyDrugTaxonomy';

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
  // Subclasses, listed separately so the dropdown can offer them alongside
  // top-level classes (e.g. "Beta-blockers" under "Cardiovascular Agents").
  const ALL_SUBCLASSES = useMemo(() => [...new Set(ALL_DRUGS.map(d => d.drug_subclass).filter(Boolean))].sort(), [ALL_DRUGS]);

  const { condition }             = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ                  = searchParams.get('q') || condition || '';
  const initialClass              = searchParams.get('class') || '';
  const initialStatus             = searchParams.get('status') || '';
  const [searchQuery,  setSearchQuery]  = useState(initialQ);
  const [filterClass,  setFilterClass]  = useState(initialClass);
  const [filterStatus, setFilterStatus] = useState(initialStatus);

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
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterClass, filterStatus]);

  // This page's free-text search box matches ONLY drug class / subclass
  // names from the 21-chapter taxonomy — not drug names, indications, or
  // conditions (that lives on the home page search instead). Typing e.g.
  // "Laxatives" matches the subclass by that name; typing a top-level class
  // name matches every drug across all of its subclasses.
  const matchingTaxonomy = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const classIds = new Set();
    const subclassKeys = new Set(); // `${classId}::${subclassId}`
    for (const cls of [...DRUG_CLASS_TAXONOMY, UNCLASSIFIED_BUCKET]) {
      if (cls.name.toLowerCase().includes(q)) classIds.add(cls.id);
      for (const sub of cls.subclasses) {
        if (sub.name.toLowerCase().includes(q)) subclassKeys.add(`${cls.id}::${sub.id}`);
      }
    }
    return { classIds, subclassKeys };
  }, [searchQuery]);

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

    // Then restrict to drugs classified under a matching class/subclass name
    if (searchQuery.trim() && matchingTaxonomy) {
      const { classIds, subclassKeys } = matchingTaxonomy;
      pool = pool.filter(drug =>
        classifyDrugTaxonomyAll(drug).some(({ classId, subclassId }) =>
          classIds.has(classId) || subclassKeys.has(`${classId}::${subclassId}`)
        )
      );
    }

    return pool;
  }, [ALL_DRUGS, searchQuery, filterClass, filterStatus, matchingTaxonomy]);

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
      </div>

      {/* Filters */}
      <div className="bg-white border border-drug-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by drug class or subclass…"
            className="flex-1 px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="px-4 py-2 border border-drug-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">All Classes &amp; Subclasses</option>
            <optgroup label="Drug Classes">
              {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            {ALL_SUBCLASSES.length > 0 && (
              <optgroup label="Drug Subclasses">
                {ALL_SUBCLASSES.map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
            )}
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

      {/* AI lookup fallback for a selected class/subclass (from the dropdown) —
          unaffected by the free-text box, which only narrows by taxonomy name. */}
      {filterClass.trim() && <AiClassFallback className={filterClass} existingDrugs={classDrugs} />}

      {/* Results — grouped into the 21 formulary classes & their subclasses */}
      {filteredDrugs.length === 0 ? (
        <div className="text-center py-20">
          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-drug-muted text-lg">
            {searchQuery.trim() ? `No drug class or subclass matches "${searchQuery}".` : 'No drugs match your search.'}
          </p>
          <button onClick={() => { setSearchQuery(''); setFilterClass(''); setFilterStatus(''); }}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
            Clear filters
          </button>
        </div>
      ) : (
        <TaxonomyBrowser drugs={filteredDrugs} allDrugs={ALL_DRUGS} />
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
