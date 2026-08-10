// src/context/AiInsightContext.js
//
// Runs the "complete all incomplete drugs" job as a background process that
// lives above the router, so it keeps running (and the floating widget stays
// visible) no matter which page the admin navigates to.
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { generateDrugOnce, saveParsedDrug, getMissingGroups, fetchAiDrugText, saveAiDrugToDatabase, slugifyDrugName, fetchConditionDrugList, fetchClassDrugList, fetchConditionClinicalInfo } from '../utils/aiDrugSave';
import { findRealDrugImage, saveFoundDrugImage } from '../utils/generateDrugImage';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { parseConditionClinicalInfo } from '../utils/parseConditionClinicalInfo';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from './AuthContext';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { useConditionClinicalInfo, saveConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import { drugMatchesConditionKeywords, SYSTEM_CONDITIONS } from '../data/systemConditions';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { GripHorizontal, AlertTriangle, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

function isIncomplete(drug) {
  return getMissingGroups(drug).length > 0;
}

// ── Class Sweep checkpoint — remembers which class to resume from next
// time, so stopping (or a page reload / logout mid-run) doesn't throw away
// progress. Keyed against the exact class list it was built from; if the
// list of classes has changed since, the old checkpoint no longer applies
// and a fresh sweep starts from the top instead.
const CLASS_SWEEP_CHECKPOINT_KEY = 'medindex_class_sweep_checkpoint_v1';

function loadClassSweepCheckpoint() {
  try {
    const raw = localStorage.getItem(CLASS_SWEEP_CHECKPOINT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveClassSweepCheckpoint(queue, index) {
  try {
    localStorage.setItem(CLASS_SWEEP_CHECKPOINT_KEY, JSON.stringify({ queue, index }));
  } catch { /* ignore quota/storage errors — worst case it just restarts */ }
}
function clearClassSweepCheckpoint() {
  try { localStorage.removeItem(CLASS_SWEEP_CHECKPOINT_KEY); } catch {}
}
function sameQueue(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ── Clinical Info Sweep checkpoint — same idea as the class sweep's, keyed
// by condition id instead of class name so it's still valid even if new
// conditions get added to earlier systems while paused (ids don't shift).
const CLINICAL_SWEEP_CHECKPOINT_KEY = 'medindex_clinical_sweep_checkpoint_v1';

function loadClinicalSweepCheckpoint() {
  try {
    const raw = localStorage.getItem(CLINICAL_SWEEP_CHECKPOINT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveClinicalSweepCheckpoint(queueIds, index) {
  try {
    localStorage.setItem(CLINICAL_SWEEP_CHECKPOINT_KEY, JSON.stringify({ queueIds, index }));
  } catch { /* ignore quota/storage errors — worst case it just restarts */ }
}
function clearClinicalSweepCheckpoint() {
  try { localStorage.removeItem(CLINICAL_SWEEP_CHECKPOINT_KEY); } catch {}
}

// ── Image Sweep checkpoint — same idea, keyed by drug id so a paused run
// resumes at the right spot even if new drugs were added to the database
// while it was stopped (they just won't be in the old queue, and get
// picked up on the next fresh sweep).
const IMAGE_SWEEP_CHECKPOINT_KEY = 'medindex_image_sweep_checkpoint_v1';

function loadImageSweepCheckpoint() {
  try {
    const raw = localStorage.getItem(IMAGE_SWEEP_CHECKPOINT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveImageSweepCheckpoint(queueIds, index) {
  try {
    localStorage.setItem(IMAGE_SWEEP_CHECKPOINT_KEY, JSON.stringify({ queueIds, index }));
  } catch { /* ignore quota/storage errors — worst case it just restarts */ }
}
function clearImageSweepCheckpoint() {
  try { localStorage.removeItem(IMAGE_SWEEP_CHECKPOINT_KEY); } catch {}
}

// Same name-normalisation used by SystemPage's condition matching, duplicated
// here (rather than imported) so this context has no dependency on any page.
function normalizeDrugName(name) {
  let n = (name || '').trim().toLowerCase();
  n = n.replace(/[\s/.+-]+/g, ' ').trim();
  n = n.replace(/\bco (\w)/g, 'co$1');
  n = n
    .replace(/\bclavulanic acid\b/g, 'clavulanate')
    .replace(/\b(hydrochloride|hcl|sodium|potassium|sulfate|sulphate|phosphate|maleate|mesylate|besylate|succinate|tartrate|dihydrate|monohydrate)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

const CONCURRENCY = 8; // paid Gemini tier — safe to run 8 in parallel
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
  const { isAdmin } = useAuth();
  const [running,     setRunning]     = useState(false);
  const [progress,    setProgress]    = useState({ done: 0, total: 0 });
  const [currentName, setCurrentName] = useState(null);
  const [summary,     setSummary]     = useState(null); // set once a run finishes/stops
  const abortRef = useRef(false);
  const listenersRef = useRef(new Set());

  // Lets any currently-mounted page (e.g. AdminPage) hear about each drug as
  // it's fixed, so its own local state/counters stay in sync live instead of
  // only refreshing once the whole background run finishes.
  const subscribeFix = useCallback((cb) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  // drugsArg: optional pre-fetched incomplete drug list (e.g. from AdminPage's
  // already-loaded state). If omitted, fetches fresh from Firestore so this
  // can be triggered from anywhere, not just while the drug list is loaded.
  const startGlobalFix = useCallback(async (drugsArg, endpoint = '/api/drug-ai-details') => {
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
          genericName: drug.generic_name, drugClass: drug.drug_class, endpoint,
        });
        if (!complete) {
          const retry = await generateDrugOnce({ genericName: drug.generic_name, drugClass: drug.drug_class, endpoint });
          if (retry.missing.length <= missing.length) { parsed = retry.parsed; complete = retry.complete; missing = retry.missing; }
        }
        await saveParsedDrug({ genericName: drug.generic_name, drugClass: drug.drug_class, parsed, existingDrug: drug });
        complete ? succeeded++ : stillIncomplete++;
        listenersRef.current.forEach(cb => cb({
          firestoreId: drug.firestoreId, generic_name: drug.generic_name,
          drug_class: drug.drug_class, parsed, complete,
        }));
      } catch (e) {
        failed++;
        listenersRef.current.forEach(cb => cb({
          firestoreId: drug.firestoreId, generic_name: drug.generic_name,
          drug_class: drug.drug_class, error: e.message,
        }));
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

  // ── Second, independent background job: "Save All" for a condition's AI
  // drug list. Previously this ran as local component state inside
  // SystemPage's AiConditionFallback, which meant collapsing the accordion
  // or opening a different condition (both unmount that component) killed
  // all visible progress and left nothing coordinating the loop. Lives here
  // instead so it survives navigation exactly like the drug-completion job.
  const [conditionRunning,     setConditionRunning]     = useState(false);
  const [conditionProgress,    setConditionProgress]    = useState({ done: 0, total: 0 });
  const [conditionCurrentName, setConditionCurrentName] = useState(null);
  const [conditionSummary,     setConditionSummary]     = useState(null);
  const [conditionLabel,       setConditionLabel]       = useState('');
  const conditionAbortRef  = useRef(false);
  // Mirrors conditionRunning but always current inside closures/refs below —
  // React state can be stale by one render inside the queue-continuation
  // logic, a plain ref never is.
  const conditionRunningRef = useRef(false);

  const startConditionSave = useCallback(async ({ items, conditionId, label, conditionKeywords, existingByName, endpoint = '/api/drug-ai-details' }) => {
    if (conditionRunningRef.current || !items || items.length === 0) return;
    conditionRunningRef.current = true;
    conditionAbortRef.current = false;
    setConditionSummary(null);
    setConditionLabel(label);
    setConditionRunning(true);
    setConditionProgress({ done: 0, total: items.length });

    let done = 0, saved = 0, reused = 0, failed = 0, flaggedForReview = 0;
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      if (conditionAbortRef.current) break;
      const item = items[i];
      setConditionCurrentName(item.name);

      const existing = existingByName.get(normalizeDrugName(item.name));
      if (existing) {
        // The AI mentioned this name and it happens to already be in the
        // database — but that alone doesn't mean it's actually indicated
        // for THIS condition (it may be in the DB for something else
        // entirely). Check its stored indications against the condition's
        // keywords before tagging it on; a null result means we have no
        // keywords to check against, so fall back to trusting the AI.
        // Also pass the AI's own note for this item (item.note) — its
        // one-line justification for why THIS drug belongs on THIS
        // condition's list, already generated in the same response, rather
        // than discarding it and checking only the drug's general-purpose
        // stored fields (which may predate/never mention a more specific
        // or less common indication the AI is correctly aware of).
        const relevant = drugMatchesConditionKeywords(existing, conditionKeywords, item.note);
        if (relevant === false) {
          // Don't just drop it — the AI still thinks it belongs here, so
          // save the link as UNCONFIRMED (pending_condition_tags) instead
          // of a confirmed condition_tags entry. An admin reviews these
          // and either confirms (promotes to condition_tags) or rejects
          // (removes) — nothing gets silently lost.
          try {
            await updateDoc(doc(db, 'drugs', existing.id || slugifyDrugName(item.name)), {
              pending_condition_tags: arrayUnion(conditionId),
              last_updated: serverTimestamp(),
            });
            flaggedForReview++;
          } catch (e) {
            errors.push({ name: item.name, message: `Failed to flag for review: ${e.message}` });
            failed++;
          }
          done++;
          setConditionProgress({ done, total: items.length });
          continue;
        }
        try {
          await updateDoc(doc(db, 'drugs', existing.id || slugifyDrugName(item.name)), {
            condition_tags: arrayUnion(conditionId),
            last_updated:   serverTimestamp(),
          });
          reused++;
        } catch (e) {
          errors.push({ name: item.name, message: `Failed to link existing drug: ${e.message}` });
          failed++;
        }
      } else {
        const drugClassForItem = item.subclass || undefined;
        try {
          const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: drugClassForItem, endpoint });
          const result = await saveAiDrugToDatabase({
            genericName: item.name, drugClass: drugClassForItem, text: itemText, overwrite: true,
          });
          if (result.status === 'saved') {
            saved++;
            try {
              // saveAiDrugToDatabase already auto-tags this drug against every
              // system's conditions — this just guarantees it's tagged onto
              // THIS specific condition even if keyword matching missed it
              // (e.g. the AI listed it here but its indications text is vague).
              await updateDoc(doc(db, 'drugs', result.id || slugifyDrugName(item.name)), { condition_tags: arrayUnion(conditionId) });
            } catch { /* tag is best-effort */ }
          }
        } catch (e) {
          errors.push({ name: item.name, message: e.message || 'Failed to save.' });
          failed++;
        }
        await new Promise(r => setTimeout(r, 350));
      }

      done++;
      setConditionProgress({ done, total: items.length });
    }

    const stopped = conditionAbortRef.current;
    conditionRunningRef.current = false;
    setConditionRunning(false);
    setConditionCurrentName(null);
    setConditionSummary({ saved, reused, failed, flaggedForReview, errors, stopped, total: items.length, label });

    // A newly-created or empty condition may have been queued up while this
    // job was running — pick up the next one automatically.
    processAutoFillQueueRef.current?.();
  }, []);

  const stopConditionSave      = useCallback(() => { conditionAbortRef.current = true; }, []);
  const dismissConditionSummary = useCallback(() => setConditionSummary(null), []);

  // ── Third, independent background job: "Class Sweep" — works through
  // EVERY drug class one at a time, asking the AI to search hard for
  // medications belonging to that class, and auto-saving the ones that
  // aren't already in the database. When a class finishes, the next class
  // in the queue starts automatically — no admin click needed per class.
  // Lives here (not on AdminPage) for the same reason as the condition job:
  // it must keep running in the background across navigation, and only
  // stop when the admin explicitly stops it or the app session ends
  // (logout / tab close).
  const [classSweepRunning,        setClassSweepRunning]        = useState(false);
  const [classSweepClassIndex,     setClassSweepClassIndex]     = useState(0);
  const [classSweepClassTotal,     setClassSweepClassTotal]     = useState(0);
  const [classSweepCurrentClass,   setClassSweepCurrentClass]   = useState(null);
  const [classSweepItemProgress,   setClassSweepItemProgress]   = useState({ done: 0, total: 0 });
  const [classSweepCurrentDrug,    setClassSweepCurrentDrug]    = useState(null);
  const [classSweepLog,            setClassSweepLog]            = useState([]); // [{className, saved, existing, failed}]
  const [classSweepSummary,        setClassSweepSummary]        = useState(null);
  // True for the lifetime of a run that started from a saved checkpoint
  // rather than class #1 — lets the pop card show "Resumed…" for that run.
  const [classSweepResumed,        setClassSweepResumed]        = useState(false);
  const classSweepAbortRef  = useRef(false);
  const classSweepRunningRef = useRef(false);
  // Pending manual navigation request from the pop card's Previous/Next
  // buttons — a 0-based target index into the queue, or null when no jump
  // is pending. Checked between drugs (and between classes) so a tap takes
  // effect right away instead of waiting for the current class to finish.
  const classSweepJumpRef = useRef(null);
  // Mirrors classSweepClassIndex (1-based "class currently in progress")
  // so jump handlers always read the live value, not a stale closure.
  const classSweepClassIndexRef = useRef(0);
  useEffect(() => { classSweepClassIndexRef.current = classSweepClassIndex; }, [classSweepClassIndex]);

  const startClassSweep = useCallback(async (classes, endpoint = '/api/drug-ai-details') => {
    if (classSweepRunningRef.current || !classes || classes.length === 0) return;
    classSweepRunningRef.current = true;
    classSweepAbortRef.current = false;
    classSweepJumpRef.current = null;
    setClassSweepSummary(null);
    setClassSweepLog([]);

    // Alphabetical order gives predictable, resumable-feeling progress.
    const queue = [...new Set(classes.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    setClassSweepClassTotal(queue.length);

    // Resume from the last checkpoint if it was built from this exact same
    // class list — otherwise (list has changed, or there's nothing saved)
    // start fresh from the top instead of guessing.
    const checkpoint = loadClassSweepCheckpoint();
    let startAt = (checkpoint && sameQueue(checkpoint.queue, queue) && checkpoint.index > 0 && checkpoint.index < queue.length)
      ? checkpoint.index
      : 0;

    setClassSweepClassIndex(startAt);
    setClassSweepResumed(startAt > 0);
    setClassSweepRunning(true);

    let totalSaved = 0, totalExisting = 0, totalFailed = 0;
    const perClassLog = [];
    // Local lookup pool, refreshed from Firestore data at the start and kept
    // in sync as we save — so a drug found under one class isn't regenerated
    // again if it happens to also appear in a later class's AI list.
    const lookupPool = [...(allDrugsRef.current || [])];
    const existingByName = new Map();
    lookupPool.forEach(d => { if (d.generic_name) existingByName.set(normalizeDrugName(d.generic_name), d); });

    let ci = startAt;
    while (ci < queue.length) {
      if (classSweepAbortRef.current) break;
      const className = queue[ci];
      setClassSweepCurrentClass(className);
      setClassSweepClassIndex(ci + 1);
      setClassSweepItemProgress({ done: 0, total: 0 });

      let saved = 0, existing = 0, failed = 0;
      try {
        const knownDrugNames = lookupPool
          .filter(d => (d.drug_class || '').toLowerCase() === className.toLowerCase())
          .map(d => d.generic_name).filter(Boolean);

        const full = await fetchClassDrugList({ className, knownDrugNames, endpoint });
        const items = parseAiDrugList(full);
        setClassSweepItemProgress({ done: 0, total: items.length });

        for (let i = 0; i < items.length; i++) {
          // A pending Previous/Next tap breaks out of this class right away
          // rather than finishing every drug in it first.
          if (classSweepAbortRef.current || classSweepJumpRef.current !== null) break;
          const item = items[i];
          setClassSweepCurrentDrug(item.name);

          if (existingByName.has(normalizeDrugName(item.name))) {
            existing++;
          } else {
            try {
              // drugClass is always forced to the class currently being
              // swept — never left to the AI's own per-item subclass guess
              // — so every drug saved here is guaranteed to be filed under
              // exactly the class it was found for.
              const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: className, endpoint });
              const result = await saveAiDrugToDatabase({
                genericName: item.name, drugClass: className, text: itemText, overwrite: true,
              });
              if (result.status === 'saved') {
                saved++;
                existingByName.set(normalizeDrugName(item.name), { generic_name: item.name, drug_class: className });
              }
            } catch (e) {
              failed++;
            }
            await new Promise(r => setTimeout(r, 350));
          }
          setClassSweepItemProgress({ done: i + 1, total: items.length });
        }
      } catch (e) {
        failed++; // class-level failure — e.g. the AI list request itself failed
      }

      totalSaved += saved; totalExisting += existing; totalFailed += failed;
      perClassLog.push({ className, saved, existing, failed });
      setClassSweepLog([...perClassLog]);
      setClassSweepCurrentDrug(null);

      // A manual Previous/Next tap takes priority over just continuing in
      // sequence; otherwise carry on to the next class as normal.
      if (classSweepJumpRef.current !== null) {
        ci = Math.max(0, classSweepJumpRef.current);
        classSweepJumpRef.current = null;
      } else {
        ci += 1;
      }

      // Checkpoint after every class so a Stop, a page reload, or logging
      // out mid-run resumes right here next time instead of restarting
      // from class #1.
      saveClassSweepCheckpoint(queue, ci);
    }

    const stopped = classSweepAbortRef.current;
    classSweepRunningRef.current = false;
    setClassSweepRunning(false);
    setClassSweepCurrentClass(null);
    // Reached the natural end of the list with nothing left to resume —
    // clear the checkpoint so the next "Run again" starts fresh.
    if (!stopped && ci >= queue.length) clearClassSweepCheckpoint();
    setClassSweepSummary({
      totalSaved, totalExisting, totalFailed, stopped,
      classesCovered: perClassLog.length, classesTotal: queue.length, perClassLog,
      resumedFrom: startAt > 0 ? startAt : null,
    });
  }, []);

  const stopClassSweep           = useCallback(() => { classSweepAbortRef.current = true; }, []);
  const dismissClassSweepSummary = useCallback(() => setClassSweepSummary(null), []);

  // Manual navigation from the pop card — 'next' skips ahead to the class
  // right after the one in progress, 'prev' goes back to the one before
  // it. Either way the sweep just keeps going sequentially from the new
  // spot afterwards, same as normal.
  const jumpClassSweep = useCallback((direction) => {
    if (!classSweepRunningRef.current) return;
    const current0 = classSweepClassIndexRef.current - 1; // 1-based -> 0-based
    classSweepJumpRef.current = direction === 'next' ? current0 + 1 : current0 - 1;
  }, []);

  // ── Fourth, independent background job: "Clinical Info Sweep" — walks
  // EVERY condition in EVERY anatomical system (static seed + admin-added
  // custom conditions) and generates the Introduction/Types/Organ
  // System/Etiology/Pathophysiology/Clinical Manifestation/Diagnosis/
  // Medical Management panel for any that don't have one yet. Unlike
  // SystemPage's per-system "Add Clinical Info to All" button (which only
  // covers whichever system is currently open and dies if you navigate
  // away), this one is a true "run it for everything" job that survives
  // navigation exactly like the class sweep.
  const { customConditionsBySystem, hiddenConditionIdsBySystem } = useCustomConditions();
  const { clinicalInfoByCondition }  = useConditionClinicalInfo();
  const clinicalInfoRef = useRef({});
  useEffect(() => { clinicalInfoRef.current = clinicalInfoByCondition; }, [clinicalInfoByCondition]);

  // Flat index of every condition that exists anywhere, rebuilt whenever the
  // custom-conditions doc changes (cheap — a few hundred entries at most).
  const allConditionsIndex = React.useMemo(() => {
    const list = [];
    for (const system of ANATOMICAL_SYSTEMS) {
      const base   = SYSTEM_CONDITIONS[system.id] || [];
      const custom = customConditionsBySystem[system.id] || [];
      const hidden = new Set(hiddenConditionIdsBySystem[system.id] || []);
      for (const c of [...base, ...custom]) {
        if (hidden.has(c.id)) continue;
        list.push({ id: c.id, label: c.label, systemName: system.name });
      }
    }
    list.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'en', { sensitivity: 'base' }));
    return list;
  }, [customConditionsBySystem, hiddenConditionIdsBySystem]);

  // Live count of conditions still missing clinical info — lets the trigger
  // button show an accurate "(N)" before the sweep even starts, and updates
  // in real time if another admin fills some in concurrently.
  const clinicalSweepEligibleCount = React.useMemo(
    () => allConditionsIndex.filter(c => !clinicalInfoByCondition[c.id]).length,
    [allConditionsIndex, clinicalInfoByCondition]
  );
  const clinicalSweepTotalConditions = allConditionsIndex.length;

  const [clinicalSweepRunning,      setClinicalSweepRunning]      = useState(false);
  const [clinicalSweepIndex,        setClinicalSweepIndex]        = useState(0); // 1-based, current/just-finished position in the queue
  const [clinicalSweepTotal,        setClinicalSweepTotal]        = useState(0);
  const [clinicalSweepCurrentLabel, setClinicalSweepCurrentLabel] = useState(null);
  const [clinicalSweepSummary,      setClinicalSweepSummary]      = useState(null);
  const [clinicalSweepResumed,      setClinicalSweepResumed]      = useState(false);
  const clinicalSweepAbortRef    = useRef(false);
  const clinicalSweepRunningRef  = useRef(false);
  const clinicalSweepJumpRef     = useRef(null);
  const clinicalSweepIndexRef    = useRef(0);
  useEffect(() => { clinicalSweepIndexRef.current = clinicalSweepIndex; }, [clinicalSweepIndex]);

  const startClinicalInfoSweep = useCallback(async (endpoint = '/api/drug-ai-details') => {
    if (clinicalSweepRunningRef.current) return;
    clinicalSweepRunningRef.current = true;
    clinicalSweepAbortRef.current = false;
    clinicalSweepJumpRef.current = null;
    setClinicalSweepSummary(null);

    // Snapshot the queue at start time — conditions already covered are
    // filtered out now, and re-checked individually below in case another
    // admin fills one in mid-sweep.
    const queue = allConditionsIndex.filter(c => !clinicalInfoRef.current[c.id]);
    if (queue.length === 0) {
      clinicalSweepRunningRef.current = false;
      setClinicalSweepTotal(0);
      setClinicalSweepSummary({ generated: 0, failed: 0, skipped: 0, stopped: false, total: 0 });
      return;
    }
    setClinicalSweepTotal(queue.length);

    const queueIds = queue.map(c => c.id);
    const checkpoint = loadClinicalSweepCheckpoint();
    let startAt = (checkpoint && sameQueue(checkpoint.queueIds, queueIds) && checkpoint.index > 0 && checkpoint.index < queue.length)
      ? checkpoint.index
      : 0;

    setClinicalSweepIndex(startAt);
    setClinicalSweepResumed(startAt > 0);
    setClinicalSweepRunning(true);

    let generated = 0, failed = 0, skipped = 0;
    let i = startAt;
    while (i < queue.length) {
      if (clinicalSweepAbortRef.current) break;
      const c = queue[i];
      setClinicalSweepIndex(i + 1);
      setClinicalSweepCurrentLabel(c.label);

      if (clinicalInfoRef.current[c.id]) {
        // Filled in by someone else since the queue was built — no need to
        // burn an AI call re-generating it.
        skipped++;
      } else {
        try {
          const full = await fetchConditionClinicalInfo({ conditionLabel: c.label, systemName: c.systemName, endpoint });
          const parsed = parseConditionClinicalInfo(full);
          await saveConditionClinicalInfo(c.id, parsed);
          generated++;
        } catch (e) {
          failed++;
        }
        await new Promise(r => setTimeout(r, 350));
      }

      if (clinicalSweepJumpRef.current !== null) {
        i = Math.max(0, clinicalSweepJumpRef.current);
        clinicalSweepJumpRef.current = null;
      } else {
        i += 1;
      }
      saveClinicalSweepCheckpoint(queueIds, i);
    }

    const stopped = clinicalSweepAbortRef.current;
    clinicalSweepRunningRef.current = false;
    setClinicalSweepRunning(false);
    setClinicalSweepCurrentLabel(null);
    if (!stopped && i >= queue.length) clearClinicalSweepCheckpoint();
    setClinicalSweepSummary({
      generated, failed, skipped, stopped, total: queue.length,
      resumedFrom: startAt > 0 ? startAt : null,
    });
  }, [allConditionsIndex]);

  const stopClinicalInfoSweep      = useCallback(() => { clinicalSweepAbortRef.current = true; }, []);
  const dismissClinicalSweepSummary = useCallback(() => setClinicalSweepSummary(null), []);
  const jumpClinicalSweep = useCallback((direction) => {
    if (!clinicalSweepRunningRef.current) return;
    const current0 = clinicalSweepIndexRef.current - 1;
    clinicalSweepJumpRef.current = direction === 'next' ? current0 + 1 : current0 - 1;
  }, []);

  // Referenced by several background jobs below (Image Sweep here, and the
  // condition auto-fill queue further down) — a live-synced ref mirror of
  // the full drug list plus its reactive source, declared up here so both
  // consumers can use it regardless of which one is defined first in the
  // file.
  const allDrugsRef = useRef([]);
  const { drugs: drugsForAutoFill } = useDrugs();
  useEffect(() => { allDrugsRef.current = drugsForAutoFill; }, [drugsForAutoFill]);

  // ── Fifth, independent background job: "Image Sweep" — walks every drug
  // that doesn't have an image yet and searches for a real, freely-licensed
  // photo (Wikimedia Commons / openFDA — same source as the manual "Find
  // Real Image" button). No AI-illustration fallback here: if no real image
  // turns up, that drug is just left blank rather than generating one, per
  // how this sweep is meant to be used. Auto-starts the first time an admin
  // logs in each session (see the effect below) and can also be started or
  // stopped manually, exactly like the other sweeps.
  const [imageSweepRunning,     setImageSweepRunning]     = useState(false);
  const [imageSweepIndex,       setImageSweepIndex]       = useState(0); // 1-based, current/just-finished position
  const [imageSweepTotal,       setImageSweepTotal]       = useState(0);
  const [imageSweepCurrentName, setImageSweepCurrentName] = useState(null);
  const [imageSweepSummary,     setImageSweepSummary]     = useState(null);
  const [imageSweepResumed,     setImageSweepResumed]     = useState(false);
  const imageSweepAbortRef   = useRef(false);
  const imageSweepRunningRef = useRef(false);
  const imageSweepJumpRef    = useRef(null);
  const imageSweepIndexRef   = useRef(0);
  useEffect(() => { imageSweepIndexRef.current = imageSweepIndex; }, [imageSweepIndex]);

  // Live count of drugs missing an image — lets the trigger button show an
  // accurate "(N)" before the sweep even starts, and lets the auto-start
  // effect below know whether there's anything worth kicking off.
  const imageSweepEligibleCount = React.useMemo(
    () => (drugsForAutoFill || []).filter(d => !d.image_url).length,
    [drugsForAutoFill]
  );

  const startImageSweep = useCallback(async () => {
    if (imageSweepRunningRef.current) return;
    imageSweepRunningRef.current = true;
    imageSweepAbortRef.current = false;
    imageSweepJumpRef.current = null;
    setImageSweepSummary(null);

    const queue = (allDrugsRef.current || [])
      .filter(d => !d.image_url && d.generic_name)
      .sort((a, b) => (a.generic_name || '').localeCompare(b.generic_name || '', 'en', { sensitivity: 'base' }));

    if (queue.length === 0) {
      imageSweepRunningRef.current = false;
      setImageSweepTotal(0);
      setImageSweepSummary({ found: 0, skipped: 0, failed: 0, stopped: false, total: 0 });
      return;
    }
    setImageSweepTotal(queue.length);

    const queueIds = queue.map(d => d.firestoreId || d.id);
    const checkpoint = loadImageSweepCheckpoint();
    let startAt = (checkpoint && sameQueue(checkpoint.queueIds, queueIds) && checkpoint.index > 0 && checkpoint.index < queue.length)
      ? checkpoint.index
      : 0;

    setImageSweepIndex(startAt);
    setImageSweepResumed(startAt > 0);
    setImageSweepRunning(true);

    let found = 0, skipped = 0, failed = 0;
    let i = startAt;
    while (i < queue.length) {
      if (imageSweepAbortRef.current) break;
      const drug = queue[i];
      setImageSweepIndex(i + 1);
      setImageSweepCurrentName(drug.generic_name);

      // Re-check live — another admin, or a previous run, may have already
      // added an image to this drug since the queue was built.
      const liveId = drug.firestoreId || drug.id;
      const live = (allDrugsRef.current || []).find(d => (d.firestoreId || d.id) === liveId);
      if (live?.image_url) {
        skipped++;
      } else {
        try {
          const result = await findRealDrugImage({ genericName: drug.generic_name });
          if (result) {
            await saveFoundDrugImage({ docId: liveId, found: result });
            found++;
          } else {
            skipped++; // no freely-licensed real image found — left blank, no AI fallback
          }
        } catch (e) {
          failed++;
        }
        // Be gentle with Wikimedia/openFDA rather than hammering them back-to-back.
        await new Promise(r => setTimeout(r, 400));
      }

      if (imageSweepJumpRef.current !== null) {
        i = Math.max(0, imageSweepJumpRef.current);
        imageSweepJumpRef.current = null;
      } else {
        i += 1;
      }
      saveImageSweepCheckpoint(queueIds, i);
    }

    const stopped = imageSweepAbortRef.current;
    imageSweepRunningRef.current = false;
    setImageSweepRunning(false);
    setImageSweepCurrentName(null);
    if (!stopped && i >= queue.length) clearImageSweepCheckpoint();
    setImageSweepSummary({
      found, skipped, failed, stopped, total: queue.length,
      resumedFrom: startAt > 0 ? startAt : null,
    });
  }, []);

  const stopImageSweep           = useCallback(() => { imageSweepAbortRef.current = true; }, []);
  const dismissImageSweepSummary = useCallback(() => setImageSweepSummary(null), []);
  const jumpImageSweep = useCallback((direction) => {
    if (!imageSweepRunningRef.current) return;
    const current0 = imageSweepIndexRef.current - 1;
    imageSweepJumpRef.current = direction === 'next' ? current0 + 1 : current0 - 1;
  }, []);

  // Auto-starts the Image Sweep the first time an admin is signed in during
  // this browser session — no click needed. Fires once drugsForAutoFill has
  // actually loaded (so it doesn't launch against an empty list) and never
  // fires again this session, so it doesn't restart every time the admin
  // navigates around or the drug list re-syncs. A manual "Image Sweep"
  // button (wherever it's wired up in the admin UI) still works normally on
  // top of this, whether or not the auto-run already happened.
  const hasAutoStartedImageSweepRef = useRef(false);
  useEffect(() => {
    if (!isAdmin) return;
    if (hasAutoStartedImageSweepRef.current) return;
    if (!drugsForAutoFill || drugsForAutoFill.length === 0) return;
    hasAutoStartedImageSweepRef.current = true;
    if (imageSweepEligibleCount > 0) startImageSweep();
  }, [isAdmin, drugsForAutoFill, imageSweepEligibleCount, startImageSweep]);

  // ── Auto-fill queue: conditions that should be populated with drugs
  // automatically, no admin click needed. Two things feed this queue:
  //   1. SystemPage enqueues a condition the moment it's created (single
  //      add or "Add All").
  //   2. SystemPage also sweeps the conditions for whatever system is
  //      currently open and enqueues any that already exist but have zero
  //      tagged drugs — each condition is only auto-attempted once ever
  //      (tracked in Firestore) so this doesn't re-run every visit or
  //      burn AI quota on a condition that legitimately has no matches.
  // Jobs run one at a time through the same startConditionSave used by the
  // manual "Save All" button, so progress shows in the same floating widget.
  const autoFillQueueRef = useRef([]); // [{ conditionId, label, systemName, endpoint }]
  // (allDrugsRef / drugsForAutoFill are declared earlier, above the Image
  // Sweep block, since that job also depends on them.)

  // ── Global pending-drug review queue ──────────────────────────────────
  // Every drug/condition pair sitting in pending_condition_tags, anywhere
  // in the database — flattened into one list so an admin can review them
  // one at a time from a single popup instead of hunting through each
  // condition's own page for its flagged drugs. Rebuilds live as drugs or
  // the custom-conditions doc change (both already streamed elsewhere in
  // this file), so a pair vanishes from the queue the moment it's
  // confirmed/rejected on any device.
  const conditionLabelById = React.useMemo(() => {
    const map = new Map();
    allConditionsIndex.forEach(c => map.set(c.id, c));
    return map;
  }, [allConditionsIndex]);

  const pendingReviewList = React.useMemo(() => {
    const list = [];
    (drugsForAutoFill || []).forEach(d => {
      (d.pending_condition_tags || []).forEach(conditionId => {
        const cond = conditionLabelById.get(conditionId);
        list.push({
          drugId: d.id,
          drugName: d.generic_name,
          drugClass: d.drug_class || '',
          conditionId,
          conditionLabel: cond?.label || conditionId,
          systemName: cond?.systemName || '',
        });
      });
    });
    return list;
  }, [drugsForAutoFill, conditionLabelById]);

  const confirmPendingReview = useCallback(async ({ drugId, conditionId }) => {
    await updateDoc(doc(db, 'drugs', drugId), {
      condition_tags: arrayUnion(conditionId),
      pending_condition_tags: arrayRemove(conditionId),
      last_updated: serverTimestamp(),
    });
  }, []);

  const rejectPendingReview = useCallback(async ({ drugId, conditionId }) => {
    await updateDoc(doc(db, 'drugs', drugId), {
      pending_condition_tags: arrayRemove(conditionId),
      last_updated: serverTimestamp(),
    });
  }, []);

  // Guards against a race that was silently dropping jobs: enqueueing
  // several conditions at once (e.g. "Add All", or the empty-condition
  // sweep finding 5 at once) called processAutoFillQueue() once per
  // condition. Since the AI fetch inside it is async, multiple calls could
  // each shift a different job off the queue before the first one had
  // actually set conditionRunningRef — so only the first job's
  // startConditionSave call ever "won" the run, and every other
  // already-shifted job got silently discarded when ITS OWN startConditionSave
  // call saw conditionRunningRef already true and bailed out. This lock
  // makes the whole "shift a job → fetch → hand off to startConditionSave"
  // sequence atomic, so extra concurrent calls just no-op instead of
  // stealing and losing a job.
  const queueLockRef = useRef(false);

  const processAutoFillQueue = useCallback(async () => {
    if (queueLockRef.current || conditionRunningRef.current) return;
    const job = autoFillQueueRef.current.shift();
    if (!job) return;

    queueLockRef.current = true;
    try {
      const lookupPool = allDrugsRef.current || [];
      const knownDrugNames = lookupPool.map(d => d.generic_name).filter(Boolean);
      const existingByName = new Map();
      lookupPool.forEach(d => { if (d.generic_name) existingByName.set(normalizeDrugName(d.generic_name), d); });

      const full = await fetchConditionDrugList({
        conditionLabel: job.label, systemName: job.systemName, knownDrugNames, endpoint: job.endpoint,
      });
      const items = parseAiDrugList(full);
      if (items.length > 0) {
        // Awaited fully — queueLockRef stays held for this job's entire
        // save run, not just the initial fetch, so nothing else can jump
        // the queue while it's in progress.
        await startConditionSave({ items, conditionId: job.conditionId, label: job.label, conditionKeywords: job.conditionKeywords, existingByName, endpoint: job.endpoint });
      }
    } catch (e) {
      console.warn('[autoFillQueue] failed for condition', job.label, e.message);
    } finally {
      queueLockRef.current = false;
    }
    // Whether this job saved something, found nothing, or errored — move on
    // to whatever's next in the queue.
    processAutoFillQueueRef.current?.();
  }, [startConditionSave]);

  const processAutoFillQueueRef = useRef(processAutoFillQueue);
  useEffect(() => { processAutoFillQueueRef.current = processAutoFillQueue; }, [processAutoFillQueue]);

  // Adds one condition to the auto-fill queue and kicks off processing.
  // Safe to call repeatedly — conditions already mid-queue or running just
  // get skipped by the caller's own dedup (see SystemPage).
  const enqueueAutoFillCondition = useCallback((job) => {
    autoFillQueueRef.current.push(job);
    processAutoFillQueueRef.current?.();
  }, []);

  return (
    <AiInsightContext.Provider value={{
      running, progress, currentName, summary,
      startGlobalFix, stopGlobalFix, dismissSummary, subscribeFix,
      conditionRunning, conditionProgress, conditionCurrentName, conditionSummary, conditionLabel,
      startConditionSave, stopConditionSave, dismissConditionSummary,
      enqueueAutoFillCondition,
      classSweepRunning, classSweepClassIndex, classSweepClassTotal, classSweepCurrentClass,
      classSweepItemProgress, classSweepCurrentDrug, classSweepLog, classSweepSummary, classSweepResumed,
      startClassSweep, stopClassSweep, dismissClassSweepSummary, jumpClassSweep,
      clinicalSweepRunning, clinicalSweepIndex, clinicalSweepTotal, clinicalSweepCurrentLabel,
      clinicalSweepSummary, clinicalSweepResumed, clinicalSweepEligibleCount, clinicalSweepTotalConditions,
      startClinicalInfoSweep, stopClinicalInfoSweep, dismissClinicalSweepSummary, jumpClinicalSweep,
      imageSweepRunning, imageSweepIndex, imageSweepTotal, imageSweepCurrentName,
      imageSweepSummary, imageSweepResumed, imageSweepEligibleCount,
      startImageSweep, stopImageSweep, dismissImageSweepSummary, jumpImageSweep,
      allConditionsIndex, clinicalInfoByCondition,
      pendingReviewList, confirmPendingReview, rejectPendingReview,
    }}>
      {children}
      <GlobalAiInsightWidget />
      <ConditionSaveWidget />
      <ClassSweepWidget />
      <ClinicalInfoSweepWidget />
      <ImageSweepWidget />
      <PendingReviewWidget />
    </AiInsightContext.Provider>
  );
}

export function useAiInsight() {
  const ctx = useContext(AiInsightContext);
  if (!ctx) throw new Error('useAiInsight must be used within an AiInsightProvider');
  return ctx;
}

// ── Draggable wrapper: lets either widget be dragged anywhere on screen ──
// Position is remembered per-widget (localStorage) so it stays put across
// reloads and navigation. Until the user drags it for the first time, it
// sits at its default corner and still responds to layout changes (e.g.
// shifting up when the other widget is also showing).
function DraggableWidget({ id, defaultBottom = 20, defaultRight = 16, width = 300, children }) {
  const [dragPos, setDragPos] = useState(() => {
    try {
      const saved = localStorage.getItem(`ai_widget_pos_${id}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [dragging, setDragging] = useState(false);
  const elRef = useRef(null);
  const dragInfo = useRef(null);

  const clamp = (x, y, w, h) => ({
    x: Math.min(Math.max(4, x), Math.max(4, window.innerWidth - w - 4)),
    y: Math.min(Math.max(4, y), Math.max(4, window.innerHeight - h - 4)),
  });

  const onPointerDown = (e) => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragInfo.current = { startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top, w: rect.width, h: rect.height };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragInfo.current) return;
    const { startX, startY, startLeft, startTop, w, h } = dragInfo.current;
    setDragPos(clamp(startLeft + (e.clientX - startX), startTop + (e.clientY - startY), w, h));
  };
  const endDrag = () => {
    if (!dragInfo.current) return;
    dragInfo.current = null;
    setDragging(false);
    setDragPos(pos => {
      if (pos) { try { localStorage.setItem(`ai_widget_pos_${id}`, JSON.stringify(pos)); } catch {} }
      return pos;
    });
  };

  // Keep it fully on-screen if the viewport is resized/rotated after a drag.
  useEffect(() => {
    if (!dragPos) return;
    const onResize = () => {
      const rect = elRef.current?.getBoundingClientRect();
      if (rect) setDragPos(p => p ? clamp(p.x, p.y, rect.width, rect.height) : p);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!dragPos]);

  const outerStyle = dragPos
    ? { position: 'fixed', left: dragPos.x, top: dragPos.y, zIndex: 9999, width }
    : { position: 'fixed', bottom: defaultBottom, right: defaultRight, zIndex: 9999, width, transition: dragging ? 'none' : 'bottom 0.25s ease' };

  return (
    <div
      ref={elRef}
      style={{
        ...outerStyle, background: '#0F172A', color: '#fff', borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden', userSelect: dragging ? 'none' : 'auto',
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Drag to move"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '7px 0 3px', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none',
        }}
      >
        <GripHorizontal className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.35)' }} />
      </div>
      <div style={{ padding: '2px 18px 18px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Floating widget: visible on every page while a background run is active ──
function GlobalAiInsightWidget() {
  const { running, progress, currentName, summary, stopGlobalFix, dismissSummary, conditionRunning, conditionSummary, classSweepRunning, classSweepSummary, clinicalSweepRunning, clinicalSweepSummary, imageSweepRunning, imageSweepSummary } = useContext(AiInsightContext);
  const [startTime] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!running && !summary) return null;

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  // Shift up so it doesn't overlap whichever other widget(s) are showing —
  // each active widget below this one takes ~250px of vertical space.
  const widgetsBelow = [conditionRunning || conditionSummary, classSweepRunning || classSweepSummary, clinicalSweepRunning || clinicalSweepSummary, imageSweepRunning || imageSweepSummary].filter(Boolean).length;
  const stackedBelow = widgetsBelow > 0;

  // ETA calculation
  let etaLabel = '';
  if (running && progress.done > 0) {
    const elapsed = (now - startTime) / 1000;
    const rate    = progress.done / elapsed; // drugs per second
    const remaining = progress.total - progress.done;
    const etaSecs = rate > 0 ? Math.round(remaining / rate) : null;
    if (etaSecs !== null) {
      etaLabel = etaSecs < 60
        ? `~${etaSecs}s left`
        : `~${Math.ceil(etaSecs / 60)}m left`;
    }
  }

  return (
    <DraggableWidget id="ai-insight" defaultBottom={stackedBelow ? 20 + widgetsBelow * 250 : 20} defaultRight={16} width={300}>
      {running ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>AI Insight running…</span>
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>{pct}%</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', borderRadius: 3, width: `${pct}%`, transition: 'width 0.5s ease' }} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {progress.done} / {progress.total} drugs
            </span>
            {etaLabel && <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>{etaLabel}</span>}
          </div>

          {/* Current drug */}
          {currentName && (
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚡ {currentName}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            Running in background — you can navigate freely
          </div>

          <button
            onClick={stopGlobalFix}
            style={{ fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
          >
            ⏹ Stop
          </button>
        </>
      ) : summary && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            {summary.stopped ? '⏹ AI Insight stopped' : '✅ AI Insight complete'}
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
            ✓ {summary.succeeded} drugs completed
          </div>
          {summary.stillIncomplete > 0 && (
            <div style={{ fontSize: 12, color: '#F59E0B', marginBottom: 4 }}>
              ⚠ {summary.stillIncomplete} still incomplete
            </div>
          )}
          {summary.failed > 0 && (
            <div style={{ fontSize: 12, color: '#F87171', marginBottom: 4 }}>
              ✗ {summary.failed} failed
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={dismissSummary}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </DraggableWidget>
  );
}

// ── Floating widget for the condition "Save All" job — same background-
// survives-navigation guarantee, stacked below the drug-completion widget ──
function ConditionSaveWidget() {
  const {
    conditionRunning, conditionProgress, conditionCurrentName, conditionSummary, conditionLabel,
    stopConditionSave, dismissConditionSummary,
    classSweepRunning, classSweepSummary, clinicalSweepRunning, clinicalSweepSummary,
    imageSweepRunning, imageSweepSummary,
  } = useContext(AiInsightContext);

  if (!conditionRunning && !conditionSummary) return null;

  const pct = conditionProgress.total ? Math.round((conditionProgress.done / conditionProgress.total) * 100) : 0;
  const widgetsBelow = [classSweepRunning || classSweepSummary, clinicalSweepRunning || clinicalSweepSummary, imageSweepRunning || imageSweepSummary].filter(Boolean).length;
  const stackedBelow = widgetsBelow > 0;

  return (
    <DraggableWidget id="condition-save" defaultBottom={stackedBelow ? 20 + widgetsBelow * 250 : 20} defaultRight={16} width={300}>
      {conditionRunning ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Saving "{conditionLabel}"…
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{pct}%</span>
          </div>

          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #8B5CF6, #A78BFA)', borderRadius: 3, width: `${pct}%`, transition: 'width 0.5s ease' }} />
          </div>

          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
            {conditionProgress.done} / {conditionProgress.total} drugs
          </div>

          {conditionCurrentName && (
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚡ {conditionCurrentName}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            Running in background — you can navigate freely
          </div>

          <button
            onClick={stopConditionSave}
            style={{ fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
          >
            ⏹ Stop
          </button>
        </>
      ) : conditionSummary && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conditionSummary.stopped ? '⏹ Stopped — ' : '✅ Done — '}"{conditionSummary.label}"
          </div>
          {conditionSummary.saved > 0 && (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
              ✓ {conditionSummary.saved} newly generated
            </div>
          )}
          {conditionSummary.reused > 0 && (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
              🔗 {conditionSummary.reused} existing drug{conditionSummary.reused !== 1 ? 's' : ''} linked
            </div>
          )}
          {conditionSummary.flaggedForReview > 0 && (
            <div style={{ fontSize: 12, color: '#FBBF24', marginBottom: 4 }}>
              🚩 {conditionSummary.flaggedForReview} saved as unconfirmed — flagged for admin review
            </div>
          )}
          {conditionSummary.failed > 0 && (
            <div style={{ fontSize: 12, color: '#F87171', marginBottom: 4 }}>
              ✗ {conditionSummary.failed} failed
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={dismissConditionSummary}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </DraggableWidget>
  );
}

// ── Floating widget for the "Class Sweep" job — walks every drug class in
// sequence, searching hard for and auto-saving matching drugs, until the
// admin stops it, the queue runs out, or the session ends. Base layer of
// the widget stack (bottom: 20) since it's usually the longest-running.
function ClassSweepWidget() {
  const {
    classSweepRunning, classSweepClassIndex, classSweepClassTotal, classSweepCurrentClass,
    classSweepItemProgress, classSweepCurrentDrug, classSweepSummary,
    stopClassSweep, dismissClassSweepSummary, jumpClassSweep,
    clinicalSweepRunning, clinicalSweepSummary, imageSweepRunning, imageSweepSummary,
  } = useContext(AiInsightContext);

  if (!classSweepRunning && !classSweepSummary) return null;

  const itemPct  = classSweepItemProgress.total ? Math.round((classSweepItemProgress.done / classSweepItemProgress.total) * 100) : 0;
  const widgetsBelow = [clinicalSweepRunning || clinicalSweepSummary, imageSweepRunning || imageSweepSummary].filter(Boolean).length;
  const stackedBelow = widgetsBelow > 0;

  return (
    <DraggableWidget id="class-sweep" defaultBottom={stackedBelow ? 20 + widgetsBelow * 250 : 20} defaultRight={16} width={300}>
      {classSweepRunning ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Class Sweep running…</span>
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>
              Class {classSweepClassIndex}/{classSweepClassTotal}
            </span>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: '#CBD5E1', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {classSweepCurrentClass}
          </div>

          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 3, width: `${itemPct}%`, transition: 'width 0.5s ease' }} />
          </div>

          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
            {classSweepItemProgress.total > 0
              ? `${classSweepItemProgress.done} / ${classSweepItemProgress.total} drugs in this class`
              : 'Searching for drugs in this class…'}
          </div>

          {classSweepCurrentDrug && (
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚡ {classSweepCurrentDrug}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            Working through every class automatically — stop anytime, or it keeps going until it finishes or you log out.
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => jumpClassSweep('prev')}
              disabled={classSweepClassIndex <= 1}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 10px', cursor: classSweepClassIndex <= 1 ? 'default' : 'pointer', opacity: classSweepClassIndex <= 1 ? 0.4 : 1 }}
            >
              ⏮ Prev
            </button>
            <button
              onClick={() => jumpClassSweep('next')}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
            >
              Next ⏭
            </button>
            <button
              onClick={stopClassSweep}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              ⏹ Stop
            </button>
          </div>
        </>
      ) : classSweepSummary && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            {classSweepSummary.stopped ? '⏹ Class Sweep stopped' : '✅ Class Sweep complete'}
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
            {classSweepSummary.classesCovered} of {classSweepSummary.classesTotal} classes covered
          </div>
          <div style={{ fontSize: 12, color: '#34D399', marginBottom: 4 }}>
            ✓ {classSweepSummary.totalSaved} new drugs saved
          </div>
          {classSweepSummary.totalExisting > 0 && (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
              🔗 {classSweepSummary.totalExisting} already in database
            </div>
          )}
          {classSweepSummary.totalFailed > 0 && (
            <div style={{ fontSize: 12, color: '#F87171', marginBottom: 4 }}>
              ✗ {classSweepSummary.totalFailed} failed
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={dismissClassSweepSummary}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </DraggableWidget>
  );
}

// ── Floating widget for the "Clinical Info Sweep" job — walks every
// condition in every system, generating its clinical info panel if it
// doesn't have one yet. Base layer alongside ClassSweepWidget (both are
// long-running full sweeps); see the stacking comments on the other
// widgets for how they avoid overlapping when several run at once.
function ClinicalInfoSweepWidget() {
  const {
    clinicalSweepRunning, clinicalSweepIndex, clinicalSweepTotal, clinicalSweepCurrentLabel,
    clinicalSweepSummary, clinicalSweepResumed,
    stopClinicalInfoSweep, dismissClinicalSweepSummary, jumpClinicalSweep,
    imageSweepRunning, imageSweepSummary,
  } = useContext(AiInsightContext);

  if (!clinicalSweepRunning && !clinicalSweepSummary) return null;

  const pct = clinicalSweepTotal ? Math.round((clinicalSweepIndex / clinicalSweepTotal) * 100) : 0;
  const stackedBelow = imageSweepRunning || imageSweepSummary;

  return (
    <DraggableWidget id="clinical-sweep" defaultBottom={stackedBelow ? 270 : 20} defaultRight={16} width={300}>
      {clinicalSweepRunning ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0EA5E9', flexShrink: 0, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {clinicalSweepResumed ? 'Clinical Info Sweep (resumed)…' : 'Clinical Info Sweep running…'}
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{pct}%</span>
          </div>

          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)', borderRadius: 3, width: `${pct}%`, transition: 'width 0.5s ease' }} />
          </div>

          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
            {clinicalSweepIndex} / {clinicalSweepTotal} conditions
          </div>

          {clinicalSweepCurrentLabel && (
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚡ {clinicalSweepCurrentLabel}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            Working through every system automatically — stop anytime, or it keeps going until it finishes or you log out.
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => jumpClinicalSweep('prev')}
              disabled={clinicalSweepIndex <= 1}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 10px', cursor: clinicalSweepIndex <= 1 ? 'default' : 'pointer', opacity: clinicalSweepIndex <= 1 ? 0.4 : 1 }}
            >
              ⏮ Prev
            </button>
            <button
              onClick={() => jumpClinicalSweep('next')}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
            >
              Next ⏭
            </button>
            <button
              onClick={stopClinicalInfoSweep}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              ⏹ Stop
            </button>
          </div>
        </>
      ) : clinicalSweepSummary && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            {clinicalSweepSummary.stopped ? '⏹ Clinical Info Sweep stopped' : '✅ Clinical Info Sweep complete'}
          </div>
          {clinicalSweepSummary.total === 0 ? (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
              Every condition already has clinical info — nothing to do.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
                {clinicalSweepSummary.generated + clinicalSweepSummary.failed + clinicalSweepSummary.skipped} of {clinicalSweepSummary.total} conditions covered
              </div>
              <div style={{ fontSize: 12, color: '#34D399', marginBottom: 4 }}>
                ✓ {clinicalSweepSummary.generated} generated
              </div>
              {clinicalSweepSummary.skipped > 0 && (
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
                  ↷ {clinicalSweepSummary.skipped} already filled in by someone else
                </div>
              )}
              {clinicalSweepSummary.failed > 0 && (
                <div style={{ fontSize: 12, color: '#F87171', marginBottom: 4 }}>
                  ✗ {clinicalSweepSummary.failed} failed
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={dismissClinicalSweepSummary}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </DraggableWidget>
  );
}

// ── Floating widget for the "Image Sweep" job — walks every drug missing an
// image, searching for a real, freely-licensed photo and saving it. Base
// layer of the widget stack (bottom: 20), matching the other long-running
// full sweeps.
function ImageSweepWidget() {
  const {
    imageSweepRunning, imageSweepIndex, imageSweepTotal, imageSweepCurrentName,
    imageSweepSummary, imageSweepResumed,
    stopImageSweep, dismissImageSweepSummary, jumpImageSweep,
  } = useContext(AiInsightContext);

  if (!imageSweepRunning && !imageSweepSummary) return null;

  const pct = imageSweepTotal ? Math.round((imageSweepIndex / imageSweepTotal) * 100) : 0;

  return (
    <DraggableWidget id="image-sweep" defaultBottom={20} defaultRight={16} width={300}>
      {imageSweepRunning ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EC4899', flexShrink: 0, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {imageSweepResumed ? 'Image Sweep (resumed)…' : 'Image Sweep running…'}
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{pct}%</span>
          </div>

          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #EC4899, #F472B6)', borderRadius: 3, width: `${pct}%`, transition: 'width 0.5s ease' }} />
          </div>

          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
            {imageSweepIndex} / {imageSweepTotal} drugs
          </div>

          {imageSweepCurrentName && (
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚡ {imageSweepCurrentName}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            Searching for real, freely-licensed photos automatically — stop anytime, or it keeps going until it finishes or you log out.
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => jumpImageSweep('prev')}
              disabled={imageSweepIndex <= 1}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 10px', cursor: imageSweepIndex <= 1 ? 'default' : 'pointer', opacity: imageSweepIndex <= 1 ? 0.4 : 1 }}
            >
              ⏮ Prev
            </button>
            <button
              onClick={() => jumpImageSweep('next')}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
            >
              Next ⏭
            </button>
            <button
              onClick={stopImageSweep}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              ⏹ Stop
            </button>
          </div>
        </>
      ) : imageSweepSummary && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            {imageSweepSummary.stopped ? '⏹ Image Sweep stopped' : '✅ Image Sweep complete'}
          </div>
          {imageSweepSummary.total === 0 ? (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
              Every drug already has an image — nothing to do.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
                {imageSweepSummary.found + imageSweepSummary.skipped + imageSweepSummary.failed} of {imageSweepSummary.total} drugs covered
              </div>
              <div style={{ fontSize: 12, color: '#34D399', marginBottom: 4 }}>
                ✓ {imageSweepSummary.found} real image{imageSweepSummary.found !== 1 ? 's' : ''} found &amp; saved
              </div>
              {imageSweepSummary.skipped > 0 && (
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
                  ↷ {imageSweepSummary.skipped} left blank — no real image found
                </div>
              )}
              {imageSweepSummary.failed > 0 && (
                <div style={{ fontSize: 12, color: '#F87171', marginBottom: 4 }}>
                  ✗ {imageSweepSummary.failed} failed
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={dismissImageSweepSummary}
              style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </DraggableWidget>
  );
}

// ── Floating trigger + modal for the global pending-drug review queue ──
// Admin-only. Shows a small badge (bottom-left, so it never collides with
// the other draggable widgets which default to bottom-right) whenever
// there's at least one drug/condition pair awaiting confirmation anywhere
// in the database. Clicking it opens a one-at-a-time review popup instead
// of making the admin dig through each condition's own page.
function PendingReviewWidget() {
  const { isAdmin } = useAuth();
  const { pendingReviewList, confirmPendingReview, rejectPendingReview } = useContext(AiInsightContext);
  const [open, setOpen]   = useState(false);
  const [index, setIndex] = useState(0);
  const [busy, setBusy]   = useState(false);

  // Keep the pointer in range as the list shrinks (items get confirmed/
  // rejected from elsewhere too, e.g. another admin, or the per-condition
  // panel) — clamp instead of resetting to 0 so reviewing stays put.
  useEffect(() => {
    setIndex(i => Math.min(i, Math.max(0, pendingReviewList.length - 1)));
  }, [pendingReviewList.length]);

  if (!isAdmin || pendingReviewList.length === 0) return null;

  const current = pendingReviewList[index];

  const advance = () => {
    setIndex(i => (i >= pendingReviewList.length - 1 ? 0 : i));
  };

  const handleConfirm = async () => {
    setBusy(true);
    try { await confirmPendingReview(current); advance(); } finally { setBusy(false); }
  };
  const handleReject = async () => {
    setBusy(true);
    try { await rejectPendingReview(current); advance(); } finally { setBusy(false); }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setIndex(0); }}
        style={{
          position: 'fixed', bottom: 20, left: 16, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0F172A', color: '#fff', border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 999, padding: '10px 16px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <AlertTriangle className="w-4 h-4" style={{ color: '#F59E0B' }} />
        {pendingReviewList.length} drug{pendingReviewList.length !== 1 ? 's' : ''} awaiting confirmation
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', color: '#0F172A', borderRadius: 20, width: '100%', maxWidth: 420,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle className="w-4 h-4" style={{ color: '#D97706' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Pending drug review</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {current ? (
              <>
                <div style={{ padding: '20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>
                    {index + 1} of {pendingReviewList.length}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{current.drugName}</div>
                  {current.drugClass && (
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>{current.drugClass}</div>
                  )}
                  <div style={{ fontSize: 13, color: '#334155', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px' }}>
                    Flagged as possibly indicated for <strong>{current.conditionLabel}</strong>
                    {current.systemName && <> ({current.systemName})</>} — the AI linked it here, but its stored
                    indications didn't clearly match. Confirm to tag it, or reject to drop the link.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px' }}>
                  <button
                    disabled={busy}
                    onClick={handleReject}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', border: 'none', borderRadius: 12, padding: '10px 0', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleConfirm}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fff', background: '#16A34A', border: 'none', borderRadius: 12, padding: '10px 0', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
                  >
                    <Check className="w-3.5 h-3.5" /> Confirm
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px 20px' }}>
                  <button
                    disabled={busy || pendingReviewList.length <= 1}
                    onClick={() => setIndex(i => (i <= 0 ? pendingReviewList.length - 1 : i - 1))}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', opacity: pendingReviewList.length <= 1 ? 0.4 : 1 }}
                  >
                    <ChevronLeft className="w-4 h-4" /> Skip back
                  </button>
                  <button
                    disabled={busy || pendingReviewList.length <= 1}
                    onClick={() => setIndex(i => (i >= pendingReviewList.length - 1 ? 0 : i + 1))}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', opacity: pendingReviewList.length <= 1 ? 0.4 : 1 }}
                  >
                    Skip next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#64748B' }}>
                All caught up — nothing left to review.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
