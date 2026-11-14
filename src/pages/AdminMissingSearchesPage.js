// src/pages/AdminMissingSearchesPage.js
// Admin-only: everything signed-in users searched for that returned nothing
// (drugs, conditions, Home search). From here the admin can add it as a
// medication or a condition, or dismiss it. Items disappear on their own once
// a matching drug/condition exists.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { SearchX, RefreshCw, Pill, Stethoscope, X, Users, Clock, Search as SearchIcon } from 'lucide-react';
import { db } from '../firebase';
import { useDrugs } from '../hooks/useDrugs';
import { SYSTEM_CONDITIONS } from '../data/systemConditions';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { useCustomConditions, addCustomConditions, slugifyConditionLabel, normalizeConditionLabel } from '../hooks/useCustomConditions';
import { createPlaceholderDrug, normalizeDrugNameForMatch } from '../utils/aiDrugSave';

const norm = (q) => String(q || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const TYPE_LABEL = { drug: 'Drug search', condition: 'Condition search', general: 'Home search' };

function timeAgo(ms) {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export default function AdminMissingSearchesPage() {
  const navigate = useNavigate();
  const { drugs } = useDrugs();
  const { customConditionsBySystem } = useCustomConditions();
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading'); // loading | done | error
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [pickFor, setPickFor] = useState(null);   // key of row choosing a body system
  const [systemId, setSystemId] = useState('');

  const load = useCallback(async () => {
    setState('loading'); setError('');
    try {
      const snap = await getDocs(query(collection(db, 'search_logs'), where('resultCount', '==', 0)));
      const byKey = new Map();
      snap.docs.forEach(d => {
        const x = d.data();
        const key = norm(x.query);
        if (!key || key.length < 3) return;
        let r = byKey.get(key);
        if (!r) { r = { key, text: x.query, count: 0, users: new Map(), types: new Set(), last: 0, docs: [], open: 0 }; byKey.set(key, r); }
        r.count += 1;
        const uKey = x.uid || x.userEmail || '?';
        const u = r.users.get(uKey) || { name: '', email: '', times: 0 };
        u.name = u.name || x.userName || '';
        u.email = u.email || x.userEmail || '';
        u.times += 1;
        r.users.set(uKey, u);
        if (x.type) r.types.add(x.type);
        r.docs.push(d.id);
        if (!x.resolved) r.open += 1;
        const t = x.createdAt?.toMillis?.() || 0;
        if (t >= r.last) { r.last = t; r.text = x.query; }
      });
      setRows([...byKey.values()].filter(r => r.open > 0).sort((a, b) => b.users.size - a.users.size || b.count - a.count || b.last - a.last));
      setState('done');
    } catch (e) {
      setError(e.message || 'Could not load searches.'); setState('error');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Names that exist now — so a search disappears once it has been added.
  const knownDrugs = useMemo(() => new Set(drugs.map(d => normalizeDrugNameForMatch(d.generic_name)).filter(Boolean)), [drugs]);
  const knownConditions = useMemo(() => {
    const set = new Set();
    Object.values(SYSTEM_CONDITIONS).flat().forEach(c => set.add(normalizeConditionLabel(c.label)));
    Object.values(customConditionsBySystem || {}).flat().forEach(c => set.add(normalizeConditionLabel(c.label)));
    return set;
  }, [customConditionsBySystem]);

  const visible = useMemo(() => rows.filter(r =>
    !knownDrugs.has(normalizeDrugNameForMatch(r.text)) && !knownConditions.has(normalizeConditionLabel(r.text))
  ), [rows, knownDrugs, knownConditions]);

  const markResolved = async (row) => {
    const batch = writeBatch(db);
    row.docs.forEach(id => batch.update(doc(db, 'search_logs', id), { resolved: true, resolvedAt: serverTimestamp() }));
    await batch.commit();
    setRows(prev => prev.filter(r => r.key !== row.key));
  };

  const run = async (row, fn) => {
    setBusyKey(row.key); setError('');
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong.'); }
    setBusyKey('');
  };

  const addAsDrug = (row) => run(row, async () => {
    const name = row.text.trim().replace(/\b\w/g, c => c.toUpperCase());
    const id = await createPlaceholderDrug(name);
    await markResolved(row);
    navigate(`/drug/${id}`);
  });

  const addAsCondition = (row) => run(row, async () => {
    if (!systemId) throw new Error('Choose a body system first.');
    const label = row.text.trim().replace(/\b\w/g, c => c.toUpperCase());
    const id = slugifyConditionLabel(label);
    await addCustomConditions(systemId, [{ id, label, icon: 'Stethoscope', keywords: [row.text.trim().toLowerCase()] }]);
    await markResolved(row);
    setPickFor(null); setSystemId('');
    navigate(`/condition/${systemId}/${id}`);
  });

  const dismiss = (row) => run(row, () => markResolved(row));

  return (
    <div className="max-w-3xl mx-auto p-4 pb-28">
      <div className="flex items-center gap-2 mb-1">
        <SearchX className="w-6 h-6 text-violet-600" />
        <h1 className="text-xl font-extrabold text-gray-900">Missing searches</h1>
        <button type="button" onClick={load} className="ml-auto p-2 rounded-full border border-gray-300 text-gray-600" aria-label="Refresh">
          <RefreshCw className={`w-4 h-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Medications and conditions that signed-in users searched for but were not found. Add them to the system, or dismiss the ones you don't need.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {state === 'loading' && <p className="text-sm text-gray-500">Loading…</p>}
      {state === 'done' && visible.length === 0 && (
        <p className="p-4 rounded-xl bg-green-50 text-green-800 text-sm font-semibold">Nothing missing right now. New unfound searches will appear here.</p>
      )}

      <ul className="space-y-3">
        {visible.map(r => {
          const busy = busyKey === r.key;
          const typeText = [...r.types].map(t => TYPE_LABEL[t]).filter(Boolean).join(' · ') || 'Search';
          return (
            <li key={r.key} className="rounded-2xl border border-violet-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-extrabold text-gray-900 break-words">{r.text}</p>
                  <p className="mt-1 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1"><SearchIcon className="w-3 h-3" /> {r.count}× · {typeText}</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {r.users.size} user{r.users.size === 1 ? '' : 's'}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(r.last)}</span>
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {[...r.users.values()].slice(0, 5).map((u, i) => (
                      <li key={i} className="text-xs text-gray-700 break-words">
                        <span className="font-semibold">{u.name || u.email || 'Unknown user'}</span>
                        {u.name && u.email ? <span className="text-gray-500"> · {u.email}</span> : null}
                        {u.times > 1 ? <span className="text-gray-400"> ({u.times}×)</span> : null}
                      </li>
                    ))}
                    {r.users.size > 5 && <li className="text-xs text-gray-400">+ {r.users.size - 5} more</li>}
                  </ul>
                </div>
                <button type="button" onClick={() => dismiss(r)} disabled={busy} aria-label={`Dismiss ${r.text}`} title="Dismiss"
                  className="p-1.5 rounded-full bg-gray-100 text-gray-500 disabled:opacity-50"><X className="w-4 h-4" /></button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => addAsDrug(r)} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">
                  <Pill className="w-4 h-4" /> Add as medication
                </button>
                <button type="button" onClick={() => { setPickFor(pickFor === r.key ? null : r.key); setSystemId(''); }} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-violet-400 text-violet-700 text-sm font-semibold disabled:opacity-50">
                  <Stethoscope className="w-4 h-4" /> Add as condition
                </button>
              </div>

              {pickFor === r.key && (
                <div className="mt-3 flex gap-2">
                  <select value={systemId} onChange={e => setSystemId(e.target.value)}
                    className="flex-1 rounded-lg border border-violet-200 bg-white px-2 py-2 text-sm">
                    <option value="">Choose body system…</option>
                    {ANATOMICAL_SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="button" onClick={() => addAsCondition(r)} disabled={busy || !systemId}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">Add</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
