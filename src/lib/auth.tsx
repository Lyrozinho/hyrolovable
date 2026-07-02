import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type AdminUser } from "./supabase";

type Session = { token: string; user: AdminUser };

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "hyro_admin_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { data, error } = await supabase.rpc("admin_login", {
      p_email: email,
      p_password: password,
    });
    if (error) return { error: error.message };
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return { error: "Credenciais inválidas" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.token) return { error: "Credenciais inválidas" };
    const s: Session = {
      token: row.token,
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSession(s);
    return {};
  };

  const signOut = async () => {
    if (session?.token) {
      try {
        await supabase.from("hyro_extension_sessions").delete().eq("token", session.token);
      } catch {}
    }
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  return <Ctx.Provider value={{ session, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
