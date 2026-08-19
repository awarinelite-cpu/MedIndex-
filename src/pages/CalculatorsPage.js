// src/pages/CalculatorsPage.js
// Route: /calculators
// Clinical calculators — card-based hub for one-tap access
// Matches MedIndex design system (light/dark theme via drug- tokens, primary blue, Inter font)

import React, { useState } from 'react';
import {
  Pill, Droplet, Calculator, ArrowLeftRight, Scale, Divide,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import DrugDosageCalculator from '../components/calculators/DrugDosageCalculator';
import SimpleDoseCalculator from '../components/calculators/SimpleDoseCalculator';
import IVFluidCalculator from '../components/calculators/IVFluidCalculator';
import UnitConverter from '../components/calculators/UnitConverter';
import BMICalculator from '../components/calculators/BMICalculator';

const CALCULATORS = [
  {
    key: 'simple',
    label: 'Simple Dose',
    description: 'Desired over have, times volume',
    icon: Divide,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    key: 'drug',
    label: 'Drug Dosage',
    description: 'Weight-based mg per kg dosing',
    icon: Pill,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    key: 'iv',
    label: 'IV Fluids',
    description: 'Drip rate, maintenance fluids, KCl',
    icon: Droplet,
    color: 'bg-cyan-50 text-cyan-600',
  },
  {
    key: 'units',
    label: 'Unit Converter',
    description: 'Mass, electrolytes, labs, and more',
    icon: ArrowLeftRight,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    key: 'bmi',
    label: 'BMI',
    description: 'Body mass index and category',
    icon: Scale,
    color: 'bg-amber-50 text-amber-600',
  },
];

export default function CalculatorsPage() {
  const [activeKey, setActiveKey] = useState(null);
  const active = CALCULATORS.find(c => c.key === activeKey);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Calculator className="w-7 h-7 text-primary-300" />
            <h1 className="text-3xl sm:text-4xl font-bold">Clinical Calculators</h1>
          </div>
          <p className="text-primary-100 max-w-xl mx-auto">
            Pick a calculator below to get started. Tap back anytime to switch.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!active ? (
          <CalculatorGrid onSelect={setActiveKey} />
        ) : (
          <div>
            <button
              onClick={() => setActiveKey(null)}
              className="flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700
                         mb-6 px-3 py-2 -ml-3 rounded-lg hover:bg-primary-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> All Calculators
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${active.color}`}>
                <active.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-drug-text">{active.label}</h2>
                <p className="text-sm text-drug-muted">{active.description}</p>
              </div>
            </div>

            {active.key === 'simple' && <SimpleDoseCalculator />}
            {active.key === 'drug' && <DrugDosageCalculator />}
            {active.key === 'iv' && <IVFluidCalculator />}
            {active.key === 'units' && <UnitConverter />}
            {active.key === 'bmi' && <BMICalculator />}
          </div>
        )}
      </section>
    </div>
  );
}

function CalculatorGrid({ onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {CALCULATORS.map(c => (
        <button
          key={c.key}
          onClick={() => onSelect(c.key)}
          className="flex items-center gap-4 text-left bg-white border border-drug-border rounded-2xl
                     p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition-all active:scale-[0.98]"
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${c.color}`}>
            <c.icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-drug-text text-base">{c.label}</div>
            <div className="text-sm text-drug-muted truncate">{c.description}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-drug-muted shrink-0" />
        </button>
      ))}
    </div>
  );
}
