import React from 'react';

// Soft blue wave backdrop used behind the Browse and Conditions headers.
export function WaveBackdrop({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0H400V92C340 52 300 128 220 138C140 148 90 96 0 128Z" fill="#cfe2fb" opacity=".55" />
      <path d="M400 10C352 40 336 96 262 150C222 180 170 214 400 236Z" fill="#9ec8fa" opacity=".45" />
    </svg>
  );
}

// Faint medical cross.
export function CrossArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 80" aria-hidden="true">
      <path d="M28 4h24a4 4 0 0 1 4 4v20h20a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H56v20a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V52H4a4 4 0 0 1-4-4V32a4 4 0 0 1 4-4h20V8a4 4 0 0 1 4-4z" fill="#b9d5fa" opacity=".7" />
    </svg>
  );
}

// Capsule and tablet illustration for the Browse Medications header.
export function PillsArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 160" aria-hidden="true">
      <defs>
        <linearGradient id="pa-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f8bff" />
          <stop offset="1" stopColor="#0b57d0" />
        </linearGradient>
        <linearGradient id="pa-white" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d7e4f6" />
        </linearGradient>
      </defs>
      <ellipse cx="108" cy="140" rx="70" ry="10" fill="#7fb0f0" opacity=".25" />
      <g transform="rotate(-42 96 70)">
        <rect x="34" y="46" width="124" height="52" rx="26" fill="url(#pa-white)" />
        <path d="M96 46h36a26 26 0 0 1 0 52H96z" fill="url(#pa-blue)" />
        <rect x="46" y="54" width="74" height="9" rx="4.5" fill="#fff" opacity=".55" />
      </g>
      <ellipse cx="146" cy="116" rx="40" ry="20" fill="#c6d6ec" />
      <ellipse cx="146" cy="110" rx="40" ry="20" fill="url(#pa-white)" />
      <path d="M122 114l48-12" stroke="#c0d0e6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
