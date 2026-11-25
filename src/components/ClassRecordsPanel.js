// src/components/ClassRecordsPanel.js
// Admin-only. Lists records in `drugs` that look like drug CLASSES (e.g.
// "NSAIDs (e.g., Ibuprofen, Naproxen)") and lets the admin confirm each one.
//   Mark as class   -> record_type: 'class'  (hidden from every drug list/search)
//   Keep as drug    -> record_type: 'drug'   (never treated as a class again)
// Marking a class also moves its example drugs into the same conditions: e.g.
// "ARBs" (sub-heading "…(e.g., Losartan, Valsartan)") makes Losartan and
// Valsartan appear in the conditions that listed ARBs — existing drugs get the
// condition + heading, missing ones are created as name-only drugs.
// Nothing is deleted. Works on a phone — no terminal needed.
import React, { useMemo, useState } from 'react';
import { writeBatch, doc, serverTimestamp, arrayUnion, FieldPath } from 'firebase/firestore';
import { Layers, Check, X } from 'lucide-react';
import { db } from '../firebase';
import { isClassRecord, classExampleNames } from '../utils/classRecords';
import { drugMatchKey } from '../utils/drugNameKey';
import { slugifyDrugName } from '../utils/aiDrugSave';

const docIdOf = (d) => d.firestoreId || d.id;

export default function ClassRecordsPanel({ drugs, showToast }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [handled, setHandled] = useState(() => new Set());

  // Detected by the rules but not yet confirmed either way.
  const pending = useMemo(
    () => (drugs || []).filter(d => !d._seed && !handled.has(docIdOf(d))
      && d.record_type !== 'class' && d.record_type !== 'drug' && isClassRecord(d)),
    [drugs, handled]
  );
  const flaggedCount = useMemo(
    () => (drugs || []).filter(d => d.record_type === 'class').length,
    [drugs]
  );

  // Real drugs by name, so a class's example drugs can be matched.
  const realByKey = useMemo(() => {
    const m = new Map();
    (drugs || []).forEach(d => { if (!isClassRecord(d)) { const k = drugMatchKey(d.generic_name); if (k && !m.has(k)) m.set(k, d); } });
    return m;
  }, [drugs]);

  async function expandClass(d) {
    const tags = Array.isArray(d.condition_tags) ? d.condition_tags : [];
    const groups = d.condition_groups || {};
    const roles = d.condition_roles || {};
    if (!tags.length) return 0;
    const batch = writeBatch(db);
    let created = 0;
    for (const ex of classExampleNames(d)) {
      const existing = realByKey.get(drugMatchKey(ex));
      if (existing) {
        const ref = doc(db, 'drugs', docIdOf(existing));
        batch.update(ref, { condition_tags: arrayUnion(...tags), last_updated: serverTimestamp() });
        for (const [cid, g] of Object.entries(groups)) {
          if (!existing.condition_groups?.[cid]) batch.update(ref, new FieldPath('condition_groups', cid), g, 'last_updated', serverTimestamp());
        }
      } else {
        batch.set(doc(db, 'drugs', slugifyDrugName(ex)), {
          generic_name: ex, drug_class: 'Unknown', prescription_status: 'Prescription',
          source: 'Class expansion', status: 'Active', info_pending: true,
          condition_tags: tags, condition_groups: groups, condition_roles: roles,
          created_at: serverTimestamp(), last_updated: serverTimestamp(),
        }, { merge: true });
        created += 1;
      }
    }
    await batch.commit();
    return created;
  }

  async function apply(items, recordType) {
    if (!items.length || busy) return;
    setBusy(true);
    try {
      let created = 0;
      for (const d of items) {
        if (recordType === 'class') created += await expandClass(d);
      }
      for (let i = 0; i < items.length; i += 400) {
        const batch = writeBatch(db);
        items.slice(i, i + 400).forEach(d =>
          batch.update(doc(db, 'drugs', docIdOf(d)), { record_type: recordType, last_updated: serverTimestamp() }));
        await batch.commit();
      }
      setHandled(prev => { const n = new Set(prev); items.forEach(d => n.add(docIdOf(d))); return n; });
      showToast?.(recordType === 'class'
        ? `${items.length} marked as class${items.length === 1 ? '' : 'es'}${created ? `, ${created} example drug${created === 1 ? '' : 's'} added` : ''}`
        : 'Kept as drug');
    } catch (e) {
      showToast?.(e.message || 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!pending.length && !flaggedCount) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-amber-900">
        <Layers size={16} />
        {pending.length
          ? `${pending.length} record${pending.length === 1 ? '' : 's'} look like drug classes, not drugs`
          : 'Drug classes are hidden from drug lists'}
        <span className="ml-auto text-xs font-normal">{open ? 'Hide' : 'Review'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {pending.length > 0 && (
            <button type="button" disabled={busy} onClick={() => apply(pending, 'class')}
              className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Saving…' : `Mark all ${pending.length} as classes`}
            </button>
          )}
          {pending.map(d => (
            <div key={docIdOf(d)} className="flex items-center gap-2 rounded-lg bg-white p-2 text-sm">
              <div className="min-w-0 flex-1 break-words font-medium text-slate-800">{d.generic_name}</div>
              <button type="button" disabled={busy} onClick={() => apply([d], 'class')}
                className="rounded-md bg-amber-100 p-1.5 text-amber-800" title="Mark as class" aria-label="Mark as class">
                <Check size={16} />
              </button>
              <button type="button" disabled={busy} onClick={() => apply([d], 'drug')}
                className="rounded-md bg-slate-100 p-1.5 text-slate-700" title="Keep as drug" aria-label="Keep as drug">
                <X size={16} />
              </button>
            </div>
          ))}
          {!pending.length && (
            <p className="text-xs text-amber-900">
              {flaggedCount} record{flaggedCount === 1 ? ' is' : 's are'} marked as classes and shown only as subheadings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
