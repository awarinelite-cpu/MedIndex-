import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, ChevronDown, ChevronUp, Sparkles, RefreshCw, Check, Trash2,
  Undo2, ExternalLink, AlertTriangle, User, Clock, Pill, Stethoscope, CheckSquare,
  ClipboardList,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useCustomConditions, approveCustomCondition, removeCondition } from '../hooks/useCustomConditions';
import { useProcedures } from '../hooks/useProcedures';
import { useAiProvider } from '../context/AiProviderContext';
import {
  fetchAiDrugText, approveDrugReview, restoreDrugPreviousVersion,
  saveReviewedDrugEdits, deleteReviewedDrug,
} from '../utils/aiDrugSave';
import {
  approveProcedureReview, restoreProcedurePreviousVersion,
  saveReviewedProcedureEdits, deleteReviewedProcedure,
} from '../utils/aiProcedureSave';
import { parseAiDrugDetail } from '../utils/parseAiDrugDetail';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';

// Same idea as REVIEW_FIELDS for drugs — the procedure fields worth
// showing/editing right in the queue.
const PROCEDURE_REVIEW_FIELDS = [
  { key: 'indications',         label: 'Indications' },
  { key: 'steps',               label: 'Procedure Steps' },
  { key: 'pre_procedure_care',  label: 'Pre-Procedure Care' },
  { key: 'post_procedure_care', label: 'Post-Procedure Care' },
  { key: 'complications',       label: 'Complications' },
  { key: 'contraindications',   label: 'Contraindications' },
];

// The fields worth showing/editing in the review queue — the clinical core,
// not every field a drug record can have.
const REVIEW_FIELDS = [
  { key: 'indications',    label: 'Indications' },
  { key: 'adult_dose',     label: 'Dosage' },
  { key: 'pharmacology',   label: 'Mechanism / Pharmacology' },
  { key: 'adverse_effect', label: 'Adverse Effects' },
  { key: 'contraindications', label: 'Contraindications' },
  { key: 'nursing_action', label: 'Nursing Considerations' },
];

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return '—'; }
}

function DrugReviewCard({ drug, selected, onToggleSelect }) {
  const { provider } = useAiProvider();
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState(() => {
    const initial = {};
    REVIEW_FIELDS.forEach(f => { initial[f.key] = drug[f.key] || ''; });
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiCompare, setAiCompare] = useState(null); // fresh AI text, for reference only
  const [aiState, setAiState] = useState('idle');

  const runAiInsight = async () => {
    setAiState('loading');
    setError('');
    try {
      const text = await fetchAiDrugText({ genericName: drug.generic_name, drugClass: drug.drug_class, endpoint: provider.endpoint });
      setAiCompare(parseAiDrugDetail(text));
      setAiState('done');
    } catch (e) {
      setError(e.message || 'AI lookup failed.');
      setAiState('error');
    }
  };

  const doApprove = async () => {
    setBusy(true); setError('');
    try { await approveDrugReview({ id: drug.id }); }
    catch (e) { setError(e.message || 'Failed to approve.'); }
    finally { setBusy(false); }
  };

  const doSaveEdits = async () => {
    setBusy(true); setError('');
    try { await saveReviewedDrugEdits({ id: drug.id, edits }); }
    catch (e) { setError(e.message || 'Failed to save edits.'); }
    finally { setBusy(false); }
  };

  const doRestore = async () => {
    setBusy(true); setError('');
    try { await restoreDrugPreviousVersion({ id: drug.id, previousVersion: drug.previous_version }); }
    catch (e) { setError(e.message || 'Failed to restore.'); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!window.confirm(`Delete "${drug.generic_name}" entirely? This can't be undone.`)) return;
    setBusy(true); setError('');
    try { await deleteReviewedDrug({ id: drug.id }); }
    catch (e) { setError(e.message || 'Failed to delete.'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${selected ? 'border-primary-400 ring-1 ring-primary-300' : 'border-drug-border'}`}>
      <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={!!selected}
          onChange={e => { e.stopPropagation(); onToggleSelect(drug.id); }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 flex-shrink-0 accent-primary-600"
          aria-label={`Select ${drug.generic_name}`}
        />
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <Pill className="w-4 h-4 text-primary-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-drug-text truncate">{drug.generic_name}</div>
          <div className="text-xs text-drug-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className={`font-semibold px-1.5 py-0.5 rounded ${drug.contribution_type === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {drug.contribution_type === 'new' ? 'New' : 'Updated'}
            </span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{drug.contributed_by_email || 'unknown'}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(drug.contributed_at)}</span>
            {drug.previous_version && <span className="text-red-600 font-semibold">overwrote existing data</span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-drug-muted" /> : <ChevronDown className="w-4 h-4 text-drug-muted" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-drug-border p-4 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/drug/${drug.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700">
              <ExternalLink className="w-3.5 h-3.5" /> View full drug page
            </Link>
            <button onClick={runAiInsight} disabled={aiState === 'loading'} className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg disabled:opacity-50">
              {aiState === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiState === 'loading' ? 'Asking AI…' : 'Get fresh AI insight for comparison'}
            </button>
          </div>

          {aiCompare && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-drug-text max-h-48 overflow-y-auto">
              <div className="font-bold text-purple-900 mb-1">Fresh AI lookup (reference only — not saved)</div>
              {REVIEW_FIELDS.map(f => aiCompare[f.key] && (
                <div key={f.key} className="mb-1.5"><span className="font-semibold">{f.label}:</span> {aiCompare[f.key]}</div>
              ))}
            </div>
          )}

          {REVIEW_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs font-bold text-drug-muted uppercase tracking-wide">{f.label}</label>
              <textarea
                value={edits[f.key]}
                onChange={e => setEdits(s => ({ ...s, [f.key]: e.target.value }))}
                rows={3}
                className="mt-1 w-full text-sm border border-drug-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={doApprove} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Approve as-is
            </button>
            <button onClick={doSaveEdits} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Save edits & approve
            </button>
            {drug.previous_version && (
              <button onClick={doRestore} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
                <Undo2 className="w-3.5 h-3.5" /> Reject — restore previous version
              </button>
            )}
            <button onClick={doDelete} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConditionReviewCard({ systemId, systemName, condition, selected, onToggleSelect }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doApprove = async () => {
    setBusy(true); setError('');
    try { await approveCustomCondition(systemId, condition.id); }
    catch (e) { setError(e.message || 'Failed to approve.'); }
    finally { setBusy(false); }
  };
  const doDelete = async () => {
    if (!window.confirm(`Delete condition "${condition.label}"? Drugs keep their tags, but the condition card will disappear.`)) return;
    setBusy(true); setError('');
    try { await removeCondition(systemId, condition.id); }
    catch (e) { setError(e.message || 'Failed to delete.'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 ${selected ? 'border-primary-400 ring-1 ring-primary-300' : 'border-drug-border'}`}>
      <input
        type="checkbox"
        checked={!!selected}
        onChange={() => onToggleSelect(`${systemId}_${condition.id}`)}
        className="w-4 h-4 flex-shrink-0 accent-primary-600"
        aria-label={`Select ${condition.label}`}
      />
      <Stethoscope className="w-4 h-4 text-primary-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-drug-text truncate">{condition.label}</div>
        <div className="text-xs text-drug-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          <span>{systemName}</span>
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{condition.contributed_by_email || 'unknown'}</span>
        </div>
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </div>
      <Link to={`/system/${systemId}`} target="_blank" className="text-primary-600 hover:text-primary-700" title="View system page">
        <ExternalLink className="w-4 h-4" />
      </Link>
      <button onClick={doApprove} disabled={busy} title="Approve" className="text-green-700 bg-green-100 hover:bg-green-200 rounded-lg p-1.5 disabled:opacity-50">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={doDelete} disabled={busy} title="Delete" className="text-red-700 bg-red-100 hover:bg-red-200 rounded-lg p-1.5 disabled:opacity-50">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function ProcedureReviewCard({ procedure, selected, onToggleSelect }) {
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState(() => {
    const initial = {};
    PROCEDURE_REVIEW_FIELDS.forEach(f => { initial[f.key] = procedure[f.key] || ''; });
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doApprove = async () => {
    setBusy(true); setError('');
    try { await approveProcedureReview({ id: procedure.id }); }
    catch (e) { setError(e.message || 'Failed to approve.'); }
    finally { setBusy(false); }
  };

  const doSaveEdits = async () => {
    setBusy(true); setError('');
    try { await saveReviewedProcedureEdits({ id: procedure.id, edits }); }
    catch (e) { setError(e.message || 'Failed to save edits.'); }
    finally { setBusy(false); }
  };

  const doRestore = async () => {
    setBusy(true); setError('');
    try { await restoreProcedurePreviousVersion({ id: procedure.id, previousVersion: procedure.previous_version }); }
    catch (e) { setError(e.message || 'Failed to restore.'); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!window.confirm(`Delete "${procedure.name}" entirely? This can't be undone.`)) return;
    setBusy(true); setError('');
    try { await deleteReviewedProcedure({ id: procedure.id }); }
    catch (e) { setError(e.message || 'Failed to delete.'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${selected ? 'border-primary-400 ring-1 ring-primary-300' : 'border-drug-border'}`}>
      <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={!!selected}
          onChange={e => { e.stopPropagation(); onToggleSelect(procedure.id); }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 flex-shrink-0 accent-primary-600"
          aria-label={`Select ${procedure.name}`}
        />
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <ClipboardList className="w-4 h-4 text-primary-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-drug-text truncate">{procedure.name}</div>
          <div className="text-xs text-drug-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className={`font-semibold px-1.5 py-0.5 rounded ${procedure.contribution_type === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {procedure.contribution_type === 'new' ? 'New' : 'Updated'}
            </span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{procedure.contributed_by_email || 'unknown'}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(procedure.contributed_at)}</span>
            {procedure.previous_version && <span className="text-red-600 font-semibold">overwrote existing data</span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-drug-muted" /> : <ChevronDown className="w-4 h-4 text-drug-muted" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-drug-border p-4 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
            </div>
          )}

          <Link to={`/procedure/${procedure.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700">
            <ExternalLink className="w-3.5 h-3.5" /> View full procedure page
          </Link>

          {PROCEDURE_REVIEW_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs font-bold text-drug-muted uppercase tracking-wide">{f.label}</label>
              <textarea
                value={edits[f.key]}
                onChange={e => setEdits(s => ({ ...s, [f.key]: e.target.value }))}
                rows={3}
                className="mt-1 w-full text-sm border border-drug-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={doApprove} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Approve as-is
            </button>
            <button onClick={doSaveEdits} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Save edits & approve
            </button>
            {procedure.previous_version && (
              <button onClick={doRestore} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
                <Undo2 className="w-3.5 h-3.5" /> Reject — restore previous version
              </button>
            )}
            <button onClick={doDelete} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminReviewPage() {
  const { drugs } = useDrugs();
  const { customConditionsBySystem } = useCustomConditions();
  const { procedures } = useProcedures();
  const [tab, setTab] = useState('drugs');
  const [selectedDrugIds, setSelectedDrugIds] = useState(() => new Set());
  const [selectedConditionKeys, setSelectedConditionKeys] = useState(() => new Set());
  const [selectedProcedureIds, setSelectedProcedureIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const pendingDrugs = useMemo(
    () => (drugs || []).filter(d => d.needs_review === true),
    [drugs]
  );

  const pendingConditions = useMemo(() => {
    const out = [];
    Object.entries(customConditionsBySystem || {}).forEach(([systemId, list]) => {
      const systemName = ANATOMICAL_SYSTEMS.find(s => s.id === systemId)?.name || systemId;
      (list || []).forEach(c => { if (c.needs_review) out.push({ systemId, systemName, condition: c }); });
    });
    return out;
  }, [customConditionsBySystem]);

  const pendingProcedures = useMemo(
    () => (procedures || []).filter(p => p.needs_review === true),
    [procedures]
  );

  const toggleDrugSelect = (id) => {
    setSelectedDrugIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleConditionSelect = (key) => {
    setSelectedConditionKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleProcedureSelect = (id) => {
    setSelectedProcedureIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allDrugsSelected = pendingDrugs.length > 0 && selectedDrugIds.size === pendingDrugs.length;
  const allConditionsSelected = pendingConditions.length > 0 && selectedConditionKeys.size === pendingConditions.length;
  const allProceduresSelected = pendingProcedures.length > 0 && selectedProcedureIds.size === pendingProcedures.length;

  const toggleSelectAllDrugs = () => {
    setSelectedDrugIds(allDrugsSelected ? new Set() : new Set(pendingDrugs.map(d => d.id)));
  };

  const toggleSelectAllConditions = () => {
    setSelectedConditionKeys(
      allConditionsSelected ? new Set() : new Set(pendingConditions.map(({ systemId, condition }) => `${systemId}_${condition.id}`))
    );
  };

  const toggleSelectAllProcedures = () => {
    setSelectedProcedureIds(allProceduresSelected ? new Set() : new Set(pendingProcedures.map(p => p.id)));
  };

  const approveSelectedDrugs = async () => {
    if (selectedDrugIds.size === 0) return;
    setBulkBusy(true); setBulkError('');
    const ids = Array.from(selectedDrugIds);
    const results = await Promise.allSettled(ids.map(id => approveDrugReview({ id })));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) setBulkError(`${failed} of ${ids.length} failed to save. Try again for those.`);
    setSelectedDrugIds(new Set());
    setBulkBusy(false);
  };

  const approveSelectedConditions = async () => {
    if (selectedConditionKeys.size === 0) return;
    setBulkBusy(true); setBulkError('');
    const targets = pendingConditions.filter(({ systemId, condition }) => selectedConditionKeys.has(`${systemId}_${condition.id}`));
    const results = await Promise.allSettled(targets.map(({ systemId, condition }) => approveCustomCondition(systemId, condition.id)));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) setBulkError(`${failed} of ${targets.length} failed to save. Try again for those.`);
    setSelectedConditionKeys(new Set());
    setBulkBusy(false);
  };

  const approveSelectedProcedures = async () => {
    if (selectedProcedureIds.size === 0) return;
    setBulkBusy(true); setBulkError('');
    const ids = Array.from(selectedProcedureIds);
    const results = await Promise.allSettled(ids.map(id => approveProcedureReview({ id })));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) setBulkError(`${failed} of ${ids.length} failed to save. Try again for those.`);
    setSelectedProcedureIds(new Set());
    setBulkBusy(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-1">
        <ClipboardCheck className="w-6 h-6 text-primary-600" />
        <h1 className="text-xl font-bold text-drug-text">Review Queue</h1>
      </div>
      <p className="text-sm text-drug-muted mb-5">
        Drugs, conditions, and procedures non-admin users' searches added or changed in the shared database.
        Nothing here waits on you before it goes live — this is where you catch anything that shouldn't have.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('drugs')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === 'drugs' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-drug-muted'}`}
        >
          Drugs ({pendingDrugs.length})
        </button>
        <button
          onClick={() => setTab('conditions')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === 'conditions' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-drug-muted'}`}
        >
          Conditions ({pendingConditions.length})
        </button>
        <button
          onClick={() => setTab('procedures')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === 'procedures' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-drug-muted'}`}
        >
          Procedures ({pendingProcedures.length})
        </button>
      </div>

      {bulkError && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{bulkError}
        </div>
      )}

      {tab === 'drugs' && (
        pendingDrugs.length === 0 ? (
          <div className="text-center text-sm text-drug-muted py-12">Nothing waiting on review. 🎉</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                onClick={toggleSelectAllDrugs}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-drug-muted hover:text-drug-text"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {allDrugsSelected ? 'Deselect all' : `Select all (${pendingDrugs.length})`}
              </button>
              <button
                onClick={approveSelectedDrugs}
                disabled={selectedDrugIds.size === 0 || bulkBusy}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {bulkBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve selected ({selectedDrugIds.size})
              </button>
            </div>
            <div className="space-y-2">
              {pendingDrugs.map(d => (
                <DrugReviewCard
                  key={d.id}
                  drug={d}
                  selected={selectedDrugIds.has(d.id)}
                  onToggleSelect={toggleDrugSelect}
                />
              ))}
            </div>
          </>
        )
      )}

      {tab === 'conditions' && (
        pendingConditions.length === 0 ? (
          <div className="text-center text-sm text-drug-muted py-12">Nothing waiting on review. 🎉</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                onClick={toggleSelectAllConditions}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-drug-muted hover:text-drug-text"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {allConditionsSelected ? 'Deselect all' : `Select all (${pendingConditions.length})`}
              </button>
              <button
                onClick={approveSelectedConditions}
                disabled={selectedConditionKeys.size === 0 || bulkBusy}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {bulkBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve selected ({selectedConditionKeys.size})
              </button>
            </div>
            <div className="space-y-2">
              {pendingConditions.map(({ systemId, systemName, condition }) => (
                <ConditionReviewCard
                  key={`${systemId}_${condition.id}`}
                  systemId={systemId}
                  systemName={systemName}
                  condition={condition}
                  selected={selectedConditionKeys.has(`${systemId}_${condition.id}`)}
                  onToggleSelect={toggleConditionSelect}
                />
              ))}
            </div>
          </>
        )
      )}

      {tab === 'procedures' && (
        pendingProcedures.length === 0 ? (
          <div className="text-center text-sm text-drug-muted py-12">Nothing waiting on review. 🎉</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                onClick={toggleSelectAllProcedures}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-drug-muted hover:text-drug-text"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {allProceduresSelected ? 'Deselect all' : `Select all (${pendingProcedures.length})`}
              </button>
              <button
                onClick={approveSelectedProcedures}
                disabled={selectedProcedureIds.size === 0 || bulkBusy}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {bulkBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve selected ({selectedProcedureIds.size})
              </button>
            </div>
            <div className="space-y-2">
              {pendingProcedures.map(p => (
                <ProcedureReviewCard
                  key={p.id}
                  procedure={p}
                  selected={selectedProcedureIds.has(p.id)}
                  onToggleSelect={toggleProcedureSelect}
                />
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}
