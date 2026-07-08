import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { SYSTEM_CONDITIONS, suggestConditionTagsForDrug } from '../data/systemConditions';

// Runs after any drug is created/updated by AI (search lookup, condition
// "Save All" job, per-tab fill, admin global fix) — checks its indications
// against every system's condition keywords (built-in + admin-added custom
// ones) and tags it onto whichever conditions it matches. This is what
// makes a newly-searched drug automatically show up under the right
// condition cards without an admin manually assigning it.
//
// Best-effort: never throws — a tagging failure should never block the
// underlying drug save that triggered it.
export async function autoTagDrugConditions(docId, drug) {
  try {
    const extraSnap = await getDoc(doc(db, 'app_config', 'system_conditions_extra'));
    const extraBySystem = extraSnap.exists() ? (extraSnap.data().systems || {}) : {};

    const matchedTags = new Set();
    const allSystemIds = new Set([...Object.keys(SYSTEM_CONDITIONS), ...Object.keys(extraBySystem)]);

    for (const systemId of allSystemIds) {
      const extra = extraBySystem[systemId] || [];
      suggestConditionTagsForDrug(drug, systemId, extra).forEach(id => matchedTags.add(id));
    }

    if (matchedTags.size > 0) {
      await updateDoc(doc(db, 'drugs', docId), {
        condition_tags: arrayUnion(...matchedTags),
      });
    }
    return [...matchedTags];
  } catch (e) {
    console.warn('[autoTagDrugConditions] failed:', e.message);
    return [];
  }
}
