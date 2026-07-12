import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Plus, FlaskConical, AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader, Sparkles } from 'lucide-react';
import { useAiProvider } from '../context/AiProviderContext';
import { fetchAiDrugText, saveAiDrugToDatabase } from '../utils/aiDrugSave';
import { parseAiDrugDetail } from '../utils/parseAiDrugDetail';

// ── Severity badge config ─────────────────────────────────────────────────────
const SEVERITY = {
  safe:          { label: 'Safe to Combine',       color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7', icon: CheckCircle },
  monitor:       { label: 'Use with Caution',      color: '#92400E', bg: '#FFFBEB', border: '#FCD34D', icon: AlertCircle },
  contraindicated:{ label: 'Avoid Combination',    color: '#991B1B', bg: '#FEF2F2', border: '#FCA5A5', icon: AlertTriangle },
  unknown:       { label: 'Insufficient Data',     color: '#374151', bg: '#F9FAFB', border: '#D1D5DB', icon: AlertCircle },
};

// ── API call via Vercel backend route (multi-provider) ────────────────────────
async function checkInteractionsWithAI(primaryDrug, selectedDrugs, providerId = 'gemini') {
  const response = await fetch('/api/drug-interaction-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ primaryDrug, selectedDrugs, provider: providerId }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Server error (${response.status}). Please try again.`);
  }
  if (!Array.isArray(data.results)) {
    throw new Error('Unexpected response from server. Please try again.');
  }
  return data.results;
}

// ── API call for the AI's own list of known incompatible drugs ────────────────
async function fetchIncompatibleDrugsList(primaryDrug, providerId = 'gemini') {
  const response = await fetch('/api/drug-interaction-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ primaryDrug, provider: providerId, mode: 'list' }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Server error (${response.status}). Please try again.`);
  }
  if (!Array.isArray(data.results)) {
    throw new Error('Unexpected response from server. Please try again.');
  }
  return data.results;
}

// ── API call for the AI's own list of synergistic combination-therapy partners ─
// The positive counterpart to fetchIncompatibleDrugsList.
async function fetchSynergyDrugsList(primaryDrug, providerId = 'gemini') {
  const response = await fetch('/api/drug-interaction-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ primaryDrug, provider: providerId, mode: 'synergy' }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Server error (${response.status}). Please try again.`);
  }
  if (!Array.isArray(data.results)) {
    throw new Error('Unexpected response from server. Please try again.');
  }
  return data.results;
}

// ── Drug search dropdown ──────────────────────────────────────────────────────
function DrugSearchInput({ allDrugs, excluded, onAdd }) {
  const { provider } = useAiProvider();
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const [searchState, setSearchState] = useState('idle'); // idle | searching | error
  const [searchError, setSearchError] = useState('');
  const inputRef                = useRef(null);
  const listRef                 = useRef(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allDrugs
      .filter(d => {
        const alreadyExcluded = excluded.some(e => e.id === d.id);
        if (alreadyExcluded) return false;
        return (
          d.generic_name?.toLowerCase().includes(q) ||
          d.brand_names?.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [query, allDrugs, excluded]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        listRef.current && !listRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Not found locally — search the AI, silently save the result to the drug
  // bank, then add the real saved drug (not a throwaway placeholder) to the
  // interaction check.
  const searchAndSave = async (nameOverride) => {
    const name = (nameOverride ?? query).trim();
    if (!name) return;
    setSearchState('searching');
    setSearchError('');
    try {
      const text   = await fetchAiDrugText({ genericName: name, endpoint: provider.endpoint });
      const result = await saveAiDrugToDatabase({ genericName: name, text });
      const parsed = parseAiDrugDetail(text);
      onAdd({
        id: result.id,
        generic_name: name,
        drug_class: parsed.drug_class || '',
        interaction: parsed.interaction || '',
      });
      setQuery('');
      setOpen(false);
      setSearchState('idle');
      inputRef.current?.focus();
    } catch (e) {
      setSearchError(e.message || 'Failed to search for this drug.');
      setSearchState('error');
    }
  };

  // Auto-search fallback: if the user pauses typing for a moment with zero
  // local matches, kick off the AI search automatically — no button tap
  // required. Guards against re-firing for a query already auto-searched
  // (e.g. if they then delete a character and retype the same thing) and
  // never fires while a search/result dropdown from a real match is open.
  const autoSearchedRef = useRef('');
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 3 || results.length > 0) return;
    if (searchState !== 'idle') return;
    if (autoSearchedRef.current === trimmed.toLowerCase()) return;

    const timer = setTimeout(() => {
      autoSearchedRef.current = trimmed.toLowerCase();
      searchAndSave(trimmed);
    }, 1100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, results.length, searchState]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 border border-drug-border rounded-lg bg-white focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
        <Search className="w-4 h-4 text-drug-muted flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setSearchState('idle'); setSearchError(''); }}
          onFocus={() => setOpen(true)}
          placeholder="Search any drug to check compatibility…"
          className="flex-1 text-sm bg-transparent outline-none text-drug-text placeholder-drug-muted"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); setSearchState('idle'); }} className="p-0.5 rounded hover:bg-gray-100">
            <X className="w-3.5 h-3.5 text-drug-muted" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-drug-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
        >
          {results.map(drug => (
            <li key={drug.id}>
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-primary-50 text-left transition-colors"
                onClick={() => {
                  onAdd(drug);
                  setQuery('');
                  setOpen(false);
                  inputRef.current?.focus();
                }}
              >
                <div>
                  <span className="text-sm font-semibold text-drug-text">{drug.generic_name}</span>
                  {drug.brand_names && (
                    <span className="text-xs text-drug-muted ml-2">({drug.brand_names.split(',')[0].trim()})</span>
                  )}
                  {drug.drug_class && (
                    <div className="text-xs text-drug-muted mt-0.5">{drug.drug_class}</div>
                  )}
                </div>
                <Plus className="w-4 h-4 text-primary-500 flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-drug-border rounded-xl shadow-xl px-4 py-3">
          {searchState === 'searching' ? (
            <div className="flex items-center gap-2 text-sm text-drug-muted">
              <Loader className="w-4 h-4 animate-spin flex-shrink-0" />
              Searching and saving &ldquo;{query}&rdquo;…
            </div>
          ) : (
            <>
              <p className="text-sm text-drug-muted mb-2">
                No drugs found for &ldquo;{query}&rdquo; in the database — searching automatically, or:
              </p>
              <button
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors text-left"
                onClick={() => searchAndSave()}
              >
                <span className="text-sm font-semibold text-primary-700">
                  Search now for &ldquo;{query}&rdquo;
                </span>
                <Search className="w-4 h-4 text-primary-500 flex-shrink-0" />
              </button>
              {searchState === 'error' && (
                <p className="text-xs text-red-600 mt-2">{searchError}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Same-class quick-adds ─────────────────────────────────────────────────────
function SameClassDrugs({ primaryDrug, allDrugs, selected, onAdd }) {
  const [showAll, setShowAll] = useState(false);

  const sameClass = useMemo(() => {
    if (!primaryDrug.drug_class) return [];
    return allDrugs
      .filter(d =>
        d.id !== primaryDrug.id &&
        d.drug_class === primaryDrug.drug_class &&
        !selected.some(s => s.id === d.id)
      )
      .slice(0, 12);
  }, [primaryDrug, allDrugs, selected]);

  if (sameClass.length === 0) return null;

  const visible = showAll ? sameClass : sameClass.slice(0, 6);

  return (
    <div>
      <p className="text-xs font-semibold text-drug-muted uppercase tracking-wide mb-2">
        Same class — {primaryDrug.drug_class}
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map(drug => (
          <button
            key={drug.id}
            onClick={() => onAdd(drug)}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {drug.generic_name}
          </button>
        ))}
        {sameClass.length > 6 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {showAll ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> +{sameClass.length - 6} more</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Result card for a single drug pair ───────────────────────────────────────
function InteractionResult({ result, onRemove }) {
  const sev = SEVERITY[result.severity] || SEVERITY.unknown;
  const Icon = sev.icon;

  return (
    <div
      className="rounded-xl border-2 overflow-hidden transition-shadow"
      style={{ borderColor: sev.border, background: sev.bg }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: sev.color }} />
          <span className="font-bold text-sm" style={{ color: sev.color }}>{result.drug}</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ color: sev.color, background: 'rgba(255,255,255,0.7)' }}
          >
            {sev.label}
          </span>
          {onRemove && (
            <button onClick={onRemove} className="p-0.5 rounded hover:bg-white/60">
              <X className="w-3.5 h-3.5" style={{ color: sev.color }} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {result.mechanism && (
          <div>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: sev.color, opacity: 0.7 }}>Mechanism</span>
            <p className="text-sm mt-0.5" style={{ color: sev.color }}>{result.mechanism}</p>
          </div>
        )}
        {result.effect && (
          <div>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: sev.color, opacity: 0.7 }}>Clinical Effect</span>
            <p className="text-sm mt-0.5" style={{ color: sev.color }}>{result.effect}</p>
          </div>
        )}
        {result.recommendation && (
          <div className="pt-1 border-t" style={{ borderColor: sev.border }}>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: sev.color, opacity: 0.7 }}>Recommendation</span>
            <p className="text-sm font-medium mt-0.5" style={{ color: sev.color }}>{result.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Popup with the full reason for one incompatibility ─────────────────────────
function IncompatibilityModal({ result, onClose }) {
  const sev = SEVERITY[result.severity] || SEVERITY.unknown;
  const Icon = sev.icon;

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: sev.bg, borderBottom: `1px solid ${sev.border}` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-5 h-5 flex-shrink-0" style={{ color: sev.color }} />
            <span className="font-bold truncate" style={{ color: sev.color }}>{result.drug}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 flex-shrink-0">
            <X className="w-4 h-4" style={{ color: sev.color }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <span
            className="inline-block text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ color: sev.color, background: sev.bg, border: `1px solid ${sev.border}` }}
          >
            {sev.label}
          </span>

          {result.mechanism && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">Why they don't mix</p>
              <p className="text-sm text-drug-text leading-relaxed">{result.mechanism}</p>
            </div>
          )}
          {result.effect && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">Clinical effect</p>
              <p className="text-sm text-drug-text leading-relaxed">{result.effect}</p>
            </div>
          )}
          {result.recommendation && (
            <div className="pt-3 border-t border-drug-border">
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">What to do</p>
              <p className="text-sm font-medium text-drug-text leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          <p className="text-xs text-drug-muted pt-2">
            AI-generated — verify against current prescribing information before applying to patient care.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Popup with the full detail for one combination-therapy partner ─────────────
function CombinationModal({ result, onClose }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: '#ECFDF5', borderBottom: '1px solid #6EE7B7' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: '#065F46' }} />
            <span className="font-bold truncate" style={{ color: '#065F46' }}>{result.drug}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 flex-shrink-0">
            <X className="w-4 h-4" style={{ color: '#065F46' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <span
            className="inline-block text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ color: '#065F46', background: '#ECFDF5', border: '1px solid #6EE7B7' }}
          >
            Combination Therapy
          </span>

          {result.indication && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">Indication</p>
              <p className="text-sm text-drug-text leading-relaxed">{result.indication}</p>
            </div>
          )}
          {result.clinicalReason && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">Why they're combined</p>
              <p className="text-sm text-drug-text leading-relaxed">{result.clinicalReason}</p>
            </div>
          )}
          {result.cautionNote && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#92400E' }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#92400E' }}>
                  Known concern with this combination
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#78350F' }}>{result.cautionNote}</p>
              </div>
            </div>
          )}
          {(result.dosage || result.frequency || result.duration) && (
            <div className="pt-3 border-t border-drug-border">
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-2">
                Dosage, Frequency &amp; Duration — {result.drug}
              </p>
              <div className="space-y-1.5">
                {result.dosage && (
                  <div className="flex items-start gap-2 text-sm text-drug-text">
                    <span className="font-semibold text-drug-muted flex-shrink-0 w-20">Dosage</span>
                    <span className="font-medium">{result.dosage}</span>
                  </div>
                )}
                {result.frequency && (
                  <div className="flex items-start gap-2 text-sm text-drug-text">
                    <span className="font-semibold text-drug-muted flex-shrink-0 w-20">Frequency</span>
                    <span className="font-medium">{result.frequency}</span>
                  </div>
                )}
                {result.duration && (
                  <div className="flex items-start gap-2 text-sm text-drug-text">
                    <span className="font-semibold text-drug-muted flex-shrink-0 w-20">Duration</span>
                    <span className="font-medium">{result.duration}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-drug-muted pt-2">
            AI-generated — verify against current prescribing information and clinical guidelines before applying to patient care.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Button + list of the AI's own known incompatibilities for this drug ────────
function IncompatibleDrugsPanel({ drug }) {
  const { providerId, provider } = useAiProvider();
  const [state, setState]     = useState('idle'); // idle | loading | done | error
  const [list, setList]       = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [openResult, setOpenResult] = useState(null);

  const runLookup = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const data = await fetchIncompatibleDrugsList(drug, providerId);
      setList(data);
      setState('done');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to load incompatible drugs.');
      setState('error');
    }
  };

  return (
    <div className="section-card p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-drug-text">Incompatible Drugs</h2>
        </div>
        {state === 'idle' && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: provider.color + '18', color: provider.color }}
          >
            {provider.icon} {provider.label}
          </span>
        )}
      </div>

      {state === 'idle' && (
        <>
          <p className="text-xs text-drug-muted mt-1 mb-4">
            See the AI's list of medications that interact with <strong>{drug.generic_name}</strong> — no need to
            add drugs one by one.
          </p>
          <button
            onClick={runLookup}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" /> Show Incompatible Drugs
          </button>
        </>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-drug-muted mt-3">
          <Loader className="w-4 h-4 animate-spin" /> Checking known interactions for {drug.generic_name}…
        </div>
      )}

      {state === 'error' && (
        <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={runLookup} className="ml-auto text-xs font-bold underline flex-shrink-0">Retry</button>
        </div>
      )}

      {state === 'done' && (
        list.length === 0 ? (
          <p className="text-sm text-drug-muted mt-3">
            No significant known interactions were flagged for {drug.generic_name}.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-drug-border border border-drug-border rounded-xl overflow-hidden">
            {list.map((r, i) => {
              const sev = SEVERITY[r.severity] || SEVERITY.unknown;
              const Icon = sev.icon;
              return (
                <button
                  key={i}
                  onClick={() => setOpenResult(r)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: sev.color }} />
                    <span className="text-sm font-semibold text-drug-text truncate">{r.drug}</span>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ color: sev.color, background: sev.bg }}
                  >
                    {sev.label}
                  </span>
                </button>
              );
            })}
          </div>
        )
      )}

      {state === 'done' && (
        <p className="text-xs text-drug-muted mt-3">
          ⚠ AI-generated — tap any drug for the full reason. Always verify against current prescribing information.
        </p>
      )}

      {openResult && (
        <IncompatibilityModal result={openResult} onClose={() => setOpenResult(null)} />
      )}
    </div>
  );
}

// ── Button + list of the AI's own known synergistic combination partners ───────
// The positive counterpart to IncompatibleDrugsPanel — combination therapy
// used to IMPROVE effectiveness, rather than interactions to avoid.
function CombinationTherapyPanel({ drug }) {
  const { providerId, provider } = useAiProvider();
  const [state, setState]       = useState('idle'); // idle | loading | done | error
  const [list, setList]         = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [openResult, setOpenResult] = useState(null);

  const runLookup = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const data = await fetchSynergyDrugsList(drug, providerId);
      setList(data);
      setState('done');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to load combination therapy options.');
      setState('error');
    }
  };

  return (
    <div className="section-card p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-bold text-drug-text">Combination Therapy</h2>
        </div>
        {state === 'idle' && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: provider.color + '18', color: provider.color }}
          >
            {provider.icon} {provider.label}
          </span>
        )}
      </div>

      {state === 'idle' && (
        <>
          <p className="text-xs text-drug-muted mt-1 mb-4">
            See drugs commonly combined with <strong>{drug.generic_name}</strong> to improve effectiveness —
            synergistic or complementary therapy, not interactions to avoid.
          </p>
          <button
            onClick={runLookup}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Show Combination Drugs
          </button>
        </>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-drug-muted mt-3">
          <Loader className="w-4 h-4 animate-spin" /> Finding combination therapy options for {drug.generic_name}…
        </div>
      )}

      {state === 'error' && (
        <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={runLookup} className="ml-auto text-xs font-bold underline flex-shrink-0">Retry</button>
        </div>
      )}

      {state === 'done' && (
        list.length === 0 ? (
          <p className="text-sm text-drug-muted mt-3">
            No well-established combination therapy partners were flagged for {drug.generic_name}.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-drug-border border border-drug-border rounded-xl overflow-hidden">
            {list.map((r, i) => (
              <button
                key={i}
                onClick={() => setOpenResult(r)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span className="text-sm font-semibold text-drug-text truncate">{r.drug}</span>
                    {r.cautionNote && (
                      <AlertTriangle
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: '#92400E' }}
                        title="This combination has a known safety concern — see details"
                      />
                    )}
                  </div>
                  {r.indication && (
                    <p className="text-xs text-drug-muted mt-0.5 ml-6 truncate">{r.indication}</p>
                  )}
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ color: '#065F46', background: '#ECFDF5' }}
                >
                  Details
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {state === 'done' && (
        <p className="text-xs text-drug-muted mt-3">
          ⚠ AI-generated — tap any drug for indication, clinical rationale, and dosing. Always verify against current prescribing information.
        </p>
      )}

      {openResult && (
        <CombinationModal result={openResult} onClose={() => setOpenResult(null)} />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DrugInteractionChecker({ drug, allDrugs }) {
  const { providerId, provider }    = useAiProvider();
  const [selected, setSelected]     = useState([]);   // drugs to check
  const [results, setResults]       = useState([]);   // AI results
  const [status, setStatus]         = useState('idle'); // idle | loading | done | error
  const [errorMsg, setErrorMsg]     = useState('');

  // Filter out the current drug from allDrugs
  const otherDrugs = useMemo(
    () => allDrugs.filter(d => d.id !== drug.id),
    [allDrugs, drug.id]
  );

  const addDrug = (d) => {
    setSelected(prev => prev.some(s => s.id === d.id) ? prev : [...prev, d]);
    // Clear stale results when selection changes
    setResults([]);
    setStatus('idle');
  };

  const removeDrug = (id) => {
    setSelected(prev => prev.filter(d => d.id !== id));
    setResults(prev => prev.filter(r => {
      const removed = selected.find(s => s.id === id);
      return removed ? r.drug !== removed.generic_name : true;
    }));
    setStatus('idle');
  };

  const handleCheck = async () => {
    if (selected.length === 0) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const data = await checkInteractionsWithAI(drug, selected, providerId);
      setResults(data);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to check interactions. Please try again.');
      setStatus('error');
    }
  };

  const summary = useMemo(() => {
    const counts = { safe: 0, monitor: 0, contraindicated: 0, unknown: 0 };
    results.forEach(r => { if (counts[r.severity] !== undefined) counts[r.severity]++; });
    return counts;
  }, [results]);

  return (
    <div className="space-y-4">

      {/* ── Existing static interaction data ─── */}
      {drug.interaction && (
        <div className="section-card p-5">
          <h3 className="text-sm font-bold text-drug-muted uppercase tracking-wide mb-3">Known Interactions (database)</h3>
          <p className="text-drug-muted text-xs mb-3">
            Always verify interactions against current prescribing information. Consult a pharmacist for patient-specific interaction checking.
          </p>
          <div className="space-y-1">
            {drug.interaction.split('\n').map((line, i) => line.trim() && (
              <div key={i} className="flex items-start gap-2 text-sm text-drug-text">
                <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI's own list of known incompatible drugs — one button, no manual add ─── */}
      <IncompatibleDrugsPanel drug={drug} />

      {/* ── Positive counterpart: synergistic combination therapy ─── */}
      <CombinationTherapyPanel drug={drug} />

      {/* ── Interaction checker ─── */}
      <div className="section-card p-5" style={{ overflow: 'visible' }}>
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary-500" />
            <h2 className="text-base font-bold text-drug-text">Drug Compatibility Checker</h2>
          </div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: provider.color + '18', color: provider.color }}
          >
            {provider.icon} {provider.label}
          </span>
        </div>
        <p className="text-xs text-drug-muted mb-4">
          Add drugs you want to combine with <strong>{drug.generic_name}</strong>. The AI will check each pair for safety.
        </p>

        {/* Search */}
        <div className="mb-4">
          <DrugSearchInput
            allDrugs={otherDrugs}
            excluded={selected}
            onAdd={addDrug}
          />
        </div>

        {/* Same-class quick adds */}
        <SameClassDrugs
          primaryDrug={drug}
          allDrugs={otherDrugs}
          selected={selected}
          onAdd={addDrug}
        />

        {/* Selected drugs chips */}
        {selected.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-drug-muted uppercase tracking-wide mb-2">
              Checking with {drug.generic_name}:
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.map(d => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-full"
                >
                  {d.generic_name}
                  <button onClick={() => removeDrug(d.id)} className="hover:text-primary-200">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selected.length > 1 && (
                <button
                  onClick={() => { setSelected([]); setResults([]); setStatus('idle'); }}
                  className="text-xs text-drug-muted hover:text-red-600 underline self-center"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Check button */}
        {selected.length > 0 && (
          <button
            onClick={handleCheck}
            disabled={status === 'loading'}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-700 text-white rounded-xl font-semibold text-sm hover:bg-primary-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <><Loader className="w-4 h-4 animate-spin" /> Checking interactions…</>
            ) : (
              <><FlaskConical className="w-4 h-4" /> Check {selected.length} drug{selected.length > 1 ? 's' : ''} for interactions</>
            )}
          </button>
        )}

        {status === 'error' && (
          <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ── Results ─── */}
      {status === 'done' && results.length > 0 && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="section-card px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-drug-text text-sm">Interaction Results for <span className="text-primary-700">{drug.generic_name}</span></h3>
                <p className="text-xs text-drug-muted mt-0.5">AI-generated — verify against current prescribing information</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {summary.safe > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" /> {summary.safe} safe
                  </span>
                )}
                {summary.monitor > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                    <AlertCircle className="w-3 h-3" /> {summary.monitor} caution
                  </span>
                )}
                {summary.contraindicated > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> {summary.contraindicated} avoid
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Individual cards — sorted: contraindicated → monitor → safe → unknown */}
          {[...results]
            .sort((a, b) => {
              const order = { contraindicated: 0, monitor: 1, safe: 2, unknown: 3 };
              return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
            })
            .map((result, i) => (
              <InteractionResult
                key={i}
                result={result}
                onRemove={() => {
                  setResults(prev => prev.filter((_, j) => j !== i));
                  setSelected(prev => prev.filter(d => d.generic_name !== result.drug));
                }}
              />
            ))
          }

          <p className="text-xs text-drug-muted px-1">
            ⚠ AI-generated content is a reference aid only. Always confirm with current product monographs, 
            a clinical pharmacist, or prescribing guidelines before applying to patient care.
          </p>
        </div>
      )}
    </div>
  );
}
