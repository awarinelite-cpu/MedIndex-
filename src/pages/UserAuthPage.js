import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Pill, Eye, EyeOff, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function UserAuthPage() {
  const [mode,     setMode]     = useState('login');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  function friendlyError(code) {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':       return 'Invalid email or password.';
      case 'auth/email-already-in-use': return 'An account with this email already exists.';
      case 'auth/weak-password':        return 'Password must be at least 6 characters.';
      case 'auth/invalid-email':        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':    return 'Too many attempts. Please wait a moment and try again.';
      default:                          return 'Something went wrong. Please try again.';
    }
  }

  async function checkIsAdmin(userEmail) {
    try {
      const exactSnap = await getDoc(doc(db, 'admins', userEmail));
      if (exactSnap.exists() && exactSnap.data()?.role === 'admin') return true;
      const q = query(collection(db, 'admins'), where('email', '==', userEmail));
      const qSnap = await getDocs(q);
      return !qSnap.empty && qSnap.docs[0].data()?.role === 'admin';
    } catch {
      return false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!name.trim())         { setError('Please enter your name.');                return; }
      if (password !== confirm) { setError('Passwords do not match.');                return; }
      if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        // After login, check if admin → send to /admin, otherwise go to intended page
        const adminUser = await checkIsAdmin(email.trim());
        navigate(adminUser ? '/admin' : from, { replace: true });
      } else {
        await register(email.trim(), password, name.trim());
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  }

  function switchMode(m) {
    setMode(m);
    setError('');
    setName(''); setEmail(''); setPassword(''); setConfirm('');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0B1F3A 0%, #0D2D5E 55%, #0B3A5E 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg,#00C9A7,#0070F3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 8px 32px rgba(0,201,167,0.3)'
          }}>
            <Pill style={{ width: 28, height: 28, color: '#fff' }} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            MedIndex
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>
            Clinical Drug Reference · Made by The Elite Nurses
          </p>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {[['login', 'Sign In', LogIn], ['register', 'Create Account', UserPlus]].map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#0B1F3A' : '#94A3B8',
                fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 7, transition: 'all 0.2s'
              }}
            >
              <Icon style={{ width: 15, height: 15 }} />
              {label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px', color: '#0B1F3A' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit}>

            {/* Name — register only */}
            {mode === 'register' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                  Full Name
                </label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Nurse Amara Okonkwo"
                  autoComplete="name"
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor='#0070F3'}
                  onBlur={e  => e.target.style.borderColor='#E2E8F0'}
                />
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                Email Address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete={mode === 'login' ? 'username' : 'email'}
                style={{ width: '100%', padding: '11px 13px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor='#0070F3'}
                onBlur={e  => e.target.style.borderColor='#E2E8F0'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: mode === 'register' ? 14 : 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={{ width: '100%', padding: '11px 42px 11px 13px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor='#0070F3'}
                  onBlur={e  => e.target.style.borderColor='#E2E8F0'}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                  {showPass ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                </button>
              </div>
            </div>

            {/* Confirm password — register only */}
            {mode === 'register' && (
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                  Confirm Password
                </label>
                <input
                  type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor='#0070F3'}
                  onBlur={e  => e.target.style.borderColor='#E2E8F0'}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 13px', marginBottom: 16 }}>
                <AlertCircle style={{ width: 15, height: 15, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#94A3B8' : 'linear-gradient(135deg,#0070F3,#0050CC)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 20 }}>
          By signing in you agree to use this app for clinical reference purposes only.
        </p>
      </div>
    </div>
  );
}
