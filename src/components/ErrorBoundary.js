// src/components/ErrorBoundary.js
// Catches render-time crashes anywhere below it in the tree. Without this,
// an uncaught error in any component unmounts the whole React tree and the
// page just goes silent/frozen — buttons stop responding with no visible
// sign anything went wrong. This shows a recoverable screen instead and
// logs the real error to the console so it can be diagnosed.

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          background: '#0B1F3A', color: '#fff', textAlign: 'center',
        }}>
          <AlertTriangle style={{ width: 36, height: 36, color: '#F59E0B' }} />
          <div style={{ fontSize: 16, fontWeight: 700 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#94A3B8', maxWidth: 320 }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 20px', background: '#00C9A7', color: '#0B1F3A',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
