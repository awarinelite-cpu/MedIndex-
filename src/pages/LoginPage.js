// src/pages/LoginPage.js  —  /admin/login
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pill, Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // If already authenticated as admin, go to dashboard
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, user, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Sign in with Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userEmail = cred.user.email;

      // 2. Try exact doc lookup first (doc ID = email)
      let isAdminDoc = false;

      const exactSnap = await getDoc(doc(db, 'admins', userEmail));
      if (exactSnap.exists()) {
        isAdminDoc = exactSnap.data()?.role === 'admin';
      } else {
        // 3. Fallback: query by email field in case doc ID differs
        const q = query(collection(db, 'admins'), where('email', '==', userEmail));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          isAdminDoc = qSnap.docs[0].data()?.role === 'admin';
        }
      }

      if (isAdminDoc) {
        navigate('/admin', { replace: true });
      } else {
        await auth.signOut();
        setError(
          'Admin record not found for ' + userEmail +
          '. Make sure the admins collection has a document with role: "admin" and email: "' + userEmail + '".'
        );
      }
    } catch (err) {
      console.error('Login error:', err.code, err.message);
      const msg =
        err.code === 'auth/invalid-credential'  ||
        err.code === 'auth/wrong-password'       ||
        err.code === 'auth/user-not-found'       ||
        err.code === 'auth/invalid-email'
          ? 'Invalid email or password.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please try again later.'
          : `Login failed: ${err.message}`;
      setError(msg);
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B1F3A' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Checking session…</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0B1F3A 0%, #0F2A50 50%, #0B1F3A 100%)',
      padding: '24px', fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 30% 20%, rgba(0,201,167,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(0,112,243,0.08) 0%, transparent 60%)' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.35)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ background: '#0B1F3A', padding: '28px 32px 24px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#00C9A7,#0070F3)', marginBottom: 14 }}>
              <Pill style={{ width: 26, height: 26, color: '#fff' }} />
            </div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>MedIndex</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,201,167,0.15)', color: '#00C9A7', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
              <Shield style={{ width: 12, height: 12 }} />
              Admin Portal
            </div>
          </div>

          {/* Form */}
          <div style={{ padding: '32px' }}>
            <p style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginBottom: 24, marginTop: 0 }}>
              Sign in with your administrator credentials
            </p>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 20, lineHeight: 1.5 }}>
                <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="admin@medindex.com" autoComplete="email"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#0070F3'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    required placeholder="••••••••" autoComplete="current-password"
                    style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = '#0070F3'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: 4 }}>
                    {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: loading ? '#94A3B8' : 'linear-gradient(135deg,#0070F3,#0050CC)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 20 }}>
          MedIndex Admin · Restricted Access
        </p>
      </div>
    </div>
  );
}
