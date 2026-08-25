// backfillGerdTags.js — One-off backfill after splitting the old combined
// "Peptic Ulcer & GERD" condition (id: peptic_ulcer) into two conditions:
//   peptic_ulcer  — Peptic Ulcer Disease  (kept the old id)
//   gerd          — GERD (Acid Reflux)    (new id)
//
// Every drug previously tagged `peptic_ulcer` is still correctly tagged for
// Peptic Ulcer Disease (that id didn't change), but drugs that were showing
// up under the OLD combined card purely because they treat GERD (PPIs, H2
// blockers, antacids used for reflux, etc.) have no `gerd` tag yet and will
// have silently disappeared from that condition on the Browse/System pages.
//
// This script re-checks every drug currently tagged `peptic_ulcer` against
// the new `gerd` condition's keywords (using the same strict keyword-match
// logic the admin backfill uses — see drugMatchesConditionKeywords in
// src/data/systemConditions.js) and adds the `gerd` tag where it matches.
//
// Additive only, same convention as autoTagDrugConditions.js: this NEVER
// removes the existing `peptic_ulcer` tag, even from drugs that turn out to
// be GERD-only — admins prune any wrong matches manually in the app, same
// as any other auto-tag suggestion.
//
// Run from the project root:  node backfillGerdTags.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { SYSTEM_CONDITIONS, drugMatchesConditionKeywords } from './src/data/systemConditions.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAB8yCfmdvOTWRpj50Hhc7AWuabWLDvy6k",
  authDomain:        "nacon-post-utme-past-question.firebaseapp.com",
  projectId:         "nacon-post-utme-past-question",
  storageBucket:     "nacon-post-utme-past-question.firebasestorage.app",
  messagingSenderId: "1090299637128",
  appId:             "1:1090299637128:web:a055d0cc654fdf569fde3d",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const gerdCond = SYSTEM_CONDITIONS.gastrointestinal.find(c => c.id === 'gerd');
if (!gerdCond) {
  console.error("❌ Couldn't find the 'gerd' condition in SYSTEM_CONDITIONS.gastrointestinal — is systemConditions.js up to date?");
  process.exit(1);
}

async function backfillGerdTags() {
  console.log(`\n🔎 Fetching drugs currently tagged 'peptic_ulcer'...\n`);

  const snap = await getDocs(query(collection(db, 'drugs'), where('condition_tags', 'array-contains', 'peptic_ulcer')));
  console.log(`Found ${snap.size} drug(s) tagged 'peptic_ulcer'. Checking each against the new GERD keywords...\n`);

  let tagged = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    const drug = d.data();
    if (Array.isArray(drug.condition_tags) && drug.condition_tags.includes('gerd')) {
      skipped++; // already tagged, nothing to do
      continue;
    }
    const matches = drugMatchesConditionKeywords(drug, gerdCond.keywords);
    if (matches) {
      await updateDoc(doc(db, 'drugs', d.id), { condition_tags: arrayUnion('gerd') });
      console.log(`  ✅ ${drug.generic_name || d.id} → tagged 'gerd'`);
      tagged++;
    }
  }

  console.log(`\n✔️  Done. ${tagged} drug(s) newly tagged 'gerd', ${skipped} already had it, ${snap.size - tagged - skipped} did not match GERD keywords.`);
  console.log(`   (No tags were removed — review results in the admin panel and prune manually if anything looks wrong.)\n`);
}

backfillGerdTags().catch(e => {
  console.error('❌ Backfill failed:', e);
  process.exit(1);
});
