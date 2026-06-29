// deleteAllDrugs.js — Deletes ALL documents from the Firestore 'drugs' collection
// This is the live database the deployed app reads from.
//
// ⚠️  DESTRUCTIVE — this empties the entire drugs collection.
// Your local seed file (src/data/seedDrugs.json) is NOT touched —
// you can re-seed afterward by running:  node seed.js
//
// Run from the project root:  node deleteAllDrugs.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

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

const BATCH_SIZE = 499; // Firestore batch write limit is 500

async function deleteAllDrugs() {
  console.log(`\n🗑️  Fetching all documents in 'drugs' collection...\n`);

  const snap = await getDocs(collection(db, 'drugs'));
  const docs = snap.docs;

  if (docs.length === 0) {
    console.log('✅ Collection is already empty — nothing to delete.\n');
    process.exit(0);
  }

  console.log(`Found ${docs.length} drugs. Deleting in batches of ${BATCH_SIZE}...\n`);

  let total = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(d => batch.delete(doc(db, 'drugs', d.id)));

    await batch.commit();
    total += chunk.length;
    console.log(`  ✓ ${total} / ${docs.length} deleted`);
  }

  console.log(`\n✅ Done! All ${total} drugs deleted from Firestore.`);
  console.log(`   Run "node seed.js" when you're ready to load new data.\n`);
  process.exit(0);
}

deleteAllDrugs().catch(err => {
  console.error('\n❌ Delete failed:', err.message, '\n');
  process.exit(1);
});
