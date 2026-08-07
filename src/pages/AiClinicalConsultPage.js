// src/pages/AiClinicalConsultPage.js
// Route: /ai-consult
//
// A free-text clinical decision-support tool: describe a complaint/note,
// get a Diagnosis + Main/Adjunct/Combination Therapy plan, then build a
// combined Drug Course Chart from whichever suggestions you pick. This is
// the SAME engine (mode: 'clinical_plan' on /api/drug-ai-details) that
// powers NACON-EMR's patient-record consultation screen — grounded here in
// MedIndex's own live drug list rather than a patient record, since
// MedIndex has no patient/consultation-note model of its own.

import React, { useState } from 'react';
import { Sparkles, Loader2, Wand2, AlertTriangle, ShieldAlert, Table2, Check, X } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { getClinicalPlan, lookupDrugByName } from '../utils/clinicalPlan';
import { splitIntoSections, extractAllDrugRows, SECTION_META } from '../utils/parseClinicalPlan';
import { parseAllergyList, flagAllergicRows } from '../utils/allergyGuard';

function renderFormattedText(text) {
  const lines = (text || '').split('\n');
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <React.Fragment key={li}>
        {parts.map((part, pi) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={pi}>{part.slice(2, -2)}</strong>
          ) : (
            <React.Fragment key={pi}>{part}</React.Fragment>
          )
        )}
        {li < lines.length - 1 && '\n'}
      </React.Fragment>
    );
  });
}

// No shared toast library in this app (AdminPage.js rolls its own inline
// banner too) — small local implementation instead of pulling in a new
// dependency for one page.
function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = 'error') => {
    setToast({ msg, type });
    window.clearTimeout(show._t);
    show._t = window.setTimeout(() => setToast(null), 5000);
  };
  return [toast, show, () => setToast(null)];
}

export default function AiClinicalConsultPage() {
  const { drugs } = useDrugs();
  const [toast, showToast, dismissToast] = useToast();

  const [noteText, setNoteText] = useState('');
  const [allergies, setAllergies] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [rows, setRows] = useState([]);
  const [acknowledged, setAcknowledged] = useState({});
  const [selected, setSelected] = useState({});

  const allergyList = parseAllergyList(allergies);
  const hasAllergyHistory = allergyList.length > 0;
  const rowKey = r => `${r.category}::${r.name.toLowerCase()}`;

  const handleSuggest = async () => {
    if (!noteText.trim()) {
      showToast('Describe the complaint / note first');
      return;
    }
    setLoading(true);
    setResult('');
    setRows([]);
    setAcknowledged({});
    setSelected({});
    try {
      const { text } = await getClinicalPlan({
        noteText,
        allergies,
        age: age ? Number(age) : undefined,
        sex: sex || undefined,
        drugs,
      });
      setResult(text);

      const sections = splitIntoSections(text);
      const extracted = extractAllDrugRows(sections);
      const enriched = extracted.map(row => {
        const match = lookupDrugByName(drugs, row.name);
        return match ? { ...row, medIndexVerified: true, medIndexClass: match.drug_class || '' } : row;
      });
      const flagged = flagAllergicRows(enriched, allergies);
      setRows(flagged);

      // Same default-selection logic as NACON-EMR: top-ranked Main Therapy
      // option plus every Combination Therapy row (that's a standard-of-
      // care package, not alternatives) — Adjunct stays fully opt-in.
      const topMain = flagged.find(r => r.category === 'MAIN THERAPY' && !r.allergyConflict);
      const combinationRows = flagged.filter(r => r.category === 'COMBINATION THERAPY' && !r.allergyConflict);
      const defaults = {};
      if (topMain) defaults[rowKey(topMain)] = true;
      combinationRows.forEach(r => { defaults[rowKey(r)] = true; });
      setSelected(defaults);

      if (flagged.some(r => r.allergyConflict)) {
        showToast('AI suggested a drug that conflicts with a recorded allergy — review flagged item(s)');
      }
    } catch (e) {
      console.error('AI clinical consult', e);
      showToast(e?.message || 'AI suggestion failed');
    } finally {
      setLoading(false);
    }
  };

  const sections = result ? splitIntoSections(result) : [];
  const rowsByCategory = {
    'MAIN THERAPY': rows.filter(r => r.category === 'MAIN THERAPY'),
    'ADJUNCT THERAPY': rows.filter(r => r.category === 'ADJUNCT THERAPY'),
    'COMBINATION THERAPY': rows.filter(r => r.category === 'COMBINATION THERAPY'),
  };
  const chosenRows = rows.filter(r => selected[rowKey(r)]);
  const unresolvedConflicts = chosenRows.filter(r => r.allergyConflict && !acknowledged[r.name.toLowerCase()]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm shadow-lg max-w-xs"
          style={{
            background: toast.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${toast.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: toast.type === 'success' ? '#166534' : '#991B1B',
          }}
        >
          {toast.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={dismissToast}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-primary-600" />
        <h1 className="text-xl font-bold text-drug-text">AI Clinical Consult</h1>
      </div>
      <p className="text-sm text-drug-muted mb-5">
        Describe a complaint or consultation note and get a diagnosis-led management plan, grounded in this app's drug database. Decision support only — not a prescription.
      </p>

      <div className="rounded-xl border border-drug-border bg-white p-4 space-y-3 mb-5">
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder={'C/O: fever, chills, headache x 3 days\nO/E: temp 38.9°C, mild pallor, no neck stiffness\n...'}
          rows={5}
          className="w-full px-3 py-2.5 bg-drug-bg border border-drug-border rounded-lg text-sm text-drug-text placeholder-drug-muted focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            value={age}
            onChange={e => setAge(e.target.value)}
            placeholder="Age"
            className="px-3 py-2 bg-drug-bg border border-drug-border rounded-lg text-sm text-drug-text placeholder-drug-muted focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select
            value={sex}
            onChange={e => setSex(e.target.value)}
            className="px-3 py-2 bg-drug-bg border border-drug-border rounded-lg text-sm text-drug-text focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">Sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <input
            type="text"
            value={allergies}
            onChange={e => setAllergies(e.target.value)}
            placeholder="Allergies (if any)"
            className="col-span-1 px-3 py-2 bg-drug-bg border border-drug-border rounded-lg text-sm text-drug-text placeholder-drug-muted focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <button
          onClick={handleSuggest}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors"
        >
          {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</>) : (<><Wand2 className="w-4 h-4" /> Get management plan</>)}
        </button>
      </div>

      {(loading || result) && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold mb-4"
          style={{
            background: hasAllergyHistory ? '#fef2f2' : '#fffbeb',
            color: hasAllergyHistory ? '#dc2626' : '#b45309',
          }}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {hasAllergyHistory
            ? `Documented allergies: ${allergyList.join(', ')}`
            : 'No allergies entered — confirm with the patient before prescribing.'}
        </div>
      )}

      {loading && (
        <div className="text-sm text-drug-muted">Analysing the note…</div>
      )}

      {!loading && result && (
        <div className="rounded-xl border border-drug-border bg-white p-4">
          {sections.length > 0 ? (
            sections.map((s, i) => {
              const meta = SECTION_META[s.header] || { label: s.header };
              const bodyText = s.lines.join('\n').trim();
              if (!bodyText) return null;
              const categoryRows = rowsByCategory[s.header];
              return (
                <div key={i} className="mb-4">
                  <div className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1.5 bg-drug-bg text-drug-text border border-drug-border">
                    {meta.label}
                  </div>
                  <div className="whitespace-pre-line text-[13.5px] leading-relaxed text-drug-text">
                    {renderFormattedText(bodyText)}
                  </div>
                  {categoryRows?.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="text-[10.5px] font-bold text-drug-muted">
                        Select for the course chart:
                      </div>
                      {categoryRows.map(r => {
                        const key = rowKey(r);
                        const isConflict = r.allergyConflict;
                        return (
                          <label
                            key={key}
                            className={`flex items-start gap-1.5 text-xs cursor-pointer ${isConflict ? 'font-bold' : 'font-medium'}`}
                            style={{ color: isConflict ? '#dc2626' : undefined }}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={!!selected[key]}
                              onChange={e => setSelected(s2 => ({ ...s2, [key]: e.target.checked }))}
                            />
                            <span>
                              {r.name}
                              {(r.dose || r.frequency || r.duration) && (
                                <span className="text-drug-muted font-normal">
                                  {' — '}{[r.dose, r.frequency, r.duration && `for ${r.duration}`].filter(Boolean).join(', ')}
                                </span>
                              )}
                              {isConflict && (
                                <span className="inline-flex items-center gap-0.5">
                                  {' '}<AlertTriangle className="w-3 h-3 inline" /> conflicts with a recorded allergy
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                      {categoryRows.some(r => r.allergyConflict) && (
                        <div className="flex flex-col gap-1 mt-0.5">
                          {categoryRows.filter(r => r.allergyConflict).map(r => (
                            <label key={r.name} className="flex items-center gap-1.5 text-[11.5px] font-bold cursor-pointer" style={{ color: '#dc2626' }}>
                              <input
                                type="checkbox"
                                checked={!!acknowledged[r.name.toLowerCase()]}
                                onChange={e => setAcknowledged(a => ({ ...a, [r.name.toLowerCase()]: e.target.checked }))}
                              />
                              <ShieldAlert className="w-3.5 h-3.5" /> I acknowledge the {r.name} allergy conflict and want to override
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="whitespace-pre-line text-[13.5px] leading-relaxed text-drug-text">
              {renderFormattedText(result)}
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-1 mb-3">
              <div className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full mb-2 bg-drug-bg text-drug-text border border-drug-border">
                <Table2 className="w-3 h-3" /> Drug Course Chart
              </div>
              {chosenRows.length === 0 ? (
                <div className="text-xs text-drug-muted">
                  Nothing selected yet — tick drugs above to build the combined course chart.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-left border-b border-drug-border">
                        <th className="py-1.5 pr-2 text-drug-muted font-bold">Drug</th>
                        <th className="py-1.5 px-2 text-drug-muted font-bold">Dose</th>
                        <th className="py-1.5 px-2 text-drug-muted font-bold">Frequency</th>
                        <th className="py-1.5 px-2 text-drug-muted font-bold">Duration</th>
                        <th className="py-1.5 pl-2 text-drug-muted font-bold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chosenRows.map(r => (
                        <tr key={rowKey(r)} className="border-b border-drug-border">
                          <td className="py-1.5 pr-2 font-bold" style={{ color: r.allergyConflict ? '#dc2626' : undefined }}>
                            {r.name}
                          </td>
                          <td className="py-1.5 px-2 text-drug-text">{r.dose || '—'}</td>
                          <td className="py-1.5 px-2 text-drug-text">{r.frequency || '—'}</td>
                          <td className="py-1.5 px-2 text-drug-text">{r.duration || '—'}</td>
                          <td className="py-1.5 pl-2 text-drug-muted">{SECTION_META[r.category]?.label || r.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-1.5 text-[11px] font-bold mb-2" style={{ color: '#b45309' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            AI suggestion only — not a prescription. Confirm against allergy history, dosage, and local protocol before prescribing.
          </div>

          <button
            onClick={() => {
              if (!chosenRows.length) { showToast('Select at least one drug for the course chart first'); return; }
              if (unresolvedConflicts.length) {
                showToast(`Acknowledge the allergy conflict on ${unresolvedConflicts.map(r => r.name).join(', ')} first`);
                return;
              }
              showToast(`Course chart confirmed with ${chosenRows.length} drug${chosenRows.length === 1 ? '' : 's'}`, 'success');
            }}
            disabled={!chosenRows.length}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-drug-success disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" /> Confirm course chart ({chosenRows.length} drug{chosenRows.length === 1 ? '' : 's'})
          </button>
        </div>
      )}
    </div>
  );
}
