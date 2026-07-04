// src/pages/CalculatorsPage.js
// Route: /calculators
// Clinical calculators — Drug Dosage & IV Fluids
// Matches MedIndex design system (light theme, primary blue, Inter font)

import React, { useState } from 'react';
import { Pill, Droplet, Calculator, ArrowLeftRight } from 'lucide-react';
import DrugDosageCalculator from '../components/calculators/DrugDosageCalculator';
import IVFluidCalculator from '../components/calculators/IVFluidCalculator';
import UnitConverter from '../components/calculators/UnitConverter';

const TABS = [
  { key: 'drug', label: 'Drug Dosage', icon: Pill },
  { key: 'iv',   label: 'IV Fluids',   icon: Droplet },
  { key: 'units', label: 'Unit Converter', icon: ArrowLeftRight },
];

export default function CalculatorsPage() {
  const [tab, setTab] = useState('drug');

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
            Weight-based drug dosing and IV fluid calculations for quick bedside reference.
          </p>
        </div>
      </section>

      {/* Tabs + content */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex rounded-xl border border-drug-border overflow-hidden mb-8 bg-white shadow-sm max-w-xl">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-colors whitespace-nowrap ${
                tab === t.key ? 'bg-primary-600 text-white' : 'text-drug-muted hover:bg-gray-50'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'drug' && <DrugDosageCalculator />}
        {tab === 'iv' && <IVFluidCalculator />}
        {tab === 'units' && <UnitConverter />}
      </section>
    </div>
  );
}
