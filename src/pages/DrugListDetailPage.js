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
import { useDrugs } from '../hooks/useDrugs';
import { shareListPdf } from '../utils/exportListPdf';
import {
  Pill, Trash2, ArrowLeft, ChevronRight, Calendar,
  Check, X, StickyNote, BookMarked, Share2, Loader2, Pencil,
} from 'lucide-react';
import { CapsuleBadge, ListsBackdrop, ShieldDecor, LISTS_NAVY, LISTS_BLUE } from '../components/ListsUi';

function ShareListButton({ list, allDrugs }) {
  const [state, setState] = useState('idle'); // idle | working | error

  const handleShare = async () => {
    setState('working');
    try {
      await shareListPdf(list, allDrugs);
      setState('idle');
    } catch (e) {
      console.error('Share list PDF error:', e);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={state === 'working'}
      title="Share list as PDF"
      className="w-10 h-10 flex items-center justify-center rounded-full border border-white bg-white/80 shadow-sm text-[#1D5FD1] hover:bg-white transition-colors disabled:opacity-50 flex-shrink-0"
    >
      {state === 'working'
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Share2 className="w-4 h-4" />}
    </button>
  );
}

export default function DrugListDetailPage() {
  const { listId }     = useParams();
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const { drugs: allDrugs } = useDrugs();

  const [list,        setList]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [editingNote, setEditingNote] = useState(null); // drugId being edited
  const [noteText,    setNoteText]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText,    setTitleText]    = useState('');
  const [savingTitle,  setSavingTitle]  = useState(false);

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

  /* Rename list */
  const saveTitle = async () => {
    const newTitle = titleText.trim();
    if (!newTitle || !user?.uid) return;
    if (newTitle === list.title) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'lists', listId), {
        title: newTitle,
        last_updated: serverTimestamp(),
      });
      setList(prev => ({ ...prev, title: newTitle }));
      setEditingTitle(false);
    } catch (e) { console.error('Rename list error:', e); }
    setSavingTitle(false);
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
          <div className="h-10 bg-blue-100/70 rounded-full w-32" />
          <div className="h-28 bg-white/70 rounded-3xl" />
          {[1,2,3].map(i => <div key={i} className="h-24 bg-white/70 rounded-[22px]" />)}
        </div>
      </div>
    );
  }

  if (!list) return null;

  const drugs = list.drugs || [];
  const createdLabel = list.createdAt?.toDate
    ? list.createdAt.toDate().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="relative min-h-full">
      <ListsBackdrop />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-3 pb-32">

        {/* Back */}
        <div className="flex items-center justify-between mb-3">
          <Link
            to="/lists"
            className="inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full border border-white bg-white/70 shadow-sm font-bold text-[15px]"
            style={{ color: LISTS_BLUE }}
          >
            <ArrowLeft className="w-5 h-5" /> My Lists
          </Link>
          <ShareListButton list={list} allDrugs={allDrugs} />
        </div>

        {/* Header card */}
        <div className="relative overflow-hidden rounded-3xl border border-white bg-white/60 backdrop-blur shadow-[0_8px_28px_rgba(40,90,200,0.10)] px-4 py-4 mb-4">
          <ShieldDecor className="absolute -right-1 top-1/2 -translate-y-1/2 opacity-90" />
          <div className="relative flex items-center gap-4 pr-20">
            <div className="w-[68px] h-[68px] rounded-2xl bg-[#DCE9FF] flex items-center justify-center flex-shrink-0">
              <BookMarked className="w-8 h-8" style={{ color: LISTS_BLUE }} />
            </div>
            <div className="min-w-0 flex-1">
              {editingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={titleText}
                    onChange={e => setTitleText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTitle();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    maxLength={60}
                    className="min-w-0 flex-1 text-xl font-extrabold border border-primary-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    style={{ color: LISTS_NAVY }}
                  />
                  <button
                    onClick={saveTitle}
                    disabled={savingTitle || !titleText.trim()}
                    title="Save name"
                    className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex-shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingTitle(false)}
                    title="Cancel"
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h1 className="text-[28px] leading-tight font-extrabold truncate" style={{ color: LISTS_NAVY }}>{list.title}</h1>
                  <button
                    onClick={() => { setTitleText(list.title || ''); setEditingTitle(true); }}
                    title="Rename list"
                    className="p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-white/70 transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="mt-1 flex items-center flex-wrap gap-x-3 gap-y-1 text-[15px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Pill className="w-4 h-4" style={{ color: LISTS_BLUE }} />
                  {drugs.length} drug{drugs.length !== 1 ? 's' : ''}
                </span>
                {createdLabel && (
                  <>
                    <span className="h-4 w-px bg-slate-300" />
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" style={{ color: LISTS_BLUE }} />
                      Created {createdLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Empty */}
        {drugs.length === 0 && (
          <div className="text-center py-14 bg-white/80 border border-white rounded-[22px] shadow-sm">
            <Pill className="w-14 h-14 text-blue-200 mx-auto mb-4" />
            <h3 className="text-lg font-extrabold mb-2" style={{ color: LISTS_NAVY }}>No drugs yet</h3>
            <p className="text-slate-500 text-sm mb-6 px-4">
              Open any drug page and tap <strong>"Add to List"</strong> to add it here.
            </p>
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-full font-bold text-sm"
              style={{ background: LISTS_BLUE }}
            >
              Browse Medications
            </Link>
          </div>
        )}

        {/* Drug cards */}
        {drugs.length > 0 && (
          <div className="space-y-3">
            {drugs.map((drug, idx) => {
              const isEditingThisNote = editingNote === drug.drugId;
              const isAi = drug.drugId?.startsWith('ai_');
              const addedLabel = drug.addedAt?.toDate
                ? drug.addedAt.toDate().toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
                : null;
              return (
                <div
                  key={drug.drugId}
                  className="bg-white/95 border border-white rounded-[22px] shadow-[0_6px_20px_rgba(40,90,200,0.10)] px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <CapsuleBadge index={idx} size={56} />

                    <div className="flex-1 min-w-0">
                      {isAi ? (
                        <span className="text-[18px] leading-tight font-extrabold inline-flex items-center gap-1.5 flex-wrap" style={{ color: LISTS_NAVY }}>
                          {drug.drugName}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">AI</span>
                        </span>
                      ) : (
                        <Link
                          to={`/drug/${drug.drugId}`}
                          className="block text-[18px] leading-tight font-extrabold"
                          style={{ color: LISTS_NAVY }}
                        >
                          {drug.drugName}
                        </Link>
                      )}
                      {drug.drugClass && (
                        <p className="text-[15px] font-medium leading-snug mt-0.5" style={{ color: LISTS_BLUE }}>{drug.drugClass}</p>
                      )}
                      {addedLabel && (
                        <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" style={{ color: LISTS_BLUE }} /> Added {addedLabel}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingNote(drug.drugId);
                          setNoteText(drug.notes || '');
                        }}
                        title="Add/edit note"
                        className="w-10 h-10 rounded-full bg-[#E3EEFF] flex items-center justify-center hover:bg-[#d3e3ff] transition-colors"
                        style={{ color: LISTS_BLUE }}
                      >
                        <StickyNote className="w-[18px] h-[18px]" />
                      </button>
                      <button
                        onClick={() => removeDrug(drug.drugId)}
                        title="Remove from list"
                        className="w-10 h-10 rounded-full bg-[#FFE4EA] flex items-center justify-center text-red-500 hover:bg-[#ffd3dc] transition-colors"
                      >
                        <Trash2 className="w-[18px] h-[18px]" />
                      </button>
                      {!isAi && (
                        <>
                          <span className="h-9 w-px bg-slate-200 mx-0.5" />
                          <Link
                            to={`/drug/${drug.drugId}`}
                            aria-label={`Open ${drug.drugName}`}
                            className="p-1 -mr-1"
                            style={{ color: LISTS_BLUE }}
                          >
                            <ChevronRight className="w-6 h-6" />
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Note area */}
                  {isEditingThisNote ? (
                    <div className="mt-3">
                      <textarea
                        autoFocus
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        rows={3}
                        placeholder="Add a note…"
                        className="w-full border border-primary-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveNote(drug.drugId)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-full text-xs font-semibold hover:bg-primary-700 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingNote(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold hover:bg-gray-200"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : drug.notes ? (
                    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-sm text-amber-900 leading-relaxed">
                      <div className="flex items-start gap-1.5">
                        <StickyNote className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>{drug.notes}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
