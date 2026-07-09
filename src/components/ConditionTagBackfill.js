// src/components/ConditionTagBackfill.js
// One-time admin tool. Display of drugs under conditions is now STRICTLY
// tag-based (a drug shows under a condition only if its condition_tags
// contains that condition's id). Older drugs have no tags yet, so this seeds
// them: for every drug, it runs a STRICT keyword match (indications only,
// whole-word) against every condition in every system and writes the matching
// condition ids into condition_tags. After running once, admins prune any
// wrong matches with the ✕ button on each condition card.

import React, { useState } from 'react';
import { collection, getDocs, doc, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Tag, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { ANATOMICAL_SYSTEMS } from '../data/anatomicalSystems';
import { suggestConditionTagsForDrug } from '../data/systemConditions';
import { useCustomConditions } from '../hooks/useCustomConditions';

export default function ConditionTagBackfill() {
  const { customConditionsBySystem } = useCustomConditions();
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null); // { drugsTagged, tagsAdded }
  const [error, setError] = useState('');

  const run = async () => {
    setState('running');
    setError('');
    setResult(null);
    try {
      const snap = await getDocs(collection(db, 'drugs'));
      const drugs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProgress({ current: 0, total: drugs.length });

      let drugsTagged = 0;
      let tagsAdded = 0;
      let batch = writeBatch(db);
      let ops = 0;

      for (let i = 0; i < drugs.length; i++) {
        const drug = drugs[i];
        setProgress({ current: i + 1, total: drugs.length });

        // Collect suggested condition ids across ALL systems (a drug can
        // legitimately belong to conditions in more than one system).
        const suggestedIds = new Set();
        for (const system of ANATOMICAL_SYSTEMS) {
          const extra = customConditionsBySystem?.[system.id] || [];
          for (const cid of suggestConditionTagsForDrug(drug, system.id, extra)) {
            suggestedIds.add(cid);
          }
        }

        // Only write drugs that gained at least one NEW tag.
        const existingTags = Array.isArray(drug.condition_tags) ? drug.condition_tags : [];
        const newIds = [...suggestedIds].filter(id => !existingTags.includes(id));
        if (newIds.length === 0) continue;

        batch.update(doc(db, 'drugs', drug.id), {
          condition_tags: arrayUnion(...newIds),
          last_updated:   serverTimestamp(),
        });
        drugsTagged += 1;
        tagsAdded   += newIds.length;
        ops += 1;

        // Firestore batches cap at 500 ops — commit and start a fresh one.
        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }

      if (ops > 0) await batch.commit();
      setResult({ drugsTagged, tagsAdded });
      setState('done');
    } catch (e) {
      setError(e.message || 'Backfill failed.');
      setState('error');
    }
  };

  // ── Resync: unlike the add-only backfill above, this reconciles each
  // drug's condition_tags to *exactly* match what the strict keyword check
  // currently supports — adding tags for conditions it now matches AND
  // removing any tag whose condition it no longer (or never genuinely)
  // matches. This is what actually cleans up drugs that were auto-tagged
  // onto a condition without truly having a matching indication. Runs as a
  // preview first since, unlike the backfill, this can remove data.
  const [resyncState,    setResyncState]    = useState('idle'); // idle | previewing | previewed | applying | done | error
  const [resyncProgress, setResyncProgress] = useState({ current: 0, total: 0 });
  const [resyncPreview,  setResyncPreview]  = useState(null); // { changes[], tagsToAdd, tagsToRemove }
  const [resyncError,    setResyncError]    = useState('');

  const previewResync = async () => {
    setResyncState('previewing');
    setResyncError('');
    setResyncPreview(null);
    try {
      const snap = await getDocs(collection(db, 'drugs'));
      const drugs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setResyncProgress({ current: 0, total: drugs.length });

      const changes = [];
      let tagsToAdd = 0, tagsToRemove = 0;

      for (let i = 0; i < drugs.length; i++) {
        const drug = drugs[i];
        setResyncProgress({ current: i + 1, total: drugs.length });

        const suggestedIds = new Set();
        for (const system of ANATOMICAL_SYSTEMS) {
          const extra = customConditionsBySystem?.[system.id] || [];
          for (const cid of suggestConditionTagsForDrug(drug, system.id, extra)) suggestedIds.add(cid);
        }

        const existingTags = Array.isArray(drug.condition_tags) ? drug.condition_tags : [];
        const toAdd    = [...suggestedIds].filter(id => !existingTags.includes(id));
        const toRemove = existingTags.filter(id => !suggestedIds.has(id));

        if (toAdd.length > 0 || toRemove.length > 0) {
          changes.push({ id: drug.id, name: drug.generic_name || '(unnamed)', toAdd, toRemove, finalTags: [...suggestedIds] });
          tagsToAdd    += toAdd.length;
          tagsToRemove += toRemove.length;
        }
      }

      setResyncPreview({ changes, tagsToAdd, tagsToRemove });
      setResyncState('previewed');
    } catch (e) {
      setResyncError(e.message || 'Preview failed.');
      setResyncState('error');
    }
  };

  const applyResync = async () => {
    if (!resyncPreview || resyncPreview.changes.length === 0) return;
    setResyncState('applying');
    try {
      let batch = writeBatch(db);
      let ops = 0;
      for (const change of resyncPreview.changes) {
        batch.update(doc(db, 'drugs', change.id), {
          condition_tags: change.finalTags,
          last_updated:   serverTimestamp(),
        });
        ops += 1;
        if (ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; }
      }
      if (ops > 0) await batch.commit();
      setResyncState('done');
    } catch (e) {
      setResyncError(e.message || 'Resync failed.');
      setResyncState('error');
    }
  };

  const cancelResyncPreview = () => { setResyncPreview(null); setResyncState('idle'); };

  return (
    <div className="mb-6 border border-primary-200 bg-primary-50/40 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Tag className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-drug-text">Backfill condition tags</h3>
          <p className="text-sm text-drug-muted mt-1">
            Drugs now show under a condition only when explicitly tagged. Run this
            once to tag existing drugs to their conditions automatically (strict
            match on indications). Afterwards, remove any wrong matches with the ✕
            button on each condition card. Safe to run more than once — it only
            adds missing tags, never removes.
          </p>

          {state === 'running' && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-sm text-primary-700">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Tagging drugs… {progress.current} / {progress.total}
              </div>
              <div className="mt-2 h-2 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {state === 'done' && result && (
            <p className="mt-3 text-sm text-green-700 inline-flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Done — tagged {result.drugsTagged} drug{result.drugsTagged !== 1 ? 's' : ''} ({result.tagsAdded} condition link{result.tagsAdded !== 1 ? 's' : ''} added). Refresh a system page to see them.
            </p>
          )}

          {state === 'error' && (
            <p className="mt-3 text-sm text-red-600 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {error}
            </p>
          )}

          {state !== 'running' && (
            <button
              onClick={run}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
            >
              <Tag className="w-4 h-4" />
              {state === 'done' ? 'Run again' : state === 'error' ? 'Try again' : 'Run backfill'}
            </button>
          )}
        </div>
      </div>

      {/* ── Resync: reconciles tags both ways (add + remove) ── */}
      <div className="mt-5 pt-5 border-t border-primary-200/60">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-drug-text">Resync condition tags (adds + removes mismatches)</h3>
            <p className="text-sm text-drug-muted mt-1">
              Re-checks every drug's indications against every condition and makes each
              drug's tags match exactly — removing tags for conditions it doesn't actually
              treat, and adding any it qualifies for but is missing. Use this to clean up
              drugs that got auto-tagged onto the wrong condition. Shows a preview before
              writing anything.
            </p>

            {resyncState === 'previewing' && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking drugs… {resyncProgress.current} / {resyncProgress.total}
                </div>
                <div className="mt-2 h-2 bg-amber-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: resyncProgress.total ? `${(resyncProgress.current / resyncProgress.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            )}

            {resyncState === 'previewed' && resyncPreview && (
              resyncPreview.changes.length === 0 ? (
                <div className="mt-3">
                  <p className="text-sm text-green-700 inline-flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Nothing to change — every drug's tags already match its indications.
                  </p>
                  <button
                    onClick={cancelResyncPreview}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-drug-border rounded-lg text-sm font-semibold hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="mt-3 bg-white border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-drug-text">
                    {resyncPreview.changes.length} drug{resyncPreview.changes.length !== 1 ? 's' : ''} affected —{' '}
                    <span className="text-green-700">+{resyncPreview.tagsToAdd} tag{resyncPreview.tagsToAdd !== 1 ? 's' : ''} to add</span>
                    {', '}
                    <span className="text-red-600">−{resyncPreview.tagsToRemove} tag{resyncPreview.tagsToRemove !== 1 ? 's' : ''} to remove</span>
                  </p>
                  <div className="mt-2 max-h-40 overflow-y-auto text-xs text-drug-muted space-y-1 border-t border-drug-border pt-2">
                    {resyncPreview.changes.slice(0, 25).map(c => (
                      <div key={c.id} className="truncate">
                        <span className="font-medium text-drug-text">{c.name}</span>
                        {c.toAdd.length > 0 && <span className="text-green-700"> +{c.toAdd.length}</span>}
                        {c.toRemove.length > 0 && <span className="text-red-600"> −{c.toRemove.length}</span>}
                      </div>
                    ))}
                    {resyncPreview.changes.length > 25 && (
                      <div>…and {resyncPreview.changes.length - 25} more</div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={applyResync}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700"
                    >
                      Apply resync
                    </button>
                    <button
                      onClick={cancelResyncPreview}
                      className="px-4 py-2 bg-white border border-drug-border rounded-lg text-sm font-semibold hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            )}

            {resyncState === 'applying' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-700">
                <RefreshCw className="w-4 h-4 animate-spin" /> Writing changes…
              </div>
            )}

            {resyncState === 'done' && (
              <p className="mt-3 text-sm text-green-700 inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Resync complete. Refresh a system page to see the changes.
              </p>
            )}

            {resyncState === 'error' && (
              <p className="mt-3 text-sm text-red-600 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> {resyncError}
              </p>
            )}

            {(resyncState === 'idle' || resyncState === 'done' || resyncState === 'error') && (
              <button
                onClick={previewResync}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-50"
              >
                <RefreshCw className="w-4 h-4" />
                {resyncState === 'done' ? 'Preview resync again' : resyncState === 'error' ? 'Try again' : 'Preview resync'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
