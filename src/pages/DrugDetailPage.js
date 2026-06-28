import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pill, AlertTriangle, Heart, Baby, Clock, FlaskConical, ChevronLeft } from 'lucide-react';
import drugsData from '../data/seedDrugs.json';

// Index by id slug at module level — O(1) lookup
const DRUG_MAP = Object.fromEntries(drugsData.map(d => [d.id, d]));

// Render pipe-separated or comma-separated text as a styled list
function renderList(value, separator = '|') {
  if (!value) return <em className="text-drug-muted">No data available</em>;
  const items = value.split(separator).map(s => s.trim()).filter(Boolean);
  if (items.length <= 1) {
    return <p className="text-drug-text leading-relaxed">{value}</p>;
  }
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-drug-text">
          <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function renderCSV(value) {
  if (!value) return <em className="text-drug-muted">No data available</em>;
  const items = value.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
          {item}
        </span>
      ))}
    </div>
  );
}

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: Pill          },
  { id: 'dosage',        label: 'Dosage',         icon: Clock         },
  { id: 'safety',        label: 'Safety',         icon: AlertTriangle },
  { id: 'interactions',  label: 'Interactions',   icon: FlaskConical  },
  { id: 'pharmacology',  label: 'Pharmacology',   icon: Heart         },
  { id: 'nursing',       label: 'Nursing Notes',  icon: Heart         },
];

export default function DrugDetailPage() {
  const { id }       = useParams();
  const [activeTab, setActiveTab] = useState('overview');

  // Instant lookup — no async, no loading state
  const drug = useMemo(() => DRUG_MAP[id] || null, [id]);

  if (!drug) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-600">Drug not found</h2>
        <p className="text-gray-500 mt-2">The medication "{id}" doesn't exist in our database.</p>
        <Link to="/browse" className="inline-block mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
          Browse all drugs
        </Link>
      </div>
    );
  }

  // The JSON uses: overview, dosage, mechanism, side_effects, nursing_considerations, contraindications
  // Map to display-friendly aliases
  const isControlled = drug.prescription_status === 'Controlled';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link to="/browse" className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to browse
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Pill className="w-7 h-7 text-primary-600" />
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
            drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                         'bg-blue-100 text-blue-700'
          }`}>
            {drug.prescription_status}
          </span>
          {isControlled && (
            <span className="text-sm font-bold px-3 py-1 rounded-full bg-red-50 text-red-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Controlled Substance
            </span>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-drug-text">{drug.generic_name}</h1>
        <p className="text-lg text-primary-600 font-medium mt-1">
          {drug.drug_class}{drug.drug_subclass && drug.drug_subclass !== drug.drug_class ? ` — ${drug.drug_subclass}` : ''}
        </p>
        {drug.source && (
          <p className="text-xs text-drug-muted mt-2 uppercase tracking-wide">Source: {drug.source}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white text-drug-muted hover:bg-gray-50 border border-drug-border'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">

        {/* ── OVERVIEW ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {drug.overview && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Overview</h2>
                <p className="text-drug-text leading-relaxed">{drug.overview}</p>
              </div>
            )}

            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-3">What it's used for</h2>
              {drug.primary_indications
                ? renderCSV(drug.primary_indications)
                : <em className="text-drug-muted">No data available</em>}
            </div>

            {drug.mechanism && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Mechanism of Action</h2>
                <p className="text-drug-text leading-relaxed">{drug.mechanism}</p>
              </div>
            )}

            {/* Special populations summary */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-3">Special Populations</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-pink-50 rounded-lg">
                  <Baby className="w-6 h-6 text-pink-600 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-pink-900">Pregnancy</div>
                  <div className="text-xs text-pink-700 mt-1">See Safety tab</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Heart className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-blue-900">Lactation</div>
                  <div className="text-xs text-blue-700 mt-1">See Safety tab</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <span className="text-2xl">👶</span>
                  <div className="text-sm font-semibold text-green-900 mt-1">Pediatric</div>
                  <div className="text-xs text-green-700 mt-1">See Dosage tab</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <span className="text-2xl">👴</span>
                  <div className="text-sm font-semibold text-amber-900 mt-1">Geriatric</div>
                  <div className="text-xs text-amber-700 mt-1">See Dosage tab</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── DOSAGE ───────────────────────────────────────────────── */}
        {activeTab === 'dosage' && (
          <>
            {drug.dosage ? (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Dosing Information</h2>
                {renderList(drug.dosage, '\n')}
              </div>
            ) : (
              <div className="section-card p-6">
                <em className="text-drug-muted">No dosage information available.</em>
              </div>
            )}
          </>
        )}

        {/* ── SAFETY ───────────────────────────────────────────────── */}
        {activeTab === 'safety' && (
          <>
            {drug.contraindications && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3 text-red-700">Contraindications</h2>
                {renderList(drug.contraindications, '\n')}
              </div>
            )}

            {drug.side_effects && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Side Effects</h2>
                {renderList(drug.side_effects, '\n')}
              </div>
            )}

            {!drug.contraindications && !drug.side_effects && (
              <div className="section-card p-6">
                <em className="text-drug-muted">No safety data available.</em>
              </div>
            )}
          </>
        )}

        {/* ── INTERACTIONS ─────────────────────────────────────────── */}
        {activeTab === 'interactions' && (
          <div className="section-card p-6">
            <h2 className="text-lg font-bold mb-4">Drug Interactions</h2>
            <p className="text-drug-muted text-sm mb-4">
              Always verify interactions against current prescribing information.
              Consult a pharmacist for patient-specific interaction checking.
            </p>
            {drug.nursing_considerations
              ? renderList(drug.nursing_considerations, '\n')
              : <em className="text-drug-muted">Detailed interaction data not available in this record. Refer to product monograph.</em>}
          </div>
        )}

        {/* ── PHARMACOLOGY ─────────────────────────────────────────── */}
        {activeTab === 'pharmacology' && (
          <>
            {drug.mechanism && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Mechanism of Action</h2>
                <p className="text-drug-text leading-relaxed">{drug.mechanism}</p>
              </div>
            )}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Drug Class</h2>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                  {drug.drug_class}
                </span>
                {drug.drug_subclass && drug.drug_subclass !== drug.drug_class && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    {drug.drug_subclass}
                  </span>
                )}
              </div>
            </div>
            {!drug.mechanism && (
              <div className="section-card p-6">
                <em className="text-drug-muted">No pharmacology data available.</em>
              </div>
            )}
          </>
        )}

        {/* ── NURSING NOTES ────────────────────────────────────────── */}
        {activeTab === 'nursing' && (
          <div className="section-card p-6">
            <h2 className="text-lg font-bold mb-4">Nursing Considerations</h2>
            {drug.nursing_considerations
              ? renderList(drug.nursing_considerations, '\n')
              : <em className="text-drug-muted">No nursing-specific notes available for this drug.</em>}
          </div>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="mt-10 pt-6 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
        <strong>Disclaimer:</strong> This information is for educational and clinical reference purposes only.
        Always verify drug information against current product monographs and consult appropriate clinical resources
        before prescribing or administering medications.
      </div>
    </div>
  );
}
