import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAB8yCfmdvOTWRpj50Hhc7AWuabWLDvy6k",
  authDomain: "nacon-post-utme-past-question.firebaseapp.com",
  databaseURL: "https://nacon-post-utme-past-question-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nacon-post-utme-past-question",
  storageBucket: "nacon-post-utme-past-question.firebasestorage.app",
  messagingSenderId: "1090299637128",
  appId: "1:1090299637128:web:a055d0cc654fdf569fde3d",
  measurementId: "G-YQ5XYVLMVT"
};

const app = initializeApp(firebaseConfig);

// Persistent local cache (IndexedDB): the drugs/conditions collections stay
// live via onSnapshot as before, but every doc that's ever synced is also
// written to disk on this device. After the first successful login and
// sync, useDrugs()/useConditionClinicalInfo() resolve instantly from that
// local cache — including with no internet at all — instead of falling
// back to the (potentially stale) bundled seedDrugs.json the moment a
// request can't reach the server.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
