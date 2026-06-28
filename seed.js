// seed.js — Seeds 280 drugs from seedDrugs.json into Firestore
// Run from the project root:  node seed.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

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

const drugs = JSON.parse(readFileSync('./src/data/seedDrugs.json', 'utf8'));

async function seed() {
  console.log(`\n🌱 Seeding ${drugs.length} drugs into Firestore...\n`);

  const BATCH_SIZE = 499;
  let total = 0;

  for (let i = 0; i < drugs.length; i += BATCH_SIZE) {
    const chunk = drugs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(drug => {
      const id  = drug.id || drug.generic_name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const ref = doc(db, 'drugs', id);
      batch.set(ref, {
        ...drug,
        status:       drug.status || 'Active',
        source:       drug.source || 'Seed Data',
        last_updated: serverTimestamp(),
        created_at:   serverTimestamp(),
      });
    });

    await batch.commit();
    total += chunk.length;
    console.log(`  ✓ ${total} / ${drugs.length} written`);
  }

  console.log(`\n✅ Done! ${total} drugs seeded successfully.\n`);
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err.message, '\n');
  process.exit(1);
});
