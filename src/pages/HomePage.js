import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Pill, ChevronRight, Syringe, Stethoscope as StethoIcon,
  PersonStanding, FilePlus2, Calculator,
} from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { useRecentActivity } from '../hooks/useRecentlyViewed';
import { useConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { quickSearch, searchDrugs } from '../utils/searchDrugs';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { drugMatchesSystem } from '../utils/systemMatch';
import { getDisplayDrugClass } from '../utils/drugCategory';
import ConditionInsightCard, { normalizeConditionDrugName } from '../components/ConditionInsightCard';
import AiSearchFallback from '../components/AiSearchFallback';
import AddToFavoritesHeart from '../components/AddToFavoritesHeart';
import { logSearch } from '../utils/logSearch';
import ConditionThumb, { ORGAN_THUMBS } from '../components/ConditionThumb';

// ── Explore medical topics: six shortcut cards ────────────────────────────
const TOPICS = [
  { to: '/conditions',      title: 'Conditions',          sub: 'Diseases & Disorders',   Icon: StethoIcon,     grad: ['#2b86ff', '#0a54d6'] },
  { to: '/browse',          title: 'Medicines',           sub: 'Drugs & Pharmacology',   Icon: Pill,           grad: ['#22c9ae', '#0a8f86'] },
  { to: '/systems',         title: 'Browse by System',    sub: 'Browse by anatomical system of the body', Icon: PersonStanding, grad: ['#7a55ea', '#4527b8'] },
  { to: '/procedures',      title: 'Procedures',          sub: 'Clinical Procedures',    Icon: Syringe,        grad: ['#3fd685', '#12a05e'] },
  { to: '/essential-drugs', title: 'Essential Drugs',     sub: 'Essential Drugs in Nigeria',  Icon: FilePlus2,      grad: ['#22c4ad', '#0d8f88'] },
  { to: '/calculators',     title: 'Calculators',         sub: 'Medical Calculators',    Icon: Calculator,     grad: ['#7357ec', '#3f2cc0'] },
];

const PUBLIC = process.env.PUBLIC_URL || '';
// Organ artwork for the recently-viewed rows (falls back to the drug photo,
// then to a coloured icon tile for systems without artwork).
// Firestore timestamps arrive as Timestamp objects live, or {seconds} once cached.
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v === 'number') return v;
  return Date.parse(v) || 0;
};


// ── Hero carousel slides ───────────────────────────────────────────────────
const SLIDES = [
  { title: 'Medical knowledge,',        accent: 'within reach',       body: 'Explore trusted medical information',    cta: 'Start Exploring',    to: '/browse' },
  { title: 'Clinical answers,',         accent: 'when you need them', body: 'Ask the AI Clinical Consult',            cta: 'Start Chat',         to: '/ai-consult' },
  { title: 'Lab values,',               accent: 'at your fingertips', body: 'Tests and normal ranges in one place',   cta: 'Open Lab Reference', to: '/labs' },
];

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
  const { imagesByCondition } = useConditionClinicalInfo();
  const { drugs: ALL_DRUGS } = useDrugs();
  const recent = useRecentActivity(user?.uid);
  const { customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem } = useCustomConditions();
  const [showAllRecent, setShowAllRecent] = useState(false);

  // Hero carousel: auto-advances every 6s unless the person prefers reduced
  // motion; tapping a dot jumps to that slide and restarts the timer.
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setTimeout(() => setSlide(i => (i + 1) % SLIDES.length), 6000);
    return () => clearTimeout(t);
  }, [slide]);
  const current = SLIDES[slide];

  // Recently viewed feed: drugs and conditions the person opened, plus drugs
  // and conditions recently added or edited. Newest first, one row per item.
  const RECENT = useMemo(() => {
    const items = new Map();
    const push = (it) => {
      const prev = items.get(it.key);
      if (!prev || it.t > prev.t) items.set(it.key, it);
    };

    const byId = new Map(ALL_DRUGS.map(d => [d.id, d]));
    recent.drugIds.forEach((id, i) => {
      const drug = byId.get(id);
      if (drug) push({ key: `drug:${id}`, kind: 'drug', drug, t: recent.times[id] || (1000 - i), tag: 'Viewed' });
    });
    ALL_DRUGS
      .map(drug => ({ drug, t: toMs(drug.last_updated) }))
      .filter(x => x.t > 0)
      .sort((a, b) => b.t - a.t)
      .slice(0, 5)
      .forEach(({ drug, t }) => push({ key: `drug:${drug.id}`, kind: 'drug', drug, t, tag: 'Updated' }));

    const systemNames = new Map(ANATOMICAL_SYSTEMS.map(sys => [sys.id, sys.name]));
    const lookup = (systemId, id) => {
      if ((hiddenConditionIdsBySystem?.[systemId] || []).includes(id)) return null;
      const found = [...(SYSTEM_CONDITIONS[systemId] || []), ...(customConditionsBySystem?.[systemId] || [])].find(c => c.id === id);
      if (!found) return null;
      return labelOverridesBySystem?.[systemId]?.[id] || found.label;
    };
    const condRow = (systemId, id, t, tag) => {
      const label = lookup(systemId, id);
      if (!label) return;
      push({ key: `cond:${systemId}:${id}`, kind: 'condition', systemId, id, label, t, tag,
        systemName: (systemNames.get(systemId) || systemId).split(' & ')[0] });
    };
    recent.conditions.forEach(c => condRow(c.s, c.id, c.t || 1, 'Viewed'));
    Object.entries(customConditionsBySystem || {}).forEach(([systemId, list]) => {
      (list || []).forEach(c => {
        const t = Math.max(c.added_at || 0, c.edited_at || 0);
        if (t > 0) condRow(systemId, c.id, t, (c.edited_at || 0) > (c.added_at || 0) ? 'Edited' : 'Added');
      });
    });

    return [...items.values()].sort((a, b) => b.t - a.t).slice(0, 10);
  }, [ALL_DRUGS, recent, customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem]);
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

  // Log Home searches so the admin 'Missing searches' page can list ones with no match.
  useEffect(() => {
    if (deferredQuery.trim()) logSearch({ user, query: deferredQuery, type: 'general', resultCount: allMatchingDrugs.length });
  }, [user, deferredQuery, allMatchingDrugs.length]);

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

        {/* Greeting */}
        <section className="mi-greet">
          <span className="mi-greet-hello"><span aria-hidden="true">☀️</span> {greeting()}</span>
          <h1>Welcome to MedIndex!</h1>
          <svg className="mi-greet-art" viewBox="0 0 150 90" width="150" height="90" aria-hidden="true">
            <rect x="28" y="10" width="22" height="64" rx="5" fill="#BBD4FB" />
            <rect x="7" y="31" width="64" height="22" rx="5" fill="#BBD4FB" />
            <path d="M92 8 C80 8 80 40 94 46 C108 52 122 46 122 30 V8" fill="none" stroke="#0F2A55" strokeWidth="4" strokeLinecap="round" />
            <path d="M108 50 C108 70 128 74 136 62" fill="none" stroke="#0F2A55" strokeWidth="4" strokeLinecap="round" />
            <circle cx="138" cy="58" r="8" fill="#DDE6F2" stroke="#0F2A55" strokeWidth="3" />
            <circle cx="92" cy="8" r="3.5" fill="#0F2A55" /><circle cx="122" cy="8" r="3.5" fill="#0F2A55" />
          </svg>
        </section>

        {/* Search */}
        <form onSubmit={handleSearch} className="mi-search">
          <div className="mi-search-field">
            <Search className="mi-search-lead" size={22} strokeWidth={2.2} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              placeholder="Search conditions, medicines, procedures..."
              aria-label="Search conditions, medicines, procedures"
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

        {/* Hero carousel */}
        <section className="mi-banner" aria-roledescription="carousel" aria-label="Highlights">
          <div className="mi-banner-text" key={slide}>
            <h2>
              {current.title}
              <span>{current.accent}</span>
            </h2>
            <p>{current.body}</p>
            <Link to={current.to} className="mi-banner-cta">
              {current.cta} <ChevronRight size={18} strokeWidth={2.6} />
            </Link>
          </div>
          <div className="mi-banner-art" aria-hidden="true" style={{ backgroundImage: `url(${PUBLIC}/img/banner-art.webp)` }} />
          <div className="mi-dots" role="tablist" aria-label="Choose highlight">
            {SLIDES.map((sl, i) => (
              <button
                key={sl.to}
                type="button"
                role="tab"
                aria-selected={i === slide}
                aria-label={`Show highlight ${i + 1}`}
                className={`mi-dot ${i === slide ? 'is-on' : ''}`}
                onClick={() => setSlide(i)}
              />
            ))}
          </div>
        </section>

        {/* Explore medical topics */}
        <div className="mi-sec-head">
          <h2 className="mi-bar">Explore medical topics</h2>
          <Link to="/more" className="mi-see-all">View All <ChevronRight size={18} strokeWidth={2.4} /></Link>
        </div>
        <div className="mi-topics">
          {TOPICS.map(({ to, title, sub, Icon, grad }) => (
            <Link key={title} to={to} className="mi-topic" style={{ '--grad': gradient(grad), '--glow': `${grad[1]}66` }}>
              <span className="mi-topic-icon"><Icon size={34} strokeWidth={1.9} /></span>
              <span className="mi-topic-text">
                <span className="mi-topic-title">{title}</span>
                <span className="mi-topic-sub">{sub}</span>
              </span>
              <ChevronRight size={20} strokeWidth={2.4} className="mi-topic-chev" />
            </Link>
          ))}
        </div>

        {/* Recently viewed */}
        <div className="mi-sec-head">
          <h2 className="mi-bar">Recently viewed</h2>
          {RECENT.length > 3 ? (
            <span
              role="button"
              tabIndex={0}
              className="mi-see-all"
              onClick={() => setShowAllRecent(v => !v)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAllRecent(v => !v); } }}
            >
              {showAllRecent ? 'Show Less' : 'View All'}
              <ChevronRight size={18} strokeWidth={2.4} style={{ transform: showAllRecent ? 'rotate(-90deg)' : 'none' }} />
            </span>
          ) : null}
        </div>
        {recentShown.length > 0 ? (
          <div className="mi-recent">
            {recentShown.map(item => {
              if (item.kind === 'condition') {
                const art = ORGAN_THUMBS[item.systemId];
                return (
                  <Link
                    key={item.key}
                    to={`/condition/${item.systemId}/${item.id}`}
                    className="mi-recent-row"
                  >
                    <span className="mi-recent-thumb" style={{ background: '#e3eeff', color: '#1769e0' }}>
                      <ConditionThumb key={imagesByCondition?.[item.id]?.[0]?.url || 'none'} url={imagesByCondition?.[item.id]?.[0]?.url} art={art} />
                    </span>
                    <span className="mi-recent-main">
                      <span className="mi-recent-name">{item.label}</span>
                      <span className="mi-recent-sub">Condition &middot; {item.systemName}</span>
                    </span>
                    <span className="mi-recent-tag">{item.tag}</span>
                    <ChevronRight size={20} strokeWidth={2.4} className="mi-recent-chev" />
                  </Link>
                );
              }
              const drug = item.drug;
              const info = describeDrug(drug);
              const RowIcon = info.systemId === 'infectious' ? Syringe : Pill;
              return (
                <Link key={item.key} to={`/drug/${drug.id}`} className="mi-recent-row">
                  <span className="mi-recent-thumb" style={{ background: info.bg, color: info.fg }}>
                    {(ORGAN_THUMBS[info.systemId] || drug.image_url)
                      ? <img src={ORGAN_THUMBS[info.systemId] || drug.image_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      : <RowIcon size={22} strokeWidth={2.2} />}
                  </span>
                  <span className="mi-recent-main">
                    <span className="mi-recent-name">{drug.generic_name}</span>
                    <span className="mi-recent-sub">{getDisplayDrugClass(drug)}</span>
                  </span>
                  <span className="mi-recent-tag">{item.tag}</span>
                  <ChevronRight size={20} strokeWidth={2.4} className="mi-recent-chev" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mi-recent-empty">
            Drugs and conditions you open, add or edit will show up here.
          </div>
        )}

      </div>
    </div>
  );
}
