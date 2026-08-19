import React, { useState, useMemo } from 'react';
import { Droplet, Clock, Baby, RotateCcw, FlaskConical, ChevronLeft } from 'lucide-react';

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

const IV_MODES = [
  { key: 'drip', label: 'Drip Rate', hint: 'mL/hr and gtt/min from volume and time', icon: Clock, color: 'bg-blue-50 text-blue-600' },
  { key: 'maintenance', label: 'Maintenance Fluids', hint: 'Holliday-Segar 4-2-1 rule by weight', icon: Baby, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'kcl', label: 'KCl / IV Additive', hint: 'Volume to draw up from a dose', icon: FlaskConical, color: 'bg-purple-50 text-purple-600' },
];

export default function IVFluidCalculator() {
  const [subTab, setSubTab] = useState(null); // drip | maintenance | kcl

  if (!subTab) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {IV_MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setSubTab(m.key)}
            className="flex flex-col items-start gap-3 text-left bg-white border border-drug-border rounded-xl
                       p-4 shadow-sm hover:shadow-md hover:border-primary-300 transition-all active:scale-[0.98]"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>
              <m.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-drug-text text-sm">{m.label}</div>
              <div className="text-xs text-drug-muted mt-0.5">{m.hint}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  const mode = IV_MODES.find(m => m.key === subTab);

  return (
    <div>
      <button
        onClick={() => setSubTab(null)}
        className="flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700
                   mb-5 px-3 py-2 -ml-3 rounded-lg hover:bg-primary-50 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> IV Fluids
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode.color}`}>
          <mode.icon className="w-5 h-5" />
        </div>
        <div>
          <div className="font-bold text-drug-text text-base">{mode.label}</div>
          <div className="text-xs text-drug-muted">{mode.hint}</div>
        </div>
      </div>

      {subTab === 'drip' && <DripRateCalculator />}
      {subTab === 'maintenance' && <MaintenanceFluidCalculator />}
      {subTab === 'kcl' && <KClVolumeCalculator />}
    </div>
  );
}

// ── KCl / Electrolyte Additive Volume Calculator ─────────────────────────
const KCL_CONCENTRATIONS = [
  { value: 2, label: '2 mmol/mL (15% KCl, standard liquid — 20 mmol in 10 mL)' },
  { value: 1.34, label: '1.34 mmol/mL (10% liquid KCl)' },
  { value: 0.2, label: '0.2 mmol/mL (15 mmol in 75 mL)' },
  { value: 'custom', label: 'Custom concentration...' },
];

function KClVolumeCalculator() {
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('mmol'); // K+ is 1:1, mmol = mEq
  const [conc, setConc] = useState(2);
  const [customConc, setCustomConc] = useState('');

  const concVal = conc === 'custom' ? toNum(customConc) : conc;

  const result = useMemo(() => {
    const d = toNum(dose);
    if (d === null || d <= 0 || !concVal || concVal <= 0) return null;
    return d / concVal;
  }, [dose, concVal]);

  const reset = () => { setDose(''); setConc(2); setCustomConc(''); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-drug-border rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Prescribed Dose</label>
          <div className="flex gap-2">
            <input
              type="number" inputMode="decimal" min="0"
              value={dose} onChange={e => setDose(e.target.value)}
              placeholder="e.g. 20"
              className="flex-1 px-3 py-2.5 border border-drug-border rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
            <select
              value={doseUnit}
              onChange={e => setDoseUnit(e.target.value)}
              className="px-3 py-2.5 border border-drug-border rounded-lg bg-white focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            >
              <option value="mmol">mmol</option>
              <option value="mEq">mEq</option>
            </select>
          </div>
          <p className="text-xs text-drug-muted mt-1.5">
            Potassium is monovalent, so 1 mmol K⁺ = 1 mEq K⁺.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-drug-text mb-1.5">Solution Concentration</label>
          <select
            value={conc}
            onChange={e => setConc(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-drug-border rounded-lg bg-white focus:outline-none
                       focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          >
            {KCL_CONCENTRATIONS.map(c => (
              <option key={c.label} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {conc === 'custom' && (
          <div>
            <label className="block text-sm font-semibold text-drug-text mb-1.5">Custom Concentration (mmol/mL)</label>
            <input
              type="number" inputMode="decimal" min="0" step="0.01"
              value={customConc} onChange={e => setCustomConc(e.target.value)}
              placeholder="e.g. 1.5"
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

      <div className="bg-primary-900 text-white rounded-xl p-5 h-fit lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="w-5 h-5 text-primary-300" />
          <h3 className="font-bold text-lg">Result</h3>
        </div>

        {!result ? (
          <p className="text-primary-200 text-sm">Enter a dose and concentration to calculate the volume to draw up.</p>
        ) : (
          <div className="space-y-4">
            <ResultRow label="Volume to draw up" value={fmt(result)} unit="mL" highlight />
            <ResultRow label="Prescribed dose" value={dose} unit={`${doseUnit} = ${dose} ${doseUnit === 'mmol' ? 'mEq' : 'mmol'}`} />
          </div>
        )}

        <p className="text-[11px] text-primary-300 mt-5 leading-relaxed">
          Always confirm the exact mmol/mL or mEq/mL strength printed on the vial or ampoule label,
          since KCl formulations vary by manufacturer and region. Never administer KCl undiluted or
          by IV push.
        </p>
      </div>
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
    const dropsPerSec = dropsPerMin / 60;

    return { mlPerHr, dropsPerMin, dropsPerSec };
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
            <ResultRow label="Drops per second" value={results.dropsPerSec.toFixed(2)} unit="gtt/sec" />
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
