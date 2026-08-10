// src/utils/mergeDrugClasses.js
//
// Merges N "duplicate" drug-class labels into one surviving "primary" class
// — for cases like "Anticoagulant" / "Anticoagulants" / "Anticoagulants
// (For specific complications)" that different AI-generation or import
// passes created as separate labels for what a clinician would treat as one
// class. Mirrors mergeConditions.js, but drug_class is a single field on
// each drug record with no per-system boundary, so this always operates
// globally: every drug anywhere in the database whose drug_class matches a
// duplicate label gets re-labeled to the primary, regardless of which
// condition(s)/system(s) it happens to be tagged under.
//
// What it does, in order:
//   1. Finds every drug whose drug_class (or drug_subclass, if it happens to
//      duplicate the class name — some older records did this) matches any
//      of the duplicate labels.
//   2. Batch-updates those drugs' drug_class (and drug_subclass, where
//      applicable) to the primary label.
//
// Nothing here needs a taxonomy list to clean up afterwards — unlike
// conditions, drug classes aren't a separate collection, they're just a
// string on each drug, so once every drug is re-labeled the duplicate class
// simply stops appearing anywhere (no orphaned record left behind).
// Idempotent — safe to retry with the same primary/duplicate selection if a
// batch fails partway through.

import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * @param {string} primaryClassName - class label to keep
 * @param {string[]} duplicateClassNames - class labels to merge away (must not include primary)
 * @param {Array} allDrugs - the full drug list (e.g. from useDrugs()), used to find affected drugs client-side
 * @returns {Promise<{ drugsUpdated: number, classesRemoved: number }>}
 */
export async function mergeDrugClasses(primaryClassName, duplicateClassNames, allDrugs) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please sign in as admin and try again.');

  const primary = (primaryClassName || '').trim();
  if (!primary) throw new Error('Pick a class to keep.');

  const dupSet = new Set(
    (duplicateClassNames || []).map(c => (c || '').trim()).filter(c => c && c !== primary)
  );
  if (dupSet.size === 0) throw new Error('Select at least one duplicate class to merge (besides the one you keep).');

  const affected = (allDrugs || []).filter(d => dupSet.has((d.drug_class || '').trim()));

  // Firestore batches cap at 500 writes — chunk if a merge somehow affects
  // more drugs than that.
  const CHUNK = 450;
  for (let i = 0; i < affected.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const drug of affected.slice(i, i + CHUNK)) {
      const update = { drug_class: primary, last_updated: serverTimestamp() };
      if (dupSet.has((drug.drug_subclass || '').trim())) {
        update.drug_subclass = primary;
      }
      batch.update(doc(db, 'drugs', drug.id), update);
    }
    await batch.commit();
  }

  return { drugsUpdated: affected.length, classesRemoved: dupSet.size };
}
