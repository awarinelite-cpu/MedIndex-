import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ClipboardList, Pencil, Save, X, Trash2, RefreshCw, AlertTriangle,
  Pill, Stethoscope, Plus,
} from 'lucide-react';
import { useProcedures } from '../hooks/useProcedures';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { renderAiText } from '../utils/renderAiText';
import { saveProcedureDetails, deleteReviewedProcedure } from '../utils/aiProcedureSave';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';

const SECTIONS = [
  { key: 'overview',            label: 'Overview' },
  { key: 'indications',         label: 'Indications' },
  { key: 'equipment_needed',    label: 'Equipment Needed' },
  { key: 'pre_procedure_care',  label: 'Pre-Procedure Care' },
  { key: 'steps',               label: 'Procedure Steps' },
  { key: 'post_procedure_care', label: 'Post-Procedure Care' },
  { key: 'complications',       label: 'Complications' },
  { key: 'contraindications',   label: 'Contraindications' },
];

// Flat list of every condition across every system, for the related-
// conditions picker — each carries its own system id/name for display.
const ALL_CONDITIONS = Object.entries(SYSTEM_CONDITIONS).flatMap(([systemId, list]) => {
  const systemName = ANATOMICAL_SYSTEMS.find(s => s.id === systemId)?.name || systemId;
  return (list || []).map(c => ({ ...c, systemId, systemName, key: `${systemId}::${c.id}` }));
});

function fmtBody(body) {
  // Section bodies are stored as plain text with '\n' separated lines
  // (already stripped of markdown by parseAiProcedureDetail); render them
  // as a lightweight markdown block the same way AI text is rendered
  // elsewhere, by wrapping in a synthetic header-less block.
  return renderAiText(body);
}

export default function ProcedureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { procedures } = useProcedures();
  const { drugs } = useDrugs();
  const { isAdmin } = useAuth();

  const procedure = useMemo(() => procedures.find(p => p.id === id), [procedures, id]);

  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState(null);
  const [drugQuery, setDrugQuery] = useState('');
  const [conditionQuery, setConditionQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (procedure && !edits) {
      const initial = { category: procedure.category || '' };
      SECTIONS.forEach(s => { initial[s.key] = procedure[s.key] || ''; });
      initial.related_drug_ids = procedure.related_drug_ids || [];
      initial.related_condition_ids = procedure.related_condition_ids || [];
      setEdits(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedure]);

  if (!procedure) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-drug-muted">Procedure not found.</p>
        <Link to="/procedures" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
          ← Back to Procedures
        </Link>
      </div>
    );
  }

  const relatedDrugs = (procedure.related_drug_ids || [])
    .map(did => drugs.find(d => d.id === did))
    .filter(Boolean);

  const relatedConditions = (procedure.related_condition_ids || [])
    .map(key => ALL_CONDITIONS.find(c => c.key === key))
    .filter(Boolean);

  const drugResults = drugQuery.trim()
    ? drugs.filter(d => (d.generic_name || '').toLowerCase().includes(drugQuery.trim().toLowerCase())).slice(0, 8)
    : [];
  const conditionResults = conditionQuery.trim()
    ? ALL_CONDITIONS.filter(c => c.label.toLowerCase().includes(conditionQuery.trim().toLowerCase())).slice(0, 8)
    : [];

  const startEdit = () => {
    const initial = { category: procedure.category || '' };
    SECTIONS.forEach(s => { initial[s.key] = procedure[s.key] || ''; });
    initial.related_drug_ids = procedure.related_drug_ids || [];
    initial.related_condition_ids = procedure.related_condition_ids || [];
    setEdits(initial);
    setEditing(true);
    setError('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
  };

  const addRelatedDrug = (drugId) => {
    if (edits.related_drug_ids.includes(drugId)) return;
    setEdits(e => ({ ...e, related_drug_ids: [...e.related_drug_ids, drugId] }));
    setDrugQuery('');
  };
  const removeRelatedDrug = (drugId) => {
    setEdits(e => ({ ...e, related_drug_ids: e.related_drug_ids.filter(id2 => id2 !== drugId) }));
  };
  const addRelatedCondition = (key) => {
    if (edits.related_condition_ids.includes(key)) return;
    setEdits(e => ({ ...e, related_condition_ids: [...e.related_condition_ids, key] }));
    setConditionQuery('');
  };
  const removeRelatedCondition = (key) => {
    setEdits(e => ({ ...e, related_condition_ids: e.related_condition_ids.filter(k => k !== key) }));
  };

  const saveEdits = async () => {
    setBusy(true); setError('');
    try {
      await saveProcedureDetails({ id: procedure.id, fields: edits });
      setEditing(false);
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!window.confirm(`Delete "${procedure.name}" entirely? This can't be undone.`)) return;
    setBusy(true); setError('');
    try {
      await deleteReviewedProcedure({ id: procedure.id });
      navigate('/procedures');
    } catch (e) {
      setError(e.message || 'Failed to delete.');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Link to="/procedures" className="text-sm text-primary-600 hover:underline mb-4 inline-block">
        ← Back to Procedures
      </Link>

      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="w-6 h-6 text-primary-600 flex-shrink-0" />
          <h1 className="text-xl font-bold text-drug-text truncate">{procedure.name}</h1>
        </div>
        {isAdmin && !editing && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={startEdit} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={doDelete} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
      {procedure.category && !editing && (
        <span className="inline-block text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded mb-4">
          {procedure.category}
        </span>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 mb-4 mt-3">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {editing ? (
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-bold text-drug-muted uppercase tracking-wide">Category</label>
            <input
              type="text"
              value={edits.category}
              onChange={e => setEdits(s => ({ ...s, category: e.target.value }))}
              className="mt-1 w-full text-sm border border-drug-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          {SECTIONS.map(s => (
            <div key={s.key}>
              <label className="text-xs font-bold text-drug-muted uppercase tracking-wide">{s.label}</label>
              <textarea
                value={edits[s.key]}
                onChange={e => setEdits(state => ({ ...state, [s.key]: e.target.value }))}
                rows={4}
                className="mt-1 w-full text-sm border border-drug-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          ))}

          {/* Related drugs */}
          <div>
            <label className="text-xs font-bold text-drug-muted uppercase tracking-wide">Related Drugs</label>
            <div className="flex flex-wrap gap-2 mt-1 mb-2">
              {edits.related_drug_ids.map(did => {
                const d = drugs.find(x => x.id === did);
                return (
                  <span key={did} className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                    <Pill className="w-3 h-3" /> {d?.generic_name || did}
                    <button onClick={() => removeRelatedDrug(did)}><X className="w-3 h-3" /></button>
                  </span>
                );
              })}
            </div>
            <input
              type="text"
              value={drugQuery}
              onChange={e => setDrugQuery(e.target.value)}
              placeholder="Search drugs to link…"
              className="w-full text-sm border border-drug-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            {drugResults.length > 0 && (
              <div className="border border-drug-border rounded-lg mt-1 divide-y divide-drug-border overflow-hidden">
                {drugResults.map(d => (
                  <button key={d.id} onClick={() => addRelatedDrug(d.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
                    <Plus className="w-3.5 h-3.5 text-primary-500" /> {d.generic_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Related conditions */}
          <div>
            <label className="text-xs font-bold text-drug-muted uppercase tracking-wide">Related Conditions</label>
            <div className="flex flex-wrap gap-2 mt-1 mb-2">
              {edits.related_condition_ids.map(key => {
                const c = ALL_CONDITIONS.find(x => x.key === key);
                return (
                  <span key={key} className="inline-flex items-center gap-1 text-xs font-semibold bg-violet-50 text-violet-700 px-2 py-1 rounded-lg">
                    <Stethoscope className="w-3 h-3" /> {c?.label || key}
                    <button onClick={() => removeRelatedCondition(key)}><X className="w-3 h-3" /></button>
                  </span>
                );
              })}
            </div>
            <input
              type="text"
              value={conditionQuery}
              onChange={e => setConditionQuery(e.target.value)}
              placeholder="Search conditions to link…"
              className="w-full text-sm border border-drug-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            {conditionResults.length > 0 && (
              <div className="border border-drug-border rounded-lg mt-1 divide-y divide-drug-border overflow-hidden">
                {conditionResults.map(c => (
                  <button key={c.key} onClick={() => addRelatedCondition(c.key)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
                    <Plus className="w-3.5 h-3.5 text-primary-500" /> {c.label} <span className="text-drug-muted">— {c.systemName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={saveEdits} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={cancelEdit} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-drug-muted bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            {SECTIONS.map(s => procedure[s.key] && (
              <div key={s.key} className="mb-6">
                <h3 className="text-base font-bold text-drug-text mb-2">{s.label}</h3>
                {fmtBody(procedure[s.key])}
              </div>
            ))}
          </div>

          {(relatedDrugs.length > 0 || relatedConditions.length > 0) && (
            <div className="border-t border-drug-border pt-4 mt-2 space-y-3">
              {relatedDrugs.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-drug-muted uppercase tracking-wide mb-2">Related Drugs</h3>
                  <div className="flex flex-wrap gap-2">
                    {relatedDrugs.map(d => (
                      <Link key={d.id} to={`/drug/${d.id}`} className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100">
                        <Pill className="w-3 h-3" /> {d.generic_name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {relatedConditions.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-drug-muted uppercase tracking-wide mb-2">Related Conditions</h3>
                  <div className="flex flex-wrap gap-2">
                    {relatedConditions.map(c => (
                      <Link key={c.key} to={`/system/${c.systemId}`} className="inline-flex items-center gap-1 text-xs font-semibold bg-violet-50 text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-100">
                        <Stethoscope className="w-3 h-3" /> {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {procedure.source === 'AI Generated' && (
            <div className="border-t border-drug-border pt-4 mt-6 text-xs text-drug-muted leading-relaxed">
              This is AI-generated reference material and not a substitute for hands-on clinical training or your facility's current protocol. Verify before applying to patient care.
            </div>
          )}
        </>
      )}
    </div>
  );
}
