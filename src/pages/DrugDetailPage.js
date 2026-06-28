import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Pill, AlertTriangle, Heart, Baby, Clock, FlaskConical, DollarSign, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

export default function DrugDetailPage() {
  const { id } = useParams();
  const [drug, setDrug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    async function loadDrug() {
      try {
        const docRef = doc(db, 'drugs', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDrug({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error('Error loading drug:', err);
      }
      setLoading(false);
    }
    loadDrug();
  }, [id]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Pill },
    { id: 'dosage', label: 'Dosage', icon: Clock },
    { id: 'safety', label: 'Safety', icon: AlertTriangle },
    { id: 'interactions', label: 'Interactions', icon: FlaskConical },
    { id: 'pharmacology', label: 'Pharmacology', icon: Heart },
  ];

  const renderList = (value, separator = '|') => {
    if (!value) return <em className="text-drug-muted">No data available</em>;
    const items = value.split(separator).map(s => s.trim()).filter(s => s);
    return (
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="list-item">{item}</div>
        ))}
      </div>
    );
  };

  const renderCSV = (value) => {
    if (!value) return <em className="text-drug-muted">No data available</em>;
    const items = value.split(',').map(s => s.trim()).filter(s => s);
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
            {item}
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!drug) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-600">Drug not found</h2>
        <p className="text-gray-500 mt-2">The medication you're looking for doesn't exist in our database.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Pill className="w-8 h-8 text-primary-600" />
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            drug.prescription_status === 'OTC' ? 'bg-green-100 text-green-700' :
            drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {drug.prescription_status}
          </span>
          {drug.black_box_warning === 'TRUE' && (
            <span className="text-sm font-bold px-3 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Black Box Warning
            </span>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-drug-text">{drug.generic_name}</h1>
        <p className="text-lg text-primary-600 font-medium mt-1">{drug.drug_class}{drug.drug_subclass ? ` — ${drug.drug_subclass}` : ''}</p>

        {drug.brand_names && (
          <p className="text-drug-muted mt-2">
            <span className="font-semibold">Brand names:</span> {drug.brand_names}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2 scrollbar-thin">
        {tabs.map((tab) => (
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
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Description */}
            {drug.description && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Description</h2>
                <p className="text-drug-text leading-relaxed">{drug.description}</p>
              </div>
            )}

            {/* Indications */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-3">What it's used for</h2>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-primary-700 mb-2">Primary Indications</h3>
                {renderCSV(drug.primary_indications)}
              </div>
              {drug.off_label_uses && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-700 mb-2">Off-label Uses</h3>
                  {renderCSV(drug.off_label_uses)}
                </div>
              )}
            </div>

            {/* Dosage Forms */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-3">Available Forms & Strengths</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {drug.strengths?.split(',').map((s, i) => (
                  <div key={i} className="text-center p-3 bg-primary-50 rounded-lg border border-primary-100">
                    <div className="font-bold text-primary-900">{s.trim()}</div>
                    <div className="text-xs text-primary-600">{drug.dosage_forms?.split(',')[0]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mechanism */}
            {drug.mechanism_of_action && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">How it works</h2>
                <p className="text-drug-text leading-relaxed">{drug.mechanism_of_action}</p>
              </div>
            )}

            {/* Special Populations Summary */}
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-3">Special Populations</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-pink-50 rounded-lg">
                  <Baby className="w-6 h-6 text-pink-600 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-pink-900">Pregnancy</div>
                  <div className="text-xs text-pink-700 mt-1">{drug.pregnancy_category || 'N/A'}</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Heart className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-blue-900">Lactation</div>
                  <div className="text-xs text-blue-700 mt-1">{drug.lactation_safety || 'N/A'}</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">👶</div>
                  <div className="text-sm font-semibold text-green-900 mt-1">Pediatric</div>
                  <div className="text-xs text-green-700 mt-1">{drug.pediatric_safety || 'N/A'}</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">👴</div>
                  <div className="text-sm font-semibold text-amber-900 mt-1">Geriatric</div>
                  <div className="text-xs text-amber-700 mt-1">{drug.geriatric_safety ? 'Caution' : 'N/A'}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* DOSAGE TAB */}
        {activeTab === 'dosage' && (
          <>
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Adult Dosing</h2>
              <div className="space-y-4">
                {drug.adult_dosing_initial && (
                  <div className="flex gap-4">
                    <div className="w-32 flex-shrink-0 text-sm font-semibold text-drug-muted">Initial</div>
                    <div className="text-drug-text">{drug.adult_dosing_initial}</div>
                  </div>
                )}
                {drug.adult_dosing_maintenance && (
                  <div className="flex gap-4">
                    <div className="w-32 flex-shrink-0 text-sm font-semibold text-drug-muted">Maintenance</div>
                    <div className="text-drug-text">{drug.adult_dosing_maintenance}</div>
                  </div>
                )}
                {drug.adult_dosing_maximum && (
                  <div className="flex gap-4">
                    <div className="w-32 flex-shrink-0 text-sm font-semibold text-drug-muted">Maximum</div>
                    <div className="text-drug-text font-semibold text-red-600">{drug.adult_dosing_maximum}</div>
                  </div>
                )}
                {drug.dosing_frequency && (
                  <div className="flex gap-4">
                    <div className="w-32 flex-shrink-0 text-sm font-semibold text-drug-muted">Frequency</div>
                    <div className="text-drug-text">{drug.dosing_frequency}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Dosing Adjustments */}
            {(drug.dosing_adjustments_renal || drug.dosing_adjustments_hepatic || drug.dosing_adjustments_elderly) && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Dosing Adjustments</h2>
                <div className="space-y-3">
                  {drug.dosing_adjustments_renal && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="font-semibold text-amber-900 mb-1">Renal Impairment</div>
                      <div className="text-sm text-amber-800">{drug.dosing_adjustments_renal}</div>
                    </div>
                  )}
                  {drug.dosing_adjustments_hepatic && (
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                      <div className="font-semibold text-orange-900 mb-1">Hepatic Impairment</div>
                      <div className="text-sm text-orange-800">{drug.dosing_adjustments_hepatic}</div>
                    </div>
                  )}
                  {drug.dosing_adjustments_elderly && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="font-semibold text-blue-900 mb-1">Elderly Patients</div>
                      <div className="text-sm text-blue-800">{drug.dosing_adjustments_elderly}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {drug.pediatric_dosing && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Pediatric Dosing</h2>
                <p className="text-drug-text">{drug.pediatric_dosing}</p>
                {drug.pediatric_age_minimum && (
                  <p className="text-sm text-drug-muted mt-2">Minimum age: {drug.pediatric_age_minimum}</p>
                )}
              </div>
            )}

            {drug.administration_instructions && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Administration</h2>
                <p className="text-drug-text">{drug.administration_instructions}</p>
              </div>
            )}
          </>
        )}

        {/* SAFETY TAB */}
        {activeTab === 'safety' && (
          <>
            {drug.black_box_warning === 'TRUE' && drug.black_box_warning_text && (
              <div className="black-box-warning">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-bold uppercase tracking-wide">Black Box Warning</span>
                </div>
                <p className="text-sm leading-relaxed">{drug.black_box_warning_text}</p>
              </div>
            )}

            {drug.contraindications && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3 text-red-700">Contraindications</h2>
                {renderList(drug.contraindications)}
              </div>
            )}

            {drug.warnings_precautions && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3 text-amber-700">Warnings & Precautions</h2>
                {renderList(drug.warnings_precautions)}
              </div>
            )}

            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Side Effects</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {drug.side_effects_common && (
                  <div>
                    <h3 className="text-sm font-bold text-green-700 mb-2">Common (≥1%)</h3>
                    {renderList(drug.side_effects_common)}
                  </div>
                )}
                {drug.side_effects_serious && (
                  <div>
                    <h3 className="text-sm font-bold text-red-700 mb-2">Serious</h3>
                    {renderList(drug.side_effects_serious)}
                  </div>
                )}
                {drug.side_effects_rare && (
                  <div>
                    <h3 className="text-sm font-bold text-amber-700 mb-2">Rare (&lt;1%)</h3>
                    {renderList(drug.side_effects_rare)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* INTERACTIONS TAB */}
        {activeTab === 'interactions' && (
          <>
            {drug.drug_interactions_major && (
              <div className="section-card p-6 border-l-4 border-red-500">
                <h2 className="text-lg font-bold mb-3 text-red-700">Major Interactions</h2>
                {renderList(drug.drug_interactions_major)}
              </div>
            )}
            {drug.drug_interactions_moderate && (
              <div className="section-card p-6 border-l-4 border-amber-500">
                <h2 className="text-lg font-bold mb-3 text-amber-700">Moderate Interactions</h2>
                {renderList(drug.drug_interactions_moderate)}
              </div>
            )}
            {drug.drug_interactions_minor && (
              <div className="section-card p-6 border-l-4 border-blue-500">
                <h2 className="text-lg font-bold mb-3 text-blue-700">Minor Interactions</h2>
                {renderList(drug.drug_interactions_minor)}
              </div>
            )}
            {drug.food_interactions && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-3">Food Interactions</h2>
                {renderList(drug.food_interactions)}
              </div>
            )}
            {drug.alcohol_interaction && (
              <div className="section-card p-6 bg-amber-50">
                <h2 className="text-lg font-bold mb-3 text-amber-900">Alcohol Interaction</h2>
                <p className="text-amber-800">{drug.alcohol_interaction}</p>
              </div>
            )}
          </>
        )}

        {/* PHARMACOLOGY TAB */}
        {activeTab === 'pharmacology' && (
          <>
            <div className="section-card p-6">
              <h2 className="text-lg font-bold mb-4">Pharmacokinetics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {drug.onset_of_action && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-drug-muted uppercase tracking-wide">Onset</div>
                    <div className="font-semibold text-drug-text">{drug.onset_of_action}</div>
                  </div>
                )}
                {drug.peak_effect && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-drug-muted uppercase tracking-wide">Peak Effect</div>
                    <div className="font-semibold text-drug-text">{drug.peak_effect}</div>
                  </div>
                )}
                {drug.duration_of_action && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-drug-muted uppercase tracking-wide">Duration</div>
                    <div className="font-semibold text-drug-text">{drug.duration_of_action}</div>
                  </div>
                )}
                {drug.half_life && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-drug-muted uppercase tracking-wide">Half-Life</div>
                    <div className="font-semibold text-drug-text">{drug.half_life}</div>
                  </div>
                )}
                {drug.protein_binding && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-drug-muted uppercase tracking-wide">Protein Binding</div>
                    <div className="font-semibold text-drug-text">{drug.protein_binding}</div>
                  </div>
                )}
              </div>
            </div>

            {(drug.metabolism || drug.excretion) && (
              <div className="section-card p-6">
                <h2 className="text-lg font-bold mb-4">Metabolism & Excretion</h2>
                <div className="space-y-3">
                  {drug.metabolism && (
                    <div className="flex gap-4">
                      <div className="w-24 flex-shrink-0 text-sm font-semibold text-drug-muted">Metabolism</div>
                      <div className="text-drug-text">{drug.metabolism}</div>
                    </div>
                  )}
                  {drug.excretion && (
                    <div className="flex gap-4">
                      <div className="w-24 flex-shrink-0 text-sm font-semibold text-drug-muted">Excretion</div>
                      <div className="text-drug-text">{drug.excretion}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* References & Footer */}
      {(drug.references || drug.prescribing_info_url) && (
        <div className="mt-8 pt-6 border-t border-drug-border">
          <h3 className="font-bold mb-3">References & Resources</h3>
          {drug.prescribing_info_url && (
            <a href={drug.prescribing_info_url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium mb-2">
              <ExternalLink className="w-4 h-4" /> Full Prescribing Information
            </a>
          )}
          {drug.references && (
            <div className="text-sm text-drug-muted">{drug.references}</div>
          )}
        </div>
      )}
    </div>
  );
}
