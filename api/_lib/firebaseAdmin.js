// ── firebaseAdmin.js ──────────────────────────────────────────────────────
// Server-only Firebase Admin SDK setup, used by /api/admin/* routes to do
// things the public client SDK can never do: list every Auth user, disable
// or delete an account, etc. This must never be imported into client code —
// it needs a service account key, which is a full-access credential.
//
// Requires ONE of these environment variables (set in Vercel project
// settings, not in the repo):
//   FIREBASE_SERVICE_ACCOUNT_BASE64  — the service account JSON, base64-encoded
//   FIREBASE_SERVICE_ACCOUNT_KEY     — the service account JSON, raw
//
// To generate the JSON: Firebase Console → Project Settings → Service
// Accounts → Generate new private key.
// ──────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  let jsonText;
  if (b64) jsonText = Buffer.from(b64, 'base64').toString('utf8');
  else if (raw) jsonText = raw;
  else {
    throw new Error(
      'Server is missing FIREBASE_SERVICE_ACCOUNT_BASE64 (or FIREBASE_SERVICE_ACCOUNT_KEY). ' +
      'Set it in Vercel project settings — see api/_lib/firebaseAdmin.js for how to generate it.'
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_* environment variable is not valid JSON.');
  }
  // Env vars often escape newlines in the private key — restore them.
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  return parsed;
}

let cachedApp = null;
function getAdminApp() {
  if (getApps().length) return getApps()[0];
  if (!cachedApp) cachedApp = initializeApp({ credential: cert(loadServiceAccount()) });
  return cachedApp;
}

export function adminAuth() { return getAuth(getAdminApp()); }
export function adminDb()   { return getFirestore(getAdminApp()); }

// Verifies the caller sent a valid Firebase ID token (Authorization: Bearer
// <token>) and that the account belongs to a Firestore `admins/{email}` doc
// with role: 'admin' — the same check the client app already uses. Throws
// an Error with a `.status` on failure.
export async function requireAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    const err = new Error('Missing Authorization header.');
    err.status = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    const err = new Error('Invalid or expired session — please sign in again.');
    err.status = 401;
    throw err;
  }

  const email = decoded.email;
  if (!email) {
    const err = new Error('This account has no email on file.');
    err.status = 403;
    throw err;
  }

  const adminSnap = await adminDb().collection('admins').doc(email).get();
  if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
    const err = new Error('Not authorized as admin.');
    err.status = 403;
    throw err;
  }

  return { uid: decoded.uid, email };
}
