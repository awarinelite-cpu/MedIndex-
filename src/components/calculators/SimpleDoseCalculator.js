import React, { useState, useMemo } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// Classic "Desired over Have" (D/H x Q) dose calculation — no patient
// weight involved, just what's ordered vs what's on hand. For a liquid,
// Q is the mL that the "available dose" strength is measured in
// (e.g. 125 mg per 5 mL); for a solid, Q is always 1 (one tablet/capsule).
export default function SimpleDoseCalculator() {
  const [orderedDose,   setOrderedDose]   = useState(''); // mg — what's prescribed
  const [availableDose, setAvailableDose] = useState(''); // mg — strength on hand
  const [formType,      setFormType]      = useState('solid'); // solid | liquid
  const [perMl,         setPerMl]         = useState('1');      // liquid only

  const result = useMemo(() => {
    const d = toNum(orderedDose);
    const h = toNum(availableDose);
    if (d === null || h === null || h <= 0) return null;

    const q = formType === 'liquid' ? (toNum(perMl) ?? 1) : 1;
    if (q <= 0) return null;

    return (d / h) * q;
  }, [orderedDose, availableDose, formType, perMl]);

  const reset = () => {
    setOrderedDose(''); setAvailableDose(''); setFormType('solid'); setPerMl('1');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Inputs ── */}
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        {/* Ordered dose */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            Ordered Dose <span className="text-drug-muted font-normal">(mg — what's prescribed)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={orderedDose}
            onChange={e => setOrderedDose(e.target.value)}
            placeholder="e.g. 250"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        {/* Available dose */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">
            Available Dose <span className="text-drug-muted font-normal">(mg — strength on hand)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={availableDose}
            onChange={e => setAvailableDose(e.target.value)}
            placeholder="e.g. 500"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        {/* Form */}
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Form</label>
          <div className="flex rounded-lg border border-drug-border overflow-hidden w-full">
            {[
              { key: 'solid',  label: 'Tablet / Capsule' },
              { key: 'liquid', label: 'Liquid' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFormType(opt.key)}
                className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                  formType === opt.key ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liquid volume — only shown for liquid form */}
        {formType === 'liquid' && (
          <div>
            <label className="block text-sm font-semibold text-drug-text mb-1.5">
              Available dose is per <span className="text-drug-muted font-normal">(mL)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={perMl}
              onChange={e => setPerMl(e.target.value)}
              placeholder="e.g. 5 (for 125 mg / 5 mL)"
              className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>
        )}

        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm font-semibold text-drug-muted hover:text-drug-text transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* ── Result ── */}
      <div className="bg-primary-900 text-white rounded-xl p-5 h-fit lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-primary-300" />
          <h3 className="font-bold text-lg">Result</h3>
        </div>

        {result === null ? (
          <p className="text-primary-200 text-sm">Enter the ordered and available dose to calculate.</p>
        ) : (
          <div className="pt-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-primary-200">Give</span>
              <span className="font-bold text-2xl text-white">
                {fmt(result)}{' '}
                <span className="text-xs font-medium text-primary-300">
                  {formType === 'liquid' ? 'mL' : result === 1 ? 'tablet / capsule' : 'tablets / capsules'}
                </span>
              </span>
            </div>
          </div>
        )}

        <p className="text-[11px] text-primary-300 mt-5 leading-relaxed">
          Formula: (Ordered ÷ Available){formType === 'liquid' ? ' × mL' : ''}. For reference only —
          always verify against the prescriber's order, drug reference, and facility protocol
          before administration.
        </p>
      </div>
    </div>
  );
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n.toFixed(2)).toString();
}
