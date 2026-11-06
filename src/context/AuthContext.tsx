"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  getToken,
  setToken,
  removeToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  clearAuth,
  apiGet,
} from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Shared User type — mirrors RoleContext.User exactly.
// Defined here (not imported) to avoid circular dependency since
// RoleContext imports useAuth from here.
// ---------------------------------------------------------------------------
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id?: number;
  permissions?: string[];
  branch?: string;
  department?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper: map backend role to frontend role (UPPER_SNAKE)
// ---------------------------------------------------------------------------

const ROLE_MAP: Record<string, string> = {
  super_admin: "SUPER_ADMIN",
  admin: "ADMIN",
  hr: "HR",
  manager: "MANAGER",
  employee: "EMPLOYEE",
};

function mapRole(backendRole: string | undefined | null): string {
  if (!backendRole) return "EMPLOYEE";
  const lower = backendRole.toLowerCase();
  if (ROLE_MAP[lower]) return ROLE_MAP[lower];
  return backendRole.toUpperCase().replace(/\s+/g, "_");
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // --------------------------------------------------
  // Bootstrap: check for existing token & fetch /me
  // --------------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      try {
        // Fetch user profile from backend
        const userData = await apiGet<{
          id: string;
          name: string;
          email: string;
          role: string;
          role_id?: number;
          permissions?: string[];
          branch?: string;
          department?: string;
        }>("/auth/me");

        const mappedUser: User = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: mapRole(userData.role),
          role_id: userData.role_id,
          permissions: userData.permissions || [],
          branch: userData.branch,
          department: userData.department,
        };

        setState({ user: mappedUser, isAuthenticated: true, isLoading: false });
      } catch {
        // Token invalid/expired — clear and proceed as unauthenticated
        clearAuth();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    };

    initAuth();
  }, []);

  // --------------------------------------------------
  // login — calls the backend, stores tokens, fetches /me
  // --------------------------------------------------
  const login = useCallback(async (email: string, password: string) => {
    // Use bare fetch to avoid the interceptor (which needs auth to exist)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";

    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!json.success) {
      // Extract the most helpful error message
      let errorMsg = json.message || "Login failed";
      if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
        errorMsg = json.errors.map((e: { field?: string; message: string }) => e.message).join("; ");
      }
      throw new Error(errorMsg);
    }

    const { token, refreshToken: rt, employee } = json.data;

    // Store tokens
    setToken(token);
    if (rt) setRefreshToken(rt);

    // Build user from login response (uses employee or top-level fields)
    const userFromLogin = employee || json.data;
    const permissions = json.data?.permissions || userFromLogin?.permissions || [];
    const mappedUser: User = {
      id: userFromLogin.id,
      name: userFromLogin.name,
      email: userFromLogin.email,
      role: mapRole(userFromLogin.role),
      role_id: userFromLogin.role_id,
      permissions,
      branch: userFromLogin.branch || userFromLogin.office_id,
      department: userFromLogin.department,
    };

    setState({ user: mappedUser, isAuthenticated: true, isLoading: false });
  }, []);

  // --------------------------------------------------
  // logout — tells backend, clears local state
  // --------------------------------------------------
  const logout = useCallback(async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";
    const token = getToken();
    try {
      // Fire-and-forget to backend; bare fetch to avoid interceptor
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => { });
      }
    } finally {
      clearAuth();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  // --------------------------------------------------
  // refreshUser — re-fetch /me (e.g. after profile update)
  // --------------------------------------------------
  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiGet<{
        id: string;
        name: string;
        email: string;
        role: string;
        role_id?: number;
        permissions?: string[];
        branch?: string;
        department?: string;
      }>("/auth/me");

      const mappedUser: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: mapRole(userData.role),
        role_id: userData.role_id,
        permissions: userData.permissions || [],
        branch: userData.branch,
        department: userData.department,
      };

      setState((prev) => ({ ...prev, user: mappedUser }));
    } catch {
      // If /me fails, log the user out
      clearAuth();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
