import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Pill, ChevronRight, Clock, Syringe,
  ClipboardPlus, FlaskConical, Calculator, GraduationCap, FileText,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { quickSearch, searchDrugs } from '../utils/searchDrugs';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { drugMatchesSystem } from '../utils/systemMatch';
import { getDisplayDrugClass } from '../utils/drugCategory';
import ConditionInsightCard, { normalizeConditionDrugName } from '../components/ConditionInsightCard';
import AiSearchFallback from '../components/AiSearchFallback';
import AddToFavoritesHeart from '../components/AddToFavoritesHeart';
import { HeartIcon, PancreasIcon, BrainIcon, StomachIcon, LungsIcon } from '../components/icons/OrganIcons';
import { PulseIcon, Stethoscope, BoneIcon } from '../components/dashboard/DashboardArt';

// ── Quick Access: the four shortcut cards under the AI banner ──────────────
const QUICK_ACCESS = [
  { to: '/browse',      title: 'Drug Library', sub: 'Search & view drug details', Icon: Pill,         grad: ['#3b92ff', '#1259d8'], bg: '#edf5ff', line: '#d5e6fb' },
  { to: '/procedures',  title: 'Procedures',   sub: 'Step-by-step guides',        Icon: ClipboardPlus, grad: ['#3688f5', '#1655cf'], bg: '#edf4ff', line: '#d5e4fa' },
  { to: '/labs',        title: 'Lab Reference', sub: 'Tests & normal values',     Icon: FlaskConical, grad: ['#9a6cf4', '#6b3fd8'], bg: '#f3eeff', line: '#e2d8fb' },
  { to: '/calculators', title: 'Calculators',  sub: 'Clinical tools & scores',    Icon: Calculator,   grad: ['#1fc1b2', '#0b8f94'], bg: '#e8f8f7', line: '#c9ece9' },
];

// ── Browse by System: one tile per organ system. The id still drives the
// /system/:id link and the keyword matching used everywhere else. ──────────
const SYSTEM_TILES = [
  { id: 'cardiovascular',   label: 'Cardiovascular',   Icon: HeartIcon,    grad: ['#3b92ff', '#1259d8'], bg: '#eaf3ff', line: '#d3e4fb' },
  { id: 'respiratory',      label: 'Respiratory',      Icon: LungsIcon,    grad: ['#34c48b', '#12985f'], bg: '#e8f8f1', line: '#cdeedd' },
  { id: 'neurological',     label: 'Neurological',     Icon: BrainIcon,    grad: ['#a074f5', '#6b3fd8'], bg: '#f2ecff', line: '#e1d7fb' },
  { id: 'gastrointestinal', label: 'Gastrointestinal', Icon: StomachIcon,  grad: ['#ffb54f', '#f27a10'], bg: '#fff3e5', line: '#f9dcba' },
  { id: 'endocrine',        label: 'Endocrine',        Icon: PancreasIcon, grad: ['#27c6b6', '#0b8f94'], bg: '#e6f8f6', line: '#c7ece8' },
  { id: 'musculoskeletal',  label: 'Musculoskeletal',  Icon: BoneIcon,     grad: ['#ff7390', '#e23a63'], bg: '#ffecf1', line: '#fad2dc' },
]
  .filter(tile => ANATOMICAL_SYSTEMS.some(s => s.id === tile.id));

// The dashboard shows the first four; "See all" opens the full list.
const SYSTEM_TILES_SHOWN = SYSTEM_TILES.slice(0, 4);

// Pill + avatar colours for the Recently Viewed rows, keyed by system id.
const SYSTEM_PALETTE = {
  cardiovascular:   { fg: '#1565d8', bg: '#e4efff', label: 'Cardiovascular' },
  endocrine:        { fg: '#7b3fe0', bg: '#efe7ff', label: 'Endocrine' },
  infectious:       { fg: '#0c9b92', bg: '#dcf6f3', label: 'Anti-infective' },
  respiratory:      { fg: '#13975f', bg: '#def5ea', label: 'Respiratory' },
  neurological:     { fg: '#6b3fd8', bg: '#eee8ff', label: 'Neurological' },
  gastrointestinal: { fg: '#e27a12', bg: '#ffeed9', label: 'Gastrointestinal' },
  musculoskeletal:  { fg: '#d93a60', bg: '#ffe5ec', label: 'Musculoskeletal' },
};
const FALLBACK_PALETTE = { fg: '#475b78', bg: '#e9eef6' };

function describeDrug(drug) {
  const system = ANATOMICAL_SYSTEMS.find(s => drugMatchesSystem(drug, s));
  const palette = system && SYSTEM_PALETTE[system.id];
  if (palette) return { ...palette, systemId: system.id };
  return {
    ...FALLBACK_PALETTE,
    label: system ? system.name.split(' & ')[0] : (drug.prescription_status || 'Medication'),
    systemId: system?.id || null,
  };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

const gradient = ([a, b]) => `linear-gradient(145deg, ${a}, ${b})`;

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
  const { user } = useAuth();
  const { drugs: ALL_DRUGS, loading } = useDrugs();
  const recentIds = useRecentlyViewed(user?.uid);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const { customConditionsBySystem, hiddenConditionIdsBySystem } = useCustomConditions();
  const TOTAL       = ALL_DRUGS.length;
  const CLASS_COUNT = useMemo(() => new Set(ALL_DRUGS.map(d => d.drug_class).filter(Boolean)).size, [ALL_DRUGS]);
  const RX_COUNT    = useMemo(() => new Set(ALL_DRUGS.map(d => d.prescription_status).filter(Boolean)).size, [ALL_DRUGS]);
  // Total conditions across every system — seeded (systemConditions.js) list
  // minus any admin-hidden seeded ids, plus AI-suggested/admin-approved
  // custom conditions stored in Firestore for that system.
  const CONDITION_COUNT = useMemo(() => {
    const systemIds = new Set([
      ...Object.keys(SYSTEM_CONDITIONS),
      ...Object.keys(customConditionsBySystem || {}),
    ]);
    let count = 0;
    systemIds.forEach(systemId => {
      const hiddenIds = new Set(hiddenConditionIdsBySystem?.[systemId] || []);
      const seeded = (SYSTEM_CONDITIONS[systemId] || []).filter(c => !hiddenIds.has(c.id));
      const custom = customConditionsBySystem?.[systemId] || [];
      count += seeded.length + custom.length;
    });
    return count;
  }, [customConditionsBySystem, hiddenConditionIdsBySystem]);
  // Recently opened drugs, newest first — ids that no longer exist are skipped.
  const RECENT = useMemo(() => {
    const byId = new Map(ALL_DRUGS.map(d => [d.id, d]));
    return recentIds.map(id => byId.get(id)).filter(Boolean);
  }, [ALL_DRUGS, recentIds]);
  const recentShown = showAllRecent ? RECENT : RECENT.slice(0, 3);

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const resultsRef = React.useRef(null);

  // The input itself is bound directly to searchQuery, so every keystroke
  // paints immediately no matter how slow the search below it is. Every
  // downstream computation (dropdown, full match list, exact-match check,
  // the condition insight card, the AI fallback) instead reads this
  // deferred copy — React keeps it a render behind while typing is in
  // progress, so a big synonym-matching pass over hundreds of drugs never
  // blocks the next keystroke from showing up on screen.
  const deferredQuery = useDeferredValue(searchQuery);

  // Keep the URL in sync (replace, not push) so a search here is shareable/
  // bookmarkable and links from elsewhere (e.g. an AI-suggested drug not yet
  // in the database) land with the search already filled in.
  useEffect(() => {
    const next = new URLSearchParams();
    if (deferredQuery) next.set('q', deferredQuery);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery]);

  // Live search — relevance ranked, searches name + ALL indication fields + class + overview
  const searchResults = useMemo(() => {
    if (!deferredQuery.trim()) return [];
    return quickSearch(ALL_DRUGS, deferredQuery, 8);
  }, [ALL_DRUGS, deferredQuery]);

  // Full, uncapped list of every matching drug — shown further down the page
  // so a search never has to leave the home page to see everything that matched.
  const allMatchingDrugs = useMemo(() => {
    if (!deferredQuery.trim()) return [];
    return searchDrugs(ALL_DRUGS, deferredQuery);
  }, [ALL_DRUGS, deferredQuery]);

  // Whether the search text is an exact drug name — if so, the instant
  // dropdown above already covers it and the AI "not in our database yet"
  // fallback below stays hidden; if not, this is likely a condition search.
  const hasExactDrugMatch = useMemo(() => {
    const q = normalizeConditionDrugName(deferredQuery);
    if (!q) return true;
    return ALL_DRUGS.some(d => normalizeConditionDrugName(d.generic_name) === q);
  }, [ALL_DRUGS, deferredQuery]);

  // Everything for a search already renders on this page — submitting just
  // closes the instant dropdown and scrolls down to the full results/insight.
  const handleSearch = (e) => {
    e.preventDefault();
    setShowDropdown(false);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mi-home">
      <div className="mi-container">

        {/* Greeting banner */}
        <section className="mi-hero">
          <div className="mi-hero-text">
            <span className="mi-hero-hello">{greeting()}</span>
            <h1>
              Healthcare Professional
              <PulseIcon className="mi-hero-pulse" />
            </h1>
            <p>Reliable drug information, clinical tools and medical resources — all in one place.</p>
          </div>
          <Stethoscope className="mi-hero-art" />
        </section>

        {/* Search */}
        <form onSubmit={handleSearch} className="mi-search">
          <div className="mi-search-field">
            <Search className="mi-search-lead" size={22} strokeWidth={2.2} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              placeholder="Search drugs, conditions, procedures..."
              aria-label="Search drugs, conditions, procedures"
            />
            <button type="submit" className="mi-search-go" aria-label="Search">
              <Search size={22} strokeWidth={2.4} />
            </button>
          </div>

          {/* Instant dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="mi-dropdown">
              {searchResults.map(drug => (
                <Link
                  key={drug.id}
                  to={`/drug/${drug.id}`}
                  onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                  className="mi-dropdown-row"
                >
                  <Pill className="mi-dropdown-pill" size={18} />
                  <div className="mi-dropdown-main">
                    <div className="mi-dropdown-name">{drug.generic_name}</div>
                    {drug._matchType === 'indication' && drug._matchSnippet ? (
                      <div className="mi-dropdown-sub mi-dropdown-match">✓ {drug._matchSnippet}</div>
                    ) : (
                      <div className="mi-dropdown-sub">{getDisplayDrugClass(drug)}</div>
                    )}
                  </div>
                  <AddToFavoritesHeart drug={drug} />
                  <RxBadge status={drug.prescription_status} />
                </Link>
              ))}
              <span
                role="button"
                tabIndex={0}
                className="mi-dropdown-all"
                onClick={() => { setShowDropdown(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowDropdown(false); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
              >
                View all results <ChevronRight size={16} />
              </span>
            </div>
          )}
        </form>

        {/* Library stats */}
        <section className="mi-stats" aria-label="Library totals">
          <div className="mi-stat">
            <Pill className="mi-stat-ico" size={30} strokeWidth={2.4} />
            <b>{loading ? '-' : TOTAL}</b><span>Drugs</span>
          </div>
          <div className="mi-stat">
            <GraduationCap className="mi-stat-ico" size={32} strokeWidth={2.2} />
            <b>{loading ? '-' : CLASS_COUNT}</b><span>Drug Classes</span>
          </div>
          <div className="mi-stat">
            <span className="mi-stat-rx" aria-hidden="true">Rx</span>
            <b>{loading ? '-' : RX_COUNT}</b><span>Rx Categories</span>
          </div>
          <div className="mi-stat">
            <FileText className="mi-stat-ico" size={30} strokeWidth={2.4} />
            <b>{loading ? '-' : CONDITION_COUNT}</b><span>Conditions</span>
          </div>
        </section>

        {/* Condition insight — if the search matches (or is close to) a known
            condition, show its clinical overview + drug list right here; if it
            doesn't exist in the system yet, the AI lookup prompt appears
            instead. */}
        {searchQuery.trim() && (
          <section ref={resultsRef} className="mi-results">
            <ConditionInsightCard searchQuery={deferredQuery} existingDrugs={ALL_DRUGS} />
            {!hasExactDrugMatch && <AiSearchFallback searchQuery={deferredQuery} />}

            {/* Every matching drug by name/indication/class — not just the top 8
                shown in the dropdown while typing. */}
            {allMatchingDrugs.length > 0 && (
              <div className="mi-recent mi-matches">
                <div className="mi-matches-head">
                  {allMatchingDrugs.length} matching medication{allMatchingDrugs.length === 1 ? '' : 's'}
                </div>
                {allMatchingDrugs.map(drug => (
                  <Link key={drug.id} to={`/drug/${drug.id}`} className="mi-dropdown-row mi-match-row">
                    <Pill className="mi-dropdown-pill" size={18} />
                    <div className="mi-dropdown-main">
                      <div className="mi-dropdown-name">{drug.generic_name}</div>
                      {drug._matchType === 'indication' && drug._matchSnippet ? (
                        <div className="mi-dropdown-sub mi-dropdown-match">✓ {drug._matchSnippet}</div>
                      ) : (
                        <div className="mi-dropdown-sub">{getDisplayDrugClass(drug)}</div>
                      )}
                    </div>
                    <AddToFavoritesHeart drug={drug} />
                    <RxBadge status={drug.prescription_status} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Quick Access */}
        <div className="mi-sec-head">
          <h2 className="mi-bar">Quick Access</h2>
          <Link to="/more" className="mi-see-all">See all <ChevronRight size={18} strokeWidth={2.4} /></Link>
        </div>
        <div className="mi-qa">
          {QUICK_ACCESS.map(({ to, title, sub, Icon, grad, bg, line }) => (
            <Link
              key={to}
              to={to}
              className="mi-qa-card"
              style={{ '--tint-bg': bg, '--tint-line': line, '--grad': gradient(grad), '--glow': `${grad[1]}66` }}
            >
              <span className="mi-qa-icon"><Icon size={28} strokeWidth={2} /></span>
              <span className="mi-qa-title">{title}</span>
              <span className="mi-qa-sub">{sub}</span>
            </Link>
          ))}
        </div>

        {/* Browse by System */}
        <div className="mi-sec-head">
          <h2 className="mi-bar">Browse by System</h2>
          <Link to="/systems" className="mi-see-all">See all <ChevronRight size={18} strokeWidth={2.4} /></Link>
        </div>
        <div className="mi-sys">
          {SYSTEM_TILES_SHOWN.map(({ id, label, Icon, grad, bg, line }) => (
            <Link
              key={id}
              to={`/system/${id}`}
              className="mi-sys-tile"
              style={{ '--tint-bg': bg, '--tint-line': line, '--grad': gradient(grad), '--glow': `${grad[1]}66` }}
            >
              <span className="mi-sys-ico"><Icon className="mi-sys-glyph" /></span>
              <span className="mi-sys-label">{label}</span>
            </Link>
          ))}
        </div>

        {/* Recently Viewed */}
        <div className="mi-sec-head">
          <h2><Clock size={28} strokeWidth={2.2} className="mi-clock" /> Recently Viewed</h2>
          {RECENT.length > 3 && (
            <span
              role="button"
              tabIndex={0}
              className="mi-see-all"
              onClick={() => setShowAllRecent(v => !v)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAllRecent(v => !v); } }}
            >
              {showAllRecent ? 'Show less' : 'See all'}
              <ChevronRight size={18} strokeWidth={2.4} style={{ transform: showAllRecent ? 'rotate(-90deg)' : 'none' }} />
            </span>
          )}
        </div>
        {recentShown.length > 0 ? (
          <div className="mi-recent">
            {recentShown.map(drug => {
              const info = describeDrug(drug);
              const RowIcon = info.systemId === 'infectious' ? Syringe : Pill;
              return (
                <Link key={drug.id} to={`/drug/${drug.id}`} className="mi-recent-row">
                  <span className="mi-recent-thumb" style={{ background: info.bg, color: info.fg }}>
                    {drug.image_url
                      ? <img src={drug.image_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      : <RowIcon size={24} strokeWidth={2.2} />}
                  </span>
                  <span className="mi-recent-main">
                    <span className="mi-recent-name">{drug.generic_name}</span>
                    <span className="mi-recent-sub">{getDisplayDrugClass(drug)}</span>
                  </span>
                  <span className="mi-tag" style={{ background: info.bg, color: info.fg }}>{info.label}</span>
                  <ChevronRight size={18} strokeWidth={2.2} className="mi-recent-chev" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mi-recent mi-recent-empty">
            Drugs you open will show up here for quick access.
          </div>
        )}

      </div>
    </div>
  );
}
