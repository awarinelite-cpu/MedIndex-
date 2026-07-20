import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAiProvider } from '../context/AiProviderContext';
import { renderAiText } from '../utils/renderAiText';
import { saveAiDrugToDatabase, isDrugNotFoundText } from '../utils/aiDrugSave';

/* ── AI fallback lookup for drugs not yet in the database ───────────────── */
/* Shared between BrowsePage and HomePage — offers to look a term up with   */
/* AI whenever it doesn't exactly match an existing drug's generic name.    */
export default function AiSearchFallback({ searchQuery }) {
  const { isAdmin } = useAuth();
  const { provider } = useAiProvider();
  const cacheKey = `ai_search_${searchQuery.trim().toLowerCase()}`;

  const [state, setState]         = useState(() => sessionStorage.getItem(cacheKey) ? 'done' : 'idle');
  const [text, setText]           = useState(() => sessionStorage.getItem(cacheKey) || '');
  const [error, setError]         = useState('');
  const [queriedFor, setQueriedFor] = useState(searchQuery);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [notFound, setNotFound]   = useState(() => {
    const cached = sessionStorage.getItem(cacheKey);
    return cached ? isDrugNotFoundText(cached) : false;
  });

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    setSaveState('idle');
    setNotFound(false);
    setQueriedFor(searchQuery);
    try {
      const res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genericName: searchQuery.trim(), notInDatabase: true }),
      });

      if (!res.ok || !res.body) {
        let message = 'Something went wrong.';
        try { message = (await res.json()).error || message; } catch {}
        throw new Error(message);
      }

      setState('streaming');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }
      sessionStorage.setItem(cacheKey, full);
      setState('done');
      const failedLookup = isDrugNotFoundText(full);
      setNotFound(failedLookup);

      // Non-admins never see a save control or the "✓ Saved" badge — but
      // every AI lookup they run still quietly adds/refreshes this drug in
      // the shared database in the background. Deliberately does NOT touch
      // saveState/saveError, since those drive UI (including the "✓ Saved
      // to database" badge above) that must stay invisible to them.
      // A lookup that didn't actually resolve to a real drug is never saved.
      if (!isAdmin && !failedLookup) {
        saveAiDrugToDatabase({ genericName: searchQuery.trim(), drugClass: '', text: full }).catch(() => {
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
      // Always save AI search results — replaces any existing entry with the
      // same name. Duplicate cleanup will be handled in the admin page later.
      await saveAiDrugToDatabase({
        genericName: queriedFor.trim(),
        drugClass:   '',
        text,
      });
      setSaveState('saved');
    } catch (e) {
      setSaveError(e.message || 'Failed to save this drug.');
      setSaveState('error');
    }
  };

  if (!searchQuery.trim()) return null;

  if (state === 'idle') {
    return (
      <div className="mt-6 bg-primary-50 border border-primary-200 rounded-xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-primary-500 mx-auto mb-3" />
        <p className="text-sm text-drug-text mb-4">
          "{searchQuery}" isn't in our database yet. Want the AI to look it up — dosage, route of
          administration, and full clinical details — on the spot?
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
          {state === 'streaming' && (
            <RefreshCw className="w-3.5 h-3.5 text-primary-400 animate-spin" />
          )}
          {saveState === 'saved' && (
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              ✓ Saved to database
            </span>
          )}
        </div>

        {state === 'done' && (
          <div className="flex items-center gap-2">
            {/* Save to Database — admin only, and only for a resolved drug */}
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
            Couldn't confirm "{queriedFor}" as a real generic or brand-name drug.
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
          This drug is not yet in the verified database — the above is AI-generated on demand and not a
          substitute for the current product monograph or clinical judgment. Verify before applying to patient care.
        </div>
      )}
    </div>
  );
}
