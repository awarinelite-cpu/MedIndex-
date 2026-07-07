// src/pages/LabReferencePage.js
// Route: /labs
// Full clinical lab reference — adapted from Nurses-Companion LabGuide
// Light mode matches MedIndex main app (drug-bg #f8fafc). Night mode + Reading mode included.

import React, { useState, useMemo, useContext, createContext } from 'react';
import { Moon, Sun, BookOpen } from 'lucide-react';
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

// ── Theme definitions ───────────────────────────────────────────────────────
// Light theme mirrors the main MedIndex app's palette (tailwind "drug" colors:
// bg #f8fafc, card #ffffff, border #e2e8f0, text #1e293b, muted #64748b).
const THEMES = {
  light: {
    pageBg: '#f8fafc',
    headerBg: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 60%, #ffffff 100%)',
    headerBorder: '#e2e8f0',
    textHeading: '#0f172a',
    textPrimary: '#1e293b',
    textMuted: '#64748b',
    textFaint: '#94a3b8',
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0',
    innerCardBg0: '#f8fafc',
    innerCardBg1: '#ffffff',
    innerCardBorder: 'rgba(15,23,42,.08)',
    inputBg: '#ffffff',
    inputBorder: '#cbd5e1',
    chipInactiveBg: '#e2e8f0',
    chipInactiveText: '#475569',
    activeAllBg: '#2563eb',
    normalValueColor: '#059669',
    divider: 'rgba(15,23,42,.07)',
    overviewBg: 'rgba(15,23,42,.03)',
    overviewBorder: 'rgba(15,23,42,.07)',
  },
  night: {
    pageBg: '#0B1F3A',
    headerBg: 'linear-gradient(135deg, #0B1F3A 0%, #0F2A50 60%, #0B1F3A 100%)',
    headerBorder: 'rgba(255,255,255,.08)',
    textHeading: '#ffffff',
    textPrimary: '#F1F5F9',
    textMuted: '#94A3B8',
    textFaint: '#64748B',
    cardBg: '#132030',
    cardBorder: 'rgba(255,255,255,.08)',
    innerCardBg0: '#0F2030',
    innerCardBg1: '#0A1825',
    innerCardBorder: 'rgba(255,255,255,.07)',
    inputBg: 'rgba(255,255,255,.06)',
    inputBorder: 'rgba(255,255,255,.12)',
    chipInactiveBg: 'rgba(255,255,255,.07)',
    chipInactiveText: '#94A3B8',
    activeAllBg: '#0070F3',
    normalValueColor: '#34D399',
    divider: 'rgba(255,255,255,.06)',
    overviewBg: 'rgba(255,255,255,.03)',
    overviewBorder: 'rgba(255,255,255,.06)',
  },
};

// Base font sizes (already bumped up from the original, tighter set) —
// reading mode scales these up further.
const BASE_FONT = {
  headerTitle: 26,
  headerSubtitle: 13,
  searchInput: 16,
  chip: 13,
  statsBar: 14,
  clearFilters: 13,
  panelName: 18,
  panelBadge: 12,
  panelChildCount: 12,
  panelAbbr: 13,
  panelNormal: 13,
  paramName: 16,
  paramUnit: 12,
  paramAbbr: 13,
  paramNormal: 13,
  listTitle: 13,
  listCount: 13,
  listItem: 14.5,
  overviewLabel: 13,
  sectionLabel: 13,
  noResultsTitle: 18,
  noResultsSub: 14,
};

const ThemeCtx = createContext(null);
function useLabTheme() { return useContext(ThemeCtx); }

// ── Collapsible list renderer ──────────────────────────────────────────────
function ListSection({ title, items, color, emoji }) {
  const { theme, S } = useLabTheme();
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
        <span style={{ fontSize: S(14) }}>{emoji}</span>
        <span style={{ fontSize: S(BASE_FONT.listTitle), fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
        <span style={{ fontSize: S(BASE_FONT.listCount), color: theme.textFaint, marginLeft: 'auto' }}>{open ? '▲' : '▼'} {items.length}</span>
      </button>
      {open && (
        <ul style={{ margin: '4px 0 0 18px', padding: 0, listStyle: 'disc' }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: S(BASE_FONT.listItem), color: theme.textPrimary, lineHeight: 1.8, marginBottom: 4 }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Single parameter card (child or standalone) ────────────────────────────
function ParamCard({ param, meta, depth = 0 }) {
  const { theme, S } = useLabTheme();
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: depth === 0 ? theme.innerCardBg0 : theme.innerCardBg1,
      border: `1px solid ${open ? meta.border : theme.innerCardBorder}`,
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
      transition: 'border-color 0.2s',
      marginLeft: depth > 0 ? 16 : 0,
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: S(BASE_FONT.paramName), color: theme.textHeading }}>{param.name}</span>
            {param.unit && (
              <span style={{
                fontSize: S(BASE_FONT.paramUnit), padding: '2px 8px', borderRadius: 20,
                background: `${meta.color}22`, color: meta.color, fontWeight: 700,
              }}>
                {param.unit}
              </span>
            )}
          </div>
          <div style={{ fontSize: S(BASE_FONT.paramAbbr), color: theme.textMuted, marginTop: 3 }}>{param.abbr}</div>
          <div style={{
            fontSize: S(BASE_FONT.paramNormal), color: theme.normalValueColor, marginTop: 5, fontWeight: 600,
            fontFamily: "'Courier New', monospace",
          }}>
            📏 {param.normal}
          </div>
        </div>
        <span style={{ color: open ? meta.color : theme.textFaint, fontSize: S(15), flexShrink: 0, marginTop: 2 }}>
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
  const { theme, S } = useLabTheme();
  const [open, setOpen] = useState(false);
  const meta = getMeta(lab.cat);
  const hasChildren = lab.children && lab.children.length > 0;

  return (
    <div style={{
      background: theme.cardBg, border: `1.5px solid ${open ? meta.color + '55' : theme.cardBorder}`,
      borderRadius: 14, marginBottom: 14, overflow: 'hidden',
      boxShadow: open ? `0 4px 24px ${meta.color}15` : 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Panel header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '17px 18px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: S(26), flexShrink: 0 }}>{lab.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: S(BASE_FONT.panelName), color: theme.textHeading }}>{lab.name}</span>
            <span style={{
              fontSize: S(BASE_FONT.panelBadge), padding: '3px 10px', borderRadius: 20,
              background: meta.bg, color: meta.color, fontWeight: 700, border: `1px solid ${meta.border}`,
            }}>
              {lab.cat}
            </span>
            {hasChildren && (
              <span style={{ fontSize: S(BASE_FONT.panelChildCount), color: theme.textFaint, fontWeight: 600 }}>
                {lab.children.length} parameters
              </span>
            )}
          </div>
          <div style={{ fontSize: S(BASE_FONT.panelAbbr), color: theme.textFaint, marginTop: 3 }}>{lab.abbr}</div>
          {lab.normal && lab.normal !== 'Panel test — see individual components below' && (
            <div style={{ fontSize: S(BASE_FONT.panelNormal), color: theme.normalValueColor, marginTop: 4, fontWeight: 600 }}>
              📏 {lab.normal}
            </div>
          )}
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: open ? meta.bg : theme.chipInactiveBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${open ? meta.border : 'transparent'}`,
          color: open ? meta.color : theme.textFaint, fontSize: S(13),
          transition: 'all 0.2s',
        }}>
          {open ? '▲' : '▼'}
        </div>
      </button>

      {/* Panel body */}
      {open && (
        <div style={{ padding: '4px 18px 16px', borderTop: `1px solid ${theme.divider}` }}>
          {/* If standalone param (not a panel of children) */}
          {!hasChildren && (
            <div style={{ paddingTop: 10 }}>
              <ListSection title="Low Causes" items={lab.lowCauses}  color="#F87171" emoji="⬇️" />
              <ListSection title="High Causes" items={lab.highCauses} color="#FB923C" emoji="⬆️" />
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
                  padding: '11px 12px', borderRadius: 8, marginBottom: 12,
                  background: theme.overviewBg, border: `1px solid ${theme.overviewBorder}`,
                }}>
                  <div style={{ fontSize: S(BASE_FONT.overviewLabel), color: theme.textFaint, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Panel Overview
                  </div>
                  <ListSection title="Low Panel"  items={lab.lowCauses}  color="#F87171" emoji="⬇️" />
                  <ListSection title="High Panel" items={lab.highCauses} color="#FB923C" emoji="⬆️" />
                </div>
              )}

              {/* Child parameters */}
              <div style={{ fontSize: S(BASE_FONT.sectionLabel), color: theme.textFaint, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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

// ── Toggle pill button (Night mode / Reading mode) ─────────────────────────
function ModeToggle({ active, onClick, icon: Icon, label, theme, S }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', borderRadius: 20,
        background: active ? theme.activeAllBg : theme.chipInactiveBg,
        color: active ? '#fff' : theme.chipInactiveText,
        border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: S(12),
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function LabReferencePage() {
  const [search,    setSearch]    = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [nightMode, setNightMode] = useState(() => {
    try { return localStorage.getItem('medindex-labs-night') === '1'; } catch { return false; }
  });
  const [readingMode, setReadingMode] = useState(() => {
    try { return localStorage.getItem('medindex-labs-reading') === '1'; } catch { return false; }
  });

  const toggleNight = () => {
    setNightMode(v => {
      const next = !v;
      try { localStorage.setItem('medindex-labs-night', next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const toggleReading = () => {
    setReadingMode(v => {
      const next = !v;
      try { localStorage.setItem('medindex-labs-reading', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const theme = nightMode ? THEMES.night : THEMES.light;
  // Reading mode scales every font size up ~18% for easier reading.
  const S = (px) => Math.round(px * (readingMode ? 1.18 : 1) * 10) / 10;

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
    <ThemeCtx.Provider value={{ theme, S }}>
      <div style={{
        minHeight: '100vh', background: theme.pageBg,
        fontFamily: "'Inter','Segoe UI',sans-serif", color: theme.textPrimary,
        transition: 'background 0.2s, color 0.2s',
      }}>
        {/* Header */}
        <div style={{
          background: theme.headerBg,
          borderBottom: `1px solid ${theme.headerBorder}`,
          padding: '32px 24px 24px',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ maxWidth: readingMode ? 760 : 900, margin: '0 auto' }}>
            {/* Title + mode toggles */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'linear-gradient(135deg, #00C9A7, #0070F3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: S(20),
                  flexShrink: 0,
                }}>🔬</div>
                <div>
                  <h1 style={{ fontSize: S(BASE_FONT.headerTitle), fontWeight: 800, color: theme.textHeading, margin: 0 }}>
                    Clinical Lab Reference
                  </h1>
                  <div style={{ fontSize: S(BASE_FONT.headerSubtitle), color: theme.textFaint, marginTop: 2 }}>
                    {LABS.length} panels · {TOTAL_PARAMS} total parameters
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <ModeToggle
                  active={nightMode} onClick={toggleNight}
                  icon={nightMode ? Moon : Sun} label={nightMode ? 'Night' : 'Day'}
                  theme={theme} S={S}
                />
                <ModeToggle
                  active={readingMode} onClick={toggleReading}
                  icon={BookOpen} label="Reading"
                  theme={theme} S={S}
                />
              </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginTop: 16 }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: S(15), color: theme.textFaint,
              }}>🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search panels, parameters, causes, management…"
                style={{
                  width: '100%', padding: '12px 12px 12px 38px',
                  background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                  borderRadius: 10, color: theme.textPrimary, fontSize: S(BASE_FONT.searchInput), outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: theme.textFaint, fontSize: S(15),
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
                      padding: '6px 13px', borderRadius: 20, border: 'none',
                      background: active ? (cat === 'All' ? theme.activeAllBg : meta.color) : theme.chipInactiveBg,
                      color: active ? '#fff' : theme.chipInactiveText,
                      fontWeight: 700, fontSize: S(BASE_FONT.chip), cursor: 'pointer', whiteSpace: 'nowrap',
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
        <div style={{ maxWidth: readingMode ? 760 : 900, margin: '0 auto', padding: '20px 16px 48px' }}>
          {/* Stats bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
          }}>
            <span style={{ fontSize: S(BASE_FONT.statsBar), color: theme.textFaint }}>
              {filtered.length === LABS.length
                ? `All ${LABS.length} panels`
                : `${filtered.length} of ${LABS.length} panels`}
            </span>
            {(search || activeCat !== 'All') && (
              <button
                onClick={() => { setSearch(''); setActiveCat('All'); }}
                style={{
                  fontSize: S(BASE_FONT.clearFilters), color: '#0D9488', fontWeight: 700, background: 'none',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textFaint }}>
              <div style={{ fontSize: S(44), marginBottom: 12 }}>🔬</div>
              <div style={{ fontWeight: 700, fontSize: S(BASE_FONT.noResultsTitle), color: theme.textMuted }}>No results found</div>
              <div style={{ fontSize: S(BASE_FONT.noResultsSub), marginTop: 4 }}>Try a different search term</div>
            </div>
          ) : (
            filtered.map((lab, i) => <PanelCard key={i} lab={lab} />)
          )}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
