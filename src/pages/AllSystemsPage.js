import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap, Pill, ArrowLeft, Siren,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { getSystemCounts } from '../utils/systemMatch';

const ICONS = {
  Heart, Activity, Brain, Bone, Stethoscope, Soup, Droplets, Droplet,
  HeartHandshake, Sparkle, Shield, Baby, Eye, Apple, Zap, Siren,
};

export default function AllSystemsPage() {
  const navigate = useNavigate();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const counts = useMemo(() => getSystemCounts(ALL_DRUGS, ANATOMICAL_SYSTEMS), [ALL_DRUGS]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Browse by Body System</h1>
      <p className="text-drug-muted mb-8">Every medication in the database, grouped by the anatomical system it acts on.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {ANATOMICAL_SYSTEMS.map(system => {
          const Icon = ICONS[system.icon] || Pill;
          return (
            <Link
              key={system.id}
              to={`/system/${system.id}`}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-drug-border
                         hover:border-primary-300 hover:shadow-md transition-all bg-white text-center"
            >
              <div className={`p-3 rounded-lg ${system.bg}`}>
                <Icon className={`w-6 h-6 ${system.color}`} />
              </div>
              <div>
                <span className="text-sm font-semibold block">{system.name}</span>
                <span className="text-xs text-drug-muted">
                  {loading ? '…' : `${counts[system.id] || 0} drug${counts[system.id] === 1 ? '' : 's'}`}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
