// src/components/BackButtonHandler.js
// Wires the Android hardware back button to in-app navigation instead of
// the native default (which just closes the app from any screen, since
// this is a single-Activity Capacitor app with no listener registered).
//
// Behavior:
//   - On any page other than Home: go back one page (router history).
//   - On Home: first press shows a "Press back again to exit" hint;
//     a second press within 2s actually exits the app.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const EXIT_WINDOW_MS = 2000;

export default function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  const lastBackPressRef = useRef(0);
  const [showExitHint, setShowExitHint] = useState(false);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const isHome = locationRef.current.pathname === '/';

      if (!isHome) {
        navigate(-1);
        return;
      }

      const now = Date.now();
      if (now - lastBackPressRef.current < EXIT_WINDOW_MS) {
        CapacitorApp.exitApp();
        return;
      }
      lastBackPressRef.current = now;
      setShowExitHint(true);
      setTimeout(() => setShowExitHint(false), EXIT_WINDOW_MS);
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);

  if (!showExitHint) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '84px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.82)',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: '20px',
        fontSize: '14px',
        zIndex: 9999,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      Press back again to exit
    </div>
  );
}
