// src/components/BackNavButton.js
// Browser/desktop "Back" button used in the Layout and AdminLayout headers.
// Goes back one step in router history; if there is no in-app history
// (page opened directly / refreshed) it falls back to `fallback`.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackNavButton({ fallback = '/', className = '', style }) {
  const navigate = useNavigate();

  const goBack = () => {
    // react-router v6 (browser router) stores the entry index in history.state
    const idx = window.history.state && window.history.state.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={goBack}
      title="Back"
      aria-label="Go back"
      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${className}`}
      style={style}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
