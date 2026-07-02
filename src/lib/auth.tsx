import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase as cloud } from "@/integrations/supabase/client";
import type { AdminUser } from "./supabase";

type Session = { token: string; user: AdminUser };

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function toSession(s: { access_token: string; user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } } | null): Session | null {
  if (!s?.user) return null;
  const meta = s.user.user_metadata ?? {};
  return {
    token: s.access_token,
    user: {
      id: s.user.id,
      email: s.user.email ?? "",
      name: (meta.name as string) ?? (meta.full_name as string) ?? null,
      role: (meta.role as string) ?? "admin",
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = cloud.auth.onAuthStateChange((_ev, s) => {
      setSession(toSession(s as any));
    });
    cloud.auth.getSession().then(({ data }) => {
      setSession(toSession(data.session as any));
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await cloud.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message };
    return {};
  };

  const signOut = async () => {
    await cloud.auth.signOut();
    setSession(null);
  };

  return <Ctx.Provider value={{ session, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
