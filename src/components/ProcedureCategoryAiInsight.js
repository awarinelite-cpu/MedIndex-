import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { fetchProcedureCategorySuggestions } from '../utils/aiProcedureSave';

/* ── AI Insight: suggest new procedure categories ────────────────────────── */
/* Shown from the Procedures list page. Suggests categories not yet present  */
/* in the app (based on what's already in use), each with example           */
/* procedures. Picking one hands the category name back to the parent,      */
/* which sets it as the active filter — from there the existing "Find more  */
/* procedures in this category" AI tool populates it with real records.     */
export default function ProcedureCategoryAiInsight({ existingCategories, onSelectCategory }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');

  const run = async () => {
    setState('loading');
    setError('');
    try {
      const results = await fetchProcedureCategorySuggestions({ existingCategories });
      setSuggestions(results);
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load suggestions.');
      setState('error');
    }
  };

  return (
    <div className="mb-6 bg-primary-50 border border-primary-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-bold text-primary-700">
          <Sparkles className="w-4 h-4" /> AI Insight: New Categories
        </div>
        {state !== 'loading' && (
          <button
            onClick={run}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {state === 'idle' ? 'Suggest categories' : 'Regenerate'}
          </button>
        )}
      </div>

      {state === 'idle' && (
        <p className="px-4 pb-4 text-sm text-drug-muted">
          Let AI suggest additional procedure categories relevant to Nigerian nursing practice, based on what's already in the app.
        </p>
      )}

      {state === 'loading' && (
        <div className="px-4 pb-4 flex items-center gap-2 text-sm text-primary-700">
          <RefreshCw className="w-4 h-4 animate-spin" /> Thinking of categories…
        </div>
      )}

      {state === 'error' && (
        <div className="px-4 pb-4 flex items-center justify-between gap-2 text-sm">
          <span className="text-red-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</span>
          <button onClick={run} className="text-primary-700 font-semibold text-xs flex-shrink-0">Retry</button>
        </div>
      )}

      {state === 'done' && (
        suggestions.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-drug-muted">No new categories to suggest right now, the existing list already covers the common ones.</p>
        ) : (
          <div className="px-4 pb-4 space-y-2">
            {suggestions.map(c => (
              <button
                key={c.name}
                onClick={() => onSelectCategory(c.name)}
                className="w-full text-left bg-white border border-primary-200 rounded-lg px-3 py-2.5 hover:bg-primary-100 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-drug-text">{c.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                </div>
                {c.description && <p className="text-xs text-drug-muted mt-0.5">{c.description}</p>}
                {c.examples.length > 0 && (
                  <p className="text-xs text-primary-600 mt-1">e.g. {c.examples.join(', ')}</p>
                )}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
