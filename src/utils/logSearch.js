// ── logSearch.js ──────────────────────────────────────────────────────────
// Records a user's search query so the admin panel can show search history
// per user. Fire-and-forget: never throws, never blocks the UI, and does
// nothing for signed-out visitors (there's no user to attribute it to).
// ──────────────────────────────────────────────────────────────────────────

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Debounce so we log once per pause-in-typing, not on every keystroke.
let pendingTimer = null;

// Write savers: each log is one billed write, so skip repeats of the same
// query in this session, ignore very short text, and cap writes per session.
const MAX_LOGS_PER_SESSION = 25;
const loggedThisSession = new Set();

// type: 'drug' | 'condition' | 'general' — which search box the query came from.
export function logSearch({ user, query, resultCount, type = 'drug' }) {
  if (!user || !query || query.trim().length < 3) return;
  if (loggedThisSession.size >= MAX_LOGS_PER_SESSION) return;
  const dedupeKey = `${type}|${query.trim().toLowerCase()}`;
  if (loggedThisSession.has(dedupeKey)) return;

  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    if (loggedThisSession.has(dedupeKey)) return;
    loggedThisSession.add(dedupeKey);
    addDoc(collection(db, 'search_logs'), {
      uid:         user.uid,
      userEmail:   user.email || '',
      userName:    user.displayName || '',
      query:       query.trim(),
      type,
      resultCount: typeof resultCount === 'number' ? resultCount : null,
      createdAt:   serverTimestamp(),
    }).catch(() => {
      // Never surface logging failures to the user.
    });
  }, 800);
}
