import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase as cloud } from "@/integrations/supabase/client";
import { supabase as ext } from "@/lib/supabase";
import type { AdminUser } from "./supabase";

type Session = { token: string; user: AdminUser };

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const CLIENT_KEY = "hyro_client_session";

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toAdminSession(s: { access_token: string; user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } } | null): Session | null {
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

function readClientSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLIENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session & { expiresAt?: number };
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(CLIENT_KEY);
      return null;
    }
    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = cloud.auth.onAuthStateChange((_ev, s) => {
      const admin = toAdminSession(s as any);
      if (admin) {
        localStorage.removeItem(CLIENT_KEY);
        setSession(admin);
      } else {
        setSession(readClientSession());
      }
    });
    cloud.auth.getSession().then(({ data }) => {
      const admin = toAdminSession(data.session as any);
      setSession(admin ?? readClientSession());
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const emailNorm = email.trim().toLowerCase();
    // 1) Try admin (Lovable Auth) first
    const { error } = await cloud.auth.signInWithPassword({ email: emailNorm, password });
    if (!error) return {};

    // 2) Fallback — client login via hyro_extension_users (license holders)
    try {
      const hash = await sha256Hex(password);
      const { data: user, error: uerr } = await ext
        .from("hyro_extension_users")
        .select("id, email, name, role, active, password_hash")
        .eq("email", emailNorm)
        .maybeSingle();
      if (uerr) throw uerr;
      if (!user || !user.active) return { error: "Credenciais inválidas" };
      if (!user.password_hash || user.password_hash !== hash) {
        return { error: "Credenciais inválidas" };
      }
      // Require at least one active, non-test license
      const nowIso = new Date().toISOString();
      const { data: lics } = await ext
        .from("hyro_extension_licenses")
        .select("id, status, expires_at")
        .eq("user_id", user.id)
        .eq("status", "ativa")
        .gt("expires_at", nowIso);
      const validLic = (lics ?? []).find((l: any) => !String(l.id).startsWith("TST-"));
      if (!validLic) return { error: "Você não possui licença ativa para acessar o painel." };

      const clientSess: Session & { expiresAt: number } = {
        token: `client_${user.id}_${Date.now()}`,
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          role: "client",
        },
        expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
      };
      localStorage.setItem(CLIENT_KEY, JSON.stringify(clientSess));
      setSession({ token: clientSess.token, user: clientSess.user });
      return {};
    } catch (e: any) {
      return { error: error.message === "Invalid login credentials" ? "Credenciais inválidas" : (e?.message ?? error.message) };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(CLIENT_KEY);
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
