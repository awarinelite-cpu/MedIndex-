// src/components/ListsUi.js
// Shared look for the "My Drug Lists" pages: colourful capsule badges and the
// soft decorative background used behind the list screens.

import React from 'react';

export const LISTS_NAVY = '#0A1F5C';
export const LISTS_BLUE = '#1D5FD1';

// Each drug row gets its own colour, cycling through this palette.
const PALETTE = [
  { bg: '#E3EEFF', a: '#2F80ED', b: '#1553C9' }, // blue
  { bg: '#FFE4EA', a: '#FB5C7C', b: '#E11D48' }, // pink / red
  { bg: '#D9F5EF', a: '#2DD4BF', b: '#0E9F8E' }, // teal
  { bg: '#ECE4FF', a: '#8B5CF6', b: '#6D28D9' }, // purple
  { bg: '#FFF0DC', a: '#FBBF24', b: '#F97316' }, // orange
  { bg: '#DDF7E5', a: '#4ADE80', b: '#16A34A' }, // green
];

export function CapsuleBadge({ index = 0, size = 56 }) {
  const c = PALETTE[index % PALETTE.length];
  const id = `cap-${index % PALETTE.length}`;
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: c.bg }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.a} />
            <stop offset="1" stopColor={c.b} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect x="4" y="15" width="40" height="18" rx="9" />
          </clipPath>
        </defs>
        <g transform="rotate(-45 24 24)">
          <g clipPath={`url(#${id}-clip)`}>
            <rect x="4" y="15" width="21" height="18" fill={`url(#${id})`} />
            <rect x="24" y="15" width="20" height="18" fill="#F4F7FF" />
            <rect x="4" y="15" width="40" height="5" fill="#fff" opacity=".35" />
          </g>
          <rect x="4" y="15" width="40" height="18" rx="9" fill="none" stroke={c.b} strokeOpacity=".25" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

// Soft blobs + plus signs behind the page content.
export function ListsBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(96,165,250,.35), rgba(96,165,250,0) 70%)' }} />
      <div className="absolute top-1/2 -left-24 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(147,197,253,.30), rgba(147,197,253,0) 70%)' }} />
      <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,.22), rgba(59,130,246,0) 70%)' }} />
    </div>
  );
}

// Decorative medical shield used on the right of the list header card.
export function ShieldDecor({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 100 110" width="84" height="92" aria-hidden="true">
      <defs>
        <linearGradient id="shield-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DCEBFF" />
          <stop offset="1" stopColor="#A9CBFF" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 20 V52 C88 78 70 96 50 104 C30 96 12 78 12 52 V20 Z" fill="url(#shield-g)" stroke="#fff" strokeWidth="3" />
      <rect x="44" y="34" width="12" height="38" rx="3" fill="#2F6FE0" />
      <rect x="31" y="47" width="38" height="12" rx="3" fill="#2F6FE0" />
    </svg>
  );
}
