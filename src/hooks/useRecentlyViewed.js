// src/hooks/useRecentlyViewed.js
// Remembers what a person opened on this device (drugs and conditions) so the
// home dashboard can show a "Recently viewed" list. Stored per signed-in user
// so a shared phone doesn't mix up two people's history.
import { useState, useEffect } from 'react';

const MAX_RECENT = 10;
const drugKey = (uid) => `medindex_recent_drugs:${uid || 'anon'}`;
const timeKey = (uid) => `medindex_recent_drug_times:${uid || 'anon'}`;
const condKey = (uid) => `medindex_recent_conditions:${uid || 'anon'}`;

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readActivity(uid) {
  const ids = readJson(drugKey(uid), []);
  const times = readJson(timeKey(uid), {});
  const conds = readJson(condKey(uid), []);
  return {
    drugIds: Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [],
    times: times && typeof times === 'object' && !Array.isArray(times) ? times : {},
    conditions: Array.isArray(conds)
      ? conds.filter(c => c && typeof c.s === 'string' && typeof c.id === 'string')
      : [],
  };
}

// Call when a drug detail page opens. Newest first, no duplicates.
export function recordRecentDrug(drugId, uid) {
  if (!drugId) return;
  try {
    const { drugIds, times } = readActivity(uid);
    const next = [drugId, ...drugIds.filter(id => id !== drugId)].slice(0, MAX_RECENT);
    const nextTimes = {};
    next.forEach(id => { if (times[id]) nextTimes[id] = times[id]; });
    nextTimes[drugId] = Date.now();
    localStorage.setItem(drugKey(uid), JSON.stringify(next));
    localStorage.setItem(timeKey(uid), JSON.stringify(nextTimes));
  } catch {
    // Storage can be unavailable (private mode / quota): history is a nicety, never block on it.
  }
}

// Call when a condition card is opened on a system page.
export function recordRecentCondition(systemId, conditionId, uid) {
  if (!systemId || !conditionId) return;
  try {
    const { conditions } = readActivity(uid);
    const next = [
      { s: systemId, id: conditionId, t: Date.now() },
      ...conditions.filter(c => !(c.s === systemId && c.id === conditionId)),
    ].slice(0, MAX_RECENT);
    localStorage.setItem(condKey(uid), JSON.stringify(next));
  } catch {
    // see above
  }
}

export function useRecentActivity(uid) {
  const [activity, setActivity] = useState(() => readActivity(uid));
  useEffect(() => {
    setActivity(readActivity(uid));
    const onStorage = () => setActivity(readActivity(uid));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [uid]);
  return activity;
}

// Kept for any caller that only needs the drug ids.
export function useRecentlyViewed(uid) {
  return useRecentActivity(uid).drugIds;
}
