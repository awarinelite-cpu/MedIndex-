// src/components/AppLockGate.js
// Wraps the whole route tree. If the signed-in user has fingerprint unlock
// enabled on this device, shows BiometricLockScreen in front of everything
// until it succeeds. Purely in-memory (`unlocked`), so a fresh app open —
// full page load or PWA relaunch — always re-locks, while normal in-app
// navigation between pages never re-prompts.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isBiometricEnrolled } from '../utils/biometricAuth';
import BiometricLockScreen from './BiometricLockScreen';

export default function AppLockGate({ children }) {
  const { user, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(false);

  // Re-lock whenever the signed-in account changes (e.g. sign out, then a
  // different account signs in on the same device).
  useEffect(() => { setUnlocked(false); }, [user?.uid]);

  if (!loading && user && isBiometricEnrolled(user.email) && !unlocked) {
    return <BiometricLockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return children;
}
