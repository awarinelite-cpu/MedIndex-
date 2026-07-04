// src/pages/CalculatorsPage.js
// Route: /calculators
// Clinical calculators for nurses: medication dosing and IV fluid rates.
// All formulas are the standard ones taught in nursing pharmacology:
//   • Dose by weight:       dose = weight (kg) × prescribed mg/kg
//   • Tablet/liquid dose:   give = (desired ÷ stock strength) × stock volume
//   • IV drip rate:         gtt/min = (volume mL × drop factor) ÷ time (min)
//   • Infusion rate/time:   mL/hr = volume ÷ hours;  time = volume ÷ rate
//   • Maintenance fluids:   Holliday–Segar 4-2-1 rule (per kg)
// Results are calculation aids only — always verify against the prescription
// and local protocol before administering.

import React, { useState } from 'react';
import {
  Calculator, Scale, Pill, Droplets, Timer, Baby, AlertTriangle,
} from 'lucide-react';

// ── Shared UI helpers ──────────────────────────────────────────────────────
function NumInput({ label, unit, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-drug-muted">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '0'}
          className="w-full px-3 py-2.5 border border-drug-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {unit && <span className="text-xs font-semibold text-drug-muted whitespace-nowrap">{unit}</span>}
      </div>
    </label>
  );
}

function Result({ label, value, unit, highlight }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-900'}`}>
      <div className={`text-xs font-semibold ${highlight ? 'text-primary-100' : 'text-primary-600'}`}>{label}</div>
      <div className="text-2xl font-extrabold mt-0.5">
        {value}<span className="text-sm font-bold ml-1">{unit}</span>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="section-card p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary-600" />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <p className="text-xs text-drug-muted mb-4 ml-12">{subtitle}</p>
      {children}
    </div>
  );
}

const num = v => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const fmt = (n, dp = 2) => {
  if (n === null || !Number.isFinite(n)) return '—';
  const r = Math.round(n * 10 ** dp) / 10 ** dp;
  return String(r % 1 === 0 ? Math.round(r) : r);
};

// ── 1. Dose by weight (mg/kg) ──────────────────────────────────────────────
function DoseByWeight() {
  const [weight, setWeight] = useState('');
  const [dose, setDose]     = useState('');
  const [perDay, setPerDay] = useState(false);
  const [times, setTimes]   = useState('3');

  const w = num(weight), d = num(dose), t = num(times);
  const total = w !== null && d !== null ? w * d : null;
  const per   = perDay && total !== null && t ? total / t : null;

  return (
    <Card icon={Scale} title="Dose by Weight" subtitle="dose = weight (kg) × prescribed mg/kg">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Patient weight" unit="kg" value={weight} onChange={setWeight} />
        <NumInput label={`Prescribed dose ${perDay ? '(per day)' : '(per dose)'}`} unit="mg/kg" value={dose} onChange={setDose} />
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm text-drug-text">
        <input type="checkbox" checked={perDay} onChange={e => setPerDay(e.target.checked)} className="rounded" />
        Prescription is per day, divided into
        <input
          type="number" inputMode="numeric" min="1" value={times} disabled={!perDay}
          onChange={e => setTimes(e.target.value)}
          className="w-14 px-2 py-1 border border-drug-border rounded-lg text-sm disabled:opacity-40"
        />
        doses
      </label>
      <div className={`grid gap-3 mt-4 ${perDay ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Result label={perDay ? 'Total daily dose' : 'Dose to give'} value={fmt(total)} unit="mg" highlight={!perDay} />
        {perDay && <Result label={`Per dose (÷${fmt(t, 0)})`} value={fmt(per)} unit="mg" highlight />}
      </div>
    </Card>
  );
}

// ── 2. Tablet / liquid dose ────────────────────────────────────────────────
function StockDose() {
  const [desired, setDesired] = useState('');
  const [stock, setStock]     = useState('');
  const [form, setForm]       = useState('tablet'); // tablet | liquid
  const [volume, setVolume]   = useState('5');

  const de = num(desired), st = num(stock), vol = num(volume);
  const ratio = de !== null && st ? de / st : null;
  const give  = form === 'liquid' ? (ratio !== null && vol !== null ? ratio * vol : null) : ratio;

  return (
    <Card icon={Pill} title="Tablet / Liquid Dose" subtitle="give = (desired ÷ stock strength) × stock volume">
      <div className="flex gap-2 mb-3">
        {['tablet', 'liquid'].map(f => (
          <button
            key={f}
            onClick={() => setForm(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize ${
              form === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f === 'tablet' ? 'Tablets / Capsules' : 'Syrup / Injection'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Desired (prescribed) dose" unit="mg" value={desired} onChange={setDesired} />
        <NumInput
          label={form === 'tablet' ? 'Stock strength per tablet' : 'Stock strength'}
          unit="mg" value={stock} onChange={setStock}
        />
        {form === 'liquid' && (
          <NumInput label="…contained in volume" unit="mL" value={volume} onChange={setVolume} />
        )}
      </div>
      <div className="mt-4">
        <Result
          label="Amount to give"
          value={fmt(give)}
          unit={form === 'tablet' ? 'tablet(s)' : 'mL'}
          highlight
        />
      </div>
    </Card>
  );
}

// ── 3. IV drip rate (gtt/min) ──────────────────────────────────────────────
const DROP_FACTORS = [
  { gtt: 10, label: '10 gtt/mL (blood set)' },
  { gtt: 15, label: '15 gtt/mL (standard)' },
  { gtt: 20, label: '20 gtt/mL (standard)' },
  { gtt: 60, label: '60 gtt/mL (micro-drip)' },
];

function DripRate() {
  const [volume, setVolume] = useState('');
  const [hours, setHours]   = useState('');
  const [mins, setMins]     = useState('');
  const [factor, setFactor] = useState(20);

  const v = num(volume);
  const totalMin = (num(hours) || 0) * 60 + (num(mins) || 0);
  const gtt  = v !== null && totalMin > 0 ? (v * factor) / totalMin : null;
  const mlhr = v !== null && totalMin > 0 ? v / (totalMin / 60) : null;

  return (
    <Card icon={Droplets} title="IV Drip Rate" subtitle="gtt/min = (volume × drop factor) ÷ time in minutes">
      <div className="grid grid-cols-3 gap-3">
        <NumInput label="Volume to infuse" unit="mL" value={volume} onChange={setVolume} />
        <NumInput label="Time — hours" unit="hr" value={hours} onChange={setHours} />
        <NumInput label="Time — minutes" unit="min" value={mins} onChange={setMins} />
      </div>
      <div className="mt-3">
        <span className="text-xs font-semibold text-drug-muted">Giving set (drop factor)</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {DROP_FACTORS.map(f => (
            <button
              key={f.gtt}
              onClick={() => setFactor(f.gtt)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                factor === f.gtt ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Result label="Drip rate (round to whole drops)" value={gtt !== null ? String(Math.round(gtt)) : '—'} unit="gtt/min" highlight />
        <Result label="Equivalent pump rate" value={fmt(mlhr, 1)} unit="mL/hr" />
      </div>
    </Card>
  );
}

// ── 4. Infusion rate / time ────────────────────────────────────────────────
function InfusionRateTime() {
  const [mode, setMode]     = useState('rate'); // rate | time
  const [volume, setVolume] = useState('');
  const [hours, setHours]   = useState('');
  const [rate, setRate]     = useState('');

  const v = num(volume), h = num(hours), r = num(rate);
  const mlhr = v !== null && h ? v / h : null;
  const timeHr  = v !== null && r ? v / r : null;
  const timeH   = timeHr !== null ? Math.floor(timeHr) : null;
  const timeM   = timeHr !== null ? Math.round((timeHr - timeH) * 60) : null;

  return (
    <Card icon={Timer} title="Infusion Pump Rate / Time" subtitle="mL/hr = volume ÷ hours   •   time = volume ÷ rate">
      <div className="flex gap-2 mb-3">
        <button onClick={() => setMode('rate')} className={`px-4 py-1.5 rounded-full text-xs font-bold ${mode === 'rate' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Find rate (mL/hr)</button>
        <button onClick={() => setMode('time')} className={`px-4 py-1.5 rounded-full text-xs font-bold ${mode === 'time' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Find time remaining</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label={mode === 'rate' ? 'Volume to infuse' : 'Volume remaining'} unit="mL" value={volume} onChange={setVolume} />
        {mode === 'rate'
          ? <NumInput label="Infuse over" unit="hr" value={hours} onChange={setHours} />
          : <NumInput label="Current pump rate" unit="mL/hr" value={rate} onChange={setRate} />}
      </div>
      <div className="mt-4">
        {mode === 'rate'
          ? <Result label="Set pump to" value={fmt(mlhr, 1)} unit="mL/hr" highlight />
          : <Result
              label="Time to completion"
              value={timeHr !== null ? `${timeH}h ${timeM}m` : '—'}
              unit=""
              highlight
            />}
      </div>
    </Card>
  );
}

// ── 5. Maintenance fluids — Holliday–Segar 4-2-1 ──────────────────────────
function MaintenanceFluids() {
  const [weight, setWeight] = useState('');
  const w = num(weight);

  let mlhr = null;
  if (w !== null && w > 0) {
    const a = Math.min(w, 10);
    const b = Math.min(Math.max(w - 10, 0), 10);
    const c = Math.max(w - 20, 0);
    mlhr = a * 4 + b * 2 + c * 1;
  }
  const mlday = mlhr !== null ? mlhr * 24 : null;

  return (
    <Card icon={Baby} title="Maintenance IV Fluids (4-2-1 Rule)" subtitle="Holliday–Segar: 4 mL/kg first 10 kg + 2 mL/kg next 10 kg + 1 mL/kg after">
      <div className="grid grid-cols-2 gap-3 items-end">
        <NumInput label="Patient weight" unit="kg" value={weight} onChange={setWeight} />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Result label="Hourly maintenance" value={fmt(mlhr, 1)} unit="mL/hr" highlight />
        <Result label="Daily maintenance" value={fmt(mlday, 0)} unit="mL/day" />
      </div>
      <p className="text-xs text-drug-muted mt-3">
        Standard maintenance estimate only — adjust for deficits, ongoing losses, fever, cardiac/renal
        status, and follow the prescriber's fluid orders and local protocol.
      </p>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CalculatorsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <Calculator className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl sm:text-3xl font-extrabold">Clinical Calculators</h1>
      </div>
      <p className="text-drug-muted text-sm mb-6">
        Medication dose and IV fluid calculations, using standard nursing formulas.
      </p>

      <div className="space-y-5">
        <DoseByWeight />
        <StockDose />
        <DripRate />
        <InfusionRateTime />
        <MaintenanceFluids />
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          These calculators are aids only. Always double-check results against the prescription,
          have high-alert medication calculations independently verified by a second nurse, and
          follow your facility's protocols.
        </p>
      </div>
    </div>
  );
}
