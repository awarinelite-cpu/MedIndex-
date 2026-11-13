// src/pages/FavouritesPage.js
// Route: /favourites
// Everything the person bookmarked with the heart: drugs and conditions.
// Tapping the heart on a row removes it from here (and from the drug or
// condition page, which read the same data).
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Pill, ChevronRight, Stethoscope } from 'lucide-react';
import { useFavourites } from '../hooks/useFavourites';
import { useDrugs } from '../hooks/useDrugs';
import { WaveBackdrop, CrossArt } from '../components/dashboard/HeroArt';

const VIEWS = [['all', 'All'], ['drug', 'Drugs'], ['condition', 'Conditions']];
const seconds = (i) => (i.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER);

function DrugThumb({ url }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) return <img className="fv-thumb" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />;
  return <span className="fv-thumb fv-thumb-icon"><Pill size={22} /></span>;
}

export default function FavouritesPage() {
  const { items, loading, toggle } = useFavourites();
  const { drugs } = useDrugs();
  const [view, setView] = useState('all');

  const drugById = useMemo(() => new Map((drugs || []).map(d => [d.id, d])), [drugs]);
  const shown = useMemo(
    () => items.filter(i => view === 'all' || i.type === view).sort((a, b) => seconds(b) - seconds(a)),
    [items, view]
  );
  const counts = useMemo(() => ({
    all: items.length,
    drug: items.filter(i => i.type === 'drug').length,
    condition: items.filter(i => i.type === 'condition').length,
  }), [items]);

  return (
    <div className="mi-cond">
      <div className="mi-cond-hero">
        <WaveBackdrop className="mi-cond-waves" />
        <CrossArt className="mi-cond-cross" />
        <h1>Favourites</h1>
        <p className="mi-cond-sub">Drugs and conditions you saved</p>
      </div>

      <div className="mi-cond-views" role="tablist" aria-label="Filter favourites">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={`mi-cond-view ${view === key ? 'is-active' : ''}`}
            onClick={() => setView(key)}
          >
            {label} {counts[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mi-cond-empty">Loading your favourites...</p>
      ) : shown.length === 0 ? (
        <div className="fv-empty">
          <span className="fv-empty-icon"><Heart size={34} /></span>
          <h2>{items.length === 0 ? 'Nothing saved yet' : 'Nothing in this list'}</h2>
          <p>Tap the heart on a drug or condition page to save it here.</p>
        </div>
      ) : (
        <div className="fv-list">
          {shown.map(item => {
            const drug = item.type === 'drug' ? drugById.get(item.refId) : null;
            const to = item.type === 'drug' ? `/drug/${item.refId}` : `/condition/${item.systemId}/${item.conditionId}`;
            return (
              <div key={item.id} className="fv-row">
                <Link to={to} className="fv-link">
                  {item.type === 'drug'
                    ? <DrugThumb url={drug?.image_url} />
                    : <span className="fv-thumb fv-thumb-icon"><Stethoscope size={22} /></span>}
                  <span className="fv-text">
                    <span className="fv-name">{drug?.generic_name || item.name}</span>
                    <span className="fv-sub">{item.type === 'drug' ? 'Drug' : 'Condition'}{item.subtitle ? `, ${item.subtitle}` : ''}</span>
                  </span>
                  <ChevronRight size={20} className="fv-go" />
                </Link>
                <button type="button" className="fv-heart" onClick={() => toggle(item)} aria-label={`Remove ${item.name} from favourites`}>
                  <Heart size={22} style={{ color: '#ff5a6e', fill: '#ff5a6e' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
