// src/components/AddToFavoritesHeart.js
// Small heart icon button. Tap it and a card pops up asking whether to save
// the drug into an existing favorite folder (Drug List) or create a new one.
// Reuses the same Firestore shape as DrugListsPage / DrugListDetailPage:
//   users/{uid}/lists/{listId}.drugs: [{ drugId, drugName, drugClass, notes, addedAt }]

import React, { useState } from 'react';
import {
  collection, addDoc, getDocs, doc,
  updateDoc, serverTimestamp, orderBy, query, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { slugifyDrugName } from '../utils/aiDrugSave';
import { Heart, X, Plus, Check, FolderPlus } from 'lucide-react';

// Works for any drug shown anywhere in the app — including one only found
// via an AI lookup that hasn't been saved to the database yet. A drug with
// no real Firestore id gets a stable slug id instead (the same slug the
// rest of the app uses if/when that drug is later saved for real), so a
// favorite saved now still resolves correctly afterwards.
export default function AddToFavoritesHeart({ drug, className = '' }) {
  const { user } = useAuth();
  const [open, setOpen]       = useState(false);
  const [lists, setLists]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);   // this heart has saved the drug somewhere this session
  const [addedIds, setAddedIds] = useState({});    // listId → true
  const [error, setError]     = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  if (!user || !drug || !drug.generic_name) return null;

  const drugId = drug.id || drug.firestoreId || `ai_${slugifyDrugName(drug.generic_name)}`;
  const inDatabase = Boolean(drug.id || drug.firestoreId);

  const loadLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'lists'), orderBy('createdAt', 'desc'))
      );
      setLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Load favorite folders error:', e);
      setError("Couldn't load your folders. Check your connection and try again.");
    }
    setLoading(false);
  };

  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    setCreatingFolder(false);
    setNewFolderName('');
    loadLists();
  };

  const close = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setOpen(false);
  };

  // NOTE: serverTimestamp() can't be used inside an array field, so each
  // saved-drug entry uses a concrete Timestamp.now() instead.
  const addToList = async (list) => {
    const already = (list.drugs || []).some(d => d.drugId === drugId);
    if (already) { setAddedIds(p => ({ ...p, [list.id]: true })); setSaved(true); return; }
    setError(null);
    try {
      const updatedDrugs = [
        ...(list.drugs || []),
        {
          drugId:    drugId,
          drugName:  drug.generic_name,
          drugClass: drug.drug_class || '',
          notes:     inDatabase ? '' : 'Saved from AI lookup — not yet in the verified database.',
          addedAt:   Timestamp.now(),
        },
      ];
      await updateDoc(doc(db, 'users', user.uid, 'lists', list.id), {
        drugs: updatedDrugs,
        last_updated: serverTimestamp(),
      });
      setAddedIds(p => ({ ...p, [list.id]: true }));
      setSaved(true);
    } catch (e) {
      console.error('Add to favorite folder error:', e);
      setError("Couldn't save this drug. Check your connection and try again.");
    }
  };

  const createFolderAndAdd = async () => {
    const title = newFolderName.trim() || 'New Folder';
    setLoading(true);
    setError(null);
    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'lists'), {
        title,
        createdAt: serverTimestamp(),
        drugs: [{
          drugId:    drugId,
          drugName:  drug.generic_name,
          drugClass: drug.drug_class || '',
          notes:     inDatabase ? '' : 'Saved from AI lookup — not yet in the verified database.',
          addedAt:   Timestamp.now(),
        }],
      });
      setAddedIds(p => ({ ...p, [ref.id]: true }));
      setSaved(true);
      setNewFolderName('');
      setCreatingFolder(false);
      await loadLists();
    } catch (e) {
      console.error('Create favorite folder error:', e);
      setError("Couldn't create the folder. Check your connection and try again.");
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        title="Save to favorites"
        className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
          saved ? 'text-red-500 hover:bg-red-50' : 'text-drug-muted hover:text-red-500 hover:bg-red-50'
        } ${className}`}
      >
        <Heart className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-drug-border">
              <div className="flex items-center gap-2 min-w-0">
                <Heart className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" />
                <span className="font-semibold text-drug-text text-sm truncate">
                  Save {drug.generic_name}
                </span>
              </div>
              <button onClick={close} className="p-1 rounded hover:bg-gray-100 flex-shrink-0">
                <X className="w-4 h-4 text-drug-muted" />
              </button>
            </div>

            {!inDatabase && (
              <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
                Not yet in the verified database — this is an AI lookup result.
              </div>
            )}

            {error && (
              <div className="px-4 py-2.5 text-xs text-red-700 bg-red-50 border-b border-red-100">
                {error}
              </div>
            )}

            {/* New folder inline form */}
            {creatingFolder ? (
              <div className="px-4 py-3 border-b border-drug-border flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createFolderAndAdd(); if (e.key === 'Escape') setCreatingFolder(false); }}
                  className="flex-1 border border-primary-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  onClick={createFolderAndAdd}
                  disabled={loading}
                  className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? '…' : 'Save'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreatingFolder(true)}
                className="w-full flex items-center gap-2 px-4 py-3 border-b border-drug-border text-sm font-semibold text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <FolderPlus className="w-4 h-4" /> Create new folder
              </button>
            )}

            {/* Existing folders */}
            {loading && lists.length === 0 && !creatingFolder && (
              <div className="px-4 py-6 text-center text-sm text-drug-muted">Loading your folders…</div>
            )}

            {!loading && lists.length === 0 && !creatingFolder && (
              <div className="px-4 py-5 text-center text-sm text-drug-muted">
                No folders yet. Create one above to save this drug.
              </div>
            )}

            {lists.length > 0 && (
              <div className="max-h-64 overflow-y-auto divide-y divide-drug-border">
                {lists.map(list => {
                  const isAdded = addedIds[list.id] || (list.drugs || []).some(d => d.drugId === drugId);
                  return (
                    <button
                      key={list.id}
                      onClick={() => addToList(list)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-drug-text truncate">{list.title}</div>
                        <div className="text-xs text-drug-muted">{(list.drugs || []).length} drugs</div>
                      </div>
                      {isAdded
                        ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <Plus  className="w-4 h-4 text-drug-muted flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
