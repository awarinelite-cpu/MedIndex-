import React, { useState, useMemo } from 'react';
import { ArrowLeftRight, Scale, Percent, Zap, RotateCcw } from 'lucide-react';

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n.toFixed(6)).toString();
}

const SUB_TABS = [
  { key: 'mass', label: 'Mass', icon: Scale },
  { key: 'percent', label: '% ↔ mg/mL', icon: Percent },
  { key: 'electrolyte', label: 'Electrolytes', icon: Zap },
];

export default function UnitConverter() {
  const [subTab, setSubTab] = useState('mass');

  return (
    <div>
      <div className="flex rounded-lg border border-drug-border overflow-hidden mb-6 max-w-xl flex-wrap">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
              subTab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {subTab === 'mass' && <MassConverter />}
      {subTab === 'percent' && <PercentConverter />}
      {subTab === 'electrolyte' && <ElectrolyteConverter />}
    </div>
  );
}

// ── Mass converter: mcg / mg / g / kg ────────────────────────────────────
const MASS_UNITS = [
  { key: 'mcg', label: 'mcg', factor: 0.001 },   // relative to mg
  { key: 'mg',  label: 'mg',  factor: 1 },
  { key: 'g',   label: 'g',   factor: 1000 },
  { key: 'kg',  label: 'kg',  factor: 1000000 },
];

function MassConverter() {
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState('mg');
  const [toUnit, setToUnit] = useState('mcg');

  const result = useMemo(() => {
    const v = toNum(value);
    if (v === null) return null;
    const from = MASS_UNITS.find(u => u.key === fromUnit);
    const to = MASS_UNITS.find(u => u.key === toUnit);
    if (!from || !to) return null;
    return (v * from.factor) / to.factor;
  }, [value, fromUnit, toUnit]);

  const swap = () => { setFromUnit(toUnit); setToUnit(fromUnit); };
  const reset = () => { setValue(''); setFromUnit('mg'); setToUnit('mcg'); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Value</label>
          <input
            type="number" inputMode="decimal" min="0"
            value={value} onChange={e => setValue(e.target.value)}
            placeholder="e.g. 500"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-drug-text mb-1.5">From</label>
            <select
              value={fromUnit}
              onChange={e => setFromUnit(e.target.value)}
              className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
            >
              {MASS_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>

          <button
            onClick={swap}
            className="p-2.5 mb-0.5 border border-drug-border rounded-lg text-drug-muted hover:text-primary-600 hover:border-primary-300 transition-colors"
            title="Swap units"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div className="flex-1">
            <label className="block text-sm font-semibold text-drug-text mb-1.5">To</label>
            <select
              value={toUnit}
              onChange={e => setToUnit(e.target.value)}
              className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
            >
              {MASS_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm font-semibold text-drug-muted hover:text-drug-text transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <ResultPanel
        icon={Scale}
        empty="Enter a value to convert."
        rows={result !== null ? [{ label: `${value || 0} ${fromUnit} =`, value: fmt(result), unit: toUnit, highlight: true }] : []}
        note="1 g = 1000 mg = 1,000,000 mcg. Always double-check decimal points — mg/mcg mix-ups are a leading cause of dosing errors."
      />
    </div>
  );
}

// ── % w/v ↔ mg/mL converter ───────────────────────────────────────────────
function PercentConverter() {
  const [percent, setPercent] = useState('');
  const [mgPerMl, setMgPerMl] = useState('');
  const [lastEdited, setLastEdited] = useState(null); // 'percent' | 'mgPerMl'

  const handlePercentChange = (v) => {
    setPercent(v);
    setLastEdited('percent');
    const n = toNum(v);
    setMgPerMl(n !== null ? String(Number((n * 10).toFixed(6))) : '');
  };

  const handleMgPerMlChange = (v) => {
    setMgPerMl(v);
    setLastEdited('mgPerMl');
    const n = toNum(v);
    setPercent(n !== null ? String(Number((n / 10).toFixed(6))) : '');
  };

  const reset = () => { setPercent(''); setMgPerMl(''); setLastEdited(null); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">% w/v Solution</label>
          <div className="relative">
            <input
              type="number" inputMode="decimal" min="0"
              value={percent} onChange={e => handlePercentChange(e.target.value)}
              placeholder="e.g. 0.9 (for normal saline)"
              className="w-full px-3 py-2.5 pr-8 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-drug-muted text-sm">%</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-drug-muted text-sm">
          <div className="flex-1 border-t border-drug-border" />
          <ArrowLeftRight className="w-4 h-4" />
          <div className="flex-1 border-t border-drug-border" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Concentration (mg/mL)</label>
          <input
            type="number" inputMode="decimal" min="0"
            value={mgPerMl} onChange={e => handleMgPerMlChange(e.target.value)}
            placeholder="e.g. 9"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm font-semibold text-drug-muted hover:text-drug-text transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <ResultPanel
        icon={Percent}
        empty="Enter a % concentration or mg/mL value to convert."
        rows={
          lastEdited && percent !== '' && mgPerMl !== ''
            ? [
                { label: `${percent}% w/v =`, value: mgPerMl, unit: 'mg/mL', highlight: true },
              ]
            : []
        }
        note="% w/v means grams per 100 mL, so 1% = 1 g/100 mL = 10 mg/mL. E.g. 0.9% normal saline = 9 mg/mL."
      />
    </div>
  );
}

// ── Electrolyte mEq ↔ mg converter ────────────────────────────────────────
// Molecular weight (g/mol) and valence for common elemental ions.
const ELECTROLYTES = [
  { key: 'na',   label: 'Sodium (Na⁺)',      mw: 23,   valence: 1 },
  { key: 'k',    label: 'Potassium (K⁺)',    mw: 39,   valence: 1 },
  { key: 'ca',   label: 'Calcium (Ca²⁺)',    mw: 40,   valence: 2 },
  { key: 'mg',   label: 'Magnesium (Mg²⁺)',  mw: 24,   valence: 2 },
  { key: 'cl',   label: 'Chloride (Cl⁻)',    mw: 35.5, valence: 1 },
  { key: 'hco3', label: 'Bicarbonate (HCO₃⁻)', mw: 61, valence: 1 },
  { key: 'po4',  label: 'Phosphate (PO₄³⁻)', mw: 95,   valence: 3 },
];

function ElectrolyteConverter() {
  const [ionKey, setIonKey] = useState('na');
  const [mode, setMode] = useState('mgToMeq'); // mgToMeq | meqToMg
  const [inputValue, setInputValue] = useState('');

  const ion = ELECTROLYTES.find(e => e.key === ionKey);

  const result = useMemo(() => {
    const v = toNum(inputValue);
    if (v === null || !ion) return null;
    if (mode === 'mgToMeq') {
      const mEq = (v * ion.valence) / ion.mw;
      const mmol = mEq / ion.valence;
      return { mEq, mmol };
    } else {
      const mg = (v * ion.mw) / ion.valence;
      const mmol = v / ion.valence;
      return { mg, mmol };
    }
  }, [inputValue, ion, mode]);

  const reset = () => { setInputValue(''); setMode('mgToMeq'); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Electrolyte</label>
          <select
            value={ionKey}
            onChange={e => setIonKey(e.target.value)}
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
          >
            {ELECTROLYTES.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Convert</label>
          <div className="flex rounded-lg border border-drug-border overflow-hidden">
            {[
              { key: 'mgToMeq', label: 'mg → mEq' },
              { key: 'meqToMg', label: 'mEq → mg' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setMode(opt.key)}
                className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === opt.key ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            {mode === 'mgToMeq' ? 'Elemental mass (mg)' : 'Milliequivalents (mEq)'}
          </label>
          <input
            type="number" inputMode="decimal" min="0"
            value={inputValue} onChange={e => setInputValue(e.target.value)}
            placeholder={mode === 'mgToMeq' ? 'e.g. 1000' : 'e.g. 40'}
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm font-semibold text-drug-muted hover:text-drug-text transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <ResultPanel
        icon={Zap}
        empty="Select an electrolyte and enter a value to convert."
        rows={
          result
            ? mode === 'mgToMeq'
              ? [
                  { label: 'Milliequivalents', value: fmt(result.mEq), unit: 'mEq', highlight: true },
                  { label: 'Millimoles', value: fmt(result.mmol), unit: 'mmol' },
                ]
              : [
                  { label: 'Elemental mass', value: fmt(result.mg), unit: 'mg', highlight: true },
                  { label: 'Millimoles', value: fmt(result.mmol), unit: 'mmol' },
                ]
            : []
        }
        note={`Based on elemental ${ion?.label.replace(/\s*\(.*\)/, '')} — MW ${ion?.mw} g/mol, valence ${ion?.valence}. Conversion is for the elemental ion, not a specific salt form (e.g. calcium gluconate vs calcium chloride contain different elemental calcium per gram — check product labeling).`}
      />
    </div>
  );
}

// ── Shared result panel ────────────────────────────────────────────────────
function ResultPanel({ icon: Icon, empty, rows, note }) {
  return (
    <div className="bg-primary-900 text-white rounded-xl p-5 h-fit lg:sticky lg:top-20">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-primary-300" />
        <h3 className="font-bold text-lg">Result</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-primary-200 text-sm">{empty}</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={i} className={`flex items-baseline justify-between ${r.highlight && i > 0 ? 'pt-3 border-t border-white/15' : ''}`}>
              <span className="text-sm text-primary-200">{r.label}</span>
              <span className={`font-bold ${r.highlight ? 'text-2xl text-white' : 'text-lg text-primary-50'}`}>
                {r.value} <span className="text-xs font-medium text-primary-300">{r.unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {note && <p className="text-[11px] text-primary-300 mt-5 leading-relaxed">{note}</p>}
    </div>
  );
}
