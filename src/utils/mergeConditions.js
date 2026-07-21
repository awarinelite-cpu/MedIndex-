// src/utils/mergeConditions.js
//
// Merges N "duplicate" condition cards into one surviving "primary"
// condition within a system — for cases like "Aortic Aneurysm" /
// "Aneurysm, Aortic" / "Aortic Aneurysm & Dissection" that the AI/import
// process created as separate cards for what a clinician would treat as one
// entry. Renaming (see renameCondition) only relabels a single card; this
// actually consolidates two or more into one.
//
// What it does, in order:
//   1. Re-tags every drug that has any duplicate id in its condition_tags:
//      add the primary id, remove all duplicate ids (deduped either way).
//   2. Removes each duplicate condition from the system's taxonomy, reusing
//      removeCondition's existing custom-vs-seeded handling (delete outright
//      if custom, record as "hidden" if seeded — never touches the drugs'
//      own data).
//   3. If the primary has no saved clinical info yet but a duplicate does,
//      copies the first duplicate's clinical info onto the primary, then
//      deletes the duplicates' clinical info docs so nothing orphaned is
//      left behind under a hidden id.
//
// Nothing here is done inside a single atomic transaction — a failure
// partway through (e.g. network drop after the drug re-tag batch commits
// but before a duplicate is hidden) is safe to just retry with the same
// primary/duplicate selection; every step is idempotent.

import { writeBatch, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { removeCondition } from '../hooks/useCustomConditions';

const CLINICAL_INFO_COLLECTION = 'condition_clinical_info';

/**
 * @param {string} systemId
 * @param {string} primaryId - condition id to keep
 * @param {string[]} duplicateIds - condition ids to merge away (must not include primaryId)
 * @param {Array} allDrugs - the full drug list (e.g. from useDrugs()), used to find affected drugs client-side
 * @returns {Promise<{ drugsUpdated: number, conditionsRemoved: number }>}
 */
export async function mergeConditions(systemId, primaryId, duplicateIds, allDrugs) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please sign in as admin and try again.');

  const dupSet = new Set((duplicateIds || []).filter(id => id && id !== primaryId));
  if (dupSet.size === 0) throw new Error('Select at least one duplicate condition to merge (besides the primary).');

  // ── 1. Re-tag affected drugs ──────────────────────────────────────────
  const affected = (allDrugs || []).filter(d =>
    Array.isArray(d.condition_tags) && d.condition_tags.some(id => dupSet.has(id))
  );

  // Firestore batches cap at 500 writes — chunk if a merge somehow affects
  // more drugs than that (very unlikely for a single condition merge, but
  // cheap to guard against).
  const CHUNK = 450;
  for (let i = 0; i < affected.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const drug of affected.slice(i, i + CHUNK)) {
      const nextTags = Array.from(new Set(
        drug.condition_tags
          .filter(id => !dupSet.has(id))
          .concat(primaryId)
      ));
      batch.update(doc(db, 'drugs', drug.id), {
        condition_tags: nextTags,
        last_updated: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // ── 2. Consolidate clinical info (best-effort — never blocks the merge) ─
  try {
    const primaryRef = doc(db, CLINICAL_INFO_COLLECTION, primaryId);
    const primarySnap = await getDoc(primaryRef);
    if (!primarySnap.exists()) {
      for (const dupId of dupSet) {
        const dupRef = doc(db, CLINICAL_INFO_COLLECTION, dupId);
        const dupSnap = await getDoc(dupRef);
        if (dupSnap.exists()) {
          await setDoc(primaryRef, { ...dupSnap.data(), generatedAt: serverTimestamp() });
          break; // first one found wins — good enough, admin can regenerate if needed
        }
      }
    }
    for (const dupId of dupSet) {
      try { await deleteDoc(doc(db, CLINICAL_INFO_COLLECTION, dupId)); } catch { /* no-op if missing */ }
    }
  } catch (err) {
    console.warn('[mergeConditions] clinical info consolidation skipped:', err.message);
  }

  // ── 3. Remove duplicates from the taxonomy ──────────────────────────────
  for (const dupId of dupSet) {
    await removeCondition(systemId, dupId);
  }

  return { drugsUpdated: affected.length, conditionsRemoved: dupSet.size };
}
