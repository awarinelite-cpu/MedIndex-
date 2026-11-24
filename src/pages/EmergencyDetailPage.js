// src/pages/EmergencyDetailPage.js
// Route: /emergency/:id — one protocol: recognise, immediate steps, drugs,
// a weight-based dose calculator, a reminder timer, monitoring and "avoid".
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Eye, ListChecks, Pill, Activity, Ban, Scale } from 'lucide-react';
import { getProtocol, REVIEWED_ON } from '../data/emergencyProtocols';
import EmergencyTimer from '../components/EmergencyTimer';

const WEIGHT_KEY = 'mi_emergency_weight_kg';

function readWeight() {
  try { return localStorage.getItem(WEIGHT_KEY) || ''; } catch { return ''; }
}

// Round sensibly for a bedside reading: 2 dp under 10, 1 dp under 100, else whole.
function round(n) {
  if (n < 10) return Math.round(n * 100) / 100;
  if (n < 100) return Math.round(n * 10) / 10;
  return Math.round(n);
}

function computeDose(item, kg) {
  let perKg = item.perKg;
  if (item.under && kg < item.under.kg) perKg = item.under.perKg;
  let dose = perKg * kg;
  let capped = false;
  if (item.max != null && dose > item.max) { dose = item.max; capped = true; }
  const volume = item.conc ? dose / item.conc.mgPerMl : null;
  return { dose: round(dose), volume: volume == null ? null : round(volume), capped, perKg };
}

function Section({ icon: Icon, title, children, tone }) {
  return (
    <section className={`em-sec ${tone ? `is-${tone}` : ''}`}>
      <h2><Icon size={18} /> {title}</h2>
      {children}
    </section>
  );
}

function WeightPanel({ items }) {
  const [weight, setWeight] = useState(readWeight());
  const [age, setAge] = useState('');
  const kg = parseFloat(weight);
  const valid = Number.isFinite(kg) && kg >= 0.5 && kg <= 250;

  useEffect(() => {
    try { localStorage.setItem(WEIGHT_KEY, weight); } catch { /* ignore */ }
  }, [weight]);

  const estimate = () => {
    const a = parseFloat(age);
    if (!Number.isFinite(a) || a < 1 || a > 10) return;
    setWeight(String((a + 4) * 2)); // standard paediatric estimate for 1–10 years
  };

  return (
    <Section icon={Scale} title="Weight-based doses">
      <div className="em-weight">
        <label>
          <span>Weight (kg)</span>
          <input
            inputMode="decimal"
            value={weight}
            onChange={e => setWeight(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 12"
            aria-label="Patient weight in kilograms"
          />
        </label>
        <label>
          <span>or child's age (1–10 y)</span>
          <span className="em-weight-age">
            <input inputMode="numeric" value={age} onChange={e => setAge(e.target.value.replace(/[^0-9]/g, ''))} placeholder="yrs" aria-label="Child's age in years" />
            <button type="button" onClick={estimate}>Estimate</button>
          </span>
        </label>
      </div>
      <p className="em-hint">Age estimate = (age + 4) × 2. Use a measured weight whenever you can.</p>

      {!valid && weight !== '' && <p className="em-warn">Enter a weight between 0.5 and 250 kg.</p>}

      <div className="space-y-2">
        {items.map(item => {
          const r = valid ? computeDose(item, kg) : null;
          return (
            <div key={item.label} className="em-dose">
              <div className="em-dose-label">{item.label}</div>
              {r ? (
                <div className="em-dose-val">
                  {r.dose} {item.unit}
                  {r.volume != null && <span> = {r.volume} mL</span>}
                  {r.capped && <em> (maximum dose)</em>}
                </div>
              ) : (
                <div className="em-dose-val is-empty">Enter weight</div>
              )}
              {item.note && <div className="em-dose-note">{item.note}</div>}
            </div>
          );
        })}
      </div>
      <p className="em-hint">Double-check every calculated dose and the concentration on the vial before giving.</p>
    </Section>
  );
}

export default function EmergencyDetailPage() {
  const { id } = useParams();
  const p = useMemo(() => getProtocol(id), [id]);
  if (!p) return <Navigate to="/emergency" replace />;

  return (
    <div className="max-w-2xl mx-auto pb-8" style={{ '--em': p.color }}>
      <div className="em-detail-head">
        <Link to="/emergency" aria-label="Back to emergency guides" className="em-back"><ArrowLeft size={22} /></Link>
        <div>
          <div className="em-detail-cat">{p.category}</div>
          <h1>{p.title}</h1>
        </div>
      </div>

      <div className="px-4 space-y-3 mt-3">
        {p.timer && <EmergencyTimer label={p.timer.label} minutes={p.timer.minutes} />}

        <Section icon={Eye} title="Recognise">
          <ul className="em-list">{p.recognise.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Section>

        <Section icon={ListChecks} title="Do now">
          <ol className="em-steps">{p.immediate.map((t, i) => <li key={i}><span>{i + 1}</span><p>{t}</p></li>)}</ol>
        </Section>

        {p.drugs.length > 0 && (
          <Section icon={Pill} title="Drugs">
            <div className="space-y-2">
              {p.drugs.map((d, i) => (
                <div key={i} className="em-drug">
                  <div className="em-drug-name">{d.name}</div>
                  <div className="em-drug-dose">{d.dose}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {p.weightDoses.length > 0 && <WeightPanel items={p.weightDoses} />}

        {p.monitor.length > 0 && (
          <Section icon={Activity} title="Monitor">
            <ul className="em-list">{p.monitor.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Section>
        )}

        {p.avoid.length > 0 && (
          <Section icon={Ban} title="Avoid" tone="danger">
            <ul className="em-list">{p.avoid.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Section>
        )}

        <div className="em-disclaimer">
          <AlertTriangle size={16} />
          <span>
            Quick-reference aid based on WHO and Nigerian guidance. Verify against the current NSTG and your facility
            protocol. Content review status: {REVIEWED_ON}.
          </span>
        </div>
      </div>
    </div>
  );
}
