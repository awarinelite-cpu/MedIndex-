// src/pages/DrugListsPage.js
// Route: /lists
// Firestore: users/{uid}/lists/{listId}/
//   title, createdAt, drugs: [{ drugId, drugName, drugClass, notes, addedAt }]

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen, Plus, Trash2, ChevronRight,
  Edit2, Check, X, Pill, ClipboardList,
} from 'lucide-react';

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

  /* Create */
  const handleCreate = async () => {
    if (!newTitle.trim() || !user?.uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'lists'), {
        title:     newTitle.trim(),
        createdAt: serverTimestamp(),
        drugs:     [],
      });
      setNewTitle('');
      setCreating(false);
      await reload();
    } catch (e) { console.error('Create list error:', e); }
    setSaving(false);
  };

  /* Rename */
  const handleRename = async (listId, newName) => {
    if (!newName.trim() || !user?.uid) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'lists', listId), { title: newName.trim() });
      setRenamingId(null);
      await reload();
    } catch (e) { console.error('Rename error:', e); }
  };

  /* Delete */
  const handleDelete = async (listId) => {
    if (!window.confirm('Delete this list? This cannot be undone.')) return;
    setDeletingId(listId);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'lists', listId));
      await reload();
    } catch (e) { console.error('Delete list error:', e); }
    setDeletingId(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ClipboardList className="w-7 h-7 text-primary-600" />
            <h1 className="text-2xl font-bold text-drug-text">My Drug Lists</h1>
          </div>
          <p className="text-drug-muted text-sm">
            Create custom lists — ICU protocols, ward rounds, study sets, etc.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New List
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-primary-600 flex-shrink-0" />
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
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-20" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && lists.length === 0 && !creating && (
        <div className="text-center py-16 bg-white border border-drug-border rounded-xl">
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
                className="bg-white border border-drug-border rounded-xl p-4 flex items-center gap-4 hover:border-primary-300 hover:shadow-sm transition-all group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary-600" />
                </div>

                {/* Title + rename */}
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <RenameInput
                      value={list.title}
                      onSave={name => handleRename(list.id, name)}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <>
                      <div className="font-semibold text-drug-text truncate">{list.title}</div>
                      <div className="text-xs text-drug-muted mt-0.5 flex items-center gap-1">
                        <Pill className="w-3 h-3" />
                        {drugCount} drug{drugCount !== 1 ? 's' : ''}
                        {list.createdAt?.toDate && (
                          <span className="ml-2">
                            · {list.createdAt.toDate().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                {!isRenaming && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setRenamingId(list.id)}
                      title="Rename"
                      className="p-2 rounded-lg hover:bg-gray-100 text-drug-muted hover:text-drug-text"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(list.id)}
                      disabled={isDeleting}
                      title="Delete"
                      className="p-2 rounded-lg hover:bg-red-50 text-drug-muted hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Navigate arrow */}
                {!isRenaming && (
                  <button
                    onClick={() => navigate(`/lists/${list.id}`)}
                    className="p-2 rounded-lg hover:bg-primary-50 text-drug-muted hover:text-primary-600 transition-colors flex-shrink-0"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
