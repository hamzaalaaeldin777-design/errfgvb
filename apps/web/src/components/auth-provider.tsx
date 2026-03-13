"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

const TOKEN_KEY = "sportstack.token";
const USER_KEY = "sportstack.user";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  ready: boolean;
  setSession: (token: string, user: User) => void;
  clearSession: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshFromToken = useEffectEvent(async (sessionToken: string) => {
    try {
      const payload = await apiFetch<{ user: User }>("/auth/me", {
        token: sessionToken,
      });
      setUser(payload.user);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    } catch {
      clearSession();
    } finally {
      setReady(true);
    }
  });

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (!savedToken) {
      setReady(true);
      return;
    }

    setToken(savedToken);

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser) as User);
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }

    void refreshFromToken(savedToken);
  }, []);

  const setSession = (nextToken: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setReady(true);
  };

  const refreshUser = async () => {
    if (!token) {
      return;
    }

    const payload = await apiFetch<{ user: User }>("/auth/me", { token });
    setUser(payload.user);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  };

  return (
    <AuthContext.Provider
      value={{ user, token, ready, setSession, clearSession, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

