// Shared, short-lived cache for a user's drug lists (users/{uid}/lists).
// The list pickers (heart button, drug page) used to re-read every list each
// time they opened; now they share one read per few minutes.
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

const TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // uid -> { at, lists }

export function invalidateUserLists(uid) { cache.delete(uid); }

export async function loadUserLists(uid, { force = false } = {}) {
  const hit = cache.get(uid);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.lists;
  const snap = await getDocs(query(collection(db, 'users', uid, 'lists'), orderBy('createdAt', 'desc')));
  const lists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.set(uid, { at: Date.now(), lists });
  return lists;
}
