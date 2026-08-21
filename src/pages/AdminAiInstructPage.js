import React, { useState, useMemo } from 'react';
import { Sparkles, Send, Loader2, AlertTriangle, CheckCircle2, ArrowRight, History } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { fetchAiAdminInstruction, applyAiAdminEdit } from '../utils/aiDrugSave';

// ── Human-readable labels for every editable field ─────────────────────────
const FIELD_LABELS = {
  generic_name: 'Generic Name',
  brand_names: 'Brand Names',
  drug_class: 'Drug Class',
  drug_subclass: 'Drug Subclass',
  strength: 'Strength',
  indications: 'Indications',
  off_label_use: 'Off-Label Therapeutic Use',
  therapeutic_note: 'Therapeutic Note',
  pharmacology: 'Pharmacology',
  adult_dose: 'Adult Dose',
  child_dose: 'Child Dose',
  renal_dose: 'Renal Dose',
  administration: 'Administration',
  nstg_recommendations: 'NSTG Recommendations',
  contraindications: 'Contraindications',
  precautions: 'Precautions',
  pregnancy_lactation: 'Pregnancy & Lactation',
  interaction: 'Interaction',
  adverse_effect: 'Adverse Effect',
  advice_to_patients: 'Advice to Patients',
  nursing_action: 'Nursing Action',
  pharmacovigilance: 'Pharmacovigilance',
  product_description: 'Product Description',
  storage_recommendations: 'Storage Recommendations',
  pack_size_price: 'Pack Size & Price',
  prescription_status: 'Prescription Status',
};

const EXAMPLE_PROMPTS = [
  'Rename Paracetamol to Acetaminophen',
  "Change Ibuprofen's drug class to NSAID",
  'Add the brand name Calpol to Paracetamol',
  "Update Diazepam's contraindications to include severe respiratory depression",
];

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

// Finds the best-matching drug(s) in the live list for a name the AI proposed.
function findCandidates(drugs, name) {
  const n = normalize(name);
  if (!n) return [];
  const exact = drugs.filter(d => normalize(d.generic_name) === n);
  if (exact.length) return exact;
  const starts = drugs.filter(d => normalize(d.generic_name).startsWith(n) || n.startsWith(normalize(d.generic_name)));
  if (starts.length) return starts;
  return drugs.filter(d =>
    normalize(d.generic_name).includes(n) ||
    normalize(d.brand_names).includes(n)
  );
}

function combineAppend(current, addition) {
  const cur = (current || '').trim();
  const add = (addition || '').trim();
  if (!cur) return add;
  if (!add) return cur;
  // List-style fields (bullet lines) — add as a new line; plain fields
  // (e.g. brand_names) — add as a comma-separated item.
  if (cur.includes('\n- ') || cur.trim().startsWith('- ')) {
    const line = add.startsWith('- ') ? add : `- ${add}`;
    return `${cur}\n${line}`;
  }
  return `${cur}, ${add}`;
}

export default function AdminAiInstructPage() {
  const { drugs } = useDrugs();
  const liveDrugs = useMemo(() => (drugs || []).filter(d => !d._seed), [drugs]);

  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clarification, setClarification] = useState('');
  const [proposals, setProposals] = useState([]); // enriched edit proposals
  const [history, setHistory] = useState([]); // applied-this-session log, newest first

  const submit = async (text) => {
    const trimmed = (text ?? instruction).trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    setClarification('');
    setProposals([]);

    try {
      const data = await fetchAiAdminInstruction({ instruction: trimmed });

      if (!data.understood) {
        setClarification(data.clarification || "I wasn't able to understand that instruction — could you rephrase it with the drug name and exact change?");
        setLoading(false);
        return;
      }

      const enriched = (data.edits || []).map((edit, i) => {
        const candidates = findCandidates(liveDrugs, edit.drugName);
        const matched = candidates.length === 1 ? candidates[0] : null;
        const currentValue = matched ? (matched[edit.field] || '') : '';
        const finalValue = edit.changeType === 'append'
          ? combineAppend(currentValue, edit.newValue)
          : edit.newValue;

        return {
          key: `${Date.now()}_${i}`,
          instruction: trimmed,
          drugNameProposed: edit.drugName,
          field: edit.field,
          changeType: edit.changeType,
          explanation: edit.explanation,
          candidates,
          matched,
          currentValue,
          finalValue,
          status: candidates.length === 0 ? 'not_found' : (candidates.length > 1 ? 'ambiguous' : 'ready'),
          applying: false,
          applied: false,
        };
      });

      setProposals(enriched);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const selectCandidate = (key, drug) => {
    setProposals(prev => prev.map(p => {
      if (p.key !== key) return p;
      const currentValue = drug[p.field] || '';
      const finalValue = p.changeType === 'append' ? combineAppend(currentValue, p.candidates.length ? p.finalValue : '') : p.finalValue;
      return { ...p, matched: drug, currentValue, finalValue, status: 'ready' };
    }));
  };

  const apply = async (key) => {
    setProposals(prev => prev.map(p => p.key === key ? { ...p, applying: true } : p));
    const proposal = proposals.find(p => p.key === key);
    if (!proposal || !proposal.matched) return;

    try {
      const drugId = proposal.matched.id || proposal.matched.firestoreId;
      await applyAiAdminEdit({
        drugId,
        drug: proposal.matched,
        instruction: proposal.instruction,
        field: proposal.field,
        previousValue: proposal.currentValue,
        newValue: proposal.finalValue,
      });
      setProposals(prev => prev.map(p => p.key === key ? { ...p, applying: false, applied: true } : p));
      setHistory(prev => [{ ...proposal, appliedAt: new Date() }, ...prev]);
    } catch (e) {
      setProposals(prev => prev.map(p => p.key === key ? { ...p, applying: false, error: e.message } : p));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary-100 rounded-xl">
          <Sparkles className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-drug-text">AI Assistant</h1>
          <p className="text-sm text-drug-muted">Tell it what to change on any drug — it proposes the edit, you review and apply it.</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border border-drug-border rounded-xl p-5">
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="e.g. Change Ibuprofen's drug class to NSAID"
          rows={3}
          className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                     focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map(ex => (
              <button
                key={ex}
                onClick={() => { setInstruction(ex); submit(ex); }}
                className="text-xs px-2.5 py-1 rounded-full bg-drug-bg text-drug-muted hover:text-primary-600 hover:bg-primary-50 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            onClick={() => submit()}
            disabled={loading || !instruction.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-semibold text-sm
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 ml-3"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {clarification && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{clarification}</span>
        </div>
      )}

      {/* Proposed edits */}
      {proposals.map(p => (
        <div key={p.key} className="bg-white border border-drug-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide">{FIELD_LABELS[p.field] || p.field}</div>
              <div className="font-bold text-drug-text">
                {p.matched ? p.matched.generic_name : p.drugNameProposed}
              </div>
            </div>
            {p.applied && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Applied
              </span>
            )}
          </div>

          {p.explanation && <p className="text-sm text-drug-muted">{p.explanation}</p>}

          {p.status === 'not_found' && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              Couldn't find "{p.drugNameProposed}" in the database — check the spelling or search for it manually first.
            </div>
          )}

          {p.status === 'ambiguous' && (
            <div className="space-y-2">
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Multiple drugs match "{p.drugNameProposed}" — pick the right one:
              </p>
              <div className="flex flex-wrap gap-2">
                {p.candidates.map(c => (
                  <button
                    key={c.id || c.firestoreId}
                    onClick={() => selectCandidate(p.key, c)}
                    className="text-sm px-3 py-1.5 border border-drug-border rounded-lg hover:border-primary-400 hover:text-primary-600 transition-colors"
                  >
                    {c.generic_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(p.status === 'ready') && !p.applied && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-drug-bg rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-drug-muted uppercase mb-1">Current</div>
                  <div className="text-sm text-drug-text whitespace-pre-line">{p.currentValue || <em className="text-drug-muted">Empty</em>}</div>
                </div>
                <div className="bg-primary-50 rounded-lg p-3 border border-primary-200">
                  <div className="text-[11px] font-semibold text-primary-700 uppercase mb-1 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> New
                  </div>
                  <div className="text-sm text-drug-text whitespace-pre-line">{p.finalValue}</div>
                </div>
              </div>

              {p.error && <p className="text-sm text-red-600">{p.error}</p>}

              <button
                onClick={() => apply(p.key)}
                disabled={p.applying}
                className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700
                           disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {p.applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Apply this change
              </button>
            </>
          )}
        </div>
      ))}

      {/* Session history */}
      {history.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-drug-muted mb-2">
            <History className="w-4 h-4" /> Applied this session
          </div>
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="text-xs text-drug-muted bg-drug-bg rounded-lg px-3 py-2">
                <span className="font-semibold text-drug-text">{h.matched?.generic_name}</span> — {FIELD_LABELS[h.field] || h.field} updated
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
