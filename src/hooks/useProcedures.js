// src/hooks/useProcedures.js
// Single source of truth for the procedure list. Mirrors useDrugs.js: one
// shared delta-synced store (utils/deltaCollection.js) backs every component
// that calls useProcedures() — the list comes from the device first and only
// procedures that changed since the last sync are downloaded, kept live so any
// write (AI save, admin edit, review approval) reaches every screen within
// about a second, no reload needed.

import { useState, useEffect } from 'react';
import { createDeltaStore } from '../utils/deltaCollection';

const store = createDeltaStore({ path: 'procedures', field: 'last_updated' });

let liveProcedures = null;

export function useProcedures() {
  const [procedures, setProcedures] = useState(liveProcedures || []);
  const [loading, setLoading]       = useState(!liveProcedures);

  useEffect(() => {
    return store.subscribe((arr, err) => {
      if (err) console.warn('[useProcedures] sync problem:', err.message);
      const next = arr || liveProcedures || [];
      liveProcedures = next;
      setProcedures(next);
      setLoading(false);
    });
  }, []);

  return { procedures, loading };
}
