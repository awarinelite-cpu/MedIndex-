// src/components/ProtectedAdminRoute.js
// Guards /admin and /admin/upload.
// Not logged in → /admin/login
// Logged in but not admin → access denied message
import React from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedAdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F0F4F8', fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Checking access…</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F0F4F8', fontFamily: "'Inter','Segoe UI',sans-serif", padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{
            width: 56, height: 56, background: '#FEF2F2', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <ShieldOff style={{ width: 26, height: 26, color: '#DC2626' }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
            Access Denied
          </h2>
          <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px' }}>
            Your account ({user.email}) does not have admin privileges.
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block', padding: '10px 24px', borderRadius: 10,
              background: '#0B1F3A', color: '#fff', fontWeight: 700, fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Sign in with a different account
          </a>
        </div>
      </div>
    );
  }

  return children;
}
