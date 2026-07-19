// src/components/DuplicateDrugsPanel.js
import React, { useState, useMemo } from 'react';
import { doc, getDoc, setDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { Copy, ChevronDown, ChevronRight, AlertTriangle, Check, Trash2, RefreshCw, X } from 'lucide-react';
import { db } from '../firebase';
import { findDuplicateDrugGroups } from '../utils/findDuplicateDrugs';

// One row inside a duplicate group: a radio to mark it the keeper, or a
// checkbox to mark it for deletion when it isn't the keeper.
function DrugRow({ drug, isKeeper, willDelete, onMakeKeeper, onToggleDelete }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isKeeper ? 'bg-green-50' : willDelete ? 'bg-red-50' : 'bg-gray-50'}`}>
      <button
        onClick={onMakeKeeper}
        title="Keep this record"
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isKeeper ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}
      >
        {isKeeper && <Check className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-drug-text truncate">
          {drug.generic_name}
          {drug._seed && <span className="ml-2 text-xs text-amber-600 font-normal">(seed)</span>}
        </div>
        <div className="text-xs text-drug-muted truncate">
          {drug.drug_class || '—'}{drug.drug_subclass ? ` · ${drug.drug_subclass}` : ''}
        </div>
      </div>
      {isKeeper ? (
        <span className="flex-shrink-0 text-xs font-semibold text-green-700 px-2 py-1 rounded bg-green-100">Keep</span>
      ) : (
        <label className="flex-shrink-0 flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={willDelete} onChange={onToggleDelete} className="rounded" />
          <span className={willDelete ? 'text-red-700 font-medium' : 'text-drug-muted'}>Delete</span>
        </label>
      )}
    </div>
  );
}

function GroupCard({ group, tier, selection, setSelection, onDismiss }) {
  const [open, setOpen] = useState(false);
  const sel = selection[group.key] || { keeperId: group.drugs[0].firestoreId, deleteIds: new Set() };
  const deleteCount = sel.deleteIds.size;

  const update = (patch) => setSelection(prev => ({ ...prev, [group.key]: { ...sel, ...patch } }));
  const makeKeeper = (id) => {
    const deleteIds = new Set(group.drugs.map(d => d.firestoreId).filter(x => x !== id));
    // Preserve which non-keepers were already unchecked, for the review tier.
    if (tier === 'review') { for (const d of group.drugs) if (!sel.deleteIds.has(d.firestoreId) && d.firestoreId !== id) deleteIds.delete(d.firestoreId); }
    update({ keeperId: id, deleteIds });
  };
  const toggleDelete = (id) => {
    const deleteIds = new Set(sel.deleteIds);
    deleteIds.has(id) ? deleteIds.delete(id) : deleteIds.add(id);
    update({ deleteIds });
  };

  return (
    <div className="border border-drug-border rounded-lg overflow-hidden">
      <div className="w-full flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-gray-50">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {open ? <ChevronDown className="w-4 h-4 text-drug-muted flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-drug-muted flex-shrink-0" />}
          <span className="font-medium text-drug-text truncate">{group.drugs[0].generic_name}</span>
          <span className="text-xs text-drug-muted flex-shrink-0">{group.drugs.length} records</span>
          {deleteCount > 0 && <span className="text-xs font-semibold text-red-600 flex-shrink-0">−{deleteCount}</span>}
        </button>
        {tier === 'review' && onDismiss && (
          <button
            onClick={() => onDismiss(group)}
            title="Not a duplicate — different products, don't flag again"
            className="flex-shrink-0 flex items-center gap-1 text-xs text-drug-muted hover:text-drug-text px-2 py-1 rounded hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" /> Not a duplicate
          </button>
        )}
      </div>
      {open && (
        <div className="p-2 space-y-1.5 border-t border-drug-border bg-gray-50/50">
          {tier === 'review' && group.reason && (
            <p className="text-xs text-amber-700 px-1 pb-1">⚠ {group.reason} — confirm these are really the same drug before deleting either.</p>
          )}
          {group.drugs.map(d => (
            <DrugRow
              key={d.firestoreId}
              drug={d}
              isKeeper={sel.keeperId === d.firestoreId}
              willDelete={sel.deleteIds.has(d.firestoreId)}
              onMakeKeeper={() => makeKeeper(d.firestoreId)}
              onToggleDelete={() => toggleDelete(d.firestoreId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Persisted so a group of similarly-named-but-different products (e.g.
// different brands, or different strengths that slipped past the numeric
// guard) doesn't get flagged again on every future scan once an admin has
// confirmed it isn't a duplicate.
const DISMISS_DOC = ['admin_settings', 'duplicate_review_dismissals'];

export default function DuplicateDrugsPanel({ drugs, onCleaned, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [exact, setExact] = useState([]);
  const [review, setReview] = useState([]);
  const [selection, setSelection] = useState({}); // key -> { keeperId, deleteIds: Set }
  const [applying, setApplying] = useState(false);

  const scan = async () => {
    const { exact: e, review: rAll } = findDuplicateDrugGroups(drugs);
    let dismissedKeys = new Set();
    try {
      const snap = await getDoc(doc(db, ...DISMISS_DOC));
      if (snap.exists() && Array.isArray(snap.data().keys)) dismissedKeys = new Set(snap.data().keys);
    } catch { /* if this fails, just show everything — no harm done */ }
    const r = rAll.filter(g => !dismissedKeys.has(g.dismissKey));

    setExact(e);
    setReview(r);
    // Pre-select every non-keeper as "delete" for exact matches only.
    const initial = {};
    for (const g of e) {
      const keeperId = g.drugs[0].firestoreId;
      initial[g.key] = { keeperId, deleteIds: new Set(g.drugs.slice(1).map(d => d.firestoreId)) };
    }
    for (const g of r) {
      initial[g.key] = { keeperId: g.drugs[0].firestoreId, deleteIds: new Set() }; // needs manual confirmation
    }
    setSelection(initial);
    setScanned(true);
  };

  const dismiss = async (group) => {
    setReview(prev => prev.filter(g => g.dismissKey !== group.dismissKey));
    setSelection(prev => { const n = { ...prev }; delete n[group.key]; return n; });
    try {
      await setDoc(doc(db, ...DISMISS_DOC), { keys: arrayUnion(group.dismissKey) }, { merge: true });
    } catch (err) {
      showToast && showToast('Could not save that as "not a duplicate" — it may reappear on the next scan.', 'error');
    }
  };

  const totalToDelete = useMemo(
    () => Object.values(selection).reduce((sum, s) => sum + s.deleteIds.size, 0),
    [selection]
  );

  const apply = async () => {
    setApplying(true);
    try {
      const ops = []; // { type: 'update'|'delete', id, data? }
      const allGroups = [...exact, ...review];
      for (const g of allGroups) {
        const sel = selection[g.key];
        if (!sel || sel.deleteIds.size === 0) continue;
        const losers = g.drugs.filter(d => sel.deleteIds.has(d.firestoreId));
        // Carry forward any taxonomy/condition links the losers had onto the keeper,
        // so deleting a duplicate never silently drops a manual classification.
        const extraSubclasses = losers.flatMap(d => Array.isArray(d.extra_subclasses) ? d.extra_subclasses : []);
        const conditionTags = losers.flatMap(d => Array.isArray(d.condition_tags) ? d.condition_tags : []);
        if (extraSubclasses.length || conditionTags.length) {
          const data = {};
          if (extraSubclasses.length) data.extra_subclasses = arrayUnion(...extraSubclasses);
          if (conditionTags.length) data.condition_tags = arrayUnion(...conditionTags);
          ops.push({ type: 'update', id: sel.keeperId, data });
        }
        for (const loser of losers) ops.push({ type: 'delete', id: loser.firestoreId });
      }

      const BATCH = 400; // stay well under Firestore's 500-op limit even with update+delete pairs
      for (let i = 0; i < ops.length; i += BATCH) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + BATCH)) {
          const ref = doc(db, 'drugs', op.id);
          if (op.type === 'update') batch.update(ref, op.data);
          else batch.delete(ref);
        }
        await batch.commit();
      }

      const deletedIds = new Set(ops.filter(o => o.type === 'delete').map(o => o.id));
      onCleaned && onCleaned(deletedIds);
      showToast && showToast(`Removed ${deletedIds.size} duplicate record${deletedIds.size === 1 ? '' : 's'}.`);
      setScanned(false);
      setExact([]);
      setReview([]);
      setSelection({});
    } catch (err) {
      showToast && showToast('Duplicate cleanup failed: ' + err.message, 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="bg-white border border-drug-border rounded-xl p-5 space-y-4">
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-start gap-3 text-left">
        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Copy className="w-5 h-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-drug-text flex items-center gap-2">
            Find duplicate drugs
            {expanded ? <ChevronDown className="w-4 h-4 text-drug-muted" /> : <ChevronRight className="w-4 h-4 text-drug-muted" />}
          </h3>
          <p className="text-sm text-drug-muted leading-relaxed mt-0.5">
            Scans every drug record for the same drug saved more than once. This only
            looks at duplicate <em>records</em>, not classes or subclasses — a drug
            correctly appearing under several classes/subclasses from a single record
            is left alone. Exact name matches are pre-selected for cleanup; anything
            just similar (possible typo or a different formulation) is flagged for you
            to confirm before anything is deleted.
          </p>
        </div>
      </button>

      {expanded && (
      <>
      {!scanned ? (
        <button onClick={scan} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
          <Copy className="w-4 h-4" /> Scan for duplicates
        </button>
      ) : (
        <>
          {exact.length === 0 && review.length === 0 ? (
            <p className="text-sm text-green-700 flex items-center gap-2"><Check className="w-4 h-4" /> No duplicates found.</p>
          ) : (
            <div className="space-y-5">
              {exact.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-drug-text">Exact matches — {exact.length} group{exact.length === 1 ? '' : 's'}</h4>
                  <div className="space-y-2">
                    {exact.map(g => <GroupCard key={g.key} group={g} tier="exact" selection={selection} setSelection={setSelection} />)}
                  </div>
                </div>
              )}
              {review.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Needs review — {review.length} group{review.length === 1 ? '' : 's'}
                  </h4>
                  <div className="space-y-2">
                    {review.map(g => <GroupCard key={g.key} group={g} tier="review" selection={selection} setSelection={setSelection} onDismiss={dismiss} />)}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-drug-border">
                <button
                  onClick={apply}
                  disabled={applying || totalToDelete === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg flex items-center gap-2"
                >
                  {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete {totalToDelete} selected record{totalToDelete === 1 ? '' : 's'}
                </button>
                <button onClick={() => { setScanned(false); setExact([]); setReview([]); setSelection({}); }} className="text-sm text-drug-muted hover:text-drug-text">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}
