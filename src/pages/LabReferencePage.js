// src/pages/LabReferencePage.js
// Route: /labs
// Full clinical lab reference — adapted from Nurses-Companion LabGuide
// Matches MedIndex design system (dark navy, teal accent, Inter font)

import React, { useState, useMemo } from 'react';
import { LABS } from '../data/labsData';

const CATEGORIES = ['All', ...Array.from(new Set(LABS.map(l => l.cat)))];

const CAT_META = {
  Hematology:        { color: '#EF4444', bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.25)'   },
  'WBC Differential':{ color: '#3B82F6', bg: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.25)' },
  Chemistry:         { color: '#0D9488', bg: 'rgba(13,148,136,.1)',  border: 'rgba(13,148,136,.25)' },
  Electrolytes:      { color: '#6366F1', bg: 'rgba(99,102,241,.1)',  border: 'rgba(99,102,241,.25)' },
  Coagulation:       { color: '#DC2626', bg: 'rgba(220,38,38,.1)',   border: 'rgba(220,38,38,.25)'  },
  ABG:               { color: '#7C3AED', bg: 'rgba(124,58,237,.1)',  border: 'rgba(124,58,237,.25)' },
  Thyroid:           { color: '#DB2777', bg: 'rgba(219,39,119,.1)',  border: 'rgba(219,39,119,.25)' },
  Liver:             { color: '#D97706', bg: 'rgba(217,119,6,.1)',   border: 'rgba(217,119,6,.25)'  },
  'Lipid Panel':     { color: '#059669', bg: 'rgba(5,150,105,.1)',   border: 'rgba(5,150,105,.25)'  },
  Urinalysis:        { color: '#CA8A04', bg: 'rgba(202,138,4,.1)',   border: 'rgba(202,138,4,.25)'  },
  Cardiac:           { color: '#E11D48', bg: 'rgba(225,29,72,.1)',   border: 'rgba(225,29,72,.25)'  },
  Serology:          { color: '#9333EA', bg: 'rgba(147,51,234,.1)',  border: 'rgba(147,51,234,.25)' },
  Hormonal:          { color: '#C026D3', bg: 'rgba(192,38,211,.1)',  border: 'rgba(192,38,211,.25)' },
  Microbiology:      { color: '#16A34A', bg: 'rgba(22,163,74,.1)',   border: 'rgba(22,163,74,.25)'  },
};
const DEFAULT_META = { color: '#0D9488', bg: 'rgba(13,148,136,.1)', border: 'rgba(13,148,136,.25)' };

function getMeta(cat) { return CAT_META[cat] || DEFAULT_META; }

const TOTAL_PARAMS = LABS.reduce((s, l) => s + 1 + (l.children?.length || 0), 0);

// ── Collapsible list renderer ──────────────────────────────────────────────
function ListSection({ title, items, color, emoji }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12 }}>{emoji}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>{open ? '▲' : '▼'} {items.length}</span>
      </button>
      {open && (
        <ul style={{ margin: '4px 0 0 18px', padding: 0, listStyle: 'disc' }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: 12, color: '#CBD5E1', lineHeight: 1.7, marginBottom: 2 }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Single parameter card (child or standalone) ────────────────────────────
function ParamCard({ param, meta, depth = 0 }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: depth === 0 ? '#0F2030' : '#0A1825',
      border: `1px solid ${open ? meta.border : 'rgba(255,255,255,.07)'}`,
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
      transition: 'border-color 0.2s',
      marginLeft: depth > 0 ? 16 : 0,
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#F1F5F9' }}>{param.name}</span>
            {param.unit && (
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 20,
                background: `${meta.color}22`, color: meta.color, fontWeight: 700,
              }}>
                {param.unit}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{param.abbr}</div>
          <div style={{
            fontSize: 11, color: '#34D399', marginTop: 4, fontWeight: 600,
            fontFamily: "'Courier New', monospace",
          }}>
            📏 {param.normal}
          </div>
        </div>
        <span style={{ color: open ? meta.color : '#64748B', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Detail panel */}
      {open && (
        <div style={{
          padding: '0 14px 14px',
          borderTop: `1px solid ${meta.border}`,
        }}>
          <div style={{ marginTop: 10 }}>
            <ListSection title="Low Causes" items={param.lowCauses}  color="#F87171" emoji="⬇️" />
            <ListSection title="High Causes" items={param.highCauses} color="#FB923C" emoji="⬆️" />
            <ListSection title="Management — Low"  items={param.solutionLow}  color="#34D399" emoji="💊" />
            <ListSection title="Management — High" items={param.solutionHigh} color="#60A5FA" emoji="🏥" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel card (top-level lab group like CBC, LFT) ─────────────────────────
function PanelCard({ lab }) {
  const [open, setOpen] = useState(false);
  const meta = getMeta(lab.cat);
  const hasChildren = lab.children && lab.children.length > 0;

  return (
    <div style={{
      background: '#132030', border: `1.5px solid ${open ? meta.color + '55' : 'rgba(255,255,255,.08)'}`,
      borderRadius: 14, marginBottom: 14, overflow: 'hidden',
      boxShadow: open ? `0 4px 24px ${meta.color}15` : 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Panel header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 24, flexShrink: 0 }}>{lab.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#F1F5F9' }}>{lab.name}</span>
            <span style={{
              fontSize: 10, padding: '2px 9px', borderRadius: 20,
              background: meta.bg, color: meta.color, fontWeight: 700, border: `1px solid ${meta.border}`,
            }}>
              {lab.cat}
            </span>
            {hasChildren && (
              <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
                {lab.children.length} parameters
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{lab.abbr}</div>
          {lab.normal && lab.normal !== 'Panel test — see individual components below' && (
            <div style={{ fontSize: 11, color: '#34D399', marginTop: 3, fontWeight: 600 }}>
              📏 {lab.normal}
            </div>
          )}
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: open ? meta.bg : 'rgba(255,255,255,.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${open ? meta.border : 'transparent'}`,
          color: open ? meta.color : '#64748B', fontSize: 12,
          transition: 'all 0.2s',
        }}>
          {open ? '▲' : '▼'}
        </div>
      </button>

      {/* Panel body */}
      {open && (
        <div style={{ padding: '4px 18px 16px', borderTop: `1px solid rgba(255,255,255,.06)` }}>
          {/* If standalone param (not a panel of children) */}
          {!hasChildren && (
            <div style={{ paddingTop: 10 }}>
              <ListSection title="Low Causes"       items={lab.lowCauses}    color="#F87171" emoji="⬇️" />
              <ListSection title="High Causes"      items={lab.highCauses}   color="#FB923C" emoji="⬆️" />
              <ListSection title="Management — Low"  items={lab.solutionLow}  color="#34D399" emoji="💊" />
              <ListSection title="Management — High" items={lab.solutionHigh} color="#60A5FA" emoji="🏥" />
            </div>
          )}

          {/* If panel with children */}
          {hasChildren && (
            <div style={{ paddingTop: 10 }}>
              {/* Panel-level causes summary */}
              {(lab.lowCauses?.length > 0 || lab.highCauses?.length > 0) && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Panel Overview
                  </div>
                  <ListSection title="Low Panel"  items={lab.lowCauses}  color="#F87171" emoji="⬇️" />
                  <ListSection title="High Panel" items={lab.highCauses} color="#FB923C" emoji="⬆️" />
                </div>
              )}

              {/* Child parameters */}
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Individual Parameters
              </div>
              {lab.children.map((child, i) => (
                <ParamCard key={i} param={child} meta={meta} depth={1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function LabReferencePage() {
  const [search,    setSearch]    = useState('');
  const [activeCat, setActiveCat] = useState('All');

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return LABS.filter(lab => {
      if (activeCat !== 'All' && lab.cat !== activeCat) return false;
      if (!term) return true;
      const inParent = lab.name.toLowerCase().includes(term) ||
        lab.abbr.toLowerCase().includes(term) ||
        [...(lab.lowCauses || []), ...(lab.highCauses || []), ...(lab.solutionLow || []), ...(lab.solutionHigh || [])]
          .some(s => s.toLowerCase().includes(term));
      if (inParent) return true;
      if (lab.children) {
        return lab.children.some(c =>
          c.name.toLowerCase().includes(term) || c.abbr.toLowerCase().includes(term) ||
          [...(c.lowCauses || []), ...(c.highCauses || []), ...(c.solutionLow || []), ...(c.solutionHigh || [])]
            .some(s => s.toLowerCase().includes(term))
        );
      }
      return false;
    });
  }, [search, activeCat]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0B1F3A',
      fontFamily: "'Inter','Segoe UI',sans-serif", color: '#F1F5F9',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0B1F3A 0%, #0F2A50 60%, #0B1F3A 100%)',
        borderBottom: '1px solid rgba(255,255,255,.08)',
        padding: '32px 24px 24px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #00C9A7, #0070F3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>🔬</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
                Clinical Lab Reference
              </h1>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                {LABS.length} panels · {TOTAL_PARAMS} total parameters
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginTop: 16 }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: '#64748B',
            }}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search panels, parameters, causes, management…"
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 10, color: '#F1F5F9', fontSize: 13, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 14,
                }}
              >✕</button>
            )}
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {CATEGORIES.map(cat => {
              const meta = getMeta(cat);
              const active = activeCat === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none',
                    background: active ? (cat === 'All' ? '#0070F3' : meta.color) : 'rgba(255,255,255,.07)',
                    color: active ? '#fff' : '#94A3B8',
                    fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                    flexShrink: 0, transition: 'all 0.15s',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 48px' }}>
        {/* Stats bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: '#64748B' }}>
            {filtered.length === LABS.length
              ? `All ${LABS.length} panels`
              : `${filtered.length} of ${LABS.length} panels`}
          </span>
          {(search || activeCat !== 'All') && (
            <button
              onClick={() => { setSearch(''); setActiveCat('All'); }}
              style={{
                fontSize: 11, color: '#0D9488', fontWeight: 700, background: 'none',
                border: 'none', cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#94A3B8' }}>No results found</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Try a different search term</div>
          </div>
        ) : (
          filtered.map((lab, i) => <PanelCard key={i} lab={lab} />)
        )}
      </div>
    </div>
  );
}
