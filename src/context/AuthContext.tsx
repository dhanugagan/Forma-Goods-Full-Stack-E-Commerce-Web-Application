import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { AppUser } from '../types.ts';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: AppUser | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<AppUser | null>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const syncUserWithBackend = useCallback(async (user: FirebaseUser): Promise<AppUser | null> => {
    try {
      const token = await user.getIdToken();
      tokenRef.current = token;
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to authenticate session.');
      }
      const data = await res.json();
      setDbUser(data.user);
      setAuthError(null);
      return data.user;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication sync failed.';
      setAuthError(message);
      setDbUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncUserWithBackend(user);
      } else {
        tokenRef.current = null;
        setDbUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [syncUserWithBackend]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      setFirebaseUser(result.user);
      return await syncUserWithBackend(result.user);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Google Sign-In was cancelled or failed.';
      setAuthError(message);
      return null;
    }
  }, [syncUserWithBackend]);

  const logout = useCallback(async () => {
    await signOut(auth);
    tokenRef.current = null;
    setFirebaseUser(null);
    setDbUser(null);
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken();
    tokenRef.current = token;
    return token;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await syncUserWithBackend(auth.currentUser);
    }
  }, [syncUserWithBackend]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        loading,
        authError,
        signInWithGoogle,
        logout,
        getIdToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
