import React, { useState } from 'react';
import { Sparkles, RefreshCw, Plus, Check, AlertTriangle } from 'lucide-react';
import { fetchProcedureSuggestions, fetchAiProcedureText, saveAiProcedureToDatabase } from '../utils/aiProcedureSave';

/* ── AI insight: "find more procedures in this category" ─────────────────── */
/* Shown at the top of the results list whenever a category filter is       */
/* active. Any signed-in-or-not user can trigger the search itself; adding  */
/* a suggested procedure goes through the normal saveAiProcedureToDatabase  */
/* path, which already routes admin saves live and non-admin saves silently */
/* into the review queue — no special-casing needed here.                   */
export default function AiProcedureCategorySearchFallback({ category, existingNames }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [itemStates, setItemStates] = useState({}); // name -> 'adding' | 'added' | 'error'

  const run = async () => {
    setState('loading');
    setError('');
    try {
      const names = await fetchProcedureSuggestions({ categoryName: category, existingNames });
      setSuggestions(names);
      setItemStates({});
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to search.');
      setState('error');
    }
  };

  const addOne = async (name) => {
    setItemStates(s => ({ ...s, [name]: 'adding' }));
    try {
      const text = await fetchAiProcedureText({ procedureName: name });
      await saveAiProcedureToDatabase({ procedureName: name, text });
      setItemStates(s => ({ ...s, [name]: 'added' }));
    } catch {
      setItemStates(s => ({ ...s, [name]: 'error' }));
    }
  };

  if (!category) return null;

  return (
    <div className="mb-4 bg-primary-50 border border-primary-200 rounded-xl p-4">
      {state === 'idle' && (
        <button
          onClick={run}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          <Sparkles className="w-4 h-4" /> Find more procedures in "{category}"
        </button>
      )}

      {state === 'loading' && (
        <div className="flex items-center justify-center gap-2 text-sm text-primary-700 py-1">
          <RefreshCw className="w-4 h-4 animate-spin" /> Searching for more "{category}" procedures…
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-red-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</span>
          <button onClick={run} className="text-primary-700 font-semibold text-xs flex-shrink-0">Retry</button>
        </div>
      )}

      {state === 'done' && (
        suggestions.length === 0 ? (
          <p className="text-sm text-drug-muted text-center py-1">No other verified procedures found for "{category}" right now.</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">More in "{category}"</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(name => {
                const st = itemStates[name] || 'idle';
                return (
                  <button
                    key={name}
                    onClick={() => st === 'idle' && addOne(name)}
                    disabled={st !== 'idle'}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      st === 'added' ? 'bg-green-100 border-green-300 text-green-700'
                      : st === 'error' ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-white border-primary-300 text-primary-700 hover:bg-primary-100'
                    }`}
                  >
                    {st === 'adding' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {st === 'added' && <Check className="w-3 h-3" />}
                    {st === 'idle' && <Plus className="w-3 h-3" />}
                    {st === 'added' ? `${name} added` : st === 'error' ? `${name} — retry` : name}
                  </button>
                );
              })}
            </div>
          </>
        )
      )}
    </div>
  );
}
