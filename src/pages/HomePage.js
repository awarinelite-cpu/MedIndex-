import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Pill, Heart, Activity, Brain, Bone,
  Stethoscope, ChevronRight, Grid3X3, LayoutGrid,
  Soup, Droplets, Droplet, HeartHandshake, Sparkle,
  Shield, Baby, Eye, Apple, Zap,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { quickSearch } from '../utils/searchDrugs';
import { ANATOMICAL_SYSTEMS, PINNED_SYSTEM_IDS } from '../data/anatomicalSystems';

const SYSTEM_ICONS = {
  Heart, Activity, Brain, Bone, Stethoscope,
  Soup, Droplets, Droplet, HeartHandshake, Sparkle,
  Shield, Baby, Eye, Apple, Zap,
};

// 5 pinned systems + All Categories + More Systems (unchanged layout)
const PINNED_CARDS = PINNED_SYSTEM_IDS
  .map(id => ANATOMICAL_SYSTEMS.find(s => s.id === id))
  .filter(Boolean)
  .map(s => ({
    name:  s.name,
    icon:  SYSTEM_ICONS[s.icon] || Pill,
    color: s.color,
    bg:    s.bg,
    to:    `/system/${s.id}`,
  }));

const CATEGORIES = [
  ...PINNED_CARDS,
  { name: 'All Categories', icon: Grid3X3,    color: 'text-primary-600', bg: 'bg-primary-50', to: '/browse'  },
  { name: 'More Systems',   icon: LayoutGrid, color: 'text-slate-600',   bg: 'bg-slate-50',   to: '/systems' },
];

// All 15 systems shown — no hidden "More Systems" tile


export default function HomePage() {
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const TOTAL       = ALL_DRUGS.length;
  const CLASS_COUNT = useMemo(() => new Set(ALL_DRUGS.map(d => d.drug_class).filter(Boolean)).size, [ALL_DRUGS]);
  const RX_COUNT    = useMemo(() => new Set(ALL_DRUGS.map(d => d.prescription_status).filter(Boolean)).size, [ALL_DRUGS]);
  const FEATURED    = ALL_DRUGS.slice(0, 6);

  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Live search — relevance ranked, searches name + ALL indication fields + class + overview
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return quickSearch(ALL_DRUGS, searchQuery, 8);
  }, [ALL_DRUGS, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Search <span className="text-primary-300">{TOTAL}+</span> Medications
          </h1>
          <p className="text-lg sm:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Comprehensive Nigerian clinical drug reference covering dosages, interactions,
            nursing considerations, and safety information.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, condition, or drug class..."
              className="w-full pl-12 pr-32 py-4 rounded-xl text-gray-900 placeholder-gray-400
                         focus:outline-none focus:ring-4 focus:ring-primary-300/50 shadow-2xl text-lg"
            />
            {searchQuery && (
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary-600
                           text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                Search
              </button>
            )}

            {/* Instant dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl
                              border border-gray-100 overflow-hidden z-50 text-left">
                {searchResults.map(drug => (
                  <Link
                    key={drug.id}
                    to={`/drug/${drug.id}`}
                    onClick={() => setSearchQuery('')}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b
                               border-gray-50 last:border-0 transition-colors"
                  >
                    <Pill className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 truncate">{drug.generic_name}</div>
                      {drug._matchType === 'indication' && drug._matchSnippet ? (
                        <div className="text-xs text-teal-600 truncate">✓ {drug._matchSnippet}</div>
                      ) : (
                        <div className="text-xs text-gray-500 truncate">{drug.drug_class}</div>
                      )}
                    </div>
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                      drug.prescription_status === 'OTC'        ? 'bg-green-100 text-green-700' :
                      drug.prescription_status === 'Controlled' ? 'bg-red-100 text-red-700' :
                                                                   'bg-blue-100 text-blue-700'
                    }`}>
                      {drug.prescription_status}
                    </span>
                  </Link>
                ))}
                <Link
                  to={`/browse?q=${encodeURIComponent(searchQuery)}`}
                  onClick={() => setSearchQuery('')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-50
                             text-primary-700 font-semibold text-sm hover:bg-primary-100 transition-colors"
                >
                  View all results <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </form>

          {/* Live stats */}
          <div className="flex justify-center gap-8 mt-10 text-primary-100">
            <div className="text-center">
              <div className="text-2xl font-bold">{loading ? '—' : TOTAL}</div>
              <div className="text-sm opacity-80">Drugs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{loading ? '—' : CLASS_COUNT}</div>
              <div className="text-sm opacity-80">Drug Classes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{loading ? '—' : RX_COUNT}</div>
              <div className="text-sm opacity-80">Rx Categories</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.name}
              to={cat.to}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-drug-border
                         hover:border-primary-300 hover:shadow-md transition-all bg-white"
            >
              <div className={`p-3 rounded-lg ${cat.bg}`}>
                <cat.icon className={`w-6 h-6 ${cat.color}`} />
              </div>
              <span className="text-sm font-semibold text-center">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Medications — always instant, no spinner */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Featured Medications</h2>
            <Link to="/browse" className="flex items-center gap-1 text-primary-600 font-semibold hover:text-primary-700">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED.map(drug => (
              <Link
                key={drug.id}
                to={`/drug/${drug.id}`}
                className="group bg-white border border-drug-border rounded-xl p-5
                           hover:border-primary-300 hover:shadow-lg transition-all"
              >
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
                <h3 className="text-lg font-bold text-drug-text group-hover:text-primary-700 transition-colors">
                  {drug.generic_name}
                </h3>
                <p className="text-sm text-primary-600 font-medium mt-1">{drug.drug_class}</p>
                <p className="text-sm text-drug-muted mt-2 line-clamp-2">{drug.indications}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>


    </div>
  );
}
