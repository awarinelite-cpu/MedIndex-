import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Pill, ChevronRight, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, Save, AlertTriangle, X, BookOpen, Trash2, Pencil, Check,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { useAiInsight } from '../context/AiInsightContext';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { fetchConditionDrugList, isDrugComplete, fetchConditionClinicalInfo } from '../utils/aiDrugSave';
import { parseConditionClinicalInfo, hasNoDistinctTypes } from '../utils/parseConditionClinicalInfo';
import { renderAiText } from '../utils/renderAiText';
import { saveConditionClinicalInfo, removeConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import { doc, updateDoc, serverTimestamp, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { getDisplayDrugClass } from '../utils/drugCategory';
import IndicationCombinationPanel from './IndicationCombinationPanel';

export function RxBadge({ status }) {
  const cls =
    status === 'OTC'        ? 'bg-green-100 text-green-700' :
    status === 'Controlled' ? 'bg-red-100 text-red-700'     :
                              'bg-blue-100 text-blue-700';
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${cls}`}>
      {status === 'OTC' ? 'OTC' : status === 'Controlled' ? 'Controlled' : 'Prescription'}
    </span>
  );
}

export function normalizeDrugName(name) {
  let n = (name || '').trim().toLowerCase();
  // Collapse punctuation/spacing differences: "co-trimoxazole" == "cotrimoxazole",
  // "amoxicillin / clavulanate" == "amoxicillin/clavulanate".
  n = n.replace(/[\s/.+-]+/g, ' ').trim();
  // "co trimoxazole" (from "co-trimoxazole") == "cotrimoxazole"
  n = n.replace(/\bco (\w)/g, 'co$1');
  // Treat common salt-name variants as equivalent so an existing drug is
  // recognised even if the AI lists a slightly different salt spelling
  // (e.g. "clavulanic acid" vs "clavulanate", "sodium"/"hydrochloride" suffixes).
  n = n
    .replace(/\bclavulanic acid\b/g, 'clavulanate')
    .replace(/\b(hydrochloride|hcl|sodium|potassium|sulfate|sulphate|phosphate|maleate|mesylate|besylate|succinate|tartrate|dihydrate|monohydrate)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

/* ── AI expansion for a clinical condition ───────────────────────────────── */
export function AiConditionFallback({ conditionId, conditionLabel, conditionKeywords, systemName, existingDrugs }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const { drugs: allDrugs } = useDrugs();
  // Match AI suggestions against EVERY drug in the database — not just the
  // drugs already tagged to this condition. Since display is now strictly
  // tag-based, a not-yet-populated condition has no tagged drugs, so relying
  // on `existingDrugs` (this condition's list) made every already-saved drug
  // look brand new and get regenerated. Checking the whole database lets us
  // recognise them and reuse their existing information instead.
  const lookupPool = (allDrugs && allDrugs.length) ? allDrugs : existingDrugs;
  const existingByName = useMemo(() => {
    const map = new Map();
    lookupPool.forEach(d => {
      if (d.generic_name) map.set(normalizeDrugName(d.generic_name), d);
    });
    return map;
  }, [lookupPool]);
  const knownDrugNames = useMemo(() => lookupPool.map(d => d.generic_name).filter(Boolean), [lookupPool]);

  const cacheKey = `ai_condition_${conditionLabel.trim().toLowerCase()}`;
  const [state, setState] = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]   = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError] = useState('');

  // The actual "Save All" job now lives in AiInsightContext, mounted above
  // the router — so it keeps running (with a floating progress widget) even
  // if this component unmounts, which happens the moment this condition's
  // accordion is collapsed or a different condition is opened. This card
  // only reflects progress when ITS OWN condition is the one currently
  // tracked; a different condition's job keeps running invisibly and still
  // shows in the global widget.
  const {
    conditionRunning, conditionProgress, conditionSummary, conditionLabel: activeLabel,
    startConditionSave,
  } = useAiInsight();
  const isThisConditionActive = activeLabel === conditionLabel;
  const bulkState    = isThisConditionActive && conditionRunning ? 'running' : (isThisConditionActive && conditionSummary ? 'done' : 'idle');
  const bulkProgress = isThisConditionActive ? conditionProgress : { done: 0, total: 0 };
  const bulkResults  = isThisConditionActive ? conditionSummary : null;
  const anyConditionRunning = conditionRunning; // a DIFFERENT condition may be saving right now

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    try {
      const full = await fetchConditionDrugList({ conditionLabel, systemName, knownDrugNames, endpoint: provider.endpoint });
      setText(full);
      sessionStorage.setItem(cacheKey, full);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  const items = state === 'done' ? parseAiDrugList(text) : [];

  const saveAllToDatabase = () => {
    startConditionSave({ items, conditionId, label: conditionLabel, conditionKeywords, existingByName, endpoint: provider.endpoint });
  };

  if (state === 'idle') {
    return (
      <div className="mt-3 bg-primary-50 border border-primary-200 rounded-xl p-5 text-center">
        <Sparkles className="w-7 h-7 text-primary-500 mx-auto mb-2" />
        <p className="text-sm text-drug-text mb-3">
          Want the AI to find more medications used for "{conditionLabel}"?
        </p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Find more drugs for "{conditionLabel}"
        </button>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="mt-3 bg-white border border-drug-border rounded-xl p-6 text-center">
        <RefreshCw className="w-6 h-6 text-primary-400 mx-auto mb-2 animate-spin" />
        <p className="text-sm text-drug-muted">Gathering medications for "{conditionLabel}"…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mt-3 bg-white border border-drug-border rounded-xl p-5 text-center">
        <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="mt-3 bg-white border border-drug-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-violet-50 border-b border-drug-border">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
          <span className="text-sm font-bold text-drug-text truncate">AI: More drugs for "{conditionLabel}"</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && items.length > 0 && !anyConditionRunning && (
            <button
              onClick={saveAllToDatabase}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1 rounded-lg"
            >
              <Save className="w-3 h-3" /> Save All
            </button>
          )}
          {isAdmin && anyConditionRunning && !isThisConditionActive && (
            <span className="text-xs text-drug-muted italic">Saving "{activeLabel}"…</span>
          )}
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
            disabled={anyConditionRunning}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      </div>

      {bulkState === 'running' && (
        <div className="p-4 border-b border-drug-border">
          <p className="text-xs text-drug-muted mb-2">
            Saving {bulkProgress.done}/{bulkProgress.total}
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-primary-500 h-1.5 rounded-full transition-all"
                 style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
          </div>
          <p className="text-[11px] text-drug-muted mt-2">
            Running in the background — feel free to browse elsewhere; progress also shows in the widget at the bottom of the screen.
          </p>
        </div>
      )}

      {bulkState === 'done' && bulkResults && (
        <div className="px-4 py-2 border-b border-drug-border text-xs text-drug-muted">
          {bulkResults.saved > 0 && `${bulkResults.saved} newly generated`}
          {bulkResults.saved > 0 && bulkResults.reused > 0 && ', '}
          {bulkResults.reused > 0 && `${bulkResults.reused} existing drug${bulkResults.reused !== 1 ? 's' : ''} linked (info reused)`}
          {bulkResults.skippedMismatch > 0 && `, ${bulkResults.skippedMismatch} skipped (not actually indicated for this condition)`}
          {bulkResults.errors.length > 0 && `, ${bulkResults.errors.length} failed`}.
        </div>
      )}

      {items.length === 0 ? (
        <p className="p-4 text-sm text-drug-muted">{text}</p>
      ) : (
        items.map((item, i) => {
          const existing = existingByName.get(normalizeDrugName(item.name));
          const isNew = !existing;
          return (
            <Link
              key={i}
              to={isNew ? `/browse?q=${encodeURIComponent(item.name)}` : `/drug/${existing.id}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${i !== items.length - 1 ? 'border-b border-drug-border' : ''}`}
            >
              <div className={`p-1.5 rounded-lg flex-shrink-0 ${isNew ? 'bg-violet-50' : 'bg-primary-50'}`}>
                <Pill className={`w-4 h-4 ${isNew ? 'text-violet-500' : 'text-primary-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{item.name}</div>
                <div className="text-xs text-drug-muted truncate">{item.subclass || item.note}</div>
              </div>
              {isNew ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">AI</span>
              ) : (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${isDrugComplete(existing) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isDrugComplete(existing) ? 'In DB' : 'Incomplete'}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
            </Link>
          );
        })
      )}
    </div>
  );
}

/* ── Clinical info panel for a condition ──────────────────────────────────
   Introduction / Types / Organ System / Etiology / Pathophysiology /
   Clinical Manifestation / Diagnosis & Investigation / Medical Management.
   Sits right below a condition's header, above its drug-class list — an
   admin can generate it once with AI, everyone else just reads it once
   it exists. Regenerate/Remove are admin-only. */
export function ConditionClinicalInfoPanel({ condition, systemName, info }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const [localInfo, setLocalInfo] = useState(info || null);
  useEffect(() => { if (info) setLocalInfo(info); }, [info]);

  const [state, setState]       = useState('idle'); // idle | loading | error
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);

  const generate = async () => {
    setState('loading');
    setError('');
    try {
      const full = await fetchConditionClinicalInfo({ conditionLabel: condition.label, systemName, endpoint: provider.endpoint });
      const parsed = parseConditionClinicalInfo(full);
      await saveConditionClinicalInfo(condition.id, parsed);
      setLocalInfo(parsed); // optimistic — Firestore listener will confirm shortly after
      setState('idle');
      setExpanded(true);
    } catch (e) {
      setError(e.message || 'Failed to generate clinical info.');
      setState('error');
    }
  };

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    setError('');
    try {
      await removeConditionClinicalInfo(condition.id);
      setLocalInfo(null);
    } catch (e) {
      setError(e.message || 'Failed to remove clinical info.');
    } finally {
      setRemoving(false);
    }
  };

  if (!localInfo) {
    if (!isAdmin) return null; // nothing generated yet, nothing for a non-admin to see
    return (
      <div className="px-5 py-3 border-b border-drug-border bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 text-sm text-drug-muted">
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          No clinical info added for "{condition.label}" yet.
        </div>
        {state === 'loading' ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…
          </span>
        ) : (
          <button
            onClick={generate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Add Clinical Info
          </button>
        )}
        {state === 'error' && (
          <div className="w-full text-xs text-red-600">⚠ {error}</div>
        )}
      </div>
    );
  }

  const noTypes = hasNoDistinctTypes(localInfo.types);

  return (
    <div className="border-b border-drug-border">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 text-sm font-semibold text-drug-text">
          <BookOpen className="w-4 h-4 text-violet-500 flex-shrink-0" />
          Clinical Info: {condition.label}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-drug-muted flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-drug-muted flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {isAdmin && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                disabled={state === 'loading'}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
                {state === 'loading' ? 'Regenerating…' : 'Regenerate'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); remove(); }}
                disabled={removing}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          )}
          {error && <div className="text-xs text-red-600">⚠ {error}</div>}

          <ClinicalInfoSection title="Introduction" body={localInfo.introduction} />
          {!noTypes && <ClinicalInfoSection title="Types" body={localInfo.types} />}
          <ClinicalInfoSection title="Organ System Involved" body={localInfo.organRelated} />
          <ClinicalInfoSection title="Etiology" body={localInfo.etiology} />
          <ClinicalInfoSection title="Pathophysiology" body={localInfo.pathology} />
          <ClinicalInfoSection title="Clinical Manifestation" body={localInfo.clinicalManifestation} />
          <ClinicalInfoSection title="Diagnosis and Investigation" body={localInfo.diagnosis} />
          <ClinicalInfoSection title="Medical Management" body={localInfo.management} />
        </div>
      )}
    </div>
  );
}

export function ClinicalInfoSection({ title, body }) {
  if (!body) return null;
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-1.5">{title}</h4>
      <div className="text-sm text-drug-text leading-relaxed">{renderAiText(body)}</div>
    </div>
  );
}

/* ── Collapsible condition section ──────────────────────────────────────── */
export default function ConditionSection({ condition, drugs, viewMode, classFilter, nameSearch, isOpen, onToggle, systemName, onDrugRemoved, clinicalInfo, onDeleteCondition, isDeleting, onRenameCondition, isRenaming, mergeMode, isSelectedForMerge, onToggleMergeSelect }) {
  const open = isOpen;
  const { isAdmin } = useAuth();
  const [removingId, setRemovingId] = useState(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(condition.label);
  const [renameFieldError, setRenameFieldError] = useState('');

  // Keep the draft in sync if the label changes from elsewhere (e.g. another
  // admin renames it while this one isn't actively editing).
  useEffect(() => {
    if (!isEditingLabel) setDraftLabel(condition.label);
  }, [condition.label, isEditingLabel]);

  const startEditingLabel = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDraftLabel(condition.label);
    setRenameFieldError('');
    setIsEditingLabel(true);
  };
  const cancelEditingLabel = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setDraftLabel(condition.label);
    setRenameFieldError('');
    setIsEditingLabel(false);
  };
  const submitEditingLabel = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!onRenameCondition || isRenaming) return;
    const trimmed = draftLabel.trim();
    if (!trimmed) { setRenameFieldError('Name cannot be empty.'); return; }
    if (trimmed === condition.label.trim()) { setIsEditingLabel(false); return; }
    try {
      await onRenameCondition(condition, trimmed);
      setIsEditingLabel(false);
      setRenameFieldError('');
    } catch (err) {
      // Keep the editor open with the attempted name so the admin can fix
      // and retry (e.g. a duplicate-name collision) instead of losing it.
      setRenameFieldError(err.message || 'Rename failed.');
    }
  };

  // Admin: remove a drug from THIS condition by pulling this condition's id
  // out of the drug's condition_tags. Since display is strictly tag-based,
  // the drug immediately stops showing here — but is untouched everywhere
  // else (it stays in the database and under any other conditions it's
  // tagged for). This is how wrong matches get cleaned up.
  const removeFromCondition = async (drug, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (removingId) return;
    setRemovingId(drug.id);
    try {
      await updateDoc(doc(db, 'drugs', drug.id), {
        condition_tags: arrayRemove(condition.id),
        last_updated:   serverTimestamp(),
      });
      if (onDrugRemoved) onDrugRemoved(drug.id, condition.id);
    } catch (err) {
      console.error('Failed to remove drug from condition:', err);
    } finally {
      setRemovingId(null);
    }
  };

  // Apply filters within this condition
  const filtered = useMemo(() => {
    const q = (nameSearch || '').trim().toLowerCase();
    // If the search text matches this condition's own name, treat every drug
    // in the condition as a match (searching "Hypertension" should surface
    // the full Hypertension drug list, not just drugs whose own name/class
    // happens to contain that word).
    const conditionMatches = !!q && condition.label?.toLowerCase().includes(q);
    return drugs.filter(d => {
      const matchClass = !classFilter || d.drug_class === classFilter;
      const matchName = !q || conditionMatches ||
        d.generic_name?.toLowerCase().includes(q) ||
        d.drug_subclass?.toLowerCase().includes(q) ||
        d.drug_class?.toLowerCase().includes(q);
      return matchClass && matchName;
    });
  }, [drugs, classFilter, nameSearch, condition.label]);

  // Sub-group by drug class within the condition — always computed
  const byClass = useMemo(() => {
    const map = new Map();
    for (const drug of filtered) {
      const key = drug.drug_class || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(drug);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const isEmpty = filtered.length === 0;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden ${isEmpty ? 'border-dashed border-drug-border' : 'border-drug-border shadow-sm'}`}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (isEditingLabel) return;
          if (mergeMode) { if (onToggleMergeSelect) onToggleMergeSelect(condition); return; }
          onToggle();
        }}
        onKeyDown={(e) => {
          if (isEditingLabel) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (mergeMode) { if (onToggleMergeSelect) onToggleMergeSelect(condition); return; }
            onToggle();
          }
        }}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors cursor-pointer ${
          mergeMode && isSelectedForMerge ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {mergeMode && (
            <input
              type="checkbox"
              checked={!!isSelectedForMerge}
              onChange={() => onToggleMergeSelect && onToggleMergeSelect(condition)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 flex-shrink-0 accent-amber-600"
            />
          )}
          <span className="text-xl">{condition.icon}</span>
          <div className="text-left min-w-0 flex-1">
            {isEditingLabel ? (
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitEditingLabel(e);
                    if (e.key === 'Escape') cancelEditingLabel(e);
                  }}
                  disabled={isRenaming}
                  className="min-w-0 flex-1 font-bold text-drug-text text-sm border border-primary-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={submitEditingLabel}
                  disabled={isRenaming}
                  title="Save name"
                  className="p-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 flex-shrink-0"
                >
                  <Check className="w-4 h-4 text-green-600" />
                </button>
                <button
                  type="button"
                  onClick={cancelEditingLabel}
                  disabled={isRenaming}
                  title="Cancel"
                  className="p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 flex-shrink-0"
                >
                  <X className="w-4 h-4 text-drug-muted" />
                </button>
              </div>
            ) : (
              <div className="font-bold text-drug-text truncate">{condition.label}</div>
            )}
            {renameFieldError && (
              <div className="text-xs text-red-600 mt-0.5">{renameFieldError}</div>
            )}
            {!isEditingLabel && (
              <div className="text-xs text-drug-muted mt-0.5">
                {isEmpty
                  ? 'No drugs saved yet — tap to generate with AI'
                  : `${filtered.length} drug${filtered.length !== 1 ? 's' : ''} · ${byClass.length} class${byClass.length !== 1 ? 'es' : ''}`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!mergeMode && isAdmin && onRenameCondition && condition.id !== '_other' && !isEditingLabel && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Edit ${condition.label}`}
              onClick={startEditingLabel}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEditingLabel(e); }}
              className={`p-1.5 rounded-lg hover:bg-primary-50 ${isRenaming ? 'opacity-50 pointer-events-none' : ''}`}
              title="Edit condition name"
            >
              <Pencil className="w-4 h-4 text-primary-600" />
            </span>
          )}
          {!mergeMode && isAdmin && onDeleteCondition && condition.id !== '_other' && !isEditingLabel && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Delete ${condition.label}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDeleting) onDeleteCondition(condition); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (!isDeleting) onDeleteCondition(condition); } }}
              className={`p-1.5 rounded-lg hover:bg-red-50 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              title="Delete condition"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </span>
          )}
          {!mergeMode && !isEditingLabel && (open
            ? <ChevronUp className="w-5 h-5 text-drug-muted flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-drug-muted flex-shrink-0" />)}
        </div>
      </div>

      {open && !mergeMode && (
        <div className="border-t border-drug-border">
          <ConditionClinicalInfoPanel condition={condition} systemName={systemName} info={clinicalInfo} />

          {isEmpty ? (
            <p className="px-5 pt-4 text-sm text-drug-muted">
              No drugs matched this condition yet. Use AI below to find and save some.
            </p>
          ) : (
            byClass.map(([className, classDrugs], ci) => (
            <div key={className}>
              {/* Drug class sub-header */}
              <div className={`flex items-center justify-between px-5 py-2 bg-gray-50 ${ci > 0 ? 'border-t border-drug-border' : ''}`}>
                <Link
                  to={`/browse?class=${encodeURIComponent(className)}`}
                  className="text-xs font-bold text-primary-700 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  {className}
                </Link>
                <span className="text-xs text-drug-muted">{classDrugs.length}</span>
              </div>

              {/* Drugs */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {classDrugs.map(drug => (
                    <Link
                      key={drug.id}
                      to={`/drug/${drug.id}`}
                      className="group border border-drug-border rounded-xl p-4 hover:border-primary-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <Pill className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="flex items-center gap-1">
                          <RxBadge status={drug.prescription_status} />
                          {isAdmin && (
                            <button
                              onClick={(e) => removeFromCondition(drug, e)}
                              disabled={removingId === drug.id}
                              title="Remove from this condition"
                              className="p-1 rounded-md hover:bg-red-50 text-drug-muted hover:text-red-600 disabled:opacity-40"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-sm group-hover:text-primary-700 transition-colors">
                        {drug.generic_name}
                      </h3>
                      <p className="text-xs text-primary-600 mt-0.5">{drug.drug_subclass || getDisplayDrugClass(drug)}</p>
                      <p className="text-xs text-drug-muted mt-1.5 line-clamp-2">
                        {drug.indications || drug.primary_indications}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div>
                  {classDrugs.map((drug, i) => (
                    <Link
                      key={drug.id}
                      to={`/drug/${drug.id}`}
                      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                        i !== classDrugs.length - 1 ? 'border-b border-drug-border' : ''
                      }`}
                    >
                      <div className="p-1.5 bg-primary-50 rounded-lg flex-shrink-0">
                        <Pill className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{drug.generic_name}</div>
                        <div className="text-xs text-primary-600 truncate">
                          {drug.drug_subclass || getDisplayDrugClass(drug)}
                        </div>
                      </div>
                      <RxBadge status={drug.prescription_status} />
                      {isAdmin && (
                        <button
                          onClick={(e) => removeFromCondition(drug, e)}
                          disabled={removingId === drug.id}
                          title="Remove from this condition"
                          className="p-1 rounded-md hover:bg-red-50 text-drug-muted hover:text-red-600 flex-shrink-0 disabled:opacity-40"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            ))
          )}

          {/* AI expansion — find more drugs for this condition */}
          <div className="p-4">
            <AiConditionFallback
              conditionId={condition.id}
              conditionLabel={condition.label}
              conditionKeywords={condition.keywords}
              systemName={systemName}
              existingDrugs={drugs}
            />
          </div>

          {/* Combination therapy regimens for this specific condition */}
          <div className="px-4 pb-4">
            <IndicationCombinationPanel
              conditionLabel={condition.label}
              systemName={systemName}
            />
          </div>
        </div>
      )}
    </div>
  );
}
