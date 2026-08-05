import React, { useState, useEffect } from 'react';
import { Sparkles, X, AlertTriangle, Loader, Save, Check } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAiProvider } from '../context/AiProviderContext';
import { apiUrl } from '../config/apiBase';
import { slugifyDrugName } from '../utils/aiDrugSave';

// ── API call for standard combination-therapy regimens for a CONDITION ────────
// Distinct from the per-drug synergy list in DrugInteractionChecker.js: this
// starts from a condition/indication (not a specific drug) and returns whole
// regimens — each with its own set of component drugs and doses — rather
// than single partner drugs relative to one starting drug.
async function fetchIndicationCombinations(conditionLabel, systemName, providerId = 'gemini') {
  const response = await fetch(apiUrl('/api/drug-interaction-check'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conditionLabel, systemName, provider: providerId, mode: 'indication_synergy' }),
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

// ── Persist a combination regimen as its own demarcated drug-list entry ────
// Saved under a stable id derived from its component drugs (not the regimen
// display name alone), so re-saving the same regimen from a different
// wording of its name still updates one record instead of duplicating it.
// is_combination_therapy is what lets ConditionSection's role classifier
// (drugRoleClassification.js) show it under "Combination Therapy Drugs"
// instead of "Main Indicated" or "Adjunct".
async function saveCombinationRegimen({ regimen, conditionId, conditionLabel }) {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error('Sign in to save this regimen.');
  }
  const componentNames = Array.isArray(regimen.drugs)
    ? regimen.drugs.map(d => d.name).filter(Boolean)
    : [];
  const combinedName = regimen.regimenName || componentNames.join(' + ') || 'Combination regimen';
  const docId = `combo_${slugifyDrugName(componentNames.join('_') || combinedName)}`;
  const ref = doc(db, 'drugs', docId);
  const existing = await getDoc(ref);

  await setDoc(ref, {
    generic_name:            combinedName,
    drug_class:               'Combination Therapy',
    drug_subclass:             null,
    is_combination_therapy:    true,
    combination_components:    Array.isArray(regimen.drugs) ? regimen.drugs : [],
    indications:                regimen.indication || conditionLabel || '',
    overview:                   regimen.clinicalReason || '',
    pharmacology:                regimen.clinicalReason || '',
    adverse_effect:              regimen.cautionNote || '',
    prescription_status:         'Prescription',
    condition_tags:              conditionId ? arrayUnion(conditionId) : [],
    source:                      'AI Generated — Combination Regimen',
    status:                      'Active',
    created_at:  existing.exists() ? (existing.data().created_at || serverTimestamp()) : serverTimestamp(),
    last_updated: serverTimestamp(),
  }, { merge: true });

  return docId;
}

// ── Popup with the full detail for one combination regimen ─────────────────────
function RegimenModal({ regimen, onClose, onSave, saveState, saveError }) {
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
            <span className="font-bold truncate" style={{ color: '#065F46' }}>{regimen.regimenName}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 flex-shrink-0">
            <X className="w-4 h-4" style={{ color: '#065F46' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className="inline-block text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ color: '#065F46', background: '#ECFDF5', border: '1px solid #6EE7B7' }}
            >
              Combination Regimen
            </span>
            {onSave && (
              <button
                onClick={onSave}
                disabled={saveState === 'saving'}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full disabled:opacity-60"
                style={{
                  color: saveState === 'saved' ? '#065F46' : '#fff',
                  background: saveState === 'saved' ? '#ECFDF5' : (saveState === 'error' ? '#DC2626' : '#059669'),
                  border: saveState === 'saved' ? '1px solid #6EE7B7' : 'none',
                }}
              >
                {saveState === 'saving' ? (
                  <><Loader className="w-3 h-3 animate-spin" /> Saving…</>
                ) : saveState === 'saved' ? (
                  <><Check className="w-3 h-3" /> Saved as Combination Therapy</>
                ) : saveState === 'error' ? (
                  <><AlertTriangle className="w-3 h-3" /> Retry save</>
                ) : (
                  <><Save className="w-3 h-3" /> Save to drug list</>
                )}
              </button>
            )}
          </div>
          {saveState === 'error' && saveError && (
            <p className="text-xs text-red-600 -mt-2">{saveError}</p>
          )}

          {regimen.indication && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">Indication</p>
              <p className="text-sm text-drug-text leading-relaxed">{regimen.indication}</p>
            </div>
          )}
          {regimen.clinicalReason && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-1">Why these are combined</p>
              <p className="text-sm text-drug-text leading-relaxed">{regimen.clinicalReason}</p>
            </div>
          )}
          {regimen.cautionNote && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#92400E' }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#92400E' }}>
                  Known concern with this regimen
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#78350F' }}>{regimen.cautionNote}</p>
              </div>
            </div>
          )}

          {Array.isArray(regimen.drugs) && regimen.drugs.length > 0 && (
            <div className="pt-3 border-t border-drug-border">
              <p className="text-xs font-bold uppercase tracking-wide text-drug-muted mb-2">
                Component Drugs — Dosage, Frequency &amp; Duration
              </p>
              <div className="space-y-3">
                {regimen.drugs.map((d, i) => (
                  <div key={i} className="rounded-lg border border-drug-border p-3">
                    <div className="font-semibold text-sm text-drug-text mb-1.5">{d.name}</div>
                    <div className="space-y-1">
                      {d.dosage && (
                        <div className="flex items-start gap-2 text-sm text-drug-text">
                          <span className="font-semibold text-drug-muted flex-shrink-0 w-20">Dosage</span>
                          <span className="font-medium">{d.dosage}</span>
                        </div>
                      )}
                      {d.frequency && (
                        <div className="flex items-start gap-2 text-sm text-drug-text">
                          <span className="font-semibold text-drug-muted flex-shrink-0 w-20">Frequency</span>
                          <span className="font-medium">{d.frequency}</span>
                        </div>
                      )}
                      {d.duration && (
                        <div className="flex items-start gap-2 text-sm text-drug-text">
                          <span className="font-semibold text-drug-muted flex-shrink-0 w-20">Duration</span>
                          <span className="font-medium">{d.duration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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

// ── Button + list, embedded inside a condition card ─────────────────────────────
export default function IndicationCombinationPanel({ conditionId, conditionLabel, systemName }) {
  const { providerId, provider } = useAiProvider();
  const [state, setState]       = useState('idle'); // idle | loading | done | error
  const [list, setList]         = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [openRegimen, setOpenRegimen] = useState(null);
  // Per-regimen save status, keyed by its index in `list` — 'saving' | 'saved' | 'error'
  const [saveStates, setSaveStates] = useState({});
  const [saveErrors, setSaveErrors] = useState({});

  const handleSaveRegimen = async (regimen, idx) => {
    if (saveStates[idx] === 'saving') return;
    setSaveStates(prev => ({ ...prev, [idx]: 'saving' }));
    setSaveErrors(prev => ({ ...prev, [idx]: '' }));
    try {
      await saveCombinationRegimen({ regimen, conditionId, conditionLabel });
      setSaveStates(prev => ({ ...prev, [idx]: 'saved' }));
    } catch (e) {
      setSaveStates(prev => ({ ...prev, [idx]: 'error' }));
      setSaveErrors(prev => ({ ...prev, [idx]: e.message || 'Failed to save this regimen.' }));
    }
  };

  const runLookup = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const data = await fetchIndicationCombinations(conditionLabel, systemName, providerId);
      setList(data);
      setState('done');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to load combination regimens.');
      setState('error');
    }
  };

  return (
    <div className="rounded-xl border border-drug-border p-4 bg-emerald-50/30">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-drug-text">Combination Therapy for {conditionLabel}</h3>
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
          <p className="text-xs text-drug-muted mt-1 mb-3">
            See standard multi-drug regimens used to treat {conditionLabel} — combinations chosen for
            synergistic or complementary benefit, not interactions to avoid.
          </p>
          <button
            onClick={runLookup}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-xs hover:bg-emerald-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Show Combination Regimens
          </button>
        </>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-drug-muted mt-2">
          <Loader className="w-4 h-4 animate-spin" /> Finding combination regimens for {conditionLabel}…
        </div>
      )}

      {state === 'error' && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={runLookup} className="ml-auto text-xs font-bold underline flex-shrink-0">Retry</button>
        </div>
      )}

      {state === 'done' && (
        list.length === 0 ? (
          <p className="text-sm text-drug-muted mt-2">
            No well-established combination regimens were flagged for {conditionLabel}.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-drug-border border border-drug-border rounded-xl overflow-hidden bg-white">
            {list.map((r, i) => {
              const saveState = saveStates[i];
              return (
                <div key={i} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => setOpenRegimen(i)}
                    className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                        <span className="text-sm font-semibold text-drug-text truncate">{r.regimenName}</span>
                        {r.cautionNote && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: '#92400E' }}
                            title="This regimen has a known safety concern — see details"
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
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSaveRegimen(r, i); }}
                    disabled={saveState === 'saving'}
                    title="Save this combination to the drug list, demarcated as Combination Therapy"
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 disabled:opacity-60"
                    style={{
                      color: saveState === 'saved' ? '#065F46' : (saveState === 'error' ? '#DC2626' : '#059669'),
                      background: saveState === 'saved' ? '#ECFDF5' : '#fff',
                      border: '1px solid ' + (saveState === 'saved' ? '#6EE7B7' : (saveState === 'error' ? '#FECACA' : '#A7F3D0')),
                    }}
                  >
                    {saveState === 'saving' ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : saveState === 'saved' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {state === 'done' && (
        <p className="text-xs text-drug-muted mt-2">
          ⚠ AI-generated — tap any regimen for its drugs, rationale, and dosing. Always verify against current guidelines.
        </p>
      )}

      {openRegimen !== null && list[openRegimen] && (
        <RegimenModal
          regimen={list[openRegimen]}
          onClose={() => setOpenRegimen(null)}
          onSave={() => handleSaveRegimen(list[openRegimen], openRegimen)}
          saveState={saveStates[openRegimen]}
          saveError={saveErrors[openRegimen]}
        />
      )}
    </div>
  );
}
