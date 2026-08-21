// src/components/BiometricLockScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { Fingerprint, KeyRound, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { verifyBiometric } from '../utils/biometricAuth';

export default function BiometricLockScreen({ onUnlock }) {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | checking | error
  const [error, setError] = useState('');

  const attempt = useCallback(async () => {
    if (!user?.email) return;
    setStatus('checking');
    setError('');
    try {
      await verifyBiometric(user.email);
      onUnlock();
    } catch (e) {
      setStatus('error');
      setError(
        e.name === 'NotAllowedError'
          ? 'Fingerprint not recognized. Try again.'
          : (e.message || 'Could not verify fingerprint on this device.')
      );
    }
  }, [user, onUnlock]);

  // Prompt automatically the moment the lock screen appears.
  useEffect(() => { attempt(); }, [attempt]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #0B1F3A 0%, #0D2D5E 55%, #0B3A5E 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif", color: '#fff', textAlign: 'center',
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
      }}>
        {status === 'checking'
          ? <RefreshCw style={{ width: 34, height: 34, animation: 'spin 0.8s linear infinite' }} />
          : <Fingerprint style={{ width: 40, height: 40 }} />}
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>MedIndex is locked</h1>
      <p style={{ color: '#94A3B8', fontSize: 14, margin: '0 0 4px' }}>
        {user?.displayName || user?.email}
      </p>

      {error && (
        <p style={{ color: '#FCA5A5', fontSize: 13, margin: '10px 0 0', maxWidth: 280 }}>{error}</p>
      )}

      <button
        onClick={attempt}
        disabled={status === 'checking'}
        style={{
          marginTop: 22, padding: '13px 30px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#00C9A7,#0070F3)', color: '#fff',
          fontWeight: 700, fontSize: 15, cursor: status === 'checking' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'checking' ? 'Verifying…' : 'Unlock with Fingerprint'}
      </button>

      <button
        onClick={logout}
        style={{
          marginTop: 18, background: 'none', border: 'none', color: '#64748B',
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <KeyRound style={{ width: 14, height: 14 }} /> Use password instead
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
