import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pill, RefreshCw } from 'lucide-react';

export default function ProtectedUserRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [slow, setSlow] = useState(false);

  // If auth is still resolving after 8s (slow/flaky connection), swap the
  // spinner for a message with a manual retry instead of leaving the
  // person staring at "Loading MedIndex…" indefinitely with no way out.
  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0B1F3A', flexDirection: 'column', gap: 16
      }}>
        <div style={{
          width: 44, height: 44, border: '3px solid rgba(0,201,167,0.2)',
          borderTop: '3px solid #00C9A7', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pill style={{ width: 16, height: 16, color: '#00C9A7' }} />
          <span style={{ color: '#64748B', fontSize: 14 }}>Loading MedIndex…</span>
        </div>
        {slow && (
          <div style={{ textAlign: 'center', maxWidth: 280 }}>
            <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
              This is taking longer than usual — check your connection.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: '#00C9A7', color: '#0B1F3A',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} /> Reload
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    // Save where they were trying to go so we redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
