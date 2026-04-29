"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type UserRoleType = "CEO" | "Team Lead" | "Member" | "Admin";

export type AuthUser = {
  id: string;
  name: string;
  role: string;
  roleType: UserRoleType;
  email: string;
  avatarColor: string;
  initials: string;
  department?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isCEO: boolean;
  isLead: boolean;
  isMember: boolean;
  /** Admin has full access to every menu, dashboard, and analytics view */
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
};

const STORAGE_KEY = "projecthub_session";

// Normalize Lambda (snake_case) or legacy (camelCase) user objects to AuthUser
function normalizeUser(raw: Record<string, unknown>): AuthUser {
  return {
    id:          String(raw.id ?? ""),
    name:        String(raw.name ?? ""),
    role:        String(raw.role ?? ""),
    roleType:    (raw.roleType ?? raw.role_type ?? "Member") as UserRoleType,
    email:       String(raw.email ?? ""),
    avatarColor: String(raw.avatarColor ?? raw.avatar_color ?? "#4f46e5"),
    department:  raw.department ? String(raw.department) : undefined,
    initials:    raw.initials
      ? String(raw.initials)
      : String(raw.name ?? "?").charAt(0).toUpperCase(),
  };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try cookie-based session first, fall back to localStorage cache
  useEffect(() => {
    async function restoreSession() {
      try {
        // Try to verify session via cookie (server-authoritative)
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          const userData = normalizeUser(json.user ?? json);
          setUser(userData);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
          return;
        }
      } catch {
        // Network error — fall through to localStorage cache
      }

      // Offline/fallback: use cached user from localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored) as AuthUser);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession().finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error ?? data.detail ?? "Login failed." };
      }

      const userData = normalizeUser(data.user ?? data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Best-effort: still clear local state
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        isCEO: user?.roleType === "CEO",
        isLead: user?.roleType === "Team Lead",
        isMember: user?.roleType === "Member",
        isAdmin: user?.roleType === "Admin",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
