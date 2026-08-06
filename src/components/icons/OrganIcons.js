import React from 'react';

// Flat, solid-filled organ icons — matching a duotone style (solid colored
// silhouette + white highlight/detail strokes) rather than lucide-react's
// thin-outline icons. lucide has no dedicated pancreas/stomach/lungs glyphs,
// so these are hand-drawn to read clearly at ~28px inside a tinted tile.
// `className` sets color via `text-*` (fill="currentColor"); size via w-/h-.

export function HeartIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 21.3s-6.9-4.3-9.6-8.1C.6 10.8.6 8.1 2.5 6.3 4.3 4.6 7.1 4.5 8.9 6L12 8.7 15.1 6c1.8-1.5 4.6-1.4 6.4.3 1.9 1.8 1.9 4.5.1 6.9-2.7 3.8-9.6 8.1-9.6 8.1Z" />
      <path
        d="M6.6 8.6c-.9 1-1 2.5-.2 3.6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function PancreasIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M5 16.5c-1.3.9-2.3-.4-1.4-1.7.9-1.2 2.6-2.6 3.8-3.9C6.4 9.4 5.6 7.5 6.4 5.7 7.3 3.6 9.7 2.6 12.3 3c3 .5 5.9 2.6 6.6 5.6.6 2.6-.7 5.1-3.3 5.7-1.8.4-3.5-.2-5-1-1 .8-2.1 1.6-3.2 2.3-.8.5-1.6.8-2.4.9Z" />
      <ellipse cx="15.2" cy="8.1" rx="1.5" ry="1.1" fill="#fff" opacity="0.35" />
    </svg>
  );
}

export function BrainIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M9.6 3c-2.1 0-3.9 1.4-4.4 3.3C3.7 6.9 2.6 8.4 2.6 10.1c0 1.2.6 2.3 1.5 3-.2.5-.3 1-.3 1.6 0 2 1.7 3.6 3.7 3.6.4 0 .8-.1 1.2-.2.5.7 1.3 1.2 2.2 1.2 1.4 0 2.6-1.1 2.6-2.6v-.2c1.7-.3 3-1.7 3-3.4 0-.8-.3-1.5-.7-2.1.8-.7 1.3-1.7 1.3-2.8 0-2-1.7-3.6-3.7-3.6-.3 0-.5 0-.8.1C12 3.5 10.9 3 9.6 3Z" />
      <g fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.55">
        <path d="M8 7.2c.6.9.6 2 0 2.8" />
        <path d="M11.3 6c.5 1.3.3 2.7-.5 3.7" />
        <path d="M6.8 12.5c.7.5 1.6.6 2.4.3" />
        <path d="M13.3 10.6c.9.2 1.7.8 2.1 1.6" />
        <path d="M10 13.6c.5.9.5 2 0 2.8" />
      </g>
    </svg>
  );
}

export function StomachIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M9.2 3.2c-1.4 0-2.5 1-2.5 2.3 0 .9.5 1.6 1.2 2C6.5 8.2 5.3 9.5 5.3 11.3c0 1.6.8 2.6.8 4.1 0 1.6-1.4 2-1.4 3.5 0 1.7 1.9 2.8 4.2 2.8 3.7 0 7.1-2.3 8.4-5.5.9-2.3.6-4.9-1-6.7-1.3-1.5-1.3-1.4-1.3-2.6 0-1.8-1.6-3.3-3.6-3.3-1.1 0-2.1.4-2.2.6Z" />
      <path
        d="M8.3 6.4c-.7.7-.8 1.9-.2 2.8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function LungsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M11.2 3v6.7c-.9-.5-2-.7-3-.4l-1-2.4c-.2-.5-.8-.6-1.2-.3-.3.3-.4.7-.2 1.1l.9 2.2c-1.4.9-2.3 2.5-2.3 4.3v2c0 1.7 1.3 3 3 3 1.9 0 3.8-1.6 3.8-4.2V3Z" />
      <path d="M12.8 3v6.7c.9-.5 2-.7 3-.4l1-2.4c.2-.5.8-.6 1.2-.3.3.3.4.7.2 1.1l-.9 2.2c1.4.9 2.3 2.5 2.3 4.3v2c0 1.7-1.3 3-3 3-1.9 0-3.8-1.6-3.8-4.2V3Z" />
      <path
        d="M12 3v13.5M12 8.3c-.4.4-.4 1 0 1.4M12 8.3c.4.4.4 1 0 1.4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

export function ShieldCheckIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.3 4.5 5.2v6c0 5 3.3 8.9 7.5 9.5 4.2-.6 7.5-4.5 7.5-9.5v-6L12 2.3Z" />
      <path
        d="M12 2.3 4.5 5.2v6c0 5 3.3 8.9 7.5 9.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
        opacity="0.35"
      />
      <path
        d="M8.3 12.2l2.4 2.4 4.7-5.1"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
