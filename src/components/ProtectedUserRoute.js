import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pill } from 'lucide-react';

export default function ProtectedUserRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

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
      </div>
    );
  }

  if (!user) {
    // Save where they were trying to go so we redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
