import React, { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap,
  Pill, ChevronRight, Grid3X3, List, ArrowLeft,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { getSystemById } from '../data/anatomicalSystems';
import { getDrugsForSystem } from '../utils/systemMatch';

const ICONS = {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap, Grid3X3,
};

export default function SystemPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const [viewMode, setViewMode] = useState('list');

  const system = getSystemById(systemId);

  const drugs = useMemo(() => {
    if (!system) return [];
    return getDrugsForSystem(ALL_DRUGS, system).sort((a, b) =>
      (a.generic_name || '').localeCompare(b.generic_name || '')
    );
  }, [ALL_DRUGS, system]);

  // Group by drug_class for a scannable subsection layout — a system like
  // Cardiovascular otherwise dumps 80 drugs into one flat list.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const drug of drugs) {
      const key = drug.drug_class || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(drug);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [drugs]);

  if (!system) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-drug-muted mb-4">Unknown system.</p>
        <Link to="/systems" className="text-primary-600 font-semibold hover:underline">
          Browse all systems
        </Link>
      </div>
    );
  }

  const Icon = ICONS[system.icon] || Pill;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-4 mb-2">
        <div className={`p-3 rounded-xl ${system.bg}`}>
          <Icon className={`w-7 h-7 ${system.color}`} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{system.name}</h1>
          <p className="text-drug-muted mt-0.5">
            {loading ? 'Loading…' : `${drugs.length} medication${drugs.length !== 1 ? 's' : ''} across ${grouped.length} class${grouped.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-6 mb-4">
        <button onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <List className="w-5 h-5" />
        </button>
        <button onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-drug-muted'}`}>
          <Grid3X3 className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-drug-muted">Loading…</div>
      ) : drugs.length === 0 ? (
        <div className="bg-white border border-drug-border rounded-xl p-10 text-center">
          <Icon className={`w-10 h-10 mx-auto mb-3 ${system.color}`} />
          <p className="text-drug-muted">No medications matched to {system.name} yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([className, classDrugs]) => (
            <div key={className}>
              <Link
                to={`/browse?class=${encodeURIComponent(className)}`}
                className="text-sm font-bold text-primary-700 hover:underline mb-3 inline-block"
              >
                {className} ({classDrugs.length})
              </Link>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classDrugs.map(drug => (
                    <Link key={drug.id} to={`/drug/${drug.id}`}
                          className="group bg-white border border-drug-border rounded-xl p-5 hover:border-primary-300 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-primary-50 rounded-lg">
                          <Pill className="w-5 h-5 text-primary-600" />
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                          drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                                       'bg-blue-100 text-blue-700'
                        }`}>
                          {drug.prescription_status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold group-hover:text-primary-700 transition-colors">{drug.generic_name}</h3>
                      <p className="text-sm text-primary-600 font-medium mt-1">{drug.drug_class}</p>
                      <p className="text-sm text-drug-muted mt-2 line-clamp-2">
                        {drug.indications || drug.primary_indications}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-drug-border rounded-xl overflow-hidden">
                  {classDrugs.map((drug, i) => (
                    <Link key={drug.id} to={`/drug/${drug.id}`}
                          className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                            i !== classDrugs.length - 1 ? 'border-b border-drug-border' : ''
                          }`}>
                      <div className="p-2 bg-primary-50 rounded-lg">
                        <Pill className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{drug.generic_name}</h3>
                        <p className="text-sm text-primary-600 truncate">{drug.drug_subclass || drug.drug_class}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                        drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                        drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                                     'bg-blue-100 text-blue-700'
                      }`}>
                        {drug.prescription_status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-drug-border text-xs text-drug-muted leading-relaxed">
        Medications are grouped here by matching their recorded drug class against "{system.name}" — a drug
        acting on multiple systems (e.g. an NSAID) may reasonably appear under more than one system.
      </div>
    </div>
  );
}
