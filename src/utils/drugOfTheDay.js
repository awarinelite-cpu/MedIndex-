// src/utils/drugOfTheDay.js
// One drug per Nigerian calendar day (Africa/Lagos), the same for every user,
// picked deterministically from the live drug list. Used by the Home carousel.

import { getDisplayDrugClass } from './drugCategory';

// Day number in Nigeria time, so the drug flips at local midnight.
function lagosDay() {
  let key;
  try {
    key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    key = new Date().toISOString().slice(0, 10);
  }
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Small seeded PRNG so every device gets the same pick on the same day.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clean = (v) => String(v || '').replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim();

export function pickDrugOfTheDay(drugs) {
  const pool = (drugs || [])
    .filter(d => d && d.id && d.generic_name && clean(d.overview).length > 20 && getDisplayDrugClass(d))
    .sort((a, b) => a.generic_name.localeCompare(b.generic_name));
  if (!pool.length) return null;
  return pool[Math.floor(mulberry32(lagosDay())() * pool.length)];
}
