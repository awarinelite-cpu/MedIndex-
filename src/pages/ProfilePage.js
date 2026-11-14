// src/pages/ProfilePage.js
// "My Profile": edit name / phone / institution / role and upload a profile picture.
// Name + photo live on the Firebase Auth user (so the header avatar updates);
// the extra details are stored at users/{uid}/settings/profile (owner-only by the
// existing users/{uid}/** Firestore rule). The picture is shrunk to a small
// square in the browser and hosted through the same ImgChest proxy as other images.

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Loader2, Mail, Phone, Building2, BadgeCheck, User, Trash2 } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uploadClipboardImageToImgChest } from '../utils/generateDrugImage';
import { ListsBackdrop, LISTS_NAVY, LISTS_BLUE } from '../components/ListsUi';

const ROLES = ['Student nurse', 'Nurse / Midwife', 'Doctor', 'Pharmacist', 'Other health worker', 'Other'];

// Center-crop to a square and downscale so uploads stay small.
function squareAvatarBlob(file, size = 480) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process that image.'))), 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image.')); };
    img.src = url;
  });
}

function Field({ icon: Icon, label, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
        <Icon className="w-4 h-4" style={{ color: LISTS_BLUE }} /> {label}
      </span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-[16px] text-[#0A1F5C] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300';

export default function ProfilePage() {
  const { user, updateUserProfile } = useAuth();
  const fileRef = useRef(null);

  const [name, setName]               = useState(user?.displayName || '');
  const [phone, setPhone]             = useState('');
  const [institution, setInstitution] = useState('');
  const [role, setRole]               = useState('');
  const [loaded, setLoaded]           = useState(false);
  const [saving, setSaving]           = useState(false);
  const [photoBusy, setPhotoBusy]     = useState(false);
  const [msg, setMsg]                 = useState(null); // { type: 'ok' | 'err', text }

  useEffect(() => {
    if (!user?.uid) return;
    let alive = true;
    getDoc(doc(db, 'users', user.uid, 'settings', 'profile'))
      .then(snap => {
        if (!alive) return;
        const d = snap.exists() ? snap.data() : {};
        setPhone(d.phone || '');
        setInstitution(d.institution || '');
        setRole(d.role || '');
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [user?.uid]);

  if (!user) return null;

  const initials = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg({ type: 'err', text: 'Please choose an image file.' }); return; }
    setPhotoBusy(true); setMsg(null);
    try {
      const blob = await squareAvatarBlob(file);
      const url = await uploadClipboardImageToImgChest({ blob });
      await updateUserProfile({ photoURL: url });
      setMsg({ type: 'ok', text: 'Profile picture updated.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Could not upload the picture.' });
    }
    setPhotoBusy(false);
  };

  const removePhoto = async () => {
    setPhotoBusy(true); setMsg(null);
    try {
      await updateUserProfile({ photoURL: null });
      setMsg({ type: 'ok', text: 'Profile picture removed.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Could not remove the picture.' });
    }
    setPhotoBusy(false);
  };

  const save = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) { setMsg({ type: 'err', text: 'Please enter your name.' }); return; }
    setSaving(true); setMsg(null);
    try {
      if (cleanName !== (user.displayName || '')) await updateUserProfile({ displayName: cleanName });
      await setDoc(
        doc(db, 'users', user.uid, 'settings', 'profile'),
        { phone: phone.trim(), institution: institution.trim(), role, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMsg({ type: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Could not save your profile.' });
    }
    setSaving(false);
  };

  return (
    <div className="relative min-h-full">
      <ListsBackdrop />
      <div className="relative max-w-xl mx-auto px-4 sm:px-6 pt-3 pb-32">
        <Link
          to="/more"
          className="inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full border border-white bg-white/70 shadow-sm font-bold text-[15px] mb-3"
          style={{ color: LISTS_BLUE }}
        >
          <ArrowLeft className="w-5 h-5" /> More
        </Link>

        <h1 className="text-[28px] leading-tight font-extrabold mb-4" style={{ color: LISTS_NAVY }}>My Profile</h1>

        {/* Picture */}
        <div className="rounded-3xl border border-white bg-white/70 backdrop-blur shadow-[0_8px_28px_rgba(40,90,200,0.10)] px-4 py-6 mb-4 flex flex-col items-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-[#DCE9FF] flex items-center justify-center shadow-md border-4 border-white">
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                : <span className="text-4xl font-extrabold" style={{ color: LISTS_BLUE }}>{initials}</span>}
              {photoBusy && (
                <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: LISTS_BLUE }} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              aria-label="Change profile picture"
              className="absolute bottom-0 right-0 w-10 h-10 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-white disabled:opacity-60"
              style={{ background: LISTS_BLUE }}
            >
              <Camera className="w-5 h-5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
          <p className="mt-3 text-[18px] font-extrabold" style={{ color: LISTS_NAVY }}>{user.displayName || 'Your name'}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          {user.photoURL && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={photoBusy}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Remove picture
            </button>
          )}
        </div>

        {/* Details */}
        <form onSubmit={save} className="rounded-3xl border border-white bg-white/70 backdrop-blur shadow-[0_8px_28px_rgba(40,90,200,0.10)] px-4 py-5 space-y-4">
          <Field icon={User} label="Full name">
            <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Your name" className={inputCls} />
          </Field>

          <Field icon={Mail} label="Email">
            <input value={user.email || ''} readOnly className={`${inputCls} bg-slate-50 text-slate-500`} />
          </Field>

          <Field icon={Phone} label="Phone">
            <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} inputMode="tel" placeholder="e.g. 0803 000 0000" className={inputCls} disabled={!loaded} />
          </Field>

          <Field icon={Building2} label="Institution / workplace">
            <input value={institution} onChange={e => setInstitution(e.target.value)} maxLength={80} placeholder="e.g. School of Nursing" className={inputCls} disabled={!loaded} />
          </Field>

          <Field icon={BadgeCheck} label="Role">
            <select value={role} onChange={e => setRole(e.target.value)} className={inputCls} disabled={!loaded}>
              <option value="">Select your role</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          {msg && (
            <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-white font-bold text-[16px] shadow-md disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${LISTS_BLUE}, #2F80ED)` }}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
