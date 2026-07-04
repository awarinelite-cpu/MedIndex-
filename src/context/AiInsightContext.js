// src/context/AiInsightContext.js
//
// Runs the "complete all incomplete drugs" job as a background process that
// lives above the router, so it keeps running (and the floating widget stays
// visible) no matter which page the admin navigates to.
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { generateDrugOnce, saveParsedDrug, getMissingGroups } from '../utils/aiDrugSave';

function isIncomplete(drug) {
  return getMissingGroups(drug).length > 0;
}

const CONCURRENCY = 4;
async function parallelMap(items, fn, concurrency = CONCURRENCY) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

const AiInsightContext = createContext(null);

export function AiInsightProvider({ children }) {
  const [running,     setRunning]     = useState(false);
  const [progress,    setProgress]    = useState({ done: 0, total: 0 });
  const [currentName, setCurrentName] = useState(null);
  const [summary,     setSummary]     = useState(null); // set once a run finishes/stops
  const abortRef = useRef(false);

  // drugsArg: optional pre-fetched incomplete drug list (e.g. from AdminPage's
  // already-loaded state). If omitted, fetches fresh from Firestore so this
  // can be triggered from anywhere, not just while the drug list is loaded.
  const startGlobalFix = useCallback(async (drugsArg) => {
    if (running) return;
    abortRef.current = false;
    setSummary(null);

    let list = drugsArg;
    if (!list) {
      const snap = await getDocs(collection(db, 'drugs'));
      const all = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
      list = all.filter(isIncomplete);
    }
    if (list.length === 0) return;

    setRunning(true);
    setProgress({ done: 0, total: list.length });

    let done = 0, succeeded = 0, stillIncomplete = 0, failed = 0;

    await parallelMap(list, async (drug) => {
      if (abortRef.current) return;
      setCurrentName(drug.generic_name);
      try {
        let { parsed, complete, missing } = await generateDrugOnce({
          genericName: drug.generic_name, drugClass: drug.drug_class,
        });
        if (!complete) {
          const retry = await generateDrugOnce({ genericName: drug.generic_name, drugClass: drug.drug_class });
          if (retry.missing.length <= missing.length) { parsed = retry.parsed; complete = retry.complete; missing = retry.missing; }
        }
        await saveParsedDrug({ genericName: drug.generic_name, drugClass: drug.drug_class, parsed });
        complete ? succeeded++ : stillIncomplete++;
      } catch (e) {
        failed++;
      } finally {
        done++;
        setProgress({ done, total: list.length });
      }
    });

    const stopped = abortRef.current;
    setRunning(false);
    setCurrentName(null);
    setSummary({ succeeded, stillIncomplete, failed, stopped, total: list.length });
  }, [running]);

  const stopGlobalFix   = useCallback(() => { abortRef.current = true; }, []);
  const dismissSummary  = useCallback(() => setSummary(null), []);

  return (
    <AiInsightContext.Provider value={{
      running, progress, currentName, summary,
      startGlobalFix, stopGlobalFix, dismissSummary,
    }}>
      {children}
      <GlobalAiInsightWidget />
    </AiInsightContext.Provider>
  );
}

export function useAiInsight() {
  const ctx = useContext(AiInsightContext);
  if (!ctx) throw new Error('useAiInsight must be used within an AiInsightProvider');
  return ctx;
}

// ── Floating widget: visible on every page while a background run is active ──
function GlobalAiInsightWidget() {
  const { running, progress, currentName, summary, stopGlobalFix, dismissSummary } = useContext(AiInsightContext);

  if (!running && !summary) return null;

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-72 bg-gray-900 text-white rounded-2xl p-4 shadow-2xl">
      {running ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold text-sm">AI Insight running…</span>
          </div>
          <div className="text-xs text-gray-400 mb-2 truncate">
            {progress.done}/{progress.total} drugs{currentName ? ` · ${currentName}` : ''}
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <button
            onClick={stopGlobalFix}
            className="text-xs font-semibold border border-gray-600 text-gray-300 rounded-lg px-3 py-1 hover:bg-gray-800 transition-colors"
          >
            Stop
          </button>
        </>
      ) : summary && (
        <>
          <div className="font-bold text-sm mb-1">
            {summary.stopped ? '⏹ AI Insight stopped' : '✅ AI Insight complete'}
          </div>
          <div className="text-xs text-gray-400 mb-3">
            {summary.succeeded} completed
            {summary.stillIncomplete ? `, ${summary.stillIncomplete} still incomplete` : ''}
            {summary.failed ? `, ${summary.failed} failed` : ''}
          </div>
          <button
            onClick={dismissSummary}
            className="text-xs font-semibold border border-gray-600 text-gray-300 rounded-lg px-3 py-1 hover:bg-gray-800 transition-colors"
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
