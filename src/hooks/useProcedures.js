// src/hooks/useProcedures.js
// Single source of truth for the procedure list. Mirrors useDrugs.js exactly:
// one shared Firestore 'procedures' listener (singleton) backs every
// component that calls useProcedures(), kept live via onSnapshot so any
// write (AI save, admin edit, review approval) reaches every screen using
// this hook within about a second, no reload needed.

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

let liveProcedures = null;
let unsubscribe     = null;
const subscribers   = new Set();

function notifyAll(procedures) {
  liveProcedures = procedures;
  subscribers.forEach(fn => fn(procedures));
}

function ensureListener() {
  if (unsubscribe) return;
  const q = query(collection(db, 'procedures'), orderBy('last_updated', 'desc'));
  unsubscribe = onSnapshot(
    q,
    (snap) => {
      notifyAll(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.warn('[useProcedures] onSnapshot failed:', err.message);
      notifyAll(liveProcedures || []);
    }
  );
}

export function useProcedures() {
  const [procedures, setProcedures] = useState(liveProcedures || []);
  const [loading, setLoading]       = useState(!liveProcedures);

  useEffect(() => {
    ensureListener();
    if (liveProcedures) setLoading(false);

    const setter = (p) => { setProcedures(p); setLoading(false); };
    subscribers.add(setter);

    return () => {
      subscribers.delete(setter);
      if (subscribers.size === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        liveProcedures = null;
      }
    };
  }, []);

  return { procedures, loading };
}
