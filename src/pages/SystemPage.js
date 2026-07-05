import React, { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap,
  Pill, ChevronRight, Grid3X3, List, ArrowLeft, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, Save, AlertTriangle,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { getSystemById } from '../data/anatomicalSystems';
import { getDrugsForSystem } from '../utils/systemMatch';
import { groupDrugsByCondition } from '../data/systemConditions';
import { parseAiDrugList } from '../utils/parseAiDrugList';
import { parseAiConditionList } from '../utils/parseAiConditionList';
import { fetchConditionDrugList, fetchAiDrugText, saveAiDrugToDatabase, isDrugComplete, fetchSystemConditionsList } from '../utils/aiDrugSave';
import { useCustomConditions, addCustomConditions, slugifyConditionLabel } from '../hooks/useCustomConditions';

const ICONS = {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap, Grid3X3,
};

function RxBadge({ status }) {
  const cls =
    status === 'OTC'        ? 'bg-green-100 text-green-700' :
    status === 'Controlled' ? 'bg-red-100 text-red-700'     :
                              'bg-blue-100 text-blue-700';
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${cls}`}>
      {status}
    </span>
  );
}

function normalizeDrugName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/* ── AI expansion for a clinical condition ───────────────────────────────── */
function AiConditionFallback({ conditionLabel, systemName, existingDrugs }) {
  const { isAdmin } = useAuth();
  const existingByName = useMemo(() => {
    const map = new Map();
    existingDrugs.forEach(d => {
      if (d.generic_name) map.set(normalizeDrugName(d.generic_name), d);
    });
    return map;
  }, [existingDrugs]);
  const knownDrugNames = useMemo(() => existingDrugs.map(d => d.generic_name).filter(Boolean), [existingDrugs]);

  const cacheKey = `ai_condition_${conditionLabel.trim().toLowerCase()}`;
  const [state, setState] = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]   = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError] = useState('');

  const [bulkState, setBulkState]     = useState('idle'); // idle | running | done
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [bulkResults, setBulkResults] = useState(null); // { saved, errors: [{name, message}] }

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    try {
      const full = await fetchConditionDrugList({ conditionLabel, systemName, knownDrugNames });
      setText(full);
      sessionStorage.setItem(cacheKey, full);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  const items = state === 'done' ? parseAiDrugList(text) : [];

  const saveAllToDatabase = async () => {
    setBulkState('running');
    setBulkResults(null);
    let saved = 0, incomplete = 0;
    const errors = [];

    // Upload every AI-suggested item, overwriting whatever's already saved
    // under that name (if anything) with this fresh data.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setBulkProgress({ current: i + 1, total: items.length, currentName: item.name });
      const drugClassForItem = item.subclass || undefined;
      try {
        const itemText = await fetchAiDrugText({ genericName: item.name, drugClass: drugClassForItem });
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
      await new Promise(r => setTimeout(r, 350));
    }

    setBulkResults({ saved, skipped: incomplete, errors });
    setBulkState('done');
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
          {isAdmin && items.length > 0 && bulkState !== 'running' && (
            <button
              onClick={saveAllToDatabase}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1 rounded-lg"
            >
              <Save className="w-3 h-3" /> Save All
            </button>
          )}
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
            disabled={bulkState === 'running'}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      </div>

      {bulkState === 'running' && (
        <div className="p-4 border-b border-drug-border">
          <p className="text-xs text-drug-muted mb-2">
            Saving {bulkProgress.current}/{bulkProgress.total} — {bulkProgress.currentName}
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-primary-500 h-1.5 rounded-full transition-all"
                 style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {bulkState === 'done' && bulkResults && (
        <div className="px-4 py-2 border-b border-drug-border text-xs text-drug-muted">
          {bulkResults.saved} saved
          {bulkResults.skipped > 0 && `, ${bulkResults.skipped} incomplete`}
          {bulkResults.errors.length > 0 && `, ${bulkResults.errors.length} failed`}.
          Refresh to see them in the list above.
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

/* ── Collapsible condition section ──────────────────────────────────────── */
function ConditionSection({ condition, drugs, viewMode, classFilter, nameSearch, defaultOpen, systemName }) {
  const [open, setOpen] = useState(defaultOpen);

  // Apply filters within this condition
  const filtered = useMemo(() => {
    return drugs.filter(d => {
      const matchClass = !classFilter || d.drug_class === classFilter;
      const q = nameSearch.trim().toLowerCase();
      const matchName = !q ||
        d.generic_name?.toLowerCase().includes(q) ||
        d.drug_subclass?.toLowerCase().includes(q) ||
        d.drug_class?.toLowerCase().includes(q);
      return matchClass && matchName;
    });
  }, [drugs, classFilter, nameSearch]);

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

  if (filtered.length === 0) return null;

  return (
    <div className="bg-white border border-drug-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{condition.icon}</span>
          <div className="text-left">
            <div className="font-bold text-drug-text">{condition.label}</div>
            <div className="text-xs text-drug-muted mt-0.5">
              {filtered.length} drug{filtered.length !== 1 ? 's' : ''} · {byClass.length} class{byClass.length !== 1 ? 'es' : ''}
            </div>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-drug-muted flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-drug-muted flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-drug-border">
          {byClass.map(([className, classDrugs], ci) => (
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
                        <RxBadge status={drug.prescription_status} />
                      </div>
                      <h3 className="font-bold text-sm group-hover:text-primary-700 transition-colors">
                        {drug.generic_name}
                      </h3>
                      <p className="text-xs text-primary-600 mt-0.5">{drug.drug_subclass || drug.drug_class}</p>
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
                          {drug.drug_subclass || drug.drug_class}
                        </div>
                      </div>
                      <RxBadge status={drug.prescription_status} />
                      <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* AI expansion — find more drugs for this condition */}
          <div className="p-4">
            <AiConditionFallback
              conditionLabel={condition.label}
              systemName={systemName}
              existingDrugs={drugs}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
/* ── AI expansion for a whole system: suggest new condition categories ──── */
function AiSystemConditionsFallback({ systemId, systemName, existingLabels }) {
  const { isAdmin } = useAuth();

  const cacheKey = `ai_system_conditions_${systemId}`;
  const [state, setState] = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]   = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);
  const [addAllState, setAddAllState] = useState('idle'); // idle | running | done

  if (!isAdmin) return null; // only admins can curate condition taxonomy

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    try {
      const full = await fetchSystemConditionsList({ systemName, existingLabels });
      setText(full);
      sessionStorage.setItem(cacheKey, full);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI suggestions.');
      setState('error');
    }
  };

  const items = state === 'done' ? parseAiConditionList(text) : [];

  const addOne = async (item) => {
    const id = slugifyConditionLabel(item.label);
    setAddingId(id);
    setError('');
    try {
      await addCustomConditions(systemId, [{ id, label: item.label, icon: item.icon, keywords: item.keywords }]);
      setAddedIds(prev => new Set(prev).add(id));
    } catch (e) {
      setError(`SAVE FAILED: ${e.code ? `[${e.code}] ` : ''}${e.message || 'Unknown error'}`);
    } finally {
      setAddingId(null);
    }
  };

  const addAll = async () => {
    setAddAllState('running');
    setError('');
    const toAdd = items
      .filter(item => !addedIds.has(slugifyConditionLabel(item.label)))
      .map(item => ({ id: slugifyConditionLabel(item.label), label: item.label, icon: item.icon, keywords: item.keywords }));
    try {
      await addCustomConditions(systemId, toAdd);
      setAddedIds(prev => new Set([...prev, ...toAdd.map(c => c.id)]));
      setAddAllState('done');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setError(`SAVE FAILED: ${e.code ? `[${e.code}] ` : ''}${e.message || 'Unknown error'}`);
      setAddAllState('idle');
    }
  };

  return (
    <div className="mt-6 bg-white border border-drug-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 bg-violet-50">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
          <span className="font-bold text-drug-text truncate">AI: More conditions for {systemName}</span>
        </div>
        {state === 'idle' && (
          <button
            onClick={runLookup}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Find more conditions
          </button>
        )}
        {state === 'done' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {items.length > 0 && addAllState !== 'running' && (
              <button
                onClick={addAll}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1 rounded-lg"
              >
                <Save className="w-3 h-3" /> Add All
              </button>
            )}
            <button
              onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
        )}
      </div>

      {state === 'loading' && (
        <div className="p-6 text-center">
          <RefreshCw className="w-6 h-6 text-violet-400 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-drug-muted">Gathering condition categories for {systemName}…</p>
        </div>
      )}

      {state === 'error' && (
        <div className="p-5 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {state === 'done' && (
        addAllState === 'done' ? (
          <div className="p-5 text-center text-sm text-green-700 bg-green-50">
            ✓ Added — refreshing to show the new condition cards…
          </div>
        ) : items.length === 0 ? (
          <p className="p-5 text-sm text-drug-muted">{text}</p>
        ) : (
          <div>
            {error && (
              <div style={{
                margin: '12px 16px',
                padding: '14px 16px',
                background: '#FEF2F2',
                border: '2px solid #EF4444',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                color: '#991B1B',
                lineHeight: 1.5,
              }}>
                ⚠️ {error}
              </div>
            )}
            {items.map((item, i) => {
              const id = slugifyConditionLabel(item.label);
              const added = addedIds.has(id);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-5 py-3 ${i !== items.length - 1 ? 'border-b border-drug-border' : ''}`}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-xs text-drug-muted truncate">{item.keywords.slice(0, 4).join(', ')}…</div>
                  </div>
                  {added ? (
                    <span className="text-xs font-bold text-green-600 flex-shrink-0">✓ Added</span>
                  ) : (
                    <button
                      onClick={() => addOne(item)}
                      disabled={addingId === id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-50 flex-shrink-0"
                    >
                      {addingId === id ? 'Adding…' : '+ Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

export default function SystemPage() {
  const { systemId }  = useParams();
  const navigate      = useNavigate();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const { customConditionsBySystem } = useCustomConditions();
  const [viewMode,    setViewMode]    = useState('list');
  const [classFilter, setClassFilter] = useState('');
  const [nameSearch,  setNameSearch]  = useState('');

  const system = getSystemById(systemId);

  // AI-suggested, admin-approved conditions for this system (from Firestore),
  // merged with the static systemConditions.js list.
  const extraConditions = useMemo(
    () => customConditionsBySystem[systemId] || [],
    [customConditionsBySystem, systemId]
  );

  // All drugs in this system
  const drugs = useMemo(() => {
    if (!system) return [];
    return getDrugsForSystem(ALL_DRUGS, system).sort((a, b) =>
      (a.generic_name || '').localeCompare(b.generic_name || '')
    );
  }, [ALL_DRUGS, system]);

  // Group by condition
  const conditionGroups = useMemo(
    () => groupDrugsByCondition(drugs, systemId, extraConditions),
    [drugs, systemId, extraConditions]
  );

  // All drug classes across this system (for dropdown)
  const allClasses = useMemo(() => {
    const s = new Set(drugs.map(d => d.drug_class).filter(Boolean));
    return [...s].sort();
  }, [drugs]);

  // Total visible after filters
  const visibleCount = useMemo(() => {
    return drugs.filter(d => {
      const matchClass = !classFilter || d.drug_class === classFilter;
      const q = nameSearch.trim().toLowerCase();
      const matchName = !q ||
        d.generic_name?.toLowerCase().includes(q) ||
        d.drug_subclass?.toLowerCase().includes(q) ||
        d.drug_class?.toLowerCase().includes(q);
      return matchClass && matchName;
    }).length;
  }, [drugs, classFilter, nameSearch]);

  if (!system) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-drug-muted mb-4">Unknown system.</p>
        <Link to="/systems" className="text-primary-600 font-semibold hover:underline">
          Browse all systems
        </Link>
      </div>
    );
  }

  const Icon = ICONS[system.icon] || Pill;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* System header */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-3 rounded-xl ${system.bg}`}>
          <Icon className={`w-7 h-7 ${system.color}`} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{system.name}</h1>
          <p className="text-drug-muted mt-0.5 text-sm">
            {loading ? 'Loading…' : `${drugs.length} medication${drugs.length !== 1 ? 's' : ''} · ${conditionGroups.size} condition${conditionGroups.size !== 1 ? 's' : ''} · ${allClasses.length} drug class${allClasses.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            placeholder="Search within this system…"
            className="w-full pl-4 pr-4 py-2 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          className="py-2 px-3 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="">All Drug Classes ({allClasses.length})</option>
          {allClasses.map(cls => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>

        <button onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <List className="w-5 h-5" />
        </button>
        <button onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <Grid3X3 className="w-5 h-5" />
        </button>
      </div>

      {/* Filter summary */}
      {(classFilter || nameSearch) && (
        <div className="flex items-center gap-3 mb-4 text-sm text-drug-muted">
          <span>
            Showing <strong className="text-drug-text">{visibleCount}</strong> of {drugs.length} drugs
          </span>
          <button
            onClick={() => { setClassFilter(''); setNameSearch(''); }}
            className="text-red-500 font-semibold hover:text-red-700"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-drug-muted">Loading…</div>
      ) : (
        <>
          {drugs.length === 0 ? (
            <div className="bg-white border border-drug-border rounded-xl p-10 text-center">
              <Icon className={`w-10 h-10 mx-auto mb-3 ${system.color}`} />
              <p className="text-drug-muted">No medications matched to {system.name} yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...conditionGroups.values()].map((entry, idx) => (
                <ConditionSection
                  key={entry.condition.id}
                  condition={entry.condition}
                  drugs={entry.drugs}
                  viewMode={viewMode}
                  classFilter={classFilter}
                  nameSearch={nameSearch}
                  defaultOpen={idx === 0}
                  systemName={system.name}
                />
              ))}
            </div>
          )}

          <AiSystemConditionsFallback
            systemId={systemId}
            systemName={system.name}
            existingLabels={[...conditionGroups.values()].map(e => e.condition.label)}
          />
        </>
      )}

      <div className="mt-10 pt-6 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
        Drugs are grouped by the clinical conditions they treat within the {system.name} system.
        A drug treating multiple conditions (e.g. a beta-blocker used in both Hypertension and Heart Failure)
        appears under each relevant group.
      </div>
    </div>
  );
}
