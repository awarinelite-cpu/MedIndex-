import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { renderAiText } from '../utils/renderAiText';

// Auto-runs the same on-demand AI lookup used elsewhere in the app (the one
// that follows the full CSV field pattern — overview, indications, dosing,
// nursing action, etc.) for a drug that isn't in the verified database yet.
// Reached by tapping a drug name inside an "AI: More in <class>" list.
export default function AiDrugPage() {
  const { name } = useParams();
  const [searchParams] = useSearchParams();
  const drugClass = searchParams.get('class') || '';
  const genericName = decodeURIComponent(name || '');
  const navigate = useNavigate();

  const [state, setState] = useState('loading'); // loading | streaming | done | error
  const [text, setText]   = useState('');
  const [error, setError] = useState('');
  const startedFor = useRef('');

  const runLookup = async () => {
    setState('loading');
    setError('');
    setText('');
    try {
      const res = await fetch('/api/drug-ai-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genericName,
          drugClass: drugClass || undefined,
          notInDatabase: true,
        }),
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
      setState('done');
    } catch (e) {
      setError(e.message || 'Failed to load AI lookup.');
      setState('error');
    }
  };

  useEffect(() => {
    if (!genericName) return;
    // Guard against double-invocation from React StrictMode / re-renders.
    if (startedFor.current === genericName) return;
    startedFor.current = genericName;
    runLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genericName]);

  const goBack = () => {
    // Prefer real browser back so the previous page (search/filter state and
    // scroll position) is restored exactly as the user left it. Fall back to
    // /browse only if this page was opened with no prior history (e.g. a
    // shared link opened directly).
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(drugClass ? `/browse?class=${encodeURIComponent(drugClass)}` : '/browse');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={goBack} className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" /> Back{drugClass ? ` to ${drugClass}` : ''}
      </button>

      <div className="bg-white border border-drug-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-primary-500 flex-shrink-0" />
            <h1 className="text-lg font-bold text-drug-text truncate">{genericName}</h1>
            {state === 'streaming' && (
              <RefreshCw className="w-3.5 h-3.5 text-primary-400 animate-spin flex-shrink-0" />
            )}
          </div>
          {state === 'done' && (
            <button
              onClick={runLookup}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          )}
        </div>

        {state === 'loading' && (
          <div className="text-center py-10">
            <RefreshCw className="w-8 h-8 text-primary-300 mx-auto mb-3 animate-spin" />
            <p className="text-drug-muted text-sm">Looking up "{genericName}"…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={runLookup}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-semibold text-sm hover:bg-primary-100"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {(state === 'streaming' || state === 'done') && (
          text
            ? renderAiText(text)
            : <p className="text-sm text-drug-muted">Starting…</p>
        )}

        {state === 'done' && (
          <div className="mt-6 pt-4 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
            This drug is not yet in the verified database — the above is AI-generated on demand and not a
            substitute for the current product monograph or clinical judgment. Verify before applying to
            patient care.
          </div>
        )}
      </div>
    </div>
  );
}
