import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Pill, AlertTriangle, Heart, Baby, Clock,
  FlaskConical, ChevronLeft, User, Stethoscope
} from 'lucide-react';
import drugsData from '../data/seedDrugs.json';

const DRUG_MAP = Object.fromEntries(drugsData.map(d => [d.id, d]));

// ── Route badges ─────────────────────────────────────────────────────────────
const ROUTE_META = {
  'PO':  { label: 'Oral (PO)',          color: '#1D4ED8', bg: '#EFF6FF' },
  'IV':  { label: 'Intravenous (IV)',   color: '#065F46', bg: '#ECFDF5' },
  'IM':  { label: 'Intramuscular (IM)', color: '#7C3AED', bg: '#F5F3FF' },
  'SC':  { label: 'Subcutaneous (SC)',  color: '#B45309', bg: '#FFFBEB' },
  'SL':  { label: 'Sublingual (SL)',    color: '#BE185D', bg: '#FDF2F8' },
  'PR':  { label: 'Rectal (PR)',        color: '#C2410C', bg: '#FFF7ED' },
  'INH': { label: 'Inhaled (INH)',      color: '#0E7490', bg: '#ECFEFF' },
  'TOP': { label: 'Topical (TOP)',      color: '#166534', bg: '#F0FDF4' },
  'NAS': { label: 'Nasal (NAS)',        color: '#1E40AF', bg: '#EFF6FF' },
  'TD':  { label: 'Transdermal (TD)',   color: '#92400E', bg: '#FFFBEB' },
};

// Detect which routes appear in dosage text
function detectRoutes(dosage) {
  if (!dosage) return [];
  const found = [];
  // Check for route abbreviations as whole words
  const text = dosage.toUpperCase();
  Object.keys(ROUTE_META).forEach(r => {
    // Match PO, IV etc. as word boundaries
    const re = new RegExp(`\\b${r}\\b`);
    if (re.test(text)) found.push(r);
  });
  // Also detect "buccal", "rectal", "oral", "sublingual" written out
  if (/\boral\b/i.test(dosage) && !found.includes('PO'))   found.push('PO');
  if (/\brectal\b/i.test(dosage) && !found.includes('PR')) found.push('PR');
  if (/\bbuccal\b/i.test(dosage))                          found.push('SL'); // treat buccal like SL display
  if (/\binhale|inhal|nebul/i.test(dosage) && !found.includes('INH')) found.push('INH');
  if (/\btopical|transdermal\b/i.test(dosage) && !found.includes('TOP')) found.push('TOP');
  if (/\bsubcutan|SC\b/i.test(dosage) && !found.includes('SC')) found.push('SC');
  return [...new Set(found)];
}

// Render dosage text with route abbreviations highlighted inline
function renderDosageWithRoutes(text) {
  if (!text) return <em className="text-drug-muted">No data available</em>;

  // Split on newlines or pipe for sections
  const sections = text.split(/\n|\|/).map(s => s.trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      {sections.map((section, i) => {
        // Highlight route abbreviations within the text
        const parts = section.split(/\b(PO|IV|IM|SC|SL|PR|INH|TOP|NAS|TD)\b/g);
        return (
          <div key={i} className="flex items-start gap-2">
            <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
            <p className="text-drug-text leading-relaxed">
              {parts.map((part, j) => {
                const meta = ROUTE_META[part];
                if (meta) {
                  return (
                    <span
                      key={j}
                      style={{
                        background: meta.bg,
                        color: meta.color,
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: '0.8em',
                        fontWeight: 700,
                        margin: '0 2px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {part}
                    </span>
                  );
                }
                return part;
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

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
  { id: 'overview',     label: 'Overview',     icon: Pill          },
  { id: 'dosage',       label: 'Dosage',        icon: Clock         },
  { id: 'safety',       label: 'Safety',        icon: AlertTriangle },
  { id: 'interactions', label: 'Interactions',  icon: FlaskConical  },
  { id: 'pharmacology', label: 'Pharmacology',  icon: Heart         },
  { id: 'nursing',      label: 'Nursing Notes', icon: Stethoscope   },
];

export default function DrugDetailPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('overview');

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

  const isControlled = drug.prescription_status === 'Controlled';
  const detectedRoutes = detectRoutes(drug.dosage);

  // ── Special Populations click handlers ───────────────────────────────────
  const goToTab = (tab) => {
    setActiveTab(tab);
    // Scroll to top of tab content smoothly
    setTimeout(() => {
      const el = document.getElementById('drug-tab-content');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

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

        {/* Route of Administration badges — shown on header */}
        {detectedRoutes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-drug-muted font-semibold uppercase tracking-wide self-center">Routes:</span>
            {detectedRoutes.map(r => {
              const meta = ROUTE_META[r];
              return (
                <span
                  key={r}
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}
                  className="text-xs font-bold px-3 py-1 rounded-full"
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        )}

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
      <div className="space-y-6" id="drug-tab-content">

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
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

            {/* Special Populations — now fully clickable */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Special Populations</h2>
              <p className="text-sm text-drug-muted mb-4">Tap a card to jump to the relevant tab.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

                {/* Pregnancy → Safety tab */}
                <button
                  onClick={() => goToTab('safety')}
                  className="text-center p-4 bg-pink-50 rounded-xl hover:bg-pink-100 hover:shadow-md transition-all group border border-pink-100 hover:border-pink-300 cursor-pointer"
                >
                  <Baby className="w-6 h-6 text-pink-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-pink-900">Pregnancy</div>
                  <div className="text-xs text-pink-600 mt-1 font-medium">→ Safety tab</div>
                </button>

                {/* Lactation → Safety tab */}
                <button
                  onClick={() => goToTab('safety')}
                  className="text-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 hover:shadow-md transition-all group border border-blue-100 hover:border-blue-300 cursor-pointer"
                >
                  <Heart className="w-6 h-6 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-blue-900">Lactation</div>
                  <div className="text-xs text-blue-600 mt-1 font-medium">→ Safety tab</div>
                </button>

                {/* Pediatric → Dosage tab */}
                <button
                  onClick={() => goToTab('dosage')}
                  className="text-center p-4 bg-green-50 rounded-xl hover:bg-green-100 hover:shadow-md transition-all group border border-green-100 hover:border-green-300 cursor-pointer"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">👶</span>
                  <div className="text-sm font-semibold text-green-900">Pediatric</div>
                  <div className="text-xs text-green-600 mt-1 font-medium">→ Dosage tab</div>
                </button>

                {/* Geriatric → Dosage tab */}
                <button
                  onClick={() => goToTab('dosage')}
                  className="text-center p-4 bg-amber-50 rounded-xl hover:bg-amber-100 hover:shadow-md transition-all group border border-amber-100 hover:border-amber-300 cursor-pointer"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">👴</span>
                  <div className="text-sm font-semibold text-amber-900">Geriatric</div>
                  <div className="text-xs text-amber-600 mt-1 font-medium">→ Dosage tab</div>
                </button>

              </div>
            </div>
          </>
        )}

        {/* ── DOSAGE ───────────────────────────────────────────────────── */}
        {activeTab === 'dosage' && (
          <>
            {/* Route of Administration summary card */}
            {detectedRoutes.length > 0 && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Routes of Administration</h2>
                <div className="flex flex-wrap gap-3">
                  {detectedRoutes.map(r => {
                    const meta = ROUTE_META[r];
                    return (
                      <div
                        key={r}
                        style={{ background: meta.bg, border: `1.5px solid ${meta.color}30` }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg"
                      >
                        <div
                          style={{ background: meta.color }}
                          className="w-2 h-2 rounded-full flex-shrink-0"
                        />
                        <span style={{ color: meta.color }} className="text-sm font-bold">
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dosage details */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Dosing Information</h2>
              <div className="text-xs text-drug-muted mb-4 flex items-center gap-1">
                <span>Route abbreviations are highlighted:</span>
                {['PO','IV','IM','SC'].map(r => (
                  <span
                    key={r}
                    style={{ background: ROUTE_META[r].bg, color: ROUTE_META[r].color, padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    {r}
                  </span>
                ))}
              </div>
              {drug.dosage
                ? renderDosageWithRoutes(drug.dosage)
                : <em className="text-drug-muted">No dosage information available.</em>}
            </div>
          </>
        )}

        {/* ── SAFETY ───────────────────────────────────────────────────── */}
        {activeTab === 'safety' && (
          <>
            {/* Pregnancy & Lactation highlight */}
            <div className="section-card p-5">
              <h2 className="text-lg font-bold mb-3">Pregnancy &amp; Lactation</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Baby className="w-4 h-4 text-pink-600" />
                    <span className="font-semibold text-pink-900 text-sm">Pregnancy</span>
                  </div>
                  <p className="text-sm text-pink-800 leading-relaxed">
                    {drug.contraindications && /pregnan/i.test(drug.contraindications)
                      ? drug.contraindications.split(/\n|,/).find(s => /pregnan/i.test(s))?.trim() || 'See contraindications below.'
                      : 'Refer to contraindications and consult current prescribing information.'}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-900 text-sm">Lactation</span>
                  </div>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    {drug.contraindications && /lactat|breastfeed|nursing/i.test(drug.contraindications)
                      ? drug.contraindications.split(/\n|,/).find(s => /lactat|breastfeed|nursing/i.test(s))?.trim()
                      : 'Consult current prescribing information for breastfeeding guidance.'}
                  </p>
                </div>
              </div>
            </div>

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

        {/* ── INTERACTIONS ─────────────────────────────────────────────── */}
        {activeTab === 'interactions' && (
          <div className="section-card p-6">
            <h2 className="text-lg font-bold mb-4">Drug Interactions</h2>
            <p className="text-drug-muted text-sm mb-4">
              Always verify interactions against current prescribing information.
              Consult a pharmacist for patient-specific interaction checking.
            </p>
            {drug.nursing_considerations
              ? renderList(drug.nursing_considerations, '\n')
              : <em className="text-drug-muted">Detailed interaction data not available. Refer to product monograph.</em>}
          </div>
        )}

        {/* ── PHARMACOLOGY ─────────────────────────────────────────────── */}
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

        {/* ── NURSING NOTES ────────────────────────────────────────────── */}
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
