// src/components/dashboard/MockupArt.js
// Inline-SVG artwork for the home dashboard, drawn to match the approved
// design picture shape-for-shape (book logo, banner scene, explore icons,
// quick-action book, recently-viewed illustrations). Colours come from the
// app palette (navy ink, blue, teal). Inline so it works offline in the PWA.
import React from 'react';

const INK = '#0b2a66';
const BLUE = '#1769e0';
const TEAL = '#1fbfae';

/* ── Brand mark: open book with a medical cross ─────────────────────────── */
export function BookLogo({ className }) {
  return (
    <svg viewBox="0 0 64 60" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mx-logo-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14408f" />
          <stop offset="1" stopColor="#071c4a" />
        </linearGradient>
        <linearGradient id="mx-logo-trim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fe9d6" />
          <stop offset="1" stopColor="#1769e0" />
        </linearGradient>
      </defs>
      {/* cover */}
      <path d="M6 6c9-3 17-2 26 3 9-5 17-6 26-3v44c-9-3-17-2-26 3-9-5-17-6-26-3z" fill="url(#mx-logo-cover)" />
      {/* trim */}
      <path d="M9 9c8-2 15-1 23 3 8-4 15-5 23-3v38c-8-2-15-1-23 3-8-4-15-5-23-3z" fill="none" stroke="url(#mx-logo-trim)" strokeWidth="2" strokeLinejoin="round" />
      {/* spine */}
      <path d="M32 11v42" stroke="url(#mx-logo-trim)" strokeWidth="1.6" />
      {/* bottom page edge */}
      <path d="M6 50c9-3 17-2 26 3 9-5 17-6 26-3v4c-9-3-17-2-26 3-9-5-17-6-26-3z" fill="url(#mx-logo-trim)" />
      {/* cross */}
      <path d="M27 17h10v8h8v10h-8v8H27v-8h-8V25h8z" fill="#fff" />
    </svg>
  );
}

/* ── Default avatar: woman silhouette ───────────────────────────────────── */
export function AvatarSilhouette({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mx-av-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf3da" />
          <stop offset="1" stopColor="#e9d3a2" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill="url(#mx-av-bg)" />
      {/* long hair + shoulders */}
      <path d="M24 7c-7 0-11 5-11 12 0 5 1 9-1 13-1 2-3 3-3 6v10h30V38c0-3-2-4-3-6-2-4-1-8-1-13 0-7-4-12-11-12z" fill="#241a17" />
      {/* face */}
      <ellipse cx="24" cy="21" rx="6.3" ry="7.6" fill="#3a2b26" />
    </svg>
  );
}

/* ── Banner scene: stethoscope on an open book, ECG line ────────────────── */
export function BannerScene({ className }) {
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
      <defs>
        <linearGradient id="mx-b-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7fbff" />
          <stop offset="1" stopColor="#a9c6ee" />
        </linearGradient>
        <linearGradient id="mx-b-cover" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a6fd6" />
          <stop offset="1" stopColor="#0a2a78" />
        </linearGradient>
        <linearGradient id="mx-b-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#c9d9ee" />
          <stop offset="1" stopColor="#6f87ab" />
        </linearGradient>
        <linearGradient id="mx-b-metal-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9bbd6" />
          <stop offset="1" stopColor="#4c6188" />
        </linearGradient>
        <radialGradient id="mx-b-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#27e1c6" stopOpacity=".28" />
          <stop offset="1" stopColor="#27e1c6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="190" cy="150" rx="140" ry="46" fill="url(#mx-b-glow)" />

      {/* open book: cover, page blocks, page edges */}
      <path d="M30 150c52-16 100-12 142 10 42-22 90-26 140-10v26c-50-14-98-10-140 12-42-22-90-26-142-12z" fill="url(#mx-b-cover)" />
      <path d="M36 136c50-18 96-14 136 8v26c-40-22-86-26-136-8z" fill="url(#mx-b-page)" />
      <path d="M172 144c40-22 86-26 136-8v26c-50-18-96-14-136 8z" fill="url(#mx-b-page)" />
      <path d="M172 144v26" stroke="#7fa2d8" strokeWidth="2" />
      <g stroke="#8aaad9" strokeWidth="1" opacity=".75" fill="none">
        <path d="M44 146c46-14 90-12 126 6" />
        <path d="M46 152c46-14 88-12 124 6" />
        <path d="M300 146c-46-14-90-12-126 6" />
        <path d="M298 152c-46-14-88-12-124 6" />
      </g>

      {/* ECG line */}
      <path d="M214 108h22l8-14 12 34 12-52 12 40 8-8h40" fill="none" stroke="#27e1c6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M214 108h22l8-14 12 34 12-52 12 40 8-8h40" fill="none" stroke="#27e1c6" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity=".16" />

      {/* tubing */}
      <path d="M150 112C118 92 112 34 168 18c52-14 104 8 112 52" fill="none" stroke="#0a2347" strokeWidth="11" strokeLinecap="round" />
      <path d="M150 112C118 92 112 34 168 18c52-14 104 8 112 52" fill="none" stroke="#2c6aa8" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
      <circle cx="280" cy="70" r="7" fill="url(#mx-b-metal)" />

      {/* chest-piece: thickness, rim, diaphragm */}
      <ellipse cx="116" cy="140" rx="52" ry="17" fill="#3b4f73" />
      <ellipse cx="116" cy="128" rx="52" ry="19" fill="url(#mx-b-metal-side)" />
      <ellipse cx="116" cy="122" rx="52" ry="19" fill="url(#mx-b-metal)" />
      <ellipse cx="116" cy="122" rx="40" ry="13.5" fill="#8ea3c3" opacity=".6" />
      <ellipse cx="116" cy="120" rx="36" ry="11.5" fill="url(#mx-b-metal)" />
      <ellipse cx="108" cy="116" rx="17" ry="4.5" fill="#fff" opacity=".55" />
      <path d="M148 112c6-4 11-5 16-4l-2 10c-4-1-8 0-13 3z" fill="url(#mx-b-metal-side)" />
    </svg>
  );
}

/* ── Explore tiles: dark line icons ─────────────────────────────────────── */
const tileProps = {
  viewBox: '0 0 48 48', fill: 'none', 'aria-hidden': 'true',
  strokeLinecap: 'round', strokeLinejoin: 'round',
};

export function TilePill({ className }) {
  return (
    <svg {...tileProps} className={className}>
      <g transform="rotate(-45 24 24)">
        <rect x="5" y="14" width="38" height="20" rx="10" fill={INK} />
        <path d="M24 14h9a10 10 0 0 1 0 20h-9z" fill={TEAL} />
        <rect x="9" y="17" width="13" height="4" rx="2" fill="#fff" opacity=".35" />
      </g>
    </svg>
  );
}

export function TileStethoscope({ className }) {
  return (
    <svg {...tileProps} className={className} stroke={INK} strokeWidth="3.2">
      <path d="M13 5v13a8 8 0 0 0 16 0V5" />
      <path d="M11 5h4M27 5h4" />
      <path d="M21 26v6a9 9 0 0 0 18 0v-4" />
      <circle cx="39" cy="24" r="4.6" fill="#e8f1ff" strokeWidth="3" />
    </svg>
  );
}

export function TileScalpel({ className }) {
  return (
    <svg {...tileProps} className={className}>
      {/* handle */}
      <path d="M26 26 8 43" stroke={INK} strokeWidth="7" />
      <path d="M8 43 5.500 45.500" stroke={INK} strokeWidth="4" />
      {/* collar */}
      <path d="M22.500 20.500l7 7" stroke={TEAL} strokeWidth="3.600" />
      {/* blade */}
      <path d="M43 4c-8 1-17 7-22.500 16.500l7 7C37 21 43 12 43 4z" fill={INK} />
      <path d="M39 8c-5 2-10 6-13 11" stroke="#fff" strokeWidth="1.600" opacity=".45" />
    </svg>
  );
}

export function TileBody({ className }) {
  return (
    <svg {...tileProps} className={className} fill={INK} stroke="none">
      <circle cx="24" cy="6.5" r="4.2" />
      <path d="M17 13h14c2.6 0 4 1.6 4.3 4.2l1.4 12.3c.2 1.6-1 2.4-2.1 2.4s-1.9-.7-2.1-2.1l-1-8h-.7l.7 24.2c0 1.6-1 2.6-2.4 2.6s-2.2-1-2.4-2.4L26 32h-4l-1.1 14.2c-.2 1.4-1 2.4-2.4 2.4s-2.4-1-2.4-2.6l.7-24.2h-.7l-1 8c-.2 1.4-1 2.1-2.1 2.1s-2.3-.8-2.1-2.4l1.4-12.3C12.2 14.6 13.600 13 16.200 13z" />
    </svg>
  );
}

export function TileCalculator({ className }) {
  return (
    <svg {...tileProps} className={className}>
      <rect x="9" y="3" width="30" height="42" rx="5" fill={INK} />
      <rect x="13" y="8" width="22" height="9" rx="2" fill="#e8f1ff" />
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <rect key={`${r}${c}`} x={13 + c * 8} y={21 + r * 8} width="6" height="5.4" rx="1.4" fill="#e8f1ff" />
      )))}
    </svg>
  );
}

export function TileFlask({ className }) {
  return (
    <svg {...tileProps} className={className}>
      <path d="M18 4h12M20 4v14L7 40a4 4 0 0 0 3.6 6h26.800A4 4 0 0 0 41 40L28 18V4" stroke={INK} strokeWidth="3.4" fill="#e8f1ff" />
      <path d="M13.500 31h21l5 9a3 3 0 0 1-2.700 4.400H11.200A3 3 0 0 1 8.500 40z" fill={INK} />
      <circle cx="21" cy="37" r="1.8" fill="#e8f1ff" />
      <circle cx="28" cy="35" r="1.3" fill="#e8f1ff" />
    </svg>
  );
}

export function TileRobot({ className }) {
  return (
    <svg {...tileProps} className={className}>
      <rect x="22" y="3" width="4" height="7" rx="2" fill={INK} />
      <circle cx="24" cy="3.600" r="2.600" fill={INK} />
      <rect x="4" y="19" width="5" height="12" rx="2.500" fill={INK} />
      <rect x="39" y="19" width="5" height="12" rx="2.500" fill={INK} />
      <rect x="9" y="10" width="30" height="26" rx="10" fill={INK} />
      <rect x="13" y="15" width="22" height="15" rx="6.500" fill="#e8f1ff" />
      <ellipse cx="19.500" cy="22.500" rx="2.600" ry="3" fill={INK} />
      <ellipse cx="28.500" cy="22.500" rx="2.600" ry="3" fill={INK} />
      <path d="M11 46c0-7 5-11 13-11s13 4 13 11z" fill={INK} />
    </svg>
  );
}

/* ── Quick Action: open book ────────────────────────────────────────────── */
export function QuickBook({ className }) {
  return (
    <svg viewBox="0 0 150 100" className={className} aria-hidden="true" preserveAspectRatio="xMaxYMid meet">
      <defs>
        <linearGradient id="mx-q-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#bcd7f6" />
        </linearGradient>
      </defs>
      <path d="M8 40c24-12 46-10 66 4v50C54 80 32 78 8 90z" fill="#8fb5e6" />
      <path d="M142 40c-24-12-46-10-66 4v50c20-14 42-16 66-4z" fill="#8fb5e6" />
      <path d="M12 32c22-12 44-10 62 4v48c-18-14-40-16-62-4z" fill="url(#mx-q-page)" />
      <path d="M138 32c-22-12-44-10-62 4v48c18-14 40-16 62-4z" fill="url(#mx-q-page)" />
      <g stroke="#8aaad9" strokeWidth="1.600" strokeLinecap="round" fill="none">
        <path d="M22 44c14-5 28-4 42 4" />
        <path d="M22 54c14-5 28-4 42 4" />
        <path d="M22 64c14-5 28-4 42 4" />
        <path d="M128 44c-14-5-28-4-42 4" />
        <path d="M128 54c-14-5-28-4-42 4" />
        <path d="M128 64c-14-5-28-4-42 4" />
      </g>
      <path d="M75 36v48" stroke="#7fa2d8" strokeWidth="2" />
    </svg>
  );
}

/* ── Recently viewed illustrations ──────────────────────────────────────── */
export function RecentPills({ className }) {
  return (
    <svg viewBox="0 0 100 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mx-p-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#58b0ff" />
          <stop offset="1" stopColor="#1357c9" />
        </linearGradient>
        <linearGradient id="mx-p-orange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a62" />
          <stop offset="1" stopColor="#e5461b" />
        </linearGradient>
        <linearGradient id="mx-p-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cdd9ea" />
        </linearGradient>
      </defs>
      <ellipse cx="52" cy="58" rx="42" ry="4" fill="#0b2a66" opacity=".12" />
      {/* orange + blue capsule (lower left) */}
      <g transform="rotate(-8 34 44)">
        <rect x="4" y="34" width="58" height="22" rx="11" fill="url(#mx-p-white)" />
        <path d="M4 45a11 11 0 0 1 11-11h14v22H15A11 11 0 0 1 4 45z" fill="url(#mx-p-orange)" />
        <path d="M33 34h18a11 11 0 0 1 0 22H33z" fill="url(#mx-p-blue)" />
        <rect x="9" y="37" width="40" height="4" rx="2" fill="#fff" opacity=".4" />
      </g>
      {/* blue + white capsule (top) */}
      <g transform="rotate(14 56 20)">
        <rect x="26" y="10" width="62" height="22" rx="11" fill="url(#mx-p-white)" />
        <path d="M26 21a11 11 0 0 1 11-11h14v22H37A11 11 0 0 1 26 21z" fill="url(#mx-p-white)" />
        <path d="M54 10h23a11 11 0 0 1 0 22H54z" fill="url(#mx-p-blue)" />
        <rect x="32" y="13" width="38" height="4" rx="2" fill="#fff" opacity=".5" />
      </g>
      {/* blue capsule (right) */}
      <g transform="rotate(-18 76 44)">
        <rect x="48" y="36" width="56" height="20" rx="10" fill="url(#mx-p-blue)" />
        <rect x="54" y="39" width="38" height="4" rx="2" fill="#fff" opacity=".45" />
      </g>
    </svg>
  );
}

export function RecentHeart({ className }) {
  return (
    <svg viewBox="0 0 80 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mx-h-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1769e0" />
          <stop offset="1" stopColor="#0b2a66" />
        </linearGradient>
      </defs>
      <path d="M40 66C16 49 5 36 5 22 5 12 13 5 22 5c7 0 14 4 18 11C44 9 51 5 58 5c9 0 17 7 17 17 0 14-11 27-35 44z" fill="url(#mx-h-fill)" />
      <path d="M12 12c4-5 12-7 18-3" stroke="#fff" strokeWidth="2.400" strokeLinecap="round" opacity=".28" fill="none" />
      <path d="M9 34h16l6-11 9 24 7-17 4 4h15" fill="none" stroke="#fff" strokeWidth="3.400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RecentSyringe({ className }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mx-s-barrel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#bcd0ee" />
        </linearGradient>
      </defs>
      <g transform="rotate(45 40 40)">
        {/* plunger */}
        <rect x="37.500" y="2" width="5" height="16" rx="2" fill="#7f95b8" />
        <rect x="27" y="0" width="26" height="4" rx="2" fill="#5d739a" />
        {/* barrel */}
        <rect x="28" y="16" width="24" height="40" rx="4" fill="url(#mx-s-barrel)" stroke="#8aa2c8" strokeWidth="1.600" />
        <rect x="32" y="26" width="16" height="22" rx="2" fill="#7fb4ff" opacity=".7" />
        <g stroke="#6b84ad" strokeWidth="1.400">
          <path d="M28 24h7M28 30h5M28 36h7M28 42h5M28 48h7" />
        </g>
        <rect x="23" y="54" width="34" height="4" rx="2" fill="#8aa2c8" />
        {/* hub + needle */}
        <path d="M35 58h10l-2 8h-6z" fill="#a9bbd6" />
        <rect x="39" y="66" width="2" height="13" rx="1" fill="#9aa9c2" />
      </g>
    </svg>
  );
}

/* ── Small glyphs ───────────────────────────────────────────────────────── */
export function PlusCircle({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill={INK} />
      <path d="M21 12h6v9h9v6h-9v9h-6v-9h-9v-6h9z" fill="#fff" />
    </svg>
  );
}

export { INK, BLUE, TEAL };
