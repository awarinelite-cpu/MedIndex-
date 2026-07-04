import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight, Scale, Percent, Zap, TestTube, Syringe,
  Droplets, Weight, Ruler, Thermometer, RotateCcw,
} from 'lucide-react';

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n.toFixed(6)).toString();
}

// ── Conversion categories shown in the dropdown ──────────────────────────
const CATEGORIES = [
  { key: 'mass',        label: 'Mass (mcg / mg / g / kg)',       icon: Scale },
  { key: 'percent',     label: '% w/v ↔ mg/mL',                  icon: Percent },
  { key: 'electrolyte', label: 'Electrolytes (mEq / mmol ↔ mg)', icon: Zap },
  { key: 'lab',         label: 'Lab Values (mmol/L ↔ mg/dL)',    icon: TestTube },
  { key: 'units',       label: 'Units / IU ↔ mL',                icon: Syringe },
  { key: 'volume',      label: 'Volume (mL / L / fl oz)',        icon: Droplets },
  { key: 'weight',      label: 'Body Weight (kg ↔ lb)',          icon: Weight },
  { key: 'height',      label: 'Height (cm ↔ in)',               icon: Ruler },
  { key: 'temp',        label: 'Temperature (°C ↔ °F)',          icon: Thermometer },
];

export default function UnitConverter() {
  const [category, setCategory] = useState('mass');

  return (
    <div>
      {/* Dropdown selector */}
      <div className="max-w-xl mb-6">
        <label className="block text-sm font-semibold text-drug-text mb-1.5">Conversion Type</label>
        <div className="relative">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full appearance-none px-4 py-3 pr-10 border border-drug-border rounded-xl bg-white
                       font-semibold text-drug-text focus:outline-none focus:ring-2 focus:ring-primary-300
                       focus:border-primary-400 shadow-sm"
          >
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <ArrowLeftRight className="w-4 h-4 text-drug-muted absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
        </div>
      </div>

      {category === 'mass'        && <MassConverter />}
      {category === 'percent'     && <PercentConverter />}
      {category === 'electrolyte' && <ElectrolyteConverter />}
      {category === 'lab'         && <LabValueConverter />}
      {category === 'units'       && <UnitsToVolumeConverter />}
      {category === 'volume'      && <VolumeConverter />}
      {category === 'weight'      && <PairConverter
        icon={Weight}
        unit1="kg" unit2="lb"
        placeholder1="e.g. 70" placeholder2="e.g. 154.3"
        toUnit2={v => v * 2.20462} toUnit1={v => v / 2.20462}
        note="1 kg = 2.20462 lb."
      />}
      {category === 'height'      && <PairConverter
        icon={Ruler}
        unit1="cm" unit2="in"
        placeholder1="e.g. 170" placeholder2="e.g. 66.9"
        toUnit2={v => v / 2.54} toUnit1={v => v * 2.54}
        note="1 in = 2.54 cm."
      />}
      {category === 'temp'        && <PairConverter
        icon={Thermometer}
        unit1="°C" unit2="°F"
        placeholder1="e.g. 37" placeholder2="e.g. 98.6"
        toUnit2={v => (v * 9) / 5 + 32} toUnit1={v => ((v - 32) * 5) / 9}
        note="°F = (°C × 9/5) + 32. Normal body temperature ≈ 37°C / 98.6°F."
      />}
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

// ── Lab value converter: SI (mmol/L or µmol/L) ↔ mg/dL ────────────────────
// Standard published clinical conversion factors: conventional = SI × factor
const LAB_ANALYTES = [
  { key: 'glucose',     label: 'Glucose',            siUnit: 'mmol/L', factor: 18.016 },
  { key: 'urea',        label: 'Urea',                siUnit: 'mmol/L', factor: 6.006  },
  { key: 'bun',         label: 'Urea Nitrogen (BUN)', siUnit: 'mmol/L', factor: 2.801  },
  { key: 'creatinine',  label: 'Creatinine',          siUnit: 'µmol/L', factor: 0.0113 },
  { key: 'calcium',     label: 'Calcium (total)',     siUnit: 'mmol/L', factor: 4.008  },
  { key: 'magnesium',   label: 'Magnesium',           siUnit: 'mmol/L', factor: 2.431  },
  { key: 'phosphate',   label: 'Phosphate',           siUnit: 'mmol/L', factor: 3.097  },
  { key: 'cholesterol', label: 'Total Cholesterol',   siUnit: 'mmol/L', factor: 38.67  },
  { key: 'triglyceride',label: 'Triglycerides',       siUnit: 'mmol/L', factor: 88.57  },
  { key: 'bilirubin',   label: 'Bilirubin (total)',   siUnit: 'µmol/L', factor: 0.0585 },
  { key: 'uricacid',    label: 'Uric Acid',            siUnit: 'µmol/L', factor: 0.0168 },
];

function LabValueConverter() {
  const [analyteKey, setAnalyteKey] = useState('glucose');
  const [mode, setMode] = useState('siToConv'); // siToConv | convToSi
  const [inputValue, setInputValue] = useState('');

  const analyte = LAB_ANALYTES.find(a => a.key === analyteKey);

  const result = useMemo(() => {
    const v = toNum(inputValue);
    if (v === null || !analyte) return null;
    return mode === 'siToConv' ? v * analyte.factor : v / analyte.factor;
  }, [inputValue, analyte, mode]);

  const reset = () => { setInputValue(''); setMode('siToConv'); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Lab Value</label>
          <select
            value={analyteKey}
            onChange={e => setAnalyteKey(e.target.value)}
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
          >
            {LAB_ANALYTES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Convert</label>
          <div className="flex rounded-lg border border-drug-border overflow-hidden">
            <button
              onClick={() => setMode('siToConv')}
              className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'siToConv' ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
              }`}
            >
              {analyte?.siUnit} → mg/dL
            </button>
            <button
              onClick={() => setMode('convToSi')}
              className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'convToSi' ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
              }`}
            >
              mg/dL → {analyte?.siUnit}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            Value ({mode === 'siToConv' ? analyte?.siUnit : 'mg/dL'})
          </label>
          <input
            type="number" inputMode="decimal" min="0"
            value={inputValue} onChange={e => setInputValue(e.target.value)}
            placeholder="e.g. 5.5"
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
        icon={TestTube}
        empty="Select a lab value and enter a result to convert."
        rows={
          result !== null
            ? [{
                label: `${inputValue} ${mode === 'siToConv' ? analyte.siUnit : 'mg/dL'} =`,
                value: fmt(result),
                unit: mode === 'siToConv' ? 'mg/dL' : analyte.siUnit,
                highlight: true,
              }]
            : []
        }
        note="Standard published SI-to-conventional conversion factors. Always confirm against your lab's reference range, as reporting units can vary by institution."
      />
    </div>
  );
}

// ── Units / IU ↔ mL (by concentration on the vial label) ──────────────────
function UnitsToVolumeConverter() {
  const [concentration, setConcentration] = useState(''); // units per mL
  const [mode, setMode] = useState('unitsToMl'); // unitsToMl | mlToUnits
  const [inputValue, setInputValue] = useState('');

  const result = useMemo(() => {
    const conc = toNum(concentration);
    const v = toNum(inputValue);
    if (conc === null || conc <= 0 || v === null) return null;
    return mode === 'unitsToMl' ? v / conc : v * conc;
  }, [concentration, inputValue, mode]);

  const reset = () => { setConcentration(''); setInputValue(''); setMode('unitsToMl'); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            Concentration on the label <span className="text-drug-muted font-normal">(units/mL)</span>
          </label>
          <input
            type="number" inputMode="decimal" min="0"
            value={concentration} onChange={e => setConcentration(e.target.value)}
            placeholder="e.g. 100 (U-100 insulin)"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
          <p className="text-xs text-drug-muted mt-1.5">
            Works for any "units" or "IU" based product — insulin, heparin, penicillin, vitamin D, etc.
            Always read the concentration from the specific vial/pen you are using; it is not standard across products.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Convert</label>
          <div className="flex rounded-lg border border-drug-border overflow-hidden">
            <button
              onClick={() => setMode('unitsToMl')}
              className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'unitsToMl' ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
              }`}
            >
              Units → mL
            </button>
            <button
              onClick={() => setMode('mlToUnits')}
              className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'mlToUnits' ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
              }`}
            >
              mL → Units
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            {mode === 'unitsToMl' ? 'Ordered dose (units)' : 'Volume (mL)'}
          </label>
          <input
            type="number" inputMode="decimal" min="0"
            value={inputValue} onChange={e => setInputValue(e.target.value)}
            placeholder={mode === 'unitsToMl' ? 'e.g. 500' : 'e.g. 2'}
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
        icon={Syringe}
        empty="Enter the label concentration and a units or mL value to convert."
        rows={
          result !== null
            ? [{
                label: mode === 'unitsToMl' ? 'Volume to draw up' : 'Total units',
                value: fmt(result),
                unit: mode === 'unitsToMl' ? 'mL' : 'units',
                highlight: true,
              }]
            : []
        }
        note="Double-check the concentration against the product label every time — units-based products (e.g. insulin, heparin) vary widely between formulations and are a common source of dosing errors."
      />
    </div>
  );
}

// ── Volume converter: mL / L / fl oz ──────────────────────────────────────
const VOLUME_UNITS = [
  { key: 'ml',    label: 'mL',    factor: 1 },
  { key: 'l',     label: 'L',     factor: 1000 },
  { key: 'floz',  label: 'fl oz (US)', factor: 29.5735 },
];

function VolumeConverter() {
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState('ml');
  const [toUnit, setToUnit] = useState('l');

  const result = useMemo(() => {
    const v = toNum(value);
    if (v === null) return null;
    const from = VOLUME_UNITS.find(u => u.key === fromUnit);
    const to = VOLUME_UNITS.find(u => u.key === toUnit);
    if (!from || !to) return null;
    return (v * from.factor) / to.factor;
  }, [value, fromUnit, toUnit]);

  const swap = () => { setFromUnit(toUnit); setToUnit(fromUnit); };
  const reset = () => { setValue(''); setFromUnit('ml'); setToUnit('l'); };

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
              {VOLUME_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
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
              {VOLUME_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
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
        icon={Droplets}
        empty="Enter a value to convert."
        rows={result !== null ? [{ label: `${value || 0} ${VOLUME_UNITS.find(u=>u.key===fromUnit)?.label} =`, value: fmt(result), unit: VOLUME_UNITS.find(u=>u.key===toUnit)?.label, highlight: true }] : []}
        note="1 L = 1000 mL. 1 US fl oz ≈ 29.57 mL — useful for oral fluid charting when intake is recorded in ounces."
      />
    </div>
  );
}

// ── Generic bidirectional pair converter (weight, height, temperature) ────
function PairConverter({ icon, unit1, unit2, placeholder1, placeholder2, toUnit2, toUnit1, note }) {
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [lastEdited, setLastEdited] = useState(null);

  const handleChange1 = (v) => {
    setVal1(v);
    setLastEdited('1');
    const n = toNum(v);
    setVal2(n !== null ? String(Number(toUnit2(n).toFixed(4))) : '');
  };

  const handleChange2 = (v) => {
    setVal2(v);
    setLastEdited('2');
    const n = toNum(v);
    setVal1(n !== null ? String(Number(toUnit1(n).toFixed(4))) : '');
  };

  const reset = () => { setVal1(''); setVal2(''); setLastEdited(null); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">{unit1}</label>
          <input
            type="number" inputMode="decimal"
            value={val1} onChange={e => handleChange1(e.target.value)}
            placeholder={placeholder1}
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        <div className="flex items-center gap-2 text-drug-muted text-sm">
          <div className="flex-1 border-t border-drug-border" />
          <ArrowLeftRight className="w-4 h-4" />
          <div className="flex-1 border-t border-drug-border" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">{unit2}</label>
          <input
            type="number" inputMode="decimal"
            value={val2} onChange={e => handleChange2(e.target.value)}
            placeholder={placeholder2}
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
        icon={icon}
        empty="Enter a value in either field to convert."
        rows={
          lastEdited && val1 !== '' && val2 !== ''
            ? [{
                label: lastEdited === '1' ? `${val1} ${unit1} =` : `${val2} ${unit2} =`,
                value: lastEdited === '1' ? val2 : val1,
                unit: lastEdited === '1' ? unit2 : unit1,
                highlight: true,
              }]
            : []
        }
        note={note}
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
