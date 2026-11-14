// src/pages/AllConditionsPage.js
// Route: /conditions
// One searchable A-Z list of every clinical condition in the app (seeded,
// minus any an admin hid, with admin renames applied, plus custom/AI-approved
// ones). Tapping a condition opens its system page with that condition's
// card already expanded, the same state SystemPage restores on Back.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import { WaveBackdrop, CrossArt } from '../components/dashboard/HeroArt';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { useCustomConditions } from '../hooks/useCustomConditions';
import { useConditionClinicalInfo } from '../hooks/useConditionClinicalInfo';
import ConditionThumb, { ORGAN_THUMBS } from '../components/ConditionThumb';

const VIEWS = [['all', 'All conditions'], ['system', 'Body system'], ['az', 'A-Z']];

export default function AllConditionsPage() {
  const navigate = useNavigate();
  const { customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem } = useCustomConditions();
  const { imagesByCondition } = useConditionClinicalInfo();
  const [query, setQuery] = useState('');
  const [view, setView] = useState('all');

  const all = useMemo(() => {
    const systemNames = new Map(ANATOMICAL_SYSTEMS.map(s => [s.id, s.name]));
    const systemIds = new Set([
      ...Object.keys(SYSTEM_CONDITIONS),
      ...Object.keys(customConditionsBySystem || {}),
    ]);
    const rows = [];
    systemIds.forEach(systemId => {
      const hidden = new Set(hiddenConditionIdsBySystem?.[systemId] || []);
      const renames = labelOverridesBySystem?.[systemId] || {};
      const seen = new Set();
      [...(SYSTEM_CONDITIONS[systemId] || []), ...(customConditionsBySystem?.[systemId] || [])].forEach(c => {
        if (!c?.id || hidden.has(c.id) || seen.has(c.id)) return;
        seen.add(c.id);
        rows.push({
          id: c.id,
          systemId,
          systemName: (systemNames.get(systemId) || systemId).split(' & ')[0],
          label: renames[c.id] || c.label,
        });
      });
    });
    return rows.sort((a, b) => a.label.localeCompare(b.label));
  }, [customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter(c => c.label.toLowerCase().includes(q) || c.systemName.toLowerCase().includes(q)) : all;
  }, [all, query]);

  // Group under A-Z letter headings (anything non-alphabetic goes under #),
  // or under body-system headings in the Body system view.
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(c => {
      let key;
      if (view === 'system') key = c.systemName;
      else {
        const first = c.label.trim().charAt(0).toUpperCase();
        key = /[A-Z]/.test(first) ? first : '#';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, view]);

  const jumpTo = (letter) => {
    const el = document.getElementById(`cond-group-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openCondition = (c) => {
    navigate(`/condition/${c.systemId}/${c.id}`);
  };

  return (
    <div className="mi-cond">
      <div className="mi-cond-hero">
        <WaveBackdrop className="mi-cond-waves" />
        <CrossArt className="mi-cond-cross" />
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="mi-cond-back"
        >
          <ArrowLeft size={22} strokeWidth={2.4} /> Back
        </button>
        <h1>Conditions</h1>
        <p className="mi-cond-sub">{all.length} conditions across every body system</p>
      </div>

      <div className="mi-cond-search">
        <Search size={22} strokeWidth={2.2} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search conditions..."
          aria-label="Search conditions"
        />
        {query && (
          <button type="button" className="mi-cond-clear" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mi-cond-views" role="tablist" aria-label="Group conditions">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={`mi-cond-view ${view === key ? 'is-active' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'az' && groups.length > 0 && (
        <div className="mi-cond-letters" aria-label="Jump to letter">
          {groups.map(([letter]) => (
            <button key={letter} type="button" onClick={() => jumpTo(letter)}>{letter}</button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="mi-cond-empty">No conditions match "{query}".</p>
      ) : (
        groups.map(([heading, items]) => (
          <section key={heading} id={`cond-group-${heading}`} className="mi-cond-group">
            <h2>{heading}</h2>
            <div className="mi-recent mi-cond-cards">
              {items.map(c => {
                const url = imagesByCondition?.[c.id]?.[0]?.url;
                return (
                  <button type="button" key={`${c.systemId}:${c.id}`} className="mi-recent-row mi-cond-card" onClick={() => openCondition(c)}>
                    <span className="mi-recent-thumb" style={{ background: '#e3eeff', color: '#1769e0' }}>
                      <ConditionThumb key={url || 'none'} url={url} art={ORGAN_THUMBS[c.systemId]} />
                    </span>
                    <span className="mi-recent-main">
                      <span className="mi-recent-name">{c.label}</span>
                      <span className="mi-recent-sub">Condition &middot; {c.systemName}</span>
                    </span>
                    <ChevronRight size={20} strokeWidth={2.4} className="mi-recent-chev" />
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
