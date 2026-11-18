import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Pill, ChevronRight, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { useDrugs } from '../hooks/useDrugs';
import { useAuth } from '../context/AuthContext';
import { useRecentActivity } from '../hooks/useRecentlyViewed';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { quickSearch, searchDrugs } from '../utils/searchDrugs';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { getDisplayDrugClass } from '../utils/drugCategory';
import ConditionInsightCard, { normalizeConditionDrugName } from '../components/ConditionInsightCard';
import AiSearchFallback from '../components/AiSearchFallback';
import NewConditionGoogleSearch from '../components/NewConditionGoogleSearch';
import { useExistingConditionMatch } from '../hooks/useExistingConditionMatch';
import AddToFavoritesHeart from '../components/AddToFavoritesHeart';
import { logSearch } from '../utils/logSearch';
import {
  BannerScene, TilePill, TileStethoscope, TileScalpel, TileBody, TileCalculator, TileFlask,
  TileRobot, QuickBook, PlusCircle, RecentPills, RecentHeart, RecentSyringe,
} from '../components/dashboard/MockupArt';

// ── Explore MedIndex: eight shortcut tiles (4 per row) ────────────────────
const TOPICS = [
  { to: '/browse',          title: 'Medicines',        Art: TilePill },
  { to: '/conditions',      title: 'Conditions',       Art: TileStethoscope },
  { to: '/procedures',      title: 'Procedures',       Art: TileScalpel },
  { to: '/systems',         title: 'Body Systems',     Art: TileBody },
  { to: '/calculators',     title: 'Calculators',      Art: TileCalculator },
  { to: '/labs',            title: 'Lab Reference',    Art: TileFlask },
  { to: '/essential-drugs', title: 'Essential Drugs',  Art: TilePill },
  { to: '/ai-consult',      title: 'AI Clinical Tools', Art: TileRobot },
];

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
  { title: 'Drug doses,',               accent: 'worked out safely',  body: 'Weight-based and IV fluid calculators',  cta: 'Open Calculators',   to: '/calculators' },
];

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
  const { drugs: ALL_DRUGS } = useDrugs();
  const recent = useRecentActivity(user?.uid);
  const { customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem } = useCustomConditions();
  const [showAllRecent, setShowAllRecent] = useState(false); // three cards by default

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
      .slice(0, 8)
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

    return [...items.values()].sort((a, b) => b.t - a.t).slice(0, 16);
  }, [ALL_DRUGS, recent, customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem]);

  // Recently viewed cards. Real history first; any empty slots are filled with
  // the starter shortcuts so the row always shows three cards.
  const recentCards = useMemo(() => {
    const cards = RECENT.map(item => item.kind === 'condition'
      ? { key: item.key, to: `/condition/${item.systemId}/${item.id}`, title: item.label, sub: 'Condition', Art: RecentHeart }
      : { key: item.key, to: `/drug/${item.drug.id}`, title: item.drug.generic_name, sub: 'Medicine', Art: RecentPills });
    const taken = new Set(cards.map(c => (c.title || '').toLowerCase()));
    const paracetamol = ALL_DRUGS.find(d => /^(paracetamol|acetaminophen)/i.test(d.generic_name || ''));
    const hypertension = (SYSTEM_CONDITIONS.cardiovascular || []).find(c => /hypertension/i.test(c.label || ''));
    const starters = [
      { key: 'starter:paracetamol', to: paracetamol ? `/drug/${paracetamol.id}` : '/browse?q=Paracetamol', title: 'Paracetamol', sub: 'Medicine', Art: RecentPills },
      { key: 'starter:hypertension', to: hypertension ? `/condition/cardiovascular/${hypertension.id}` : '/conditions', title: 'Hypertension', sub: 'Condition', Art: RecentHeart },
      { key: 'starter:iv', to: '/calculators?tool=iv', title: 'IV Fluid Calculator', sub: 'Calculator', Art: RecentSyringe },
    ].filter(c => !taken.has(c.title.toLowerCase()));
    while (cards.length < 3 && starters.length) cards.push(starters.shift());
    return cards;
  }, [RECENT, ALL_DRUGS]);
  const recentShown = showAllRecent ? recentCards : recentCards.slice(0, 3);

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
  const existingCondition = useExistingConditionMatch(deferredQuery);

  const handleSearch = (e) => {
    e.preventDefault();
    setShowDropdown(false);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mi-home">
      <div className="mi-container">

        {/* Search */}
        <form onSubmit={handleSearch} className="mi-search">
          <div className="mi-search-field">
            <Search className="mi-search-lead" size={24} strokeWidth={2.2} aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              placeholder="Search for medicines, conditions, procedures..."
              aria-label="Search for medicines, conditions, procedures"
            />
            <Link to="/browse" className="mi-search-filter" aria-label="Filters">
              <SlidersHorizontal size={24} strokeWidth={2.2} />
            </Link>
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

        {/* Admin: condition not in the system yet → search Google for its clinical info */}
        {searchQuery.trim() && !existingCondition && !hasExactDrugMatch && (
          <NewConditionGoogleSearch query={deferredQuery} />
        )}

        {/* Condition insight — if the search matches (or is close to) a known
            condition, show its clinical overview + drug list right here; if it
            doesn't exist in the system yet, the AI lookup prompt appears
            instead. */}
        {searchQuery.trim() && (
          <section ref={resultsRef} className="mi-results">
            <ConditionInsightCard
              searchQuery={deferredQuery}
              existingDrugs={ALL_DRUGS}
              aiExtra={!hasExactDrugMatch ? <AiSearchFallback searchQuery={deferredQuery} /> : null}
            />

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
              {current.cta} <ChevronRight size={20} strokeWidth={2.6} />
            </Link>
          </div>
          <BannerScene className="mi-banner-art" />
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

        {/* Explore MedIndex */}
        <div className="mi-sec-head">
          <h2 className="mi-bar">Explore MedIndex</h2>
          <Link to="/more" className="mi-see-all">View All <ArrowRight size={22} strokeWidth={2.2} /></Link>
        </div>
        <div className="mi-topics">
          {TOPICS.map(({ to, title, Art }) => (
            <Link key={title} to={to} className="mi-topic">
              <Art className="mi-topic-art" />
              <span className="mi-topic-title">{title}</span>
            </Link>
          ))}
        </div>

        {/* Quick action */}
        <Link to="/calculators" className="mi-quick">
          <PlusCircle className="mi-quick-ico" />
          <span className="mi-quick-text">
            <b>Quick Action</b>
            <span>Get started with a tool</span>
          </span>
          <QuickBook className="mi-quick-art" />
          <ChevronRight size={26} strokeWidth={2.2} className="mi-quick-chev" />
        </Link>

        {/* Recently viewed */}
        <div className="mi-sec-head">
          <h2 className="mi-bar">Recently Viewed</h2>
          <span
            role="button"
            tabIndex={0}
            className="mi-see-all"
            onClick={() => setShowAllRecent(v => !v)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAllRecent(v => !v); } }}
          >
            {showAllRecent ? 'Show Less' : 'See All'}
            <ArrowRight size={22} strokeWidth={2.2} style={{ transform: showAllRecent ? 'rotate(-90deg)' : 'none' }} />
          </span>
        </div>
        <div className="mi-recent-grid">
          {recentShown.map(({ key, to, title, sub, Art }) => (
            <Link key={key} to={to} className="mi-rcard">
              <Art className="mi-rcard-art" />
              <span className="mi-rcard-title">{title}</span>
              <span className="mi-rcard-sub">{sub}</span>
              <span className="mi-rcard-go" aria-hidden="true"><ArrowRight size={18} strokeWidth={2.4} /></span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
