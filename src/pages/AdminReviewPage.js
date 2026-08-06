import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, ChevronDown, ChevronUp, Sparkles, RefreshCw, Check, Trash2,
  Undo2, ExternalLink, AlertTriangle, User, Clock, Pill, Stethoscope,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useCustomConditions, approveCustomCondition, removeCondition } from '../hooks/useCustomConditions';
import { useAiProvider } from '../context/AiProviderContext';
import {
  fetchAiDrugText, approveDrugReview, restoreDrugPreviousVersion,
  saveReviewedDrugEdits, deleteReviewedDrug,
} from '../utils/aiDrugSave';
import { parseAiDrugDetail } from '../utils/parseAiDrugDetail';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';

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

function DrugReviewCard({ drug }) {
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
    <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
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

function ConditionReviewCard({ systemId, systemName, condition }) {
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
    <div className="bg-white border border-drug-border rounded-xl px-4 py-3 flex items-center gap-3">
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

export default function AdminReviewPage() {
  const { drugs } = useDrugs();
  const { customConditionsBySystem } = useCustomConditions();
  const [tab, setTab] = useState('drugs');

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-1">
        <ClipboardCheck className="w-6 h-6 text-primary-600" />
        <h1 className="text-xl font-bold text-drug-text">Review Queue</h1>
      </div>
      <p className="text-sm text-drug-muted mb-5">
        Drugs and conditions non-admin users' searches added or changed in the shared database. Nothing here
        waits on you before it goes live — this is where you catch anything that shouldn't have.
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
      </div>

      {tab === 'drugs' && (
        pendingDrugs.length === 0 ? (
          <div className="text-center text-sm text-drug-muted py-12">Nothing waiting on review. 🎉</div>
        ) : (
          <div className="space-y-2">
            {pendingDrugs.map(d => <DrugReviewCard key={d.id} drug={d} />)}
          </div>
        )
      )}

      {tab === 'conditions' && (
        pendingConditions.length === 0 ? (
          <div className="text-center text-sm text-drug-muted py-12">Nothing waiting on review. 🎉</div>
        ) : (
          <div className="space-y-2">
            {pendingConditions.map(({ systemId, systemName, condition }) => (
              <ConditionReviewCard key={`${systemId}_${condition.id}`} systemId={systemId} systemName={systemName} condition={condition} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
