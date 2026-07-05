import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
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
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ── Ensure Firebase Auth is always signed in (anonymously if needed) ───────
// This guarantees request.auth != null for Firestore writes, even for
// unauthenticated users browsing the public app.
export async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export default app;
