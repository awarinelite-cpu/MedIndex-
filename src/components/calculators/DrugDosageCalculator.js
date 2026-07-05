import React, { useState, useMemo } from 'react';
import { Calculator, AlertTriangle, RotateCcw } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────
const LB_TO_KG = 0.453592;
const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function DrugDosageCalculator() {
  // Patient weight
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg'); // kg | lb

  // Dosing mode
  const [doseMode, setDoseMode] = useState('perKg'); // perKg | fixed
  const [dosePerKg, setDosePerKg] = useState('');     // mg/kg
  const [fixedDose, setFixedDose] = useState('');     // mg (already a total dose)
  const [frequency, setFrequency] = useState('');     // doses per day

  // Concentration → volume to administer
  const [concentration, setConcentration] = useState(''); // mg/mL

  // Safety ceiling
  const [maxDailyDose, setMaxDailyDose] = useState(''); // mg/day

  const weightKg = useMemo(() => {
    const w = toNum(weight);
    if (w === null) return null;
    return weightUnit === 'lb' ? w * LB_TO_KG : w;
  }, [weight, weightUnit]);

  const results = useMemo(() => {
    if (weightKg === null || weightKg <= 0) return null;

    let dosePerAdmin = null; // mg per administration
    if (doseMode === 'perKg') {
      const dpk = toNum(dosePerKg);
      if (dpk === null) return null;
      dosePerAdmin = dpk * weightKg;
    } else {
      const fd = toNum(fixedDose);
      if (fd === null) return null;
      dosePerAdmin = fd;
    }

    const freq = toNum(frequency);
    const dailyDose = freq !== null ? dosePerAdmin * freq : null;

    const conc = toNum(concentration);
    const volumePerAdmin = conc !== null && conc > 0 ? dosePerAdmin / conc : null;

    const maxDaily = toNum(maxDailyDose);
    const exceedsMax = maxDaily !== null && dailyDose !== null && dailyDose > maxDaily;

    return { dosePerAdmin, dailyDose, volumePerAdmin, exceedsMax, maxDaily };
  }, [weightKg, doseMode, dosePerKg, fixedDose, frequency, concentration, maxDailyDose]);

  const reset = () => {
    setWeight(''); setDosePerKg(''); setFixedDose('');
    setFrequency(''); setConcentration(''); setMaxDailyDose('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Inputs ── */}
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        {/* Weight */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Patient Weight</label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 68"
              className="flex-1 px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
            <div className="flex rounded-lg border border-drug-border overflow-hidden">
              {['kg', 'lb'].map(u => (
                <button
                  key={u}
                  onClick={() => setWeightUnit(u)}
                  className={`px-3 py-2.5 text-sm font-semibold transition-colors ${
                    weightUnit === u ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          {weightUnit === 'lb' && weightKg !== null && (
            <p className="text-xs text-drug-muted mt-1">≈ {weightKg.toFixed(2)} kg</p>
          )}
        </div>

        {/* Dose mode */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Ordered Dose</label>
          <div className="flex rounded-lg border border-drug-border overflow-hidden mb-3 w-full">
            {[
              { key: 'perKg', label: 'mg / kg' },
              { key: 'fixed', label: 'Fixed dose (mg)' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setDoseMode(opt.key)}
                className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                  doseMode === opt.key ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {doseMode === 'perKg' ? (
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={dosePerKg}
              onChange={e => setDosePerKg(e.target.value)}
              placeholder="Dose per kg, e.g. 10 (mg/kg)"
              className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          ) : (
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={fixedDose}
              onChange={e => setFixedDose(e.target.value)}
              placeholder="Total dose in mg, e.g. 500"
              className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          )}
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            Frequency <span className="text-drug-muted font-normal">(doses per day, optional)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={frequency}
            onChange={e => setFrequency(e.target.value)}
            placeholder="e.g. 3 (for TDS)"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        {/* Concentration */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            Available Concentration <span className="text-drug-muted font-normal">(mg/mL, optional)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={concentration}
            onChange={e => setConcentration(e.target.value)}
            placeholder="e.g. 25 (mg/mL)"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        {/* Max daily dose */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            Max Daily Dose <span className="text-drug-muted font-normal">(mg/day, optional safety check)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={maxDailyDose}
            onChange={e => setMaxDailyDose(e.target.value)}
            placeholder="e.g. 4000"
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

      {/* ── Results ── */}
      <div className="bg-primary-900 text-white rounded-xl p-5 h-fit lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-primary-300" />
          <h3 className="font-bold text-lg">Result</h3>
        </div>

        {!results ? (
          <p className="text-primary-200 text-sm">Enter patient weight and dose to calculate.</p>
        ) : (
          <div className="space-y-4">
            <ResultRow label="Dose per administration" value={fmt(results.dosePerAdmin)} unit="mg" />
            {results.dailyDose !== null && (
              <ResultRow label="Total daily dose" value={fmt(results.dailyDose)} unit="mg/day" />
            )}
            {results.volumePerAdmin !== null && (
              <ResultRow label="Volume to administer" value={fmt(results.volumePerAdmin)} unit="mL / dose" highlight />
            )}

            {results.exceedsMax && (
              <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/40 rounded-lg p-3 mt-2">
                <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-100">
                  Calculated daily dose ({fmt(results.dailyDose)} mg) exceeds the entered max
                  daily dose ({fmt(results.maxDaily)} mg). Re-check the order before administering.
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-primary-300 mt-5 leading-relaxed">
          For reference only — always verify against the prescriber's order, drug reference,
          and facility protocol before administration.
        </p>
      </div>
    </div>
  );
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n.toFixed(3)).toString();
}

function ResultRow({ label, value, unit, highlight }) {
  return (
    <div className={`flex items-baseline justify-between ${highlight ? 'pt-3 border-t border-white/15' : ''}`}>
      <span className="text-sm text-primary-200">{label}</span>
      <span className={`font-bold ${highlight ? 'text-2xl text-white' : 'text-lg text-primary-50'}`}>
        {value} <span className="text-xs font-medium text-primary-300">{unit}</span>
      </span>
    </div>
  );
}
