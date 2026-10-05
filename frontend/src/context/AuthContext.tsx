import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, onUnauthorized, tokenStore } from "@/lib/api";
import { setCurrency } from "@/lib/format";
import type { AuthResponse, User } from "@/types";

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  organization_name: string;
}

interface AuthState {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setSession: (response: AuthResponse) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(() => Boolean(tokenStore.get()));

  const setUser = useCallback((next: User) => {
    setCurrency(next.organization?.currency ?? "USD");
    setUserState(next);
  }, []);

  const setSession = useCallback(
    ({ token, user: next }: AuthResponse) => {
      tokenStore.set(token);
      setUser(next);
    },
    [setUser],
  );

  // Restore the session from a stored token.
  useEffect(() => {
    onUnauthorized(() => setUserState(null));
    if (!tokenStore.get()) return;
    api
      .get<User>("/auth/me/")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setInitializing(false));
  }, [setUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setSession(await api.post<AuthResponse>("/auth/login/", { email, password }));
    },
    [setSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setSession(await api.post<AuthResponse>("/auth/register/", payload));
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      /* token may already be invalid — sign out locally regardless */
    }
    tokenStore.clear();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout, setUser, setSession }),
    [user, initializing, login, register, logout, setUser, setSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
