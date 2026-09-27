"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, User } from "@/lib/api/client";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "review_token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function writeToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token === null) window.localStorage.removeItem(TOKEN_KEY);
  else window.localStorage.setItem(TOKEN_KEY, token);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    const initial = readToken();
    return !!initial;
  });

  const refreshUser = useCallback(async () => {
    await Promise.resolve();
    const current = readToken();
    if (!current) {
      writeToken(null);
      setToken(null);
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/api/auth/me");
      setToken(current);
      setUser(me);
    } catch {
      writeToken(null);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUser();
  }, [token, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const res = await api<{ access_token: string; token_type?: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        writeToken(res.access_token);
        setToken(res.access_token);
        await refreshUser();
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    },
    [refreshUser, router],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const res = await api<{ access_token: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        writeToken(res.access_token);
        setToken(res.access_token);
        await refreshUser();
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    },
    [refreshUser, router],
  );

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
