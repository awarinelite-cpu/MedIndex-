import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, UserPlus, LogIn, Mail, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function UserAuthPage() {
  const { isDark } = useTheme();
  // Light = the new MedIndex login look; navy kept for dark mode.
  const pal = isDark
    ? { page: 'linear-gradient(135deg, #0B1F3A 0%, #0D2D5E 55%, #0B3A5E 100%)', med: '#fff', tag: '#94A3B8', tabsBg: 'rgba(255,255,255,0.08)', tabsBorder: 'rgba(255,255,255,0.12)', tabOff: '#94A3B8', foot: '#94A3B8' }
    : { page: 'linear-gradient(180deg, #e6efff 0, #f3f7ff 38%, #ffffff 75%)', med: '#0b1d4d', tag: '#44556f', tabsBg: 'rgba(255,255,255,0.75)', tabsBorder: '#cfe0fb', tabOff: '#0b1d4d', foot: '#44556f' };
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

  const NAVY = '#0b1d4d';
  const BLUE = '#1565d8';
  const labelStyle = { display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 8px' };
  const inputStyle = {
    width: '100%', height: 54, padding: '0 20px', borderRadius: 28, boxSizing: 'border-box',
    border: '1.5px solid #dbe5f5', background: '#fff', fontSize: 16, color: NAVY, outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(15,60,140,0.04)', transition: 'border-color .15s, box-shadow .15s'
  };
  const focusOn  = e => { e.target.style.borderColor = '#2a7bf0'; e.target.style.boxShadow = '0 0 0 4px rgba(42,123,240,0.14)'; };
  const focusOff = e => { e.target.style.borderColor = '#dbe5f5'; e.target.style.boxShadow = 'inset 0 1px 2px rgba(15,60,140,0.04)'; };
  const fieldGap = 16;
  // The app styles every <button> with a glossy glass look; this page wants flat fills.
  const flat = { backgroundSize: '100% 100%', backgroundPosition: '0 0', backgroundRepeat: 'no-repeat', filter: 'none' };

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', minHeight: '100vh',
      background: pal.page, padding: '28px 22px 120px',
      fontFamily: "'Inter','Segoe UI',sans-serif"
    }}>
      {/* Decorative waves (top-left + bottom) */}
      <svg aria-hidden="true" viewBox="0 0 360 360" preserveAspectRatio="xMinYMin meet"
        style={{ position: 'absolute', top: 0, left: 0, width: 'min(34vw, 190px)', height: 'auto', opacity: isDark ? 0.5 : 1, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="lw1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f5fe0" /><stop offset="1" stopColor="#4d92f7" /></linearGradient>
          <linearGradient id="lw2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8db8fb" /><stop offset="1" stopColor="#d4e5fd" /></linearGradient>
        </defs>
        <path d="M0 0 H345 C300 40 250 40 215 85 C175 140 205 190 150 245 C110 285 55 300 0 345 Z" fill="url(#lw2)" opacity="0.85" />
        <path d="M0 0 H245 C215 45 160 50 120 95 C80 140 95 180 55 215 C35 232 15 240 0 250 Z" fill="url(#lw1)" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 1086 150" preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 110, opacity: isDark ? 0.5 : 1, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="bw1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#bcd6fb" /><stop offset="1" stopColor="#6aa5f8" /></linearGradient>
          <linearGradient id="bw2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2f78ec" /><stop offset="1" stopColor="#1d62dc" /></linearGradient>
        </defs>
        <path d="M0 40 C200 0 380 20 560 70 C760 125 930 110 1086 55 V150 H0 Z" fill="url(#bw1)" opacity="0.8" />
        <path d="M0 95 C220 55 420 80 620 118 C800 150 960 135 1086 100 V150 H0 Z" fill="url(#bw2)" />
      </svg>
      <div aria-hidden="true" style={{ position: 'absolute', right: -70, top: 190, width: 150, height: 150, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(42,123,240,0.07)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 430, margin: '0 auto' }}>

        {/* Decorative plus signs + stethoscope art */}
        {[{ l: '19%', t: 22, s: 38 }, { l: '9%', t: 70, s: 20 }].map((pl, i) => (
          <svg key={i} aria-hidden="true" viewBox="0 0 24 24" style={{ position: 'absolute', left: pl.l, top: pl.t, width: pl.s, height: pl.s, pointerEvents: 'none' }}>
            <path d="M9 2h6a1.5 1.5 0 0 1 1.5 1.5V9H22a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 22 15h-5.5v5.5A1.5 1.5 0 0 1 15 22H9a1.5 1.5 0 0 1-1.5-1.5V15H2a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 2 9h5.5V3.5A1.5 1.5 0 0 1 9 2z" fill={isDark ? '#1d3a6b' : '#c7d8f6'} />
          </svg>
        ))}
        {!isDark && (
          <img src="/img/login-art.webp" alt="" aria-hidden="true"
            style={{ position: 'absolute', top: -28, right: -22, width: '46%', maxWidth: 200, height: 'auto', pointerEvents: 'none', userSelect: 'none' }} />
        )}

        {/* Logo */}
        <div style={{ position: 'relative', textAlign: 'center', paddingTop: 8, marginBottom: 22 }}>
          <svg viewBox="0 0 100 100" width="68" height="68" role="img" aria-label="MedIndex"
            style={{ display: 'block', margin: '0 auto 10px', filter: 'drop-shadow(0 10px 16px rgba(17,85,216,0.35))' }}>
            <defs>
              <linearGradient id="appIcon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f86f6" /><stop offset="1" stopColor="#0f48c4" /></linearGradient>
            </defs>
            <rect x="2" y="2" width="96" height="96" rx="26" fill="url(#appIcon)" />
            <g transform="rotate(-38 50 48)">
              <rect x="22" y="33" width="56" height="30" rx="15" fill="#fff" />
              <path d="M50 33 h13 a15 15 0 0 1 0 30 h-13 z" fill="#dfe9fb" />
              <path d="M50 33 v30" stroke="#b9cdf0" strokeWidth="1.5" />
              <path d="M30 40 q6 -4 14 -4" stroke="#fff" strokeWidth="0" fill="none" />
            </g>
            <path d="M22 70 C34 84 62 84 80 62" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
          </svg>
          <h1 style={{ margin: '0 0 6px', fontSize: 38, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.1, color: pal.med }}>
            Med<span style={{ color: isDark ? '#5ea2ff' : BLUE }}>Index</span>
          </h1>
          <p style={{ margin: 0, color: pal.tag, fontSize: 12.5, fontWeight: 500 }}>
            Clinical Drug Reference <span style={{ margin: '0 5px' }}>&bull;</span> Made by The Elite Nurses
          </p>
        </div>

        {/* Tab toggle */}
        <div style={{
          display: 'flex', background: pal.tabsBg, border: `1.5px solid ${pal.tabsBorder}`, borderRadius: 40,
          padding: 4, marginBottom: 20, boxShadow: isDark ? 'none' : '0 6px 18px -10px rgba(21,101,216,0.35)'
        }}>
          {[['login', 'Sign In', LogIn], ['register', 'Create Account', UserPlus]].map(([m, label, Icon]) => {
            const on = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  ...flat, flex: 1, height: 46, padding: '0 8px', borderRadius: 32, border: 'none', cursor: 'pointer',
                  background: on ? 'linear-gradient(100deg,#0a4cbd,#2a85f4)' : 'transparent',
                  color: on ? '#fff' : pal.tabOff,
                  boxShadow: on ? '0 8px 16px -8px rgba(10,76,189,0.7)' : 'none',
                  fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 9, transition: 'all 0.2s'
                }}
              >
                <Icon style={{ width: 20, height: 20 }} strokeWidth={2.2} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 36, padding: '26px 22px 24px',
          boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.35)' : '0 22px 44px -22px rgba(21,101,216,0.5)',
          border: isDark ? 'none' : '1px solid #e3ecf9'
        }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
            <span style={{ width: 4, borderRadius: 4, background: 'linear-gradient(180deg,#1565d8,#2a85f4)', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px', color: NAVY, letterSpacing: '-0.6px', lineHeight: 1.15 }}>
                {mode === 'login' ? <>Welcome back <span role="img" aria-label="waving hand">{'👋'}</span></> : 'Create your account'}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#44556f', textAlign: 'left', hyphens: 'none', WebkitHyphens: 'none', lineHeight: 1.35 }}>
                {mode === 'login' ? 'Sign in to access clinical drug information' : 'Join to access clinical drug information'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Name — register only */}
            {mode === 'register' && (
              <div style={{ marginBottom: fieldGap }}>
                <label htmlFor="auth-name" style={labelStyle}>
                  <User style={{ width: 22, height: 22, color: BLUE }} strokeWidth={2.2} /> Full Name
                </label>
                <input
                  id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Nurse Amara Okonkwo"
                  autoComplete="name"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff}
                />
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: fieldGap }}>
              <label htmlFor="auth-email" style={labelStyle}>
                <Mail style={{ width: 22, height: 22, color: BLUE }} strokeWidth={2.2} /> Email Address
              </label>
              <input
                id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete={mode === 'login' ? 'username' : 'email'}
                style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: mode === 'register' ? fieldGap : 22 }}>
              <label htmlFor="auth-password" style={labelStyle}>
                <Lock style={{ width: 22, height: 22, color: BLUE }} strokeWidth={2.2} /> Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-password" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={{ ...inputStyle, paddingRight: 54 }} onFocus={focusOn} onBlur={focusOff}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{ ...flat, position: 'absolute', right: 8, top: 0, bottom: 0, width: 44, background: 'none', boxShadow: 'none', border: 'none', borderRadius: 22, cursor: 'pointer', color: '#5b6b86', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'none' }}>
                  {showPass ? <Eye style={{ width: 22, height: 22 }} /> : <EyeOff style={{ width: 22, height: 22 }} />}
                </button>
              </div>
            </div>

            {/* Confirm password — register only */}
            {mode === 'register' && (
              <div style={{ marginBottom: 22 }}>
                <label htmlFor="auth-confirm" style={labelStyle}>
                  <Lock style={{ width: 22, height: 22, color: BLUE }} strokeWidth={2.2} /> Confirm Password
                </label>
                <input
                  id="auth-confirm" type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 20, padding: '10px 14px', marginBottom: 16 }}>
                <AlertCircle style={{ width: 16, height: 16, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              ...flat, position: 'relative', width: '100%', height: 56,
              background: loading ? '#94A3B8' : 'linear-gradient(100deg,#0a47b8,#1b8dff)',
              color: '#fff', border: 'none', borderRadius: 32,
              boxShadow: loading ? 'none' : '0 14px 24px -12px rgba(10,76,189,0.75)',
              fontWeight: 700, fontSize: 18, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
            }}>
              {loading ? (
                mode === 'login' ? 'Signing in…' : 'Creating account…'
              ) : (
                <>
                  {mode === 'login' ? <LogIn style={{ width: 22, height: 22 }} strokeWidth={2.2} /> : <UserPlus style={{ width: 22, height: 22 }} strokeWidth={2.2} />}
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowRight style={{ width: 18, height: 18 }} strokeWidth={2.4} />
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
          <span style={{ flex: 1, height: 1.5, background: isDark ? 'rgba(255,255,255,0.15)' : '#cddcf5' }} />
          <ShieldCheck style={{ width: 24, height: 24, color: isDark ? '#5ea2ff' : BLUE, flexShrink: 0 }} fill={isDark ? 'none' : '#d9e7fd'} strokeWidth={2.2} />
          <p style={{ margin: 0, maxWidth: 270, textAlign: 'center', color: pal.foot, fontSize: 12.5, lineHeight: 1.4 }}>
            By signing in you agree to use this app for <span style={{ color: isDark ? '#5ea2ff' : BLUE, fontWeight: 600 }}>clinical reference</span> purposes only.
          </p>
          <span style={{ flex: 1, height: 1.5, background: isDark ? 'rgba(255,255,255,0.15)' : '#cddcf5' }} />
        </div>
      </div>
    </div>
  );
}
