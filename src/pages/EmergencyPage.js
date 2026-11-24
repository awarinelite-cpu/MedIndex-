// src/pages/EmergencyPage.js
// Route: /emergency — list of bedside emergency guides. Everything here is
// bundled with the app, so it works with no network at all.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, Phone, AlertTriangle, ShieldAlert } from 'lucide-react';
import { EMERGENCY_PROTOCOLS, CATEGORIES, EMERGENCY_NUMBERS } from '../data/emergencyProtocols';

export default function EmergencyPage() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EMERGENCY_PROTOCOLS.filter(p =>
      (cat === 'All' || p.category === cat) &&
      (!needle || `${p.title} ${p.short} ${p.category}`.toLowerCase().includes(needle))
    );
  }, [q, cat]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
      <div className="em-hero">
        <ShieldAlert size={30} />
        <div>
          <h1>Emergency guides</h1>
          <p>Fast bedside steps and doses. Works offline.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {EMERGENCY_NUMBERS.map(n => (
          <a key={n.value} href={`tel:${n.value}`} className="em-call">
            <Phone size={16} /> <span><b>{n.value}</b><small>{n.label}</small></span>
          </a>
        ))}
      </div>

      <div className="em-search">
        <Search size={18} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search: eclampsia, CPR, snake…"
          aria-label="Search emergency guides"
          type="search"
        />
      </div>

      <div className="em-chips" role="tablist" aria-label="Category">
        {CATEGORIES.map(c => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            className={`em-chip ${cat === c ? 'is-on' : ''}`}
            onClick={() => setCat(c)}
          >{c}</button>
        ))}
      </div>

      <div className="space-y-2.5">
        {list.map(p => (
          <Link key={p.id} to={`/emergency/${p.id}`} className="em-card" style={{ '--em': p.color }}>
            <span className="em-card-bar" />
            <span className="em-card-text">
              <span className="em-card-title">{p.title}</span>
              <span className="em-card-sub">{p.short}</span>
              <span className="em-card-cat">{p.category}</span>
            </span>
            <ChevronRight size={22} />
          </Link>
        ))}
        {list.length === 0 && <p className="text-center text-sm opacity-70 py-6">No guide matches "{q}".</p>}
      </div>

      <div className="em-disclaimer">
        <AlertTriangle size={16} />
        <span>
          Quick-reference aid, not a substitute for clinical judgement. Always check doses against the current
          Nigeria Standard Treatment Guidelines and your facility protocol.
        </span>
      </div>
    </div>
  );
}
