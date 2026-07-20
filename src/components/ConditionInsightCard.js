import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pill, Sparkles, RefreshCw, AlertTriangle, Save, CheckCircle } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { renderAiText } from '../utils/renderAiText';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { fetchAiDrugText, saveAiDrugToDatabase, isDrugComplete, fetchConditionInsight, fetchConditionClassification, slugifyDrugName as slugifyDrugNameUtil } from '../utils/aiDrugSave';
import { parseConditionInsight, isNotAConditionText } from '../utils/parseConditionInsight';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { useCustomConditions, normalizeConditionLabel, slugifyConditionLabel, addCustomConditions } from '../hooks/useCustomConditions';

/* ── AI condition insight: intro/etiology/pathophysiology + drug list ────── */
/* Shown above search results whenever there's an active search query, so a  */
/* nurse searching an indication/disease name (not just a drug name) gets a  */
/* clinical primer plus every matching medication — in-database and new.     */
/* Shared between BrowsePage and HomePage.                                   */
export function normalizeConditionDrugName(name) {
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

export default function ConditionInsightCard({ searchQuery, existingDrugs }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const { customConditionsBySystem, hiddenConditionIdsBySystem } = useCustomConditions();
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
      const hidden = new Set(hiddenConditionIdsBySystem[system.id] || []);
      for (const c of [...base, ...custom]) {
        if (hidden.has(c.id)) continue;
        list.push({ systemId: system.id, systemName: system.name, id: c.id, label: c.label, keywords: c.keywords });
      }
    }
    list.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'en', { sensitivity: 'base' }));
    return list;
  }, [customConditionsBySystem, hiddenConditionIdsBySystem]);

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
