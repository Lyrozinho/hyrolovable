import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase as cloud } from "@/integrations/supabase/client";
import { supabase as ext } from "@/lib/supabase";
import { warmDashboardStatsSnapshot } from "@/lib/dashboard-stats";
import { heartbeatPresence, logActivity } from "@/lib/reseller-activity";
import type { AdminUser } from "./supabase";

type Session = { token: string; user: AdminUser };

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  sessionKey: string;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; redirectTo?: "/dashboard" | "/my-license" }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const CLIENT_KEY = "hyro_client_session";
const CLIENT_ROLE_HINT_KEY = "hyro_client_role_hint";

export function readClientRoleHint(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(CLIENT_ROLE_HINT_KEY); } catch { return null; }
}

function writeClientRoleHint(role: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (role) localStorage.setItem(CLIENT_ROLE_HINT_KEY, role);
    else localStorage.removeItem(CLIENT_ROLE_HINT_KEY);
  } catch {
    // ignore
  }
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeRole(value: unknown) {
  return typeof value === "string" && value ? value : "user";
}

function normalizeAppRole(value: unknown) {
  const role = normalizeRole(value);
  return role === "admin" ? "admin" : "client";
}

function persistClientSession(session: Session & { expiresAt: number }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLIENT_KEY, JSON.stringify(session));
}

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
      email: normalizeEmail(s.user.email),
      name: (meta.name as string) ?? (meta.full_name as string) ?? null,
      role: normalizeRole(meta.role) === "user" ? "admin" : normalizeRole(meta.role),
    },
  };
}

function normalizeClientSession(parsed: Partial<Session> & { expiresAt?: number }): (Session & { expiresAt?: number }) | null {
  const user = parsed.user as Partial<AdminUser> | undefined;
  if (!parsed.token || !user?.id) return null;
  return {
    token: String(parsed.token),
    user: {
      id: String(user.id),
      email: normalizeEmail(user.email),
      name: typeof user.name === "string" && user.name.trim() ? user.name : null,
      role: normalizeAppRole(user.role),
    },
    expiresAt: parsed.expiresAt,
  };
}

function readClientSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLIENT_KEY);
    if (!raw) return null;
    const parsed = normalizeClientSession(JSON.parse(raw) as Partial<Session> & { expiresAt?: number });
    if (!parsed) {
      localStorage.removeItem(CLIENT_KEY);
      return null;
    }
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(CLIENT_KEY);
      return null;
    }
    return { token: parsed.token, user: parsed.user };
  } catch {
    localStorage.removeItem(CLIENT_KEY);
    return null;
  }
}

async function repairClientSession(current: Session | null): Promise<Session | null> {
  if (!current || current.user.role === "admin" || normalizeEmail(current.user.email)) return current;
  try {
    const { data: user, error } = await ext
      .from("hyro_extension_users")
      .select("id,email,name,role,active")
      .eq("id", current.user.id)
      .maybeSingle();
    if (error || !user || !(user as any).active) return current;
    const fixed: Session & { expiresAt: number } = {
      token: current.token,
      user: {
        id: (user as any).id,
        email: normalizeEmail((user as any).email),
        name: (user as any).name ?? current.user.name ?? null,
        role: normalizeAppRole((user as any).role),
      },
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    };
    persistClientSession(fixed);
    return { token: fixed.token, user: fixed.user };
  } catch {
    return current;
  }
}

export function getSessionHome(session: Session | null): "/dashboard" | "/my-license" {
  return session?.user.role === "client" ? "/my-license" : "/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const sessionKey = useMemo(() => {
    if (!session?.user.id) return "anon";
    return `${session.user.role}:${session.user.id}:${normalizeEmail(session.user.email) || "no-email"}`;
  }, [session?.user.email, session?.user.id, session?.user.role]);

  useEffect(() => {
    const { data: sub } = cloud.auth.onAuthStateChange((_ev, s) => {
      queueMicrotask(() => {
        const admin = toAdminSession(s as any);
        if (admin) {
          localStorage.removeItem(CLIENT_KEY);
          setSession(admin);
        } else {
          const client = readClientSession();
          setSession(client);
          repairClientSession(client).then((fixed) => setSession((cur) => (cur?.token === fixed?.token ? fixed : cur)));
        }
        setAuthReady(true);
        setLoading(false);
      });
    });
    cloud.auth.getSession().then(({ data }) => {
      const admin = toAdminSession(data.session as any);
      const client = admin ? null : readClientSession();
      setSession(admin ?? client);
      if (!admin) repairClientSession(client).then((fixed) => setSession((cur) => (cur?.token === fixed?.token ? fixed : cur)));
      setAuthReady(true);
      setLoading(false);
    }).catch(() => {
      const client = readClientSession();
      setSession(client);
      repairClientSession(client).then((fixed) => setSession((cur) => (cur?.token === fixed?.token ? fixed : cur)));
      setAuthReady(true);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const emailNorm = email.trim().toLowerCase();
    // 1) Try admin (Lovable Auth) first
    const { error } = await cloud.auth.signInWithPassword({ email: emailNorm, password });
    if (!error) {
      const { data: sd } = await cloud.auth.getSession();
      const adm = toAdminSession(sd.session as any);
      if (adm) {
        void logActivity({ id: adm.user.id, email: adm.user.email, name: adm.user.name, role: "admin" }, "login", { method: "password" });
        void heartbeatPresence({ id: adm.user.id, email: adm.user.email, name: adm.user.name, role: "admin" });
      }
      await warmDashboardStatsSnapshot();
      return { redirectTo: "/dashboard" };
    }

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
      const userEmail = normalizeEmail((user as any).email);
      if (!userEmail || !userEmail.includes("@")) return { error: "Cadastro sem e-mail válido. Solicite a correção do cadastro." };
      if (!user.password_hash || user.password_hash !== hash) {
        return { error: "Credenciais inválidas" };
      }
      // Cliente comum precisa de licença ativa. Revendedor entra pelo pacote/saldo
      // de revenda e a criação de licenças continua bloqueada quando não há saldo.
      if (user.role !== "reseller") {
        const nowIso = new Date().toISOString();
        const { data: lics } = await ext
          .from("hyro_extension_licenses")
          .select("id, status, expires_at")
          .eq("user_id", user.id)
          .eq("status", "ativa")
          .gt("expires_at", nowIso);
        const validLic = (lics ?? []).find((l: any) => !String(l.id).startsWith("TST-"));
        if (!validLic) return { error: "Você não possui licença ativa para acessar o painel." };
      }

      const clientSess: Session & { expiresAt: number } = {
        token: `client_${user.id}_${Date.now()}`,
        user: {
          id: user.id,
          email: userEmail,
          name: user.name ?? null,
          role: "client",
        },
        expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
      };
      persistClientSession(clientSess);
      setSession({ token: clientSess.token, user: clientSess.user });
      void logActivity(
        { id: user.id, email: userEmail, name: user.name ?? null, role: user.role },
        "login",
        { method: "password", role: user.role },
      );
      void heartbeatPresence({ id: user.id, email: userEmail, name: user.name ?? null, role: user.role });
      return { redirectTo: "/my-license" };
    } catch (e: any) {
      return { error: error.message === "Invalid login credentials" ? "Credenciais inválidas" : (e?.message ?? error.message) };
    }
  };

  const signOut = async () => {
    if (session?.user) {
      void logActivity(
        { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role },
        "logout",
        {},
      );
    }
    localStorage.removeItem(CLIENT_KEY);
    await cloud.auth.signOut();
    setSession(null);
  };

  return <Ctx.Provider value={{ session, loading, sessionKey, authReady, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
