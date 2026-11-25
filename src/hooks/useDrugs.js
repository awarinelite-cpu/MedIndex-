// src/hooks/useDrugs.js
// Single source of truth for the drug list.
// Primary: Firestore 'drugs' collection, loaded with "delta sync" (see
// utils/deltaCollection.js): the list is read from the device first and only
// the drugs that changed since the last sync are downloaded — any write
// (admin save, AI insight save, bulk upload, image link, etc.) still reaches
// every screen within about a second, but a normal app start no longer
// re-reads the whole collection.
// Fallback: local seedDrugs.json (used only if Firestore is empty or
// unreachable with nothing saved on the device).
//
// One shared store backs every component that calls useDrugs() — Home,
// Browse, System, and Drug Detail all stay in sync off the same data.

import { useState, useEffect, useMemo } from 'react';
import SEED_DRUGS from '../data/seedDrugs.json';
import { createDeltaStore } from '../utils/deltaCollection';
import { splitDrugRecords } from '../utils/classRecords';

// Pre-process seed data once — give each drug a stable id
const SEED_WITH_IDS = SEED_DRUGS.map(d => ({
  ...d,
  id: d.generic_name.replace(/[^a-zA-Z0-9_-]/g, '_'),
  // Map seed field names → app field names
  indications: d.primary_indications || d.indications || '',
  // Marks this drug as coming from the bundled local seed file, NOT Firestore.
  // Existence checks (e.g. "already in database" in AI class save) must ignore
  // seed drugs — they are display-only fallbacks and do not exist in the DB.
  _seed: true,
}));

// No limit on purpose: this hook backs Home, Browse, System, and Drug Detail
// app-wide, so capping it would silently hide drugs everywhere.
const store = createDeltaStore({ path: 'drugs', field: 'last_updated' });

let liveDrugs = null; // most recent data, so later mounts start with it

// useDrugs()                         -> real drugs only. Class records (NSAIDs (e.g., ...))
//                                       are headings, never drugs, so every screen is
//                                       protected from them by default.
// useDrugs({ includeClasses: true }) -> raw list, for admin clean-up screens only.
// `classRecords` is always returned so a screen can still read them if needed.
export function useDrugs({ includeClasses = false } = {}) {
  const [records, setRecords] = useState(liveDrugs || []);
  const [loading, setLoading] = useState(!liveDrugs);

  useEffect(() => {
    return store.subscribe((arr, err) => {
      let next;
      if (!arr || arr.length === 0) {
        if (err) console.warn('[useDrugs] Firestore unreachable — using local seed data:', err.message);
        else console.info('[useDrugs] Firestore empty — using local seed data');
        next = err ? (liveDrugs || SEED_WITH_IDS) : SEED_WITH_IDS;
      } else {
        next = arr;
      }
      liveDrugs = next;
      setRecords(next);
      setLoading(false);
    });
  }, []);

  // Memoised so consumers get a stable array reference between renders.
  const split = useMemo(() => splitDrugRecords(records), [records]);

  return {
    drugs: includeClasses ? records : split.drugs,
    classRecords: split.classes,
    loading,
  };
}
