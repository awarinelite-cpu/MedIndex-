// src/pages/DrugListsPage.js
// Route: /lists
// Firestore: users/{uid}/lists/{listId}/
//   title, createdAt, drugs: [{ drugId, drugName, drugClass, notes, addedAt }]

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  BookMarked, Plus, Trash2, ChevronRight,
  Edit2, Check, X, Pill, ClipboardList, Calendar,
} from 'lucide-react';
import { ListsBackdrop, LISTS_NAVY, LISTS_BLUE } from '../components/ListsUi';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function useUserLists(uid) {
  const [lists,   setLists]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const snap = await getDocs(
        query(collection(db, 'users', uid, 'lists'), orderBy('createdAt', 'desc'))
      );
      setLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Load lists error:', e);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);
  return { lists, loading, reload: load };
}

/* ── Inline rename input ─────────────────────────────────────────────────── */
function RenameInput({ value, onSave, onCancel }) {
  const [val, setVal] = useState(value);
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel(); }}
        className="border border-primary-300 rounded-lg px-3 py-1.5 text-sm font-semibold flex-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
      <button onClick={() => onSave(val)} className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function DrugListsPage() {
  const { user }                 = useAuth();
  const navigate                 = useNavigate();
  const { lists, loading, reload } = useUserLists(user?.uid);

  const [creating,    setCreating]    = useState(false);
  const [newTitle,    setNewTitle]    = useState('');
  const [renamingId,  setRenamingId]  = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  /* Create */
  const handleCreate = async () => {
    if (!newTitle.trim() || !user?.uid) return;
    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, 'users', user.uid, 'lists'), {
        title:     newTitle.trim(),
        createdAt: serverTimestamp(),
        drugs:     [],
      });
      setNewTitle('');
      setCreating(false);
      await reload();
    } catch (e) {
      console.error('Create list error:', e);
      setError(e.code === 'permission-denied'
        ? "Couldn't save — please sign out and back in, then try again."
        : "Couldn't create the list. Check your connection and try again.");
    }
    setSaving(false);
  };

  /* Rename */
  const handleRename = async (listId, newName) => {
    if (!newName.trim() || !user?.uid) return;
    setError(null);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'lists', listId), { title: newName.trim() });
      setRenamingId(null);
      await reload();
    } catch (e) {
      console.error('Rename error:', e);
      setError("Couldn't rename the list. Check your connection and try again.");
    }
  };

  /* Delete */
  const handleDelete = async (listId) => {
    if (!window.confirm('Delete this list? This cannot be undone.')) return;
    setDeletingId(listId);
    setError(null);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'lists', listId));
      await reload();
    } catch (e) {
      console.error('Delete list error:', e);
      setError("Couldn't delete the list. Check your connection and try again.");
    }
    setDeletingId(null);
  };

  return (
    <div className="relative min-h-full">
    <ListsBackdrop />
    <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-32">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <ClipboardList className="w-7 h-7 flex-shrink-0" style={{ color: LISTS_BLUE }} />
            <h1 className="text-[28px] leading-tight font-extrabold" style={{ color: LISTS_NAVY }}>My Drug Lists</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Create custom lists — ICU protocols, ward rounds, study sets, etc.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-full font-bold text-sm shadow-md flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${LISTS_BLUE}, #2F80ED)` }}
        >
          <Plus className="w-4 h-4" /> New List
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-6 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 rounded-lg hover:bg-red-100 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="bg-white/80 border border-white shadow-sm rounded-[22px] p-4 mb-6 flex items-center gap-3">
          <BookMarked className="w-5 h-5 flex-shrink-0" style={{ color: LISTS_BLUE }} />
          <input
            autoFocus
            type="text"
            placeholder="List name (e.g. ICU Protocol)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
            className="flex-1 bg-white border border-primary-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim() || saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={() => { setCreating(false); setNewTitle(''); }}
            className="p-2 rounded-lg hover:bg-primary-100"
          >
            <X className="w-4 h-4 text-drug-muted" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse bg-white/70 rounded-[22px] h-24" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && lists.length === 0 && !creating && (
        <div className="text-center py-16 bg-white/80 border border-white shadow-sm rounded-[22px]">
          <ClipboardList className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-drug-text mb-2">No lists yet</h3>
          <p className="text-drug-muted text-sm mb-6">
            Create your first list to save and organise medications.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> Create a List
          </button>
        </div>
      )}

      {/* List items */}
      {!loading && lists.length > 0 && (
        <div className="space-y-3">
          {lists.map(list => {
            const drugCount = list.drugs?.length || 0;
            const isRenaming = renamingId === list.id;
            const isDeleting = deletingId === list.id;

            return (
              <div
                key={list.id}
                onClick={() => { if (!isRenaming) navigate(`/lists/${list.id}`); }}
                className={`bg-white/95 border border-white rounded-[22px] shadow-[0_6px_20px_rgba(40,90,200,0.10)] px-3 py-3 flex items-center gap-3 hover:shadow-[0_8px_24px_rgba(40,90,200,0.16)] transition-all group ${isRenaming ? '' : 'cursor-pointer'}`}
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-[#DCE9FF] flex items-center justify-center flex-shrink-0">
                  <BookMarked className="w-7 h-7" style={{ color: LISTS_BLUE }} />
                </div>

                {/* Title + rename */}
                <div className="flex-1 min-w-0" onClick={isRenaming ? e => e.stopPropagation() : undefined}>
                  {isRenaming ? (
                    <RenameInput
                      value={list.title}
                      onSave={name => handleRename(list.id, name)}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <>
                      <div className="text-[18px] leading-tight font-extrabold truncate" style={{ color: LISTS_NAVY }}>{list.title}</div>
                      <div className="text-sm text-slate-500 mt-1 flex items-center flex-wrap gap-x-3 gap-y-0.5">
                        <span className="inline-flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5" style={{ color: LISTS_BLUE }} />
                          {drugCount} drug{drugCount !== 1 ? 's' : ''}
                        </span>
                        {list.createdAt?.toDate && (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" style={{ color: LISTS_BLUE }} />
                            {list.createdAt.toDate().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                {!isRenaming && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      onClick={() => setRenamingId(list.id)}
                      title="Rename"
                      className="w-9 h-9 rounded-full bg-[#E3EEFF] flex items-center justify-center hover:bg-[#d3e3ff]"
                      style={{ color: LISTS_BLUE }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(list.id)}
                      disabled={isDeleting}
                      title="Delete"
                      className="w-9 h-9 rounded-full bg-[#FFE4EA] flex items-center justify-center text-red-500 hover:bg-[#ffd3dc]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Navigate arrow */}
                {!isRenaming && (
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/lists/${list.id}`); }}
                    className="p-1 flex-shrink-0"
                    style={{ color: LISTS_BLUE }}
                    aria-label={`Open ${list.title}`}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
