import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Pill, Heart, Activity, Brain, Bone,
  Stethoscope, ChevronRight, Grid3X3, LayoutGrid,
  Soup, Droplets, Droplet, HeartHandshake, Sparkle,
  Shield, Baby, Eye, Apple, Zap, ShieldCheck, Siren,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { quickSearch, searchDrugs } from '../utils/searchDrugs';
import { ANATOMICAL_SYSTEMS, PINNED_SYSTEM_IDS } from '../data/anatomicalSystems';
import { getDisplayDrugClass } from '../utils/drugCategory';
import ConditionInsightCard, { normalizeConditionDrugName } from '../components/ConditionInsightCard';
import AiSearchFallback from '../components/AiSearchFallback';

const SYSTEM_ICONS = {
  Heart, Activity, Brain, Bone, Stethoscope,
  Soup, Droplets, Droplet, HeartHandshake, Sparkle,
  Shield, Baby, Eye, Apple, Zap, Siren,
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
  { name: 'Essential Drugs', icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50',   to: '/essential-drugs' },
];

// All 15 systems shown — no hidden "More Systems" tile


export default function HomePage() {
  const { isAdmin } = useAuth();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const TOTAL       = ALL_DRUGS.length;
  const CLASS_COUNT = useMemo(() => new Set(ALL_DRUGS.map(d => d.drug_class).filter(Boolean)).size, [ALL_DRUGS]);
  const RX_COUNT    = useMemo(() => new Set(ALL_DRUGS.map(d => d.prescription_status).filter(Boolean)).size, [ALL_DRUGS]);
  const FEATURED    = ALL_DRUGS.slice(0, 6);

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const resultsRef = React.useRef(null);

  // Keep the URL in sync (replace, not push) so a search here is shareable/
  // bookmarkable and links from elsewhere (e.g. an AI-suggested drug not yet
  // in the database) land with the search already filled in.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchQuery) next.set('q', searchQuery);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Live search — relevance ranked, searches name + ALL indication fields + class + overview
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return quickSearch(ALL_DRUGS, searchQuery, 8);
  }, [ALL_DRUGS, searchQuery]);

  // Full, uncapped list of every matching drug — shown further down the page
  // so a search never has to leave the home page to see everything that matched.
  const allMatchingDrugs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchDrugs(ALL_DRUGS, searchQuery);
  }, [ALL_DRUGS, searchQuery]);

  // Whether the search text is an exact drug name — if so, the instant
  // dropdown above already covers it and the AI "not in our database yet"
  // fallback below stays hidden; if not, this is likely a condition search.
  const hasExactDrugMatch = useMemo(() => {
    const q = normalizeConditionDrugName(searchQuery);
    if (!q) return true;
    return ALL_DRUGS.some(d => normalizeConditionDrugName(d.generic_name) === q);
  }, [ALL_DRUGS, searchQuery]);

  // Everything for a search already renders on this page — submitting just
  // closes the instant dropdown and scrolls down to the full results/insight.
  const handleSearch = (e) => {
    e.preventDefault();
    setShowDropdown(false);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            {isAdmin
              ? <>Search <span className="text-primary-300">{TOTAL}+</span> Medications</>
              : <>Search <span className="text-primary-300">Medications</span></>}
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
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
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
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl
                              border border-gray-100 overflow-hidden z-50 text-left">
                {searchResults.map(drug => (
                  <Link
                    key={drug.id}
                    to={`/drug/${drug.id}`}
                    onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b
                               border-gray-50 last:border-0 transition-colors"
                  >
                    <Pill className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 truncate">{drug.generic_name}</div>
                      {drug._matchType === 'indication' && drug._matchSnippet ? (
                        <div className="text-xs text-teal-600 truncate">✓ {drug._matchSnippet}</div>
                      ) : (
                        <div className="text-xs text-gray-500 truncate">{getDisplayDrugClass(drug)}</div>
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
                <button
                  type="button"
                  onClick={() => { setShowDropdown(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-50
                             text-primary-700 font-semibold text-sm hover:bg-primary-100 transition-colors"
                >
                  View all results <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>

          {/* Live stats — internal figures, admin-only */}
          {isAdmin && (
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
          )}
        </div>
      </section>

      {/* Condition insight — if the search matches (or is close to) a known
          condition, show its clinical overview + drug list right here; if it
          doesn't exist in the system yet, the AI lookup prompt appears
          instead. Only the main hero search bar does this. */}
      {searchQuery.trim() && (
        <section ref={resultsRef} className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 scroll-mt-6">
          <ConditionInsightCard searchQuery={searchQuery} existingDrugs={ALL_DRUGS} />
          {!hasExactDrugMatch && <AiSearchFallback searchQuery={searchQuery} />}

          {/* Every matching drug by name/indication/class — not just the top 8
              shown in the dropdown while typing — so nothing requires leaving
              this page to see the full picture. */}
          {allMatchingDrugs.length > 0 && (
            <div className="mt-6 bg-white border border-drug-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-drug-border">
                <h2 className="text-sm font-bold text-drug-text">
                  {allMatchingDrugs.length} matching medication{allMatchingDrugs.length === 1 ? '' : 's'}
                </h2>
              </div>
              {allMatchingDrugs.map((drug, i) => (
                <Link
                  key={drug.id}
                  to={`/drug/${drug.id}`}
                  className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors ${
                    i !== allMatchingDrugs.length - 1 ? 'border-b border-drug-border' : ''
                  }`}
                >
                  <Pill className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-gray-900 truncate">{drug.generic_name}</div>
                    {drug._matchType === 'indication' && drug._matchSnippet ? (
                      <div className="text-xs text-teal-600 truncate">✓ {drug._matchSnippet}</div>
                    ) : (
                      <div className="text-xs text-gray-500 truncate">{getDisplayDrugClass(drug)}</div>
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
            </div>
          )}
        </section>
      )}

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
                <p className="text-sm text-primary-600 font-medium mt-1">{getDisplayDrugClass(drug)}</p>
                <p className="text-sm text-drug-muted mt-2 line-clamp-2">{drug.indications}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>


    </div>
  );
}
