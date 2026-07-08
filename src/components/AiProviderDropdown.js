// src/components/AiProviderDropdown.js
// Dropdown button to select which AI provider powers the "AI Insights" feature.
// Persists choice in localStorage via AiProviderContext.

import React, { useState, useRef, useEffect } from 'react';
import { useAiProvider, AI_PROVIDERS } from '../context/AiProviderContext';

export default function AiProviderDropdown() {
  const { provider, setProvider } = useAiProvider();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Switch AI provider"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          padding:        '5px 10px 5px 8px',
          borderRadius:   10,
          border:         '1.5px solid rgba(255,255,255,0.13)',
          background:     'rgba(255,255,255,0.07)',
          color:          '#fff',
          cursor:         'pointer',
          fontSize:       13,
          fontWeight:     600,
          whiteSpace:     'nowrap',
          transition:     'background 0.15s',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>{provider.icon}</span>
        <span>{provider.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div style={{
          position:     'absolute',
          top:          'calc(100% + 6px)',
          right:        0,
          zIndex:       9999,
          minWidth:     190,
          background:   '#0F172A',
          border:       '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
          overflow:     'hidden',
          padding:      '6px 0',
        }}>
          <div style={{ padding: '6px 14px 8px', fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            AI Provider
          </div>
          {AI_PROVIDERS.map(p => {
            const active = p.id === provider.id;
            return (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setOpen(false); }}
                style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         10,
                  width:       '100%',
                  padding:     '9px 14px',
                  border:      'none',
                  background:  active ? 'rgba(255,255,255,0.06)' : 'transparent',
                  cursor:      'pointer',
                  textAlign:   'left',
                  transition:  'background 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Coloured icon circle */}
                <span style={{
                  width:          28,
                  height:         28,
                  borderRadius:   8,
                  background:     p.color + '22',
                  border:         `1.5px solid ${p.color}55`,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       14,
                  color:          p.color,
                  flexShrink:     0,
                }}>
                  {p.icon}
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#F8FAFC' : '#CBD5E1' }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{p.sublabel}</div>
                </div>

                {/* Active checkmark */}
                {active && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="7" fill={p.color} fillOpacity="0.2" />
                    <path d="M4 7L6.2 9.2L10 5" stroke={p.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
