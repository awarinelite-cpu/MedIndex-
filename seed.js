/**
 * seed.js — Upload all Nurses Companion drug data to MedIndex Firestore
 *
 * Usage:
 *   1. Create a .env file in project root with your Firebase credentials:
 *        REACT_APP_FIREBASE_API_KEY=...
 *        REACT_APP_FIREBASE_AUTH_DOMAIN=...
 *        REACT_APP_FIREBASE_PROJECT_ID=...
 *        REACT_APP_FIREBASE_APP_ID=...
 *
 *   2. Run:  node seed.js
 *
 *   This is a one-time operation. Safe to re-run — uses drug name as
 *   document ID so duplicates just overwrite, not duplicate.
 *
 * Source: 280 drugs from Nurses Companion (CNS + CVS + General)
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, serverTimestamp } = require('firebase/firestore');
const drugs = require('./src/data/seedDrugs.json');
require('dotenv').config();

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function seed() {
  console.log(`\n🔬 MedIndex Seed — uploading ${drugs.length} drugs...\n`);

  let uploaded = 0;
  let failed   = 0;

  for (const drug of drugs) {
    try {
      // Use sanitised drug name as document ID (avoids duplicates on re-run)
      const docId = drug.generic_name.replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'drugs', docId), {
        ...drug,
        created_at:   serverTimestamp(),
        last_updated: serverTimestamp(),
      });
      uploaded++;
      if (uploaded % 20 === 0) {
        process.stdout.write(`  ✓ ${uploaded}/${drugs.length}\r`);
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${drug.generic_name} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Done! ${uploaded} uploaded, ${failed} failed.\n`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
