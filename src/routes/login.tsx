import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Mail, Lock, Eye, EyeOff, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getSessionHome, sha256Hex, useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase as ext } from "@/lib/supabase";
import { enforceIpLock } from "@/lib/ip-lock";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

const REMEMBER_KEY = "hyro_login_remember_email";

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");

  // login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // signup state
  const [suFirst, setSuFirst] = useState("");
  const [suLast, setSuLast] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suRemember, setSuRemember] = useState(true);
  const [suShow, setSuShow] = useState(false);
  const [suSubmitting, setSuSubmitting] = useState(false);
  

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && session && !submitting) navigate({ to: getSessionHome(session), replace: true });
  }, [loading, session, submitting, navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error, redirectTo } = await signIn(email, password);
    if (error) {
      setSubmitting(false);
      toast.error(error);
      return;
    }
    // Trava-IP (só front) para clientes com licença criada por admin/Lael.
    if (redirectTo === "/my-license") {
      try {
        const { data: u } = await ext
          .from("hyro_extension_users")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();
        const uid = (u as any)?.id as string | undefined;
        if (uid) {
          const ipErr = await enforceIpLock(uid);
          if (ipErr) {
            const { supabase: cloud } = await import("@/integrations/supabase/client");
            try { localStorage.removeItem("hyro_client_session"); } catch {}
            await cloud.auth.signOut();
            setSubmitting(false);
            toast.error(ipErr);
            return;
          }
        }
      } catch { /* best-effort */ }
    }
    setSubmitting(false);
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim().toLowerCase());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* ignore */ }
    toast.success("Bem-vindo!");
    navigate({ to: redirectTo ?? getSessionHome(session), replace: true });
  };






  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Soft top/bottom wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, color-mix(in oklab, var(--color-foreground) 5%, transparent), transparent 60%), radial-gradient(ellipse 70% 50% at 50% 110%, color-mix(in oklab, var(--color-foreground) 4%, transparent), transparent 60%)",
        }}
      />

      {/* Two subtle aurora glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full blur-3xl opacity-[0.12] dark:opacity-[0.18] animate-hyro-float-a"
        style={{ background: "radial-gradient(circle, oklch(0.68 0.18 250) 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 -right-32 h-[560px] w-[560px] rounded-full blur-3xl opacity-[0.10] dark:opacity-[0.16] animate-hyro-float-b"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.16 300) 0%, transparent 65%)" }}
      />

      {/* Fine grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--color-foreground) 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-foreground) 5%, transparent) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 35%, black 25%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 35%, black 25%, transparent 80%)",
        }}
      />

      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 85% at 50% 50%, transparent 60%, color-mix(in oklab, var(--color-background) 60%, transparent) 100%)",
        }}
      />
      <header className="relative h-14 flex items-center px-6 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center shadow-sm">
            <span className="text-[11px] font-bold text-background tracking-tight">H</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight">Hyro</span>
            <span className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">Admin Console</span>
          </div>
        </div>
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      <div className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">
          <div className="relative rounded-2xl bg-card border border-border shadow-elegant p-8 sm:p-9">
            <>
                <div className="mb-6">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Acesso seguro</div>
                </div>

                <form onSubmit={onLogin} className="space-y-4">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h1 className="text-[22px] font-semibold tracking-tight leading-tight">Entrar no painel</h1>
                      <p className="text-[13px] text-muted-foreground mt-1.5">Acesse com suas credenciais.</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg border border-border bg-secondary/40 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4 text-foreground/70" />
                    </div>
                  </div>

                  <FieldWithIcon icon={<Mail className="h-4 w-4" />} label="E-mail">
                    <Input id="email" type="email" autoComplete="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com"
                      className="h-11 pl-10 pr-3 text-sm bg-secondary/30 border-border/80" />
                  </FieldWithIcon>

                  <FieldWithIcon icon={<Lock className="h-4 w-4" />} label="Senha">
                    <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                      required value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••" className="h-11 pl-10 pr-10 text-sm bg-secondary/30 border-border/80" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent"
                      aria-label={showPassword ? "Ocultar" : "Mostrar"}>
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </FieldWithIcon>

                  <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground select-none cursor-pointer">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} className="border-0 bg-secondary/60 data-[state=checked]:bg-primary" />
                    Salvar senha neste dispositivo
                  </label>

                  <Button type="submit" className="w-full h-11 text-sm font-medium gap-2" disabled={submitting}>
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Autenticando…</> : <>Entrar no painel <ArrowRight className="h-3.5 w-3.5" /></>}
                  </Button>

                  <div className="text-center text-[12px] text-muted-foreground pt-2">
                    Não tem conta? <a href="/signup" className="text-primary hover:underline">Criar conta</a>
                  </div>
                </form>
              </>


          </div>

          <p className="mt-6 text-[11px] text-muted-foreground/80 leading-relaxed text-center px-4">
            Acesso restrito e monitorado. Todas as ações são registradas em auditoria.
          </p>
        </div>
      </div>

      <footer className="relative h-12 border-t border-border/60 flex items-center justify-end px-6 text-[11px] text-muted-foreground">
        <span className="font-mono tracking-tight">v1.0 · secure</span>
      </footer>
    </div>
  );
}

function FieldWithIcon({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</Label>
      <div className="group relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground">
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}

