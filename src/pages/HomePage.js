import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Pill, ChevronRight,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { quickSearch, searchDrugs } from '../utils/searchDrugs';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { getDisplayDrugClass } from '../utils/drugCategory';
import ConditionInsightCard, { normalizeConditionDrugName } from '../components/ConditionInsightCard';
import AiSearchFallback from '../components/AiSearchFallback';
import { HeartIcon, PancreasIcon, BrainIcon, StomachIcon, LungsIcon, ShieldCheckIcon } from '../components/icons/OrganIcons';

// The 6-tile "Browse by Category" grid — solid, flat organ-color icons (not
// lucide's thin outline set, which has no dedicated pancreas/stomach/lungs
// glyphs) tinted to a soft background square; the underlying system id still
// drives the link and the keyword-matching used everywhere else, only the
// tile styling and display label ("... Drugs") are specific to this grid.
const CATEGORY_TILES = [
  { id: 'cardiovascular',   label: 'Cardiovascular Drugs',   icon: HeartIcon,       color: 'text-red-500',    bg: 'bg-red-100'    },
  { id: 'endocrine',        label: 'Endocrine Drugs',        icon: PancreasIcon,    color: 'text-amber-500',  bg: 'bg-amber-100'  },
  { id: 'neurological',     label: 'Neurological Drugs',     icon: BrainIcon,       color: 'text-purple-500', bg: 'bg-purple-100' },
  { id: 'gastrointestinal', label: 'Gastrointestinal Drugs', icon: StomachIcon,     color: 'text-green-600',  bg: 'bg-green-100'  },
  { id: 'respiratory',      label: 'Respiratory Drugs',      icon: LungsIcon,       color: 'text-blue-500',   bg: 'bg-blue-100'   },
  { id: 'infectious',       label: 'Anti-infective Drugs',   icon: ShieldCheckIcon, color: 'text-teal-600',   bg: 'bg-teal-100'   },
]
  .map(tile => {
    const system = ANATOMICAL_SYSTEMS.find(s => s.id === tile.id);
    return system ? { ...tile, to: `/system/${tile.id}` } : null;
  })
  .filter(Boolean);

// Rotating avatar tints for the Featured Drugs list rows
const AVATAR_TINTS = ['bg-slate-100 text-slate-500', 'bg-blue-100 text-blue-500', 'bg-pink-100 text-pink-500'];

function RxBadge({ status }) {
  const cls =
    status === 'OTC'        ? 'bg-green-100 text-green-700' :
    status === 'Controlled' ? 'bg-red-100 text-red-700' :
                               'bg-blue-100 text-blue-700';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${cls}`}>
      {status || 'Prescription'}
    </span>
  );
}


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
      {/* Hero — same flat color as the header above it, so the two read as
          one continuous blue block with no gradient/shade break between them. */}
      <section className="bg-primary-900 text-white pt-2 pb-12 sm:pt-3 sm:pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Search <span className="text-primary-300">Medications</span>
          </h1>
          <p className="text-primary-100 max-w-xl mx-auto">
            Comprehensive Nigerian clinical drug reference and Medsurge covering class,
            dosages, interactions, nursing considerations, and safety information.
          </p>
        </div>
      </section>

      {/* Search bar — sits directly under the app header, app-bar style */}
      <section className="bg-white border-b border-drug-border py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              placeholder="Search drugs, conditions, or drug classes..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-drug-bg text-gray-900 placeholder-gray-400
                         border border-drug-border focus:outline-none focus:ring-4 focus:ring-primary-300/30
                         focus:border-primary-300 shadow-sm"
            />

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
                    <RxBadge status={drug.prescription_status} />
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
            <div className="flex justify-center gap-8 mt-5 text-drug-muted">
              <div className="text-center">
                <div className="text-xl font-bold text-drug-text">{loading ? '—' : TOTAL}</div>
                <div className="text-xs opacity-80">Drugs</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-drug-text">{loading ? '—' : CLASS_COUNT}</div>
                <div className="text-xs opacity-80">Drug Classes</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-drug-text">{loading ? '—' : RX_COUNT}</div>
                <div className="text-xs opacity-80">Rx Categories</div>
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
                  <RxBadge status={drug.prescription_status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Browse by Category — 6-tile grid of colored icon squares */}
      <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-drug-text">Browse by Category</h2>
          <Link to="/systems" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {CATEGORY_TILES.map(cat => (
            <Link
              key={cat.id}
              to={cat.to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:shadow-md transition-all bg-white
                         border border-drug-border text-center"
            >
              <div className={`w-14 h-14 flex items-center justify-center rounded-2xl ${cat.bg}`}>
                <cat.icon className={`w-8 h-8 ${cat.color}`} />
              </div>
              <span className="text-xs font-semibold text-drug-text leading-tight">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Drugs — list rows, always instant, no spinner */}
      <section className="py-4 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-drug-text">Featured Drugs</h2>
            <Link to="/browse" className="flex items-center gap-0.5 text-sm font-semibold text-primary-600 hover:text-primary-700">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="border border-drug-border rounded-xl overflow-hidden">
            {FEATURED.map((drug, i) => (
              <Link
                key={drug.id}
                to={`/drug/${drug.id}`}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                  i !== FEATURED.length - 1 ? 'border-b border-drug-border' : ''
                }`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}>
                  <Pill className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-drug-text truncate">{drug.generic_name}</div>
                  <div className="text-xs text-drug-muted truncate">{getDisplayDrugClass(drug)}</div>
                </div>
                <RxBadge status={drug.prescription_status} />
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
