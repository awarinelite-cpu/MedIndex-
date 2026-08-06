// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      // Resolve the loading screen the moment auth itself settles — don't
      // make the splash screen wait on a Firestore round-trip (admin lookup)
      // on top of that. Firestore's persistent multi-tab cache can take a
      // while (or occasionally hang) to acquire its lease on first load,
      // especially over a flaky mobile connection, and there's no reason
      // the whole app should sit on a spinner for that: nothing before the
      // admin-only UI needs isAdmin to be known yet.
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        getDoc(doc(db, 'admins', firebaseUser.email))
          .then(snap => setIsAdmin(snap.exists() && snap.data()?.role === 'admin'))
          .catch(() => setIsAdmin(false));
      } else {
        setIsAdmin(false);
      }
    });
    return unsub;
  }, []);

  const login    = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout   = () => signOut(auth);
  const register = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    return cred.user;
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
