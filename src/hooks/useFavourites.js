// src/hooks/useFavourites.js
// Bookmarked drugs and conditions, stored per user in Firestore at
// users/{uid}/favourites/{type}_{key} so they follow the person across devices.
// Covered by the existing users/{uid}/** rule (owner read and write).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export const favDocId = (type, key) => `${type}_${String(key).replace(/[\s/]+/g, '_')}`;
export const conditionFavKey = (systemId, conditionId) => `${systemId}__${conditionId}`;

export function useFavourites() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!!uid);

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(
      collection(db, 'users', uid, 'favourites'),
      (snap) => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useFavourites] listen error:', err.code, err.message);
        setLoading(false);
      }
    );
  }, [uid]);

  const savedIds = useMemo(() => new Set(items.map(i => i.id)), [items]);
  const isFav = useCallback((type, key) => savedIds.has(favDocId(type, key)), [savedIds]);

  // Saves the item if it is not saved yet, removes it if it is.
  const toggle = useCallback(async (item) => {
    if (!uid || !item?.type || !item?.refId) return;
    const ref = doc(db, 'users', uid, 'favourites', favDocId(item.type, item.refId));
    try {
      if (savedIds.has(ref.id)) await deleteDoc(ref);
      else await setDoc(ref, { ...item, createdAt: serverTimestamp() });
    } catch (e) {
      console.error('[useFavourites] toggle error:', e);
    }
  }, [uid, savedIds]);

  return { items, loading, isFav, toggle };
}
