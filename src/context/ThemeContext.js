import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ── ThemeContext ────────────────────────────────────────────────────────────
// Simple class-based dark mode: toggles a 'dark' class on <html>, which
// tailwind.config.js (darkMode: 'class') and the .dark overrides in
// index.css key off of. Preference is persisted in localStorage; if the
// user has never chosen, falls back to the OS/browser's prefers-color-scheme.
const ThemeContext = createContext(null);
const STORAGE_KEY = 'medindex-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  // Follow OS changes only if the user hasn't explicitly chosen a theme yet.
  useEffect(() => {
    let hasStoredPref = false;
    try { hasStoredPref = !!window.localStorage.getItem(STORAGE_KEY); } catch {}
    if (hasStoredPref || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
