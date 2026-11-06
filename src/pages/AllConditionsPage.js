// src/pages/AllConditionsPage.js
// Route: /conditions
// One searchable A-Z list of every clinical condition in the app (seeded,
// minus any an admin hid, with admin renames applied, plus custom/AI-approved
// ones). Tapping a condition opens its system page with that condition's
// card already expanded, the same state SystemPage restores on Back.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { useCustomConditions } from '../hooks/useCustomConditions';

export default function AllConditionsPage() {
  const navigate = useNavigate();
  const { customConditionsBySystem, hiddenConditionIdsBySystem, labelOverridesBySystem } = useCustomConditions();
  const [query, setQuery] = useState('');

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

  // Group under A-Z letter headings (anything non-alphabetic goes under #).
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(c => {
      const first = c.label.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter).push(c);
    });
    return [...map.entries()];
  }, [filtered]);

  const openCondition = (c) => {
    try { sessionStorage.setItem(`system_open_condition_${c.systemId}`, c.id); } catch { /* storage unavailable: the system page still opens */ }
    navigate(`/system/${c.systemId}`);
  };

  return (
    <div className="mi-cond">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="mi-cond-back"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <h1>Conditions</h1>
      <p className="mi-cond-sub">
        {all.length} conditions across every body system. Tap one to see the medications used for it.
      </p>

      <div className="mi-cond-search">
        <Search size={20} strokeWidth={2.2} />
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

      {groups.length === 0 ? (
        <p className="mi-cond-empty">No conditions match "{query}".</p>
      ) : (
        groups.map(([letter, items]) => (
          <section key={letter} className="mi-cond-group">
            <h2>{letter}</h2>
            <div className="mi-cond-list">
              {items.map(c => (
                <button type="button" key={`${c.systemId}:${c.id}`} className="mi-cond-row" onClick={() => openCondition(c)}>
                  <span className="mi-cond-name">{c.label}</span>
                  <span className="mi-cond-sys">{c.systemName}</span>
                  <ChevronRight size={18} strokeWidth={2.4} />
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
