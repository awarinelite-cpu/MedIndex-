import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, Save, X, CheckCircle, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchProcedureInsight, saveProcedureInsight } from '../utils/aiProcedureSave';
import { parseAiProcedureDetail } from '../utils/parseAiProcedureDetail';

const SECTIONS = [
  ['overview',            'Overview'],
  ['indications',         'Indications'],
  ['equipment_needed',    'Equipment Needed'],
  ['pre_procedure_care',  'Pre-Procedure Care'],
  ['steps',               'Procedure Steps'],
  ['post_procedure_care', 'Post-Procedure Care'],
  ['complications',       'Complications'],
  ['contraindications',   'Contraindications'],
];

// Builds the "existing content" context sent to the AI: the procedure's
// current saved fields PLUS whatever this session has already generated but
// not yet saved — so a Regenerate click adds further NEW points instead of
// re-suggesting the same ones.
function buildKnownData(procedure, additions) {
  return SECTIONS
    .map(([key, label]) => {
      const combined = [procedure[key], additions[key]].filter(Boolean).join('\n');
      return combined ? `${label}: ${combined}` : null;
    })
    .filter(Boolean)
    .join('\n');
}

function AdditionLines({ text }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-drug-text leading-relaxed">
          <Plus className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
}

/* ── AI Insight: add new points to a procedure's existing sections ──────── */
/* Never rewrites what's already there. Each Generate/Regenerate call adds   */
/* further new points on top of whatever's already pending in this session. */
/* Save merges the accumulated pending points straight into the procedure's  */
/* own fields (overview, indications, etc.) — nothing is stored separately. */
export default function ProcedureAiInsight({ procedure, onClose }) {
  const { isAdmin } = useAuth();
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [additions, setAdditions] = useState({}); // sectionKey -> accumulated new bullet text
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');

  const hasAdditions = SECTIONS.some(([key]) => additions[key]);

  const runLookup = async () => {
    setState('loading');
    setError('');
    setSaveState('idle');
    try {
      const full = await fetchProcedureInsight({
        procedureName: procedure.name,
        categoryName: procedure.category,
        knownData: buildKnownData(procedure, additions),
      });
      const parsed = parseAiProcedureDetail(full);
      setAdditions(prev => {
        const next = { ...prev };
        for (const [key] of SECTIONS) {
          if (parsed[key]) {
            next[key] = next[key] ? `${next[key]}\n${parsed[key]}` : parsed[key];
          }
        }
        return next;
      });
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI insight.');
      setState('error');
    }
  };

  const handleSave = async () => {
    if (!hasAdditions) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const fields = {};
      for (const [key] of SECTIONS) {
        if (additions[key]) {
          fields[key] = [procedure[key], additions[key]].filter(Boolean).join('\n');
        }
      }
      await saveProcedureInsight({ id: procedure.id, fields });
      setSaveState('saved');
      setAdditions({});
    } catch (e) {
      setSaveError(e.message || 'Failed to save.');
      setSaveState('error');
    }
  };

  return (
    <div className="mb-6 bg-white border border-primary-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3 bg-primary-50 border-b border-primary-100">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <h2 className="text-sm font-bold text-drug-text">AI Insight</h2>
          {saveState === 'saved' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Saved to procedure
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {state === 'done' && (
            <>
              {isAdmin && hasAdditions && (
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1 rounded-lg disabled:opacity-50"
                >
                  {saveState === 'saving' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saveState === 'error' ? 'Retry save' : 'Save'}
                </button>
              )}
              <button
                onClick={runLookup}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
            </>
          )}
          {onClose && (
            <button onClick={onClose} className="text-drug-muted hover:text-drug-text">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {state === 'idle' && (
          <div className="text-center py-4">
            <p className="text-sm text-drug-muted mb-4">
              Let AI add new points to {procedure.name}'s existing sections, it won't rewrite anything already there.
            </p>
            <button
              onClick={runLookup}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Generate AI Insight
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="text-center py-6">
            <RefreshCw className="w-7 h-7 text-primary-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-drug-muted">Looking for new points to add to {procedure.name}…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center py-4">
            <AlertTriangle className="w-7 h-7 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={runLookup}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {state === 'done' && (
          <>
            {saveError && saveState === 'error' && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{saveError}
              </div>
            )}
            {!hasAdditions ? (
              <p className="text-sm text-drug-muted text-center py-2">
                Nothing new to add right now, the existing sections already cover this well.
              </p>
            ) : (
              <div className="space-y-5">
                {SECTIONS.map(([key, label]) => additions[key] && (
                  <div key={key}>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-primary-600 mb-1.5">{label}</h3>
                    <AdditionLines text={additions[key]} />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
              {isAdmin
                ? 'These points are not yet saved to the procedure, press Save to add them.'
                : 'AI-generated reference material, not a substitute for hands-on clinical training or your facility\'s current protocol. Verify before applying to patient care.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
