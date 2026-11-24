// src/utils/drugOfTheDay.js
// One drug per Nigerian calendar day (Africa/Lagos), the same for every user,
// picked deterministically from the live drug list. Used by the Home carousel.
// The pick cycles through the whole list, so no drug repeats until every
// eligible drug has been shown.

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

const clean = (v) => String(v || '').replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim();

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function pickDrugOfTheDay(drugs) {
  const pool = (drugs || [])
    .filter(d => d && d.id && d.generic_name && clean(d.overview).length > 20 && getDisplayDrugClass(d))
    .sort((a, b) => a.generic_name.localeCompare(b.generic_name));
  if (!pool.length) return null;
  // Walk the list with a step that shares no factor with its length: this
  // visits every drug exactly once per cycle, in a scrambled (not A-Z) order.
  let step = 7919;
  while (gcd(step, pool.length) !== 1) step += 2;
  return pool[(lagosDay() * step) % pool.length];
}
