import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pill, Sparkles, RefreshCw, AlertTriangle, Save, CheckCircle } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { renderAiText } from '../utils/renderAiText';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { searchDrugs } from '../utils/searchDrugs';
import { fetchAiDrugText, saveAiDrugToDatabase, fetchStrengthText, saveStrengthOnly, needsStrengthOnly, isDrugComplete, isDrugNotFoundText, fetchConditionInsight, fetchConditionClassification, slugifyDrugName as slugifyDrugNameUtil } from '../utils/aiDrugSave';
import { parseConditionInsight, isNotAConditionText } from '../utils/parseConditionInsight';
import { logSearch } from '../utils/logSearch';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { useCustomConditions, normalizeConditionLabel, slugifyConditionLabel, addCustomConditions } from '../hooks/useCustomConditions';
import TaxonomyBrowser from '../components/TaxonomyBrowser';
import AiClassFallback from '../components/AiClassInsight';

/* ── AI condition insight: intro/etiology/pathophysiology + drug list ────── */
/* Shown above search results whenever there's an active search query, so a  */
/* nurse searching an indication/disease name (not just a drug name) gets a  */
/* clinical primer plus every matching medication — in-database and new.     */
function normalizeConditionDrugName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function conditionLabelTokens(label) {
  return normalizeConditionLabel(label).split(' ').filter(Boolean);
}

// Fuzzy, keyword-overlap match against the existing condition taxonomy.
// This is intentionally a *suggestion*, never an auto-merge: exact matches
// are handled separately (existingMatch) and get linked with no admin
// interaction. This fuzzy layer only flags conditions that share enough
// vocabulary with the search query — via label words or the condition's own
// keyword list — to be worth a human glance, e.g. "High Blood Pressure"
// against the seeded "Hypertension" (keywords include "blood pressure").
// A false positive here just means the admin dismisses the suggestion;
// nothing is written until they explicitly confirm.
function findFuzzyConditionMatch(searchQuery, existingConditionIndex) {
  const queryTokens = conditionLabelTokens(searchQuery).filter(t => t.length >= 3);
  if (queryTokens.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const c of existingConditionIndex) {
    const candidateTokens = new Set([
      ...conditionLabelTokens(c.label),
      ...(c.keywords || []).flatMap(k => conditionLabelTokens(k)),
    ]);
    if (candidateTokens.size === 0) continue;

    const overlap = queryTokens.filter(t => candidateTokens.has(t)).length;
    if (overlap === 0) continue;

    // Fraction of the query's meaningful words found in the candidate's
    // label/keywords — simple, explainable, and biased toward not matching
    // rather than over-matching (short generic queries need near-total
    // overlap; longer queries just need most of their distinctive words).
    const score = overlap / queryTokens.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  // Require at least half the query's words to overlap before it's worth
  // surfacing at all — anything looser is noise, not a likely match.
  return best && bestScore >= 0.5 ? { ...best, score: bestScore } : null;
}

function ConditionInsightCard({ searchQuery, existingDrugs }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const { customConditionsBySystem } = useCustomConditions();
  const dbDrugs = useMemo(() => existingDrugs.filter(d => !d._seed), [existingDrugs]);
  const knownDrugNames = useMemo(() => dbDrugs.map(d => d.generic_name).filter(Boolean), [dbDrugs]);
  const existingByName = useMemo(() => {
    const map = new Map();
    dbDrugs.forEach(d => {
      if (d.generic_name) map.set(normalizeConditionDrugName(d.generic_name), d);
    });
    return map;
  }, [dbDrugs]);

  // Flat index of EVERY condition already in the taxonomy (static seed +
  // admin-added custom ones) across every system, so a searched condition
  // can be matched against what already exists before deciding whether to
  // create a new entry or just link drugs to the existing one.
  const existingConditionIndex = useMemo(() => {
    const list = [];
    for (const system of ANATOMICAL_SYSTEMS) {
      const base   = SYSTEM_CONDITIONS[system.id] || [];
      const custom = customConditionsBySystem[system.id] || [];
      for (const c of [...base, ...custom]) {
        list.push({ systemId: system.id, systemName: system.name, id: c.id, label: c.label, keywords: c.keywords });
      }
    }
    list.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'en', { sensitivity: 'base' }));
    return list;
  }, [customConditionsBySystem]);

  const existingMatch = useMemo(
    () => existingConditionIndex.find(c => normalizeConditionLabel(c.label) === normalizeConditionLabel(searchQuery)),
    [existingConditionIndex, searchQuery]
  );

  // Only computed when there's no exact match — a middle ground between
  // silent auto-merge and forcing every near-duplicate to become a new
  // condition. Surfaced as a dismissible suggestion; see addOne/addAll below
  // for how the admin's decision gates which condition gets used.
  const fuzzyMatch = useMemo(
    () => (existingMatch ? null : findFuzzyConditionMatch(searchQuery, existingConditionIndex)),
    [existingMatch, existingConditionIndex, searchQuery]
  );
  const [fuzzyDecision, setFuzzyDecision] = useState('pending'); // 'pending' | 'use' | 'new'
  useEffect(() => {
    setFuzzyDecision('pending');
  }, [fuzzyMatch?.id, searchQuery]);

  const cacheKey = `ai_condition_insight_${searchQuery.trim().toLowerCase()}`;
  const [state, setState] = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle'); // idle | loading | done | error
  const [text, setText]   = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError] = useState('');
  const [queriedFor, setQueriedFor] = useState(searchQuery);

  // Per-item "Add" state, keyed by drug name, plus the "Add All" bulk job.
  const [itemState, setItemState] = useState({}); // name -> 'saving' | 'saved' | 'error'
  const [bulkState, setBulkState] = useState('idle'); // idle | running | done
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState(null); // { saved, linked, errors: [{name,message}] }

  // Resolves (once) where this condition lives in the systems taxonomy:
  // reuse it if it already exists, or classify it into a system and create
  // it if it doesn't. Cached in a ref so repeated add actions in the same
  // session don't re-classify or re-create it.
  const conditionTargetRef = React.useRef(null);
  const [classifyState, setClassifyState] = useState('idle'); // idle | classifying | error
  const [classifyError, setClassifyError] = useState('');

  const ensureConditionTarget = async () => {
    if (conditionTargetRef.current) return conditionTargetRef.current;
    if (existingMatch) {
      conditionTargetRef.current = { systemId: existingMatch.systemId, systemName: existingMatch.systemName, conditionId: existingMatch.id, isNew: false };
      return conditionTargetRef.current;
    }
    // Admin explicitly confirmed the fuzzy suggestion ("use that instead?")
    // — link to it exactly like an exact match, no new condition created.
    if (fuzzyMatch && fuzzyDecision === 'use') {
      conditionTargetRef.current = { systemId: fuzzyMatch.systemId, systemName: fuzzyMatch.systemName, conditionId: fuzzyMatch.id, isNew: false };
      return conditionTargetRef.current;
    }
    setClassifyState('classifying');
    setClassifyError('');
    try {
      const systemOptions = ANATOMICAL_SYSTEMS.map(s => ({ id: s.id, name: s.name }));
      const { systemId, icon, keywords } = await fetchConditionClassification({
        conditionLabel: searchQuery.trim(), systemOptions, endpoint: provider.endpoint,
      });
      const conditionId = slugifyConditionLabel(searchQuery.trim());
      await addCustomConditions(systemId, [{ id: conditionId, label: searchQuery.trim(), icon, keywords }]);
      const systemName = ANATOMICAL_SYSTEMS.find(s => s.id === systemId)?.name || systemId;
      conditionTargetRef.current = { systemId, systemName, conditionId, isNew: true };
      setClassifyState('idle');
      return conditionTargetRef.current;
    } catch (e) {
      setClassifyState('error');
      setClassifyError(e.message || 'Failed to classify this condition into a system.');
      throw e;
    }
  };

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setQueriedFor(searchQuery);
    conditionTargetRef.current = null;
    try {
      const full = await fetchConditionInsight({ conditionLabel: searchQuery.trim(), knownDrugNames, endpoint: provider.endpoint });
      setText(full);
      sessionStorage.setItem(cacheKey, full);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  const insight = state === 'done' ? parseConditionInsight(text) : null;
  const items   = state === 'done' ? parseAiDrugList(text) : [];
  const notACondition = state === 'done' && isNotAConditionText(text);

  // Links an already-in-database drug to the resolved condition (idempotent
  // — arrayUnion never creates duplicate tags).
  const linkExistingDrug = async (existing, conditionId) => {
    await updateDoc(doc(db, 'drugs', existing.id || existing.firestoreId || slugifyDrugNameUtil(existing.generic_name)), {
      condition_tags: arrayUnion(conditionId),
    });
  };

  const addOne = async (item) => {
    if (fuzzyMatch && fuzzyDecision === 'pending') return; // resolve the suggestion banner first
    setItemState(s => ({ ...s, [item.name]: 'saving' }));
    try {
      const target = await ensureConditionTarget();
      const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: item.subclass, endpoint: provider.endpoint });
      const result = await saveAiDrugToDatabase({ genericName: item.name, drugClass: item.subclass, text: itemText, overwrite: true });
      try {
        await updateDoc(doc(db, 'drugs', result.id || slugifyDrugNameUtil(item.name)), { condition_tags: arrayUnion(target.conditionId) });
      } catch { /* tag is best-effort */ }
      setItemState(s => ({ ...s, [item.name]: 'saved' }));
    } catch (e) {
      setItemState(s => ({ ...s, [item.name]: 'error' }));
    }
  };

  const addAll = async () => {
    if (fuzzyMatch && fuzzyDecision === 'pending') return; // resolve the suggestion banner first
    setBulkState('running');
    setBulkResults(null);
    let target;
    try {
      target = await ensureConditionTarget();
    } catch (e) {
      setBulkState('idle');
      return; // classifyError already surfaced in the UI
    }

    const newItems = items.filter(item => !existingByName.has(normalizeConditionDrugName(item.name)) && itemState[item.name] !== 'saved');
    const existingItems = items.filter(item => existingByName.has(normalizeConditionDrugName(item.name)));

    let saved = 0, linked = 0;
    const errors = [];
    const total = newItems.length + existingItems.length;
    let done = 0;

    // Link already-in-database drugs first — quick, no AI calls needed.
    for (const item of existingItems) {
      const existing = existingByName.get(normalizeConditionDrugName(item.name));
      setBulkProgress({ current: ++done, total });
      try {
        await linkExistingDrug(existing, target.conditionId);
        linked++;
        setItemState(s => ({ ...s, [item.name]: 'saved' }));
      } catch (e) {
        errors.push({ name: item.name, message: e.message || 'Failed to link.' });
      }
    }

    for (const item of newItems) {
      setBulkProgress({ current: ++done, total });
      setItemState(s => ({ ...s, [item.name]: 'saving' }));
      try {
        const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: item.subclass, endpoint: provider.endpoint });
        const result = await saveAiDrugToDatabase({ genericName: item.name, drugClass: item.subclass, text: itemText, overwrite: true });
        try {
          await updateDoc(doc(db, 'drugs', result.id || slugifyDrugNameUtil(item.name)), { condition_tags: arrayUnion(target.conditionId) });
        } catch { /* tag is best-effort */ }
        setItemState(s => ({ ...s, [item.name]: 'saved' }));
        saved++;
      } catch (e) {
        setItemState(s => ({ ...s, [item.name]: 'error' }));
        errors.push({ name: item.name, message: e.message || 'Failed to save.' });
      }
      await new Promise(r => setTimeout(r, 350));
    }

    setBulkResults({ saved, linked, errors });
    setBulkState('done');
  };

  if (!searchQuery.trim()) return null;

  if (state === 'idle') {
    return (
      <div className="mb-6 bg-violet-50 border border-violet-200 rounded-xl p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
          <p className="text-sm text-drug-text">
            Is "{searchQuery}" a condition? Get a clinical overview and full drug list.
          </p>
        </div>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors flex-shrink-0"
        >
          <Sparkles className="w-4 h-4" /> Get AI Insight
        </button>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="mb-6 bg-white border border-drug-border rounded-xl p-8 text-center">
        <RefreshCw className="w-8 h-8 text-violet-400 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-drug-muted">Gathering clinical overview for "{queriedFor}"…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mb-6 bg-white border border-drug-border rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg font-semibold text-sm hover:bg-violet-100"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  // done
  if (notACondition) {
    return (
      <div className="mb-6 bg-white border border-drug-border rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <p className="text-sm text-drug-text mb-1">"{queriedFor}" doesn't look like a recognized clinical condition.</p>
        <p className="text-xs text-drug-muted">If this was meant as a drug name instead, use the lookup below.</p>
      </div>
    );
  }

  const newCount = items.filter(item => !existingByName.has(normalizeConditionDrugName(item.name)) && itemState[item.name] !== 'saved').length;

  return (
    <div className="mb-6 bg-white border border-drug-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 bg-violet-50 border-b border-drug-border flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
          <h2 className="text-lg font-bold text-drug-text truncate">AI Insight: {queriedFor}</h2>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isAdmin && items.length > 0 && bulkState !== 'running' && (
            <button
              onClick={addAll}
              disabled={classifyState === 'classifying' || (fuzzyMatch && fuzzyDecision === 'pending')}
              title={fuzzyMatch && fuzzyDecision === 'pending' ? 'Resolve the possible-match suggestion above first' : undefined}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {newCount > 0 ? `Add All ${newCount} New` : 'Link to Condition'}
            </button>
          )}
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
            disabled={bulkState === 'running'}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="px-5 py-2 border-b border-drug-border text-xs text-drug-muted bg-gray-50">
          {existingMatch ? (
            <>📁 Already tracked as <strong>"{existingMatch.label}"</strong> under {existingMatch.systemName}. Adding drugs here links them to it — no duplicate condition will be created.</>
          ) : fuzzyMatch ? (
            <>🔎 No exact match, but "{queriedFor}" shares keywords with an existing condition — see the suggestion below.</>
          ) : (
            <>🆕 "{queriedFor}" isn't in the systems taxonomy yet — adding drugs here will file it as a new condition under the best-matching system.</>
          )}
        </div>
      )}

      {isAdmin && fuzzyMatch && fuzzyDecision === 'pending' && (
        <div className="px-5 py-3 border-b border-drug-border bg-amber-50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-drug-text">
              This looks like it might be the same as <strong>"{fuzzyMatch.label}"</strong> ({fuzzyMatch.systemName}) — use that instead?
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setFuzzyDecision('use')}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
            >
              Yes, use it
            </button>
            <button
              onClick={() => setFuzzyDecision('new')}
              className="px-3 py-1.5 bg-white border border-amber-300 text-drug-text rounded-lg text-xs font-semibold hover:bg-amber-100"
            >
              No, keep separate
            </button>
          </div>
        </div>
      )}
      {isAdmin && fuzzyMatch && fuzzyDecision === 'use' && (
        <div className="px-5 py-2 border-b border-drug-border text-xs text-drug-muted bg-gray-50">
          📁 Using <strong>"{fuzzyMatch.label}"</strong> under {fuzzyMatch.systemName} per your confirmation above.
        </div>
      )}

      {classifyState === 'error' && (
        <div className="px-5 py-3 border-b border-drug-border text-sm bg-red-50 text-red-700">
          ⚠ {classifyError}
        </div>
      )}

      {bulkState === 'running' && (
        <div className="px-5 py-4 border-b border-drug-border">
          <div className="flex items-center gap-2 text-sm text-drug-text mb-2">
            <RefreshCw className="w-4 h-4 text-violet-500 animate-spin flex-shrink-0" />
            <span>{classifyState === 'classifying' ? 'Filing condition into a system…' : `Adding ${bulkProgress.current} of ${bulkProgress.total}…`}</span>
          </div>
          <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all"
                 style={{ width: `${(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100}%` }} />
          </div>
        </div>
      )}

      {bulkState === 'done' && bulkResults && (
        <div className={`px-5 py-3 border-b border-drug-border text-sm ${bulkResults.errors.length > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
          <div className={`flex items-center gap-2 font-semibold ${bulkResults.errors.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Added {bulkResults.saved}{bulkResults.linked > 0 ? `, linked ${bulkResults.linked} existing` : ''}{bulkResults.errors.length > 0 ? `, ${bulkResults.errors.length} failed` : ''}.
          </div>
        </div>
      )}

      {/* Clinical primer */}
      <div className="px-5 py-4 space-y-4 border-b border-drug-border">
        {insight.overview && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-1.5">Overview</h3>
            <div className="text-sm text-drug-text leading-relaxed">{renderAiText(insight.overview)}</div>
          </div>
        )}
        {insight.etiology && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-1.5">Etiology</h3>
            <div className="text-sm text-drug-text leading-relaxed">{renderAiText(insight.etiology)}</div>
          </div>
        )}
        {insight.pathophysiology && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-1.5">Pathophysiology</h3>
            <div className="text-sm text-drug-text leading-relaxed">{renderAiText(insight.pathophysiology)}</div>
          </div>
        )}
      </div>

      {/* Drug list */}
      {items.length > 0 && (
        <div>
          <h3 className="px-5 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-violet-600">Medications</h3>
          <div>
            {items.map((item, i) => {
              const existing = existingByName.get(normalizeConditionDrugName(item.name));
              const saved = itemState[item.name];
              const isNew = !existing && saved !== 'saved';
              return (
                <div
                  key={`${item.name}-${i}`}
                  className={`flex items-center gap-3 px-5 py-3 ${i !== items.length - 1 ? 'border-b border-drug-border' : ''}`}
                >
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${isNew ? 'bg-violet-50' : 'bg-green-50'}`}>
                    <Pill className={`w-4 h-4 ${isNew ? 'text-violet-500' : 'text-green-600'}`} />
                  </div>
                  <Link
                    to={existing ? `/drug/${existing.id || existing.firestoreId}` : `/browse?q=${encodeURIComponent(item.name)}`}
                    className="flex-1 min-w-0 hover:underline"
                  >
                    <div className="font-semibold text-sm truncate">{item.name}</div>
                    <div className="text-xs text-drug-muted truncate">{item.subclass || item.note}</div>
                  </Link>
                  {isNew ? (
                    isAdmin ? (
                      saved === 'saving' ? (
                        <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 bg-violet-100 text-violet-700 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Adding…
                        </span>
                      ) : saved === 'error' ? (
                        <button
                          onClick={() => addOne(item)}
                          className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Retry
                        </button>
                      ) : (
                        <button
                          onClick={() => addOne(item)}
                          disabled={fuzzyMatch && fuzzyDecision === 'pending'}
                          title={fuzzyMatch && fuzzyDecision === 'pending' ? 'Resolve the possible-match suggestion above first' : undefined}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          <Save className="w-3 h-3" /> Add
                        </button>
                      )
                    ) : (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">AI</span>
                    )
                  ) : (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${existing && isDrugComplete(existing) ? 'bg-green-100 text-green-700' : 'bg-green-100 text-green-700'}`}>
                      {saved === 'saved' ? 'Added' : existing && isDrugComplete(existing) ? 'In DB' : 'In DB (incomplete)'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 py-3 text-xs text-drug-muted leading-relaxed bg-gray-50">
        AI-generated reference material — not a substitute for current clinical guidelines. Verify before applying to patient care.
      </div>
    </div>
  );
}

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

      {/* AI condition insight — offered whenever there's an active search term */}
      {searchQuery.trim() && <ConditionInsightCard searchQuery={searchQuery} existingDrugs={ALL_DRUGS} />}

      {/* Results — grouped into the 21 formulary classes & their subclasses */}
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
      ) : (
        <TaxonomyBrowser drugs={filteredDrugs} allDrugs={ALL_DRUGS} />
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
