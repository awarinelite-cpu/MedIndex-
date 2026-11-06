// src/components/dashboard/DashboardArt.js
// Hand-drawn SVG artwork for the home dashboard: brand mark, stethoscope,
// AI assistant robot, and a few small glyphs. Everything is inline SVG so it
// works offline (the app ships as a PWA) and scales crisply on any screen.
import React from 'react';

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 72 52" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mi-logo-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#27d3c4" />
          <stop offset="1" stopColor="#1769e0" />
        </linearGradient>
        <linearGradient id="mi-logo-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cfe4ff" />
        </linearGradient>
      </defs>
      <path d="M4 14c11-3 22-2 32 4v28C26 40 15 39 4 42z" fill="url(#mi-logo-a)" />
      <path d="M68 14C57 11 46 12 36 18v28c10-6 21-7 32-4z" fill="url(#mi-logo-a)" />
      <path d="M8 16c9-2 18-1 26 4v22c-8-4-17-5-26-3z" fill="url(#mi-logo-b)" />
      <path d="M64 16c-9-2-18-1-26 4v22c8-4 17-5 26-3z" fill="url(#mi-logo-b)" />
      <path d="M30 2h12v10h10v12H42v10H30V24H20V12h10z" fill="#0b3fb4" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function PulseIcon({ className }) {
  return (
    <svg viewBox="0 0 28 24" className={className} fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 13h5l3-8 5 15 4-11 2 4h7" />
    </svg>
  );
}

export function Stethoscope({ className }) {
  return (
    <svg viewBox="0 0 230 150" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mi-steth-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#d5deea" />
          <stop offset="1" stopColor="#9aa8bd" />
        </linearGradient>
        <linearGradient id="mi-steth-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9c5d6" />
          <stop offset="1" stopColor="#6c7b92" />
        </linearGradient>
        <radialGradient id="mi-steth-face" cx=".4" cy=".35" r=".8">
          <stop offset="0" stopColor="#f4f8fc" />
          <stop offset=".6" stopColor="#c4cfdd" />
          <stop offset="1" stopColor="#8795ab" />
        </radialGradient>
      </defs>
      {/* tubing */}
      <path d="M232 6 C196 -4 170 22 150 56" fill="none" stroke="#243247" strokeWidth="9" strokeLinecap="round" />
      <path d="M232 6 C196 -4 170 22 150 56" fill="none" stroke="#3b4d68" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
      {/* chest-piece: thickness, rim, diaphragm */}
      <ellipse cx="112" cy="98" rx="62" ry="38" fill="url(#mi-steth-side)" />
      <ellipse cx="112" cy="88" rx="62" ry="38" fill="url(#mi-steth-top)" />
      <ellipse cx="112" cy="88" rx="50" ry="29" fill="#8d9bb0" opacity=".55" />
      <ellipse cx="112" cy="86" rx="46" ry="26" fill="url(#mi-steth-face)" />
      <ellipse cx="104" cy="78" rx="22" ry="8" fill="#fff" opacity=".35" />
      {/* stem into the tube */}
      <path d="M143 60c4-4 8-6 12-8l4 8c-4 2-7 4-10 7z" fill="url(#mi-steth-side)" />
    </svg>
  );
}

export function Robot({ className }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mi-bot-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe8fb" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <rect x="58" y="13" width="4" height="11" rx="2" fill="#dbe8fb" />
      <circle cx="60" cy="12" r="5" fill="#ffffff" />
      {/* ear pods */}
      <rect x="21" y="43" width="11" height="24" rx="5.5" fill="#8fc0ff" />
      <rect x="88" y="43" width="11" height="24" rx="5.5" fill="#8fc0ff" />
      {/* head + face screen */}
      <rect x="27" y="24" width="66" height="54" rx="22" fill="url(#mi-bot-head)" />
      <rect x="35" y="35" width="50" height="32" rx="14" fill="#0b2a66" />
      <ellipse cx="50" cy="51" rx="5.5" ry="6" fill="#58d6ff" />
      <ellipse cx="70" cy="51" rx="5.5" ry="6" fill="#58d6ff" />
      {/* body */}
      <path d="M36 112c0-16 10-27 24-27s24 11 24 27z" fill="#ffffff" />
      <path d="M52 86c2 4 14 4 16 0" stroke="#9db8dd" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* chat bubble */}
      <rect x="76" y="68" width="38" height="26" rx="13" fill="#1f7bf2" />
      <path d="M84 92l-3 9 10-6z" fill="#1f7bf2" />
      <circle cx="87" cy="81" r="2.6" fill="#fff" />
      <circle cx="95" cy="81" r="2.6" fill="#fff" />
      <circle cx="103" cy="81" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Heartbeat({ className }) {
  return (
    <svg viewBox="0 0 200 90" className={className} fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M0 52h38l10-14 12 32 14-62 14 76 12-32h30" />
    </svg>
  );
}

export function BoneIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <g transform="rotate(-45 12 12)">
        <rect x="6" y="9.5" width="12" height="5" rx="1.5" />
        <circle cx="5.6" cy="8.6" r="2.7" />
        <circle cx="5.6" cy="15.4" r="2.7" />
        <circle cx="18.4" cy="8.6" r="2.7" />
        <circle cx="18.4" cy="15.4" r="2.7" />
      </g>
    </svg>
  );
}

export function HomeGlyph({ className, filled }) {
  const d = 'M3 10.6 12 3l9 7.6V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z';
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true"
         fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
         strokeWidth={filled ? 1.5 : 1.8} strokeLinejoin="round" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}

// Banner illustration for the dark hero carousel: glowing cross, ECG line,
// open book and a stethoscope, all drawn inline so it works offline.
export function BannerArt({ className }) {
  return (
    <svg viewBox="0 0 260 170" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mi-ban-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eaf3ff" />
          <stop offset="1" stopColor="#8fb6ee" />
        </linearGradient>
        <radialGradient id="mi-ban-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#3fd8ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#3fd8ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mi-ban-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f8fc" />
          <stop offset="1" stopColor="#7f8fa8" />
        </linearGradient>
      </defs>
      <circle cx="176" cy="54" r="52" fill="url(#mi-ban-glow)" />
      <circle cx="176" cy="54" r="44" fill="none" stroke="#38c6ff" strokeWidth="1.2" opacity=".55" />
      <path d="M166 22h20v22h22v20h-22v22h-20V64h-22V44h22z" fill="none" stroke="#5fe0ff" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M200 96h14l6-18 8 38 8-48 6 28h18" fill="none" stroke="#5fe0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
      {/* open book */}
      <path d="M40 132c34-12 66-10 92 4v22c-26-14-58-16-92-4z" fill="#0b3a96" opacity=".7" />
      <path d="M132 136c26-14 58-16 92-4v22c-34-12-66-10-92 4z" fill="#0b3a96" opacity=".7" />
      <path d="M44 124c32-12 62-10 88 4v24c-26-14-56-16-88-4z" fill="url(#mi-ban-page)" />
      <path d="M132 128c26-14 56-16 88-4v24c-32-12-62-10-88 4z" fill="url(#mi-ban-page)" />
      <path d="M132 128v24" stroke="#6f97d6" strokeWidth="1.5" />
      {/* stethoscope */}
      <path d="M96 20c-14 4-22 18-18 36 4 20 22 28 36 22 12-5 18-18 14-30" fill="none" stroke="#9fdcff" strokeWidth="4" strokeLinecap="round" opacity=".9" />
      <circle cx="132" cy="96" r="15" fill="url(#mi-ban-steel)" />
      <circle cx="132" cy="96" r="8" fill="#5d6f8c" />
      <circle cx="96" cy="18" r="4" fill="#cfe9ff" />
    </svg>
  );
}
