// ── logSearch.js ──────────────────────────────────────────────────────────
// Records a user's search query so the admin panel can show search history
// per user. Fire-and-forget: never throws, never blocks the UI, and does
// nothing for signed-out visitors (there's no user to attribute it to).
// ──────────────────────────────────────────────────────────────────────────

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Debounce so we log once per pause-in-typing, not on every keystroke.
let pendingTimer = null;

export function logSearch({ user, query, resultCount }) {
  if (!user || !query || !query.trim()) return;

  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    addDoc(collection(db, 'search_logs'), {
      uid:         user.uid,
      userEmail:   user.email || '',
      userName:    user.displayName || '',
      query:       query.trim(),
      resultCount: typeof resultCount === 'number' ? resultCount : null,
      createdAt:   serverTimestamp(),
    }).catch(() => {
      // Never surface logging failures to the user.
    });
  }, 800);
}
