import React, { useState, useMemo } from 'react';
import { Droplet, Clock, Baby, RotateCcw } from 'lucide-react';

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const DROP_FACTORS = [
  { value: 10, label: '10 gtt/mL (macro)' },
  { value: 15, label: '15 gtt/mL (macro)' },
  { value: 20, label: '20 gtt/mL (macro)' },
  { value: 60, label: '60 gtt/mL (micro / pediatric)' },
];

export default function IVFluidCalculator() {
  const [subTab, setSubTab] = useState('drip'); // drip | maintenance

  return (
    <div>
      <div className="flex rounded-lg border border-drug-border overflow-hidden mb-6 max-w-md">
        <button
          onClick={() => setSubTab('drip')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors ${
            subTab === 'drip' ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
          }`}
        >
          <Clock className="w-4 h-4" /> Drip Rate
        </button>
        <button
          onClick={() => setSubTab('maintenance')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors ${
            subTab === 'maintenance' ? 'bg-primary-600 text-white' : 'bg-white text-drug-muted hover:bg-gray-50'
          }`}
        >
          <Baby className="w-4 h-4" /> Maintenance Fluids
        </button>
      </div>

      {subTab === 'drip' ? <DripRateCalculator /> : <MaintenanceFluidCalculator />}
    </div>
  );
}

// ── Drip Rate Calculator ─────────────────────────────────────────────────
function DripRateCalculator() {
  const [volume, setVolume] = useState('');       // mL
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [dropFactor, setDropFactor] = useState(20);

  const totalMinutes = useMemo(() => {
    const h = toNum(hours) || 0;
    const m = toNum(minutes) || 0;
    const total = h * 60 + m;
    return total > 0 ? total : null;
  }, [hours, minutes]);

  const results = useMemo(() => {
    const vol = toNum(volume);
    if (vol === null || vol <= 0 || totalMinutes === null) return null;

    const mlPerHr = vol / (totalMinutes / 60);
    const dropsPerMin = (vol * dropFactor) / totalMinutes;

    return { mlPerHr, dropsPerMin };
  }, [volume, totalMinutes, dropFactor]);

  const reset = () => { setVolume(''); setHours(''); setMinutes(''); setDropFactor(20); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Volume to Infuse (mL)</label>
          <input
            type="number" inputMode="decimal" min="0"
            value={volume} onChange={e => setVolume(e.target.value)}
            placeholder="e.g. 1000"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Infusion Time</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number" inputMode="decimal" min="0"
                value={hours} onChange={e => setHours(e.target.value)}
                placeholder="Hours"
                className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                           focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
            <div className="flex-1">
              <input
                type="number" inputMode="decimal" min="0" max="59"
                value={minutes} onChange={e => setMinutes(e.target.value)}
                placeholder="Minutes"
                className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                           focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Giving Set Drop Factor</label>
          <select
            value={dropFactor}
            onChange={e => setDropFactor(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
          >
            {DROP_FACTORS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm font-semibold text-drug-muted hover:text-drug-text transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="bg-primary-900 text-white rounded-xl p-5 h-fit lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-4">
          <Droplet className="w-5 h-5 text-primary-300" />
          <h3 className="font-bold text-lg">Result</h3>
        </div>

        {!results ? (
          <p className="text-primary-200 text-sm">Enter volume and time to calculate the flow rate.</p>
        ) : (
          <div className="space-y-4">
            <ResultRow label="Infusion rate" value={fmt(results.mlPerHr)} unit="mL/hr" />
            <ResultRow label="Drip rate" value={fmt(results.dropsPerMin)} unit="gtt/min" highlight />
          </div>
        )}

        <p className="text-[11px] text-primary-300 mt-5 leading-relaxed">
          Round drops/min to the nearest whole drop when setting a manual gravity infusion.
          Always double-check against pump settings and facility protocol.
        </p>
      </div>
    </div>
  );
}

// ── Maintenance Fluid Calculator (Holliday-Segar 4-2-1 rule) ────────────
function MaintenanceFluidCalculator() {
  const [weight, setWeight] = useState('');

  const results = useMemo(() => {
    const w = toNum(weight);
    if (w === null || w <= 0) return null;

    let mlPerHr = 0;
    if (w <= 10) {
      mlPerHr = w * 4;
    } else if (w <= 20) {
      mlPerHr = 10 * 4 + (w - 10) * 2;
    } else {
      mlPerHr = 10 * 4 + 10 * 2 + (w - 20) * 1;
    }

    return { mlPerHr, mlPerDay: mlPerHr * 24 };
  }, [weight]);

  const reset = () => setWeight('');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Patient Weight (kg)</label>
          <input
            type="number" inputMode="decimal" min="0"
            value={weight} onChange={e => setWeight(e.target.value)}
            placeholder="e.g. 24"
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
          <p className="text-xs text-drug-muted mt-1.5">
            Uses the Holliday–Segar (4-2-1) rule: 4 mL/kg/hr for the first 10 kg, 2 mL/kg/hr for
            the next 10 kg, and 1 mL/kg/hr for each kg above 20 kg.
          </p>
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm font-semibold text-drug-muted hover:text-drug-text transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="bg-primary-900 text-white rounded-xl p-5 h-fit lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-4">
          <Baby className="w-5 h-5 text-primary-300" />
          <h3 className="font-bold text-lg">Result</h3>
        </div>

        {!results ? (
          <p className="text-primary-200 text-sm">Enter weight to calculate maintenance fluid needs.</p>
        ) : (
          <div className="space-y-4">
            <ResultRow label="Maintenance rate" value={fmt(results.mlPerHr)} unit="mL/hr" highlight />
            <ResultRow label="Total daily volume" value={fmt(results.mlPerDay)} unit="mL/day" />
          </div>
        )}

        <p className="text-[11px] text-primary-300 mt-5 leading-relaxed">
          Intended primarily for pediatric maintenance fluid estimation. Adjust for fever,
          renal/cardiac status, and fluid restriction per clinical judgment.
        </p>
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n.toFixed(2)).toString();
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
