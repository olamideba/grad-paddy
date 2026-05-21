"use client";

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from "react";
import {
  onAuthStateChanged, signInWithPopup, signOut as fbSignOut,
  User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { usersApi } from "@/lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await usersApi.createOrFetch(u.email!, u.displayName ?? u.email!, u.photoURL ?? undefined)
          .catch(() => {});
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signOut() {
    await fbSignOut(auth);
  }

  return <Ctx.Provider value={{ user, loading, signInWithGoogle, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
