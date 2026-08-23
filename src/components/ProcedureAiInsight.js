import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, Save, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { renderAiText } from '../utils/renderAiText';
import { fetchProcedureInsight, saveProcedureInsight } from '../utils/aiProcedureSave';

const KNOWN_DATA_KEYS = [
  ['overview', 'Overview'],
  ['indications', 'Indications'],
  ['equipment_needed', 'Equipment Needed'],
  ['pre_procedure_care', 'Pre-Procedure Care'],
  ['steps', 'Procedure Steps'],
  ['post_procedure_care', 'Post-Procedure Care'],
  ['complications', 'Complications'],
  ['contraindications', 'Contraindications'],
];

function buildKnownData(procedure) {
  return KNOWN_DATA_KEYS
    .filter(([key]) => procedure[key])
    .map(([key, label]) => `${label}: ${procedure[key]}`)
    .join('\n');
}

/* ── AI Insight card for an existing procedure ───────────────────────────── */
/* Adds nursing considerations, patient education, clinical pearls, and red  */
/* flags on top of the static reference sections — cached on the procedure   */
/* record (ai_insight) once an admin saves it, so most visitors just see it  */
/* instantly instead of regenerating.                                       */
export default function ProcedureAiInsight({ procedure, onClose }) {
  const { isAdmin } = useAuth();
  const [state, setState] = useState(procedure.ai_insight ? 'done' : 'idle'); // idle | loading | done | error
  const [text, setText]   = useState(procedure.ai_insight || '');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState(procedure.ai_insight ? 'saved' : 'idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setSaveState('idle');
    try {
      const full = await fetchProcedureInsight({
        procedureName: procedure.name,
        categoryName: procedure.category,
        knownData: buildKnownData(procedure),
      });
      setText(full);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI insight.');
      setState('error');
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaveState('saving');
    setSaveError('');
    try {
      await saveProcedureInsight({ id: procedure.id, text });
      setSaveState('saved');
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
              <CheckCircle className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {state === 'done' && (
            <>
              {isAdmin && saveState !== 'saved' && (
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
              Get AI-generated nursing considerations, patient education points, clinical pearls, and red flags for {procedure.name}.
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
            <p className="text-sm text-drug-muted">Generating insight for {procedure.name}…</p>
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

        {(state === 'done') && (
          <>
            {saveError && saveState === 'error' && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{saveError}
              </div>
            )}
            {text ? renderAiText(text) : <p className="text-sm text-drug-muted">Starting…</p>}
            <div className="mt-4 pt-3 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
              AI-generated reference material, not a substitute for hands-on clinical training or your facility's current protocol. Verify before applying to patient care.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
