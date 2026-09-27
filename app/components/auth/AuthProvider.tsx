"use client";

import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { auth } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    /*
     * Listener dibuat setelah persistence selesai.
     * Dengan begitu Firebase akan membaca session
     * login yang tersimpan sebelum aplikasi menganggap
     * user sebagai unauthenticated.
     */
    const initializeAuth = async () => {
      try {
        await setPersistence(
          auth,
          browserLocalPersistence
        );

        if (!mounted) {
          return;
        }

        const unsubscribe = onAuthStateChanged(
          auth,
          (currentUser) => {
            if (!mounted) {
              return;
            }

            console.log(
              "[AuthProvider] Auth state:",
              currentUser
                ? {
                    uid: currentUser.uid,
                    email: currentUser.email,
                  }
                : null
            );

            setUser(currentUser);
            setLoading(false);
          }
        );

        /*
         * Simpan unsubscribe ke property cleanup.
         */
        cleanupRef = unsubscribe;
      } catch (error) {
        console.error(
          "[AuthProvider] Gagal menginisialisasi Firebase Auth:",
          error
        );

        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    let cleanupRef: (() => void) | undefined;

    void initializeAuth();

    return () => {
      mounted = false;
      cleanupRef?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,

      logout: async () => {
        await signOut(auth);
      },
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth harus digunakan di dalam AuthProvider."
    );
  }

  return context;
}