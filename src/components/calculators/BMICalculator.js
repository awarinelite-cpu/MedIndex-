// src/components/calculators/BMICalculator.js
// BMI (Body Mass Index) calculator with metric/imperial toggle and gauge display.
// Matches the styling pattern used by the other clinical calculators.

import React, { useState, useMemo } from 'react';
import { Scale, Ruler, Sparkles } from 'lucide-react';

export default function BMICalculator() {
  const [unit, setUnit] = useState('metric'); // 'metric' | 'imperial'

  // Metric Inputs
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(70);

  // Imperial Inputs
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(9);
  const [weightLbs, setWeightLbs] = useState(154);

  // Simple BMI calculation
  const calculations = useMemo(() => {
    let heightInMeters = 0;
    let weightInKg = 0;

    if (unit === 'metric') {
      heightInMeters = heightCm / 100;
      weightInKg = weightKg;
    } else {
      const totalInches = (heightFt * 12) + heightIn;
      heightInMeters = (totalInches * 2.54) / 100;
      weightInKg = weightLbs * 0.45359237;
    }

    if (heightInMeters <= 0 || weightInKg <= 0) {
      return { bmi: 0, category: 'Invalid Input', color: '#94A3B8' };
    }

    const bmi = weightInKg / (heightInMeters * heightInMeters);

    let category = '';
    let color = '';
    let bgClass = '';

    if (bmi < 18.5) {
      category = 'Underweight';
      color = '#3B82F6';
      bgClass = 'bg-blue-50 border-blue-200 text-blue-700';
    } else if (bmi >= 18.5 && bmi < 25) {
      category = 'Normal weight';
      color = '#10B981';
      bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-700';
    } else if (bmi >= 25 && bmi < 30) {
      category = 'Overweight';
      color = '#F59E0B';
      bgClass = 'bg-amber-50 border-amber-200 text-amber-700';
    } else {
      category = 'Obesity';
      color = '#EF4444';
      bgClass = 'bg-red-50 border-red-200 text-red-700';
    }

    return {
      bmi: parseFloat(bmi.toFixed(1)),
      category,
      color,
      bgClass,
    };
  }, [unit, heightCm, weightKg, heightFt, heightIn, weightLbs]);

  // Switch between unit systems cleanly
  const toggleUnit = (newUnit) => {
    if (newUnit === unit) return;
    if (newUnit === 'imperial') {
      const totalIn = heightCm / 2.54;
      setHeightFt(Math.floor(totalIn / 12));
      setHeightIn(Math.round(totalIn % 12));
      setWeightLbs(Math.round(weightKg * 2.20462));
    } else {
      const totalIn = (heightFt * 12) + heightIn;
      setHeightCm(Math.round(totalIn * 2.54));
      setWeightKg(Math.round(weightLbs / 2.20462));
    }
    setUnit(newUnit);
  };

  // Gauge Needle Position (-90 deg to +90 deg)
  const gaugePercent = Math.min(Math.max((calculations.bmi - 12) / (40 - 12), 0), 1);
  const needleRotation = gaugePercent * 180 - 90;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-drug-border shadow-sm overflow-hidden">

      {/* Header */}
      <div className="p-6 border-b border-drug-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-primary-600 text-white rounded-xl">
            <Scale className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-lg text-drug-text">BMI Calculator</h2>
        </div>

        {/* Unit Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => toggleUnit('metric')}
            className={`px-3 py-1.5 rounded-lg transition ${
              unit === 'metric'
                ? 'bg-white text-drug-text shadow-sm'
                : 'text-drug-muted hover:text-drug-text'
            }`}
          >
            Metric
          </button>
          <button
            onClick={() => toggleUnit('imperial')}
            className={`px-3 py-1.5 rounded-lg transition ${
              unit === 'imperial'
                ? 'bg-white text-drug-text shadow-sm'
                : 'text-drug-muted hover:text-drug-text'
            }`}
          >
            Imperial
          </button>
        </div>
      </div>

      {/* Form Controls */}
      <div className="p-6 space-y-6">

        {/* Height Input */}
        <div className="space-y-2">
          <label className="font-semibold flex items-center space-x-1.5 text-drug-text text-sm">
            <Ruler className="w-4 h-4 text-primary-500" />
            <span>Height</span>
          </label>

          {unit === 'metric' ? (
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="100"
                max="220"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="relative w-36">
                <input
                  type="number"
                  min="50"
                  max="250"
                  value={heightCm || ''}
                  onChange={(e) => setHeightCm(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-50 border border-drug-border rounded-xl py-3.5 pl-4 pr-10 text-right text-lg font-bold text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="absolute right-4 top-4 text-sm font-bold text-drug-muted">cm</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="relative">
                <span className="text-xs text-drug-muted mb-1 block">Feet</span>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={heightFt || ''}
                  onChange={(e) => setHeightFt(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-50 border border-drug-border rounded-xl py-3.5 px-4 text-center text-lg font-bold text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="absolute right-4 top-9 text-sm font-bold text-drug-muted">ft</span>
              </div>
              <div className="relative">
                <span className="text-xs text-drug-muted mb-1 block">Inches</span>
                <input
                  type="number"
                  min="0"
                  max="11"
                  value={heightIn || ''}
                  onChange={(e) => setHeightIn(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-50 border border-drug-border rounded-xl py-3.5 px-4 text-center text-lg font-bold text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="absolute right-4 top-9 text-sm font-bold text-drug-muted">in</span>
              </div>
            </div>
          )}
        </div>

        {/* Weight Input */}
        <div className="space-y-2">
          <label className="font-semibold flex items-center space-x-1.5 text-drug-text text-sm">
            <Scale className="w-4 h-4 text-primary-500" />
            <span>Weight</span>
          </label>

          {unit === 'metric' ? (
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="30"
                max="180"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="relative w-36">
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={weightKg || ''}
                  onChange={(e) => setWeightKg(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-50 border border-drug-border rounded-xl py-3.5 pl-4 pr-10 text-right text-lg font-bold text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="absolute right-4 top-4 text-sm font-bold text-drug-muted">kg</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="60"
                max="400"
                value={weightLbs}
                onChange={(e) => setWeightLbs(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="relative w-36">
                <input
                  type="number"
                  min="20"
                  max="600"
                  value={weightLbs || ''}
                  onChange={(e) => setWeightLbs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-50 border border-drug-border rounded-xl py-3.5 pl-4 pr-10 text-right text-lg font-bold text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="absolute right-4 top-4 text-sm font-bold text-drug-muted">lbs</span>
              </div>
            </div>
          )}
        </div>

        {/* Gauge Display Card */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-drug-border flex flex-col items-center justify-center">

          {/* SVG Arc Gauge */}
          <div className="relative w-48 h-28 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 200 110">
              <defs>
                <linearGradient id="bmiGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="35%" stopColor="#10B981" />
                  <stop offset="70%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#EF4444" />
                </linearGradient>
              </defs>

              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="16"
                strokeLinecap="round"
              />

              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#bmiGaugeGrad)"
                strokeWidth="16"
                strokeLinecap="round"
              />

              <g transform={`translate(100, 100) rotate(${needleRotation})`}>
                <line x1="0" y1="0" x2="0" y2="-66" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" className="transition-all duration-300" />
                <circle cx="0" cy="0" r="6" fill="#0F172A" />
              </g>
            </svg>
          </div>

          {/* Score Readout */}
          <div className="text-center mt-1">
            <div className="text-4xl font-extrabold text-drug-text">
              {calculations.bmi}
            </div>
            <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center space-x-1.5 ${calculations.bgClass}`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{calculations.category}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
