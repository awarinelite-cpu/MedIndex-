// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Admin docs may be keyed by email OR by uid, and may store the
          // email in a field rather than the doc id — check all three, the
          // same way the login pages do, so isAdmin is detected consistently.
          let admin = false;
          const byEmail = await getDoc(doc(db, 'admins', firebaseUser.email));
          if (byEmail.exists() && byEmail.data()?.role === 'admin') {
            admin = true;
          } else {
            const byUid = await getDoc(doc(db, 'admins', firebaseUser.uid));
            if (byUid.exists() && byUid.data()?.role === 'admin') {
              admin = true;
            } else {
              const q = query(collection(db, 'admins'), where('email', '==', firebaseUser.email));
              const qSnap = await getDocs(q);
              admin = !qSnap.empty && qSnap.docs[0].data()?.role === 'admin';
            }
          }
          setIsAdmin(admin);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
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
