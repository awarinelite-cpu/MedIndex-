import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Filter, Sparkles, RefreshCw, AlertTriangle, CheckCircle, ChevronRight, Search,
  Merge, X,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAiProvider } from '../context/AiProviderContext';
import { useAiInsight } from '../context/AiInsightContext';
import { useAuth } from '../context/AuthContext';
import { isDrugComplete } from '../utils/aiDrugSave';
import { mergeDrugClasses } from '../utils/mergeDrugClasses';

// ── Live progress card — shown at the TOP of the page whenever a Class
// Sweep is running (or just finished). Pops up the moment the AI Insight
// button is tapped, and shows exactly which class it's currently searching
// and which drug it's adding right now, updating live as it works through
// the whole list.
function ClassSweepInsightCard({ allClasses, endpoint }) {
  const {
    classSweepRunning, classSweepClassIndex, classSweepClassTotal, classSweepCurrentClass,
    classSweepItemProgress, classSweepCurrentDrug, classSweepLog, classSweepSummary, classSweepResumed,
    startClassSweep, stopClassSweep, dismissClassSweepSummary, jumpClassSweep,
  } = useAiInsight();

  const itemPct = classSweepItemProgress.total
    ? Math.round((classSweepItemProgress.done / classSweepItemProgress.total) * 100)
    : 0;

  // Idle — just the launcher button
  if (!classSweepRunning && !classSweepSummary) {
    return (
      <button
        onClick={() => startClassSweep(allClasses, endpoint)}
        disabled={allClasses.length === 0}
        className="w-full mb-6 flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-bold text-white transition-colors disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
      >
        <Sparkles className="w-5 h-5" /> AI Insight — Auto-Build All {allClasses.length} Classes
      </button>
    );
  }

  // Running — the live pop-up card
  if (classSweepRunning) {
    return (
      <div className="mb-6 bg-white border-2 border-green-300 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />
              <span className="font-bold truncate">AI Insight is searching…</span>
            </div>
            <span className="text-sm font-semibold flex-shrink-0">
              Class {classSweepClassIndex} / {classSweepClassTotal}
            </span>
          </div>
          <p className="text-sm text-green-50 mt-1 truncate">
            Now scanning: <strong>{classSweepCurrentClass}</strong>
          </p>
          {classSweepResumed && (
            <p className="text-xs text-green-100 mt-1">↻ Resumed from where it last stopped</p>
          )}
        </div>

        <div className="p-5">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${itemPct}%` }}
            />
          </div>
          <p className="text-xs text-drug-muted mb-3">
            {classSweepItemProgress.total > 0
              ? `${classSweepItemProgress.done} / ${classSweepItemProgress.total} drugs checked in "${classSweepCurrentClass}"`
              : `Fetching the drug list for "${classSweepCurrentClass}"…`}
          </p>

          {classSweepCurrentDrug && (
            <p className="text-sm font-semibold text-drug-text mb-3">
              ⚡ Adding: {classSweepCurrentDrug}
            </p>
          )}

          {classSweepLog.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-xs text-drug-muted space-y-1 border-t border-drug-border pt-2 mb-3">
              {[...classSweepLog].reverse().map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">{row.className}</span>
                  <span className="flex-shrink-0 text-green-600 font-semibold">
                    ✓ {row.saved}{row.existing > 0 ? ` · 🔗 ${row.existing}` : ''}{row.failed > 0 ? ` · ✗ ${row.failed}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-drug-muted mb-3">
            This keeps running in the background — you can navigate away and it'll keep going until it
            finishes, you stop it, or you log out. If you do stop it, tapping "AI Insight" again picks
            up right where it left off instead of starting over.
          </p>

          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => jumpClassSweep('prev')}
              disabled={classSweepClassIndex <= 1}
              className="flex-1 py-2 bg-white border border-drug-border text-drug-text font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              ⏮ Previous class
            </button>
            <button
              onClick={() => jumpClassSweep('next')}
              className="flex-1 py-2 bg-white border border-drug-border text-drug-text font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Next class ⏭
            </button>
          </div>

          <button
            onClick={stopClassSweep}
            className="w-full py-2.5 bg-red-50 border border-red-200 text-red-700 font-bold rounded-lg hover:bg-red-100 transition-colors"
          >
            ⏹ Stop
          </button>
        </div>
      </div>
    );
  }

  // Done
  return (
    <div className={`mb-6 rounded-xl border p-5 ${classSweepSummary.stopped ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-center gap-2 font-bold text-drug-text mb-2">
        {classSweepSummary.stopped ? <AlertTriangle className="w-5 h-5 text-gray-500" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
        {classSweepSummary.stopped ? 'Class Sweep stopped' : 'Class Sweep complete'}
      </div>
      <p className="text-sm text-drug-muted mb-3">
        {classSweepSummary.resumedFrom ? `Resumed from class #${classSweepSummary.resumedFrom + 1} · ` : ''}
        Covered {classSweepSummary.classesCovered} of {classSweepSummary.classesTotal} classes ·
        <span className="text-green-700 font-semibold"> {classSweepSummary.totalSaved} new drugs saved</span>
        {classSweepSummary.totalExisting > 0 ? ` · ${classSweepSummary.totalExisting} already in database` : ''}
        {classSweepSummary.totalFailed > 0 ? ` · ${classSweepSummary.totalFailed} failed` : ''}
      </p>
      {classSweepSummary.stopped && (
        <p className="text-xs text-drug-muted mb-3">
          Stopped partway through — tapping "Run again" will pick up right where this left off.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={dismissClassSweepSummary}
          className="px-4 py-2 bg-white border border-drug-border rounded-lg text-sm font-semibold hover:bg-gray-50"
        >
          Dismiss
        </button>
        <button
          onClick={() => startClassSweep(allClasses, endpoint)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
        >
          <Sparkles className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> Run again
        </button>
      </div>
    </div>
  );
}

export default function AllClassesPage() {
  const { drugs, loading, invalidateCache } = useDrugs();
  const { provider } = useAiProvider();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // ── Merge duplicate drug classes ────────────────────────────────────────
  // Admin picks 2+ class labels that mean the same thing (e.g. "Anticoagulant"
  // / "Anticoagulants"), chooses which one to keep, and every drug carrying
  // any of the duplicate labels is re-labeled to it. Global — a drug's class
  // isn't scoped to one condition or system, so the merge isn't either.
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState(() => new Set());
  const [primaryMergeClass, setPrimaryMergeClass] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeResult, setMergeResult] = useState(null);

  const toggleMergeMode = () => {
    setMergeMode(m => !m);
    setSelectedForMerge(new Set());
    setPrimaryMergeClass(null);
    setMergeError('');
    setMergeResult(null);
  };

  const handleToggleMergeSelect = (className) => {
    setSelectedForMerge(prev => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
        if (primaryMergeClass === className) setPrimaryMergeClass(null);
      } else {
        next.add(className);
      }
      return next;
    });
  };

  const handleConfirmMerge = async () => {
    if (!primaryMergeClass || selectedForMerge.size < 2) return;
    const duplicateNames = [...selectedForMerge].filter(c => c !== primaryMergeClass);
    if (!window.confirm(
      `Merge ${duplicateNames.map(l => `"${l}"`).join(', ')} into "${primaryMergeClass}"?\n\n` +
      `Every drug carrying one of the merged-away class labels will be re-labeled to the kept one, everywhere in the app. This cannot be undone.`
    )) return;

    setMerging(true);
    setMergeError('');
    try {
      const result = await mergeDrugClasses(primaryMergeClass, duplicateNames, drugs);
      setMergeResult({ ...result, primaryLabel: primaryMergeClass });
      setSelectedForMerge(new Set());
      setPrimaryMergeClass(null);
      setMergeMode(false);
      invalidateCache();
    } catch (err) {
      setMergeError(`MERGE FAILED: ${err.code ? `[${err.code}] ` : ''}${err.message || 'Unknown error'}`);
    } finally {
      setMerging(false);
    }
  };

  const classRows = useMemo(() => {
    const map = new Map();
    drugs.forEach(d => {
      const cls = d.drug_class || 'Unknown';
      if (!map.has(cls)) map.set(cls, { className: cls, count: 0, incomplete: 0 });
      const row = map.get(cls);
      row.count += 1;
      if (!isDrugComplete(d)) row.incomplete += 1;
    });
    return [...map.values()].sort((a, b) => a.className.localeCompare(b.className));
  }, [drugs]);

  const allClasses = useMemo(() => classRows.map(r => r.className), [classRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classRows;
    return classRows.filter(r => r.className.toLowerCase().includes(q));
  }, [classRows, search]);

  return (
    <div className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${mergeMode ? 'pb-56' : ''}`}>
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/admin'))}
        className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-blue-50">
          <Filter className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">All Drug Classes</h1>
          <p className="text-drug-muted text-sm mt-0.5">
            {loading ? 'Loading…' : `${classRows.length} classes · ${drugs.length} drugs`}
          </p>
        </div>
        {isAdmin && !loading && (
          <button
            onClick={toggleMergeMode}
            title="Select two or more class labels that mean the same thing (e.g. 'Anticoagulant' / 'Anticoagulants') and fold them into one"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold flex-shrink-0 disabled:opacity-50 ${
              mergeMode ? 'text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1.5 rounded-lg' : 'text-amber-600 hover:text-amber-800'
            }`}
          >
            <Merge className="w-3.5 h-3.5" />
            {mergeMode ? 'Cancel Merge' : 'Merge Duplicates'}
          </button>
        )}
      </div>

      {mergeMode && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Tap two or more classes below that mean the same thing, then pick which label to keep.
        </div>
      )}

      {/* AI Insight — always on top of the page */}
      {!loading && <ClassSweepInsightCard allClasses={allClasses} endpoint={provider.endpoint} />}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-drug-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search classes…"
          className="w-full pl-10 pr-4 py-2.5 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* Class list */}
      {loading ? (
        <div className="text-center py-16 text-drug-muted">Loading…</div>
      ) : (
        <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
          {filteredRows.map((row, i) => {
            const isSelected = selectedForMerge.has(row.className);
            const rowContent = (
              <>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-drug-text truncate">{row.className}</p>
                  <p className="text-xs text-drug-muted">
                    {row.count} drug{row.count !== 1 ? 's' : ''}
                    {row.incomplete > 0 && (
                      <span className="text-amber-600 font-semibold"> · {row.incomplete} incomplete</span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
              </>
            );
            if (mergeMode) {
              return (
                <button
                  key={row.className}
                  type="button"
                  onClick={() => handleToggleMergeSelect(row.className)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                    i !== filteredRows.length - 1 ? 'border-b border-drug-border' : ''
                  } ${isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                >
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'bg-amber-600 border-amber-600' : 'border-drug-border'
                    }`}
                  >
                    {isSelected && <CheckCircle className="w-4 h-4 text-white" fill="currentColor" />}
                  </span>
                  {rowContent}
                </button>
              );
            }
            return (
              <Link
                key={row.className}
                to={`/browse?class=${encodeURIComponent(row.className)}`}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                  i !== filteredRows.length - 1 ? 'border-b border-drug-border' : ''
                }`}
              >
                {rowContent}
              </Link>
            );
          })}
          {filteredRows.length === 0 && (
            <div className="text-center py-10 text-drug-muted text-sm">No classes match "{search}".</div>
          )}
        </div>
      )}

      {/* Floating merge-mode toggle — always well clear of any bottom nav
          since AdminLayout has no mobile tab bar, but kept above other
          fixed UI (z-50) and safe-area aware regardless. */}
      {isAdmin && !loading && !mergeMode && (
        <button
          onClick={toggleMergeMode}
          title="Select two or more class labels that mean the same thing and fold them into one"
          className="fixed right-4 z-50 inline-flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-amber-600 text-white text-sm font-semibold shadow-lg hover:bg-amber-700"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <Merge className="w-4 h-4" />
          Merge Duplicates
        </button>
      )}

      {/* Selection / confirm bar */}
      {mergeMode && (
        <div className="fixed left-0 right-0 bottom-0 z-50 px-4 sm:px-6 lg:px-8 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="max-w-3xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Merge mode</span>
              <button
                onClick={toggleMergeMode}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
            {selectedForMerge.size === 0 && (
              <p className="text-sm text-amber-800">
                Tap two or more classes above that mean the same thing.
              </p>
            )}
            {selectedForMerge.size === 1 && (
              <p className="text-sm text-amber-800">
                Select at least one more class to merge with — 1 selected so far.
              </p>
            )}
            {selectedForMerge.size >= 2 && (
              <>
                <p className="text-sm font-semibold text-amber-900 mb-2">
                  {selectedForMerge.size} selected — choose which label to keep:
                </p>
                <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                  {classRows
                    .filter(r => selectedForMerge.has(r.className))
                    .map(r => (
                      <label key={r.className} className="flex items-center gap-2 text-sm text-drug-text cursor-pointer">
                        <input
                          type="radio"
                          name="merge-primary-class"
                          checked={primaryMergeClass === r.className}
                          onChange={() => setPrimaryMergeClass(r.className)}
                        />
                        <span>{r.className}</span>
                        <span className="text-xs text-drug-muted">({r.count} drug{r.count !== 1 ? 's' : ''})</span>
                      </label>
                    ))}
                </div>
                <button
                  onClick={handleConfirmMerge}
                  disabled={!primaryMergeClass || merging}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg"
                >
                  <Merge className="w-3.5 h-3.5" />
                  {merging ? 'Merging…' : `Merge ${selectedForMerge.size - 1} into ${primaryMergeClass || 'selected'}`}
                </button>
              </>
            )}
            {mergeError && (
              <p className="mt-3 text-xs text-red-600 font-medium">{mergeError}</p>
            )}
          </div>
        </div>
      )}

      {mergeResult && !mergeMode && (
        <p className="mt-3 text-xs text-green-700 font-medium">
          ✓ Merged {mergeResult.classesRemoved} class{mergeResult.classesRemoved !== 1 ? 'es' : ''} into "{mergeResult.primaryLabel}" — {mergeResult.drugsUpdated} drug{mergeResult.drugsUpdated !== 1 ? 's' : ''} re-labeled.
        </p>
      )}
    </div>
  );
}
