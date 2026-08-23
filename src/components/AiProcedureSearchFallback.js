import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { renderAiText } from '../utils/renderAiText';
import { fetchAiProcedureText, saveAiProcedureToDatabase, isProcedureNotFoundText } from '../utils/aiProcedureSave';

/* ── AI fallback lookup for procedures not yet in the database ──────────── */
/* Any signed-in user can trigger it. Admins see an explicit save button    */
/* (saves live immediately); non-admins' lookups save quietly in the        */
/* background flagged for the admin review queue — same model as drugs.    */
export default function AiProcedureSearchFallback({ searchQuery }) {
  const { isAdmin } = useAuth();
  const cacheKey = `ai_procedure_search_${searchQuery.trim().toLowerCase()}`;

  const [state, setState]         = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]           = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError]         = useState('');
  const [queriedFor, setQueriedFor] = useState(searchQuery);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [notFound, setNotFound]   = useState(() => {
    const cached = sessionStorage.getItem(cacheKey);
    return cached ? isProcedureNotFoundText(cached) : false;
  });

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setSaveState('idle');
    setNotFound(false);
    setQueriedFor(searchQuery);
    try {
      const full = await fetchAiProcedureText({ procedureName: searchQuery.trim() });
      sessionStorage.setItem(cacheKey, full);
      setText(full);
      setState('done');
      const failedLookup = isProcedureNotFoundText(full);
      setNotFound(failedLookup);

      // Non-admins never see a save control — but their lookup still
      // quietly adds/refreshes this procedure in the background, flagged
      // for the review queue. Deliberately does not touch saveState.
      if (!isAdmin && !failedLookup) {
        saveAiProcedureToDatabase({ procedureName: searchQuery.trim(), text: full }).catch(() => {
          // Intentionally silent — this must never surface to the user.
        });
      }
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaveState('saving');
    setSaveError('');
    try {
      await saveAiProcedureToDatabase({ procedureName: queriedFor.trim(), text });
      setSaveState('saved');
    } catch (e) {
      setSaveError(e.message || 'Failed to save this procedure.');
      setSaveState('error');
    }
  };

  if (!searchQuery.trim()) return null;

  if (state === 'idle') {
    return (
      <div className="mt-6 bg-primary-50 border border-primary-200 rounded-xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-primary-500 mx-auto mb-3" />
        <p className="text-sm text-drug-text mb-4">
          "{searchQuery}" isn't in our procedure database yet. Want the AI to look it up — technique,
          equipment, and full clinical details — on the spot?
        </p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Ask AI about "{searchQuery}"
        </button>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-8 text-center">
        <RefreshCw className="w-8 h-8 text-primary-400 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-drug-muted">Looking up "{queriedFor}"…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mt-6 bg-white border border-drug-border rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={runLookup}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  // streaming or done
  return (
    <div className="mt-6 bg-white border border-drug-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-bold text-drug-text">AI Lookup: {queriedFor}</h2>
          {saveState === 'saved' && (
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              ✓ Saved to database
            </span>
          )}
          {!isAdmin && state === 'done' && !notFound && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Submitted for admin review
            </span>
          )}
        </div>

        {state === 'done' && (
          <div className="flex items-center gap-2">
            {isAdmin && !notFound && saveState !== 'saved' && (
              <button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: saveState === 'error' ? '#FEF2F2' : '#1e40af',
                  color: saveState === 'error' ? '#DC2626' : '#fff',
                  border: saveState === 'error' ? '1px solid #FECACA' : 'none',
                  cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: saveState === 'saving' ? 0.7 : 1,
                }}
              >
                {saveState === 'saving' ? (
                  <><RefreshCw style={{ width: 13, height: 13 }} /> Saving…</>
                ) : saveState === 'error' ? (
                  <>⚠ {saveError || 'Failed'} — Retry</>
                ) : (
                  <><Save style={{ width: 13, height: 13 }} /> Save to Database</>
                )}
              </button>
            )}
            <button
              onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
        )}
      </div>

      {state === 'done' && notFound ? (
        <div className="text-center py-6">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-drug-text mb-1">
            Couldn't confirm "{queriedFor}" as a real clinical/nursing procedure.
          </p>
          <p className="text-xs text-drug-muted mb-4">
            Nothing was saved to the database. Check the spelling, or try the full name if this was an
            abbreviation.
          </p>
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); runLookup(); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      ) : (
        text
          ? renderAiText(text)
          : <p className="text-sm text-drug-muted">Starting…</p>
      )}

      {state === 'done' && !notFound && (
        <div className="mt-6 pt-4 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
          This procedure is not yet in the verified database — the above is AI-generated on demand and not a
          substitute for hands-on clinical training or your facility's current protocol. Verify before applying to patient care.
        </div>
      )}
    </div>
  );
}
