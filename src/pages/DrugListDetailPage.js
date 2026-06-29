// src/pages/DrugListDetailPage.js
// Route: /lists/:listId
// Shows drugs in a list, lets user remove drugs or add notes.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  Pill, Trash2, ChevronLeft,
  Check, X, StickyNote, BookOpen,
} from 'lucide-react';

export default function DrugListDetailPage() {
  const { listId }     = useParams();
  const { user }       = useAuth();
  const navigate       = useNavigate();

  const [list,        setList]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [editingNote, setEditingNote] = useState(null); // drugId being edited
  const [noteText,    setNoteText]    = useState('');
  const [saving,      setSaving]      = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid || !listId) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'lists', listId));
      if (snap.exists()) setList({ id: snap.id, ...snap.data() });
      else navigate('/lists');
    } catch (e) { console.error('Load list detail error:', e); }
    setLoading(false);
  }, [user?.uid, listId, navigate]);

  useEffect(() => { load(); }, [load]);

  /* Remove drug from list */
  const removeDrug = async (drugId) => {
    if (!list || !user?.uid) return;
    const updated = list.drugs.filter(d => d.drugId !== drugId);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'lists', listId), {
        drugs: updated,
        last_updated: serverTimestamp(),
      });
      setList(prev => ({ ...prev, drugs: updated }));
    } catch (e) { console.error('Remove drug error:', e); }
  };

  /* Save note */
  const saveNote = async (drugId) => {
    if (!list || !user?.uid) return;
    setSaving(true);
    const updated = list.drugs.map(d =>
      d.drugId === drugId ? { ...d, notes: noteText } : d
    );
    try {
      await updateDoc(doc(db, 'users', user.uid, 'lists', listId), {
        drugs: updated,
        last_updated: serverTimestamp(),
      });
      setList(prev => ({ ...prev, drugs: updated }));
      setEditingNote(null);
    } catch (e) { console.error('Save note error:', e); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!list) return null;

  const drugs = list.drugs || [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {/* Back */}
      <Link to="/lists" className="inline-flex items-center gap-1 text-drug-muted hover:text-primary-600 mb-6 text-sm font-medium">
        <ChevronLeft className="w-4 h-4" /> My Lists
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-drug-text">{list.title}</h1>
          <p className="text-sm text-drug-muted">
            {drugs.length} drug{drugs.length !== 1 ? 's' : ''}
            {list.createdAt?.toDate && (
              <span className="ml-2">
                · Created {list.createdAt.toDate().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="h-px bg-drug-border my-6" />

      {/* Empty */}
      {drugs.length === 0 && (
        <div className="text-center py-16 bg-white border border-drug-border rounded-xl">
          <Pill className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-drug-text mb-2">No drugs yet</h3>
          <p className="text-drug-muted text-sm mb-6">
            Open any drug page and tap <strong>"Add to List"</strong> to add it here.
          </p>
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700"
          >
            Browse Medications
          </Link>
        </div>
      )}

      {/* Drug cards */}
      {drugs.length > 0 && (
        <div className="space-y-3">
          {drugs.map(drug => {
            const isEditingThisNote = editingNote === drug.drugId;
            return (
              <div key={drug.drugId} className="bg-white border border-drug-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Pill className="w-4 h-4 text-primary-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/drug/${drug.drugId}`}
                      className="font-semibold text-drug-text hover:text-primary-600 transition-colors"
                    >
                      {drug.drugName}
                    </Link>
                    {drug.drugClass && (
                      <p className="text-xs text-primary-600 font-medium mt-0.5">{drug.drugClass}</p>
                    )}
                    {drug.addedAt?.toDate && (
                      <p className="text-xs text-drug-muted mt-0.5">
                        Added {drug.addedAt.toDate().toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                      </p>
                    )}

                    {/* Note area */}
                    {isEditingThisNote ? (
                      <div className="mt-3">
                        <textarea
                          autoFocus
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          rows={3}
                          placeholder="Add a note…"
                          className="w-full border border-primary-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => saveNote(drug.drugId)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold hover:bg-gray-200"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : drug.notes ? (
                      <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-900 leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <StickyNote className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <span>{drug.notes}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingNote(drug.drugId);
                        setNoteText(drug.notes || '');
                      }}
                      title="Add/edit note"
                      className="p-2 rounded-lg hover:bg-amber-50 text-drug-muted hover:text-amber-600 transition-colors"
                    >
                      <StickyNote className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeDrug(drug.drugId)}
                      title="Remove from list"
                      className="p-2 rounded-lg hover:bg-red-50 text-drug-muted hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
