import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Mail, Lock, Eye, EyeOff, ShieldCheck, User as UserIcon, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getSessionHome, sha256Hex, useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase as ext } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

const WHATSAPP_NUMBER = "5527981359051";
const APPROVAL_MSG = "Olá, acabei de criar meu cadastro, solicito aprovação.";
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
  const [signedUp, setSignedUp] = useState(false);

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
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim().toLowerCase());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* ignore */ }
    toast.success("Bem-vindo!");
    navigate({ to: redirectTo ?? getSessionHome(session), replace: true });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const first = suFirst.trim();
    const last = suLast.trim();
    const em = suEmail.trim().toLowerCase();
    if (!first) return toast.error("Informe seu nome.");
    if (!last) return toast.error("Informe seu sobrenome.");
    if (!em || !em.includes("@") || em.length < 5) return toast.error("E-mail inválido.");
    if (suPassword.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres.");

    setSuSubmitting(true);
    try {
      const passwordHash = await sha256Hex(suPassword);
      const fullName = `${first} ${last}`;

      const { data: existing } = await ext
        .from("hyro_extension_users")
        .select("id, password_hash, active")
        .eq("email", em)
        .maybeSingle();

      if (existing) {
        if (existing.password_hash) throw new Error("Este e-mail já possui cadastro.");
        const { error: upErr } = await ext
          .from("hyro_extension_users")
          .update({
            email: em,
            password_hash: passwordHash,
            name: fullName,
            active: false,
            role: "reseller",
          })
          .eq("id", existing.id);
        if (upErr) throw upErr;
      } else {
        const { error: cErr } = await ext
          .from("hyro_extension_users")
          .insert({
            email: em,
            name: fullName,
            role: "reseller",
            password_hash: passwordHash,
            active: false,
          });
        if (cErr) throw cErr;
      }

      try {
        if (suRemember) localStorage.setItem(REMEMBER_KEY, em);
      } catch { /* ignore */ }
      setSignedUp(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao cadastrar");
    } finally {
      setSuSubmitting(false);
    }
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(APPROVAL_MSG)}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 24px 24px, color-mix(in oklab, var(--color-foreground) 10%, transparent) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 75%)",
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
            {signedUp ? (
              <SignedUpSuccess whatsappUrl={whatsappUrl} onBack={() => { setSignedUp(false); setTab("login"); }} />
            ) : (
              <>
                {/* Tabs */}
                <div className="mb-6">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Acesso seguro</div>
                  <div className="grid grid-cols-2 items-center rounded-lg border border-border bg-secondary/40 p-0.5 w-full">
                    <button
                      type="button"
                      onClick={() => setTab("login")}
                      className={[
                        "h-9 text-[12.5px] font-medium rounded-md transition-colors w-full",
                        tab === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("signup")}
                      className={[
                        "h-9 text-[12.5px] font-medium rounded-md transition-colors w-full",
                        tab === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      Cadastro
                    </button>
                  </div>
                </div>

                {tab === "login" ? (
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
                  </form>
                ) : (
                  <form onSubmit={onSignup} className="space-y-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h1 className="text-[22px] font-semibold tracking-tight leading-tight">Criar conta</h1>
                        <p className="text-[13px] text-muted-foreground mt-1.5">Seu acesso passa por aprovação.</p>
                      </div>
                      <div className="h-10 w-10 rounded-lg border border-border bg-secondary/40 flex items-center justify-center shrink-0">
                        <UserIcon className="h-4 w-4 text-foreground/70" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Nome</Label>
                        <Input required value={suFirst} onChange={(e) => setSuFirst(e.target.value)}
                          className="h-11 text-sm bg-secondary/30 border-border/80" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Sobrenome</Label>
                        <Input required value={suLast} onChange={(e) => setSuLast(e.target.value)}
                          className="h-11 text-sm bg-secondary/30 border-border/80" />
                      </div>
                    </div>

                    <FieldWithIcon icon={<Mail className="h-4 w-4" />} label="E-mail">
                      <Input type="email" required value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
                        placeholder="voce@exemplo.com" className="h-11 pl-10 pr-3 text-sm bg-secondary/30 border-border/80" />
                    </FieldWithIcon>

                    <FieldWithIcon icon={<Lock className="h-4 w-4" />} label="Senha">
                      <Input type={suShow ? "text" : "password"} required minLength={6}
                        value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres" className="h-11 pl-10 pr-10 text-sm bg-secondary/30 border-border/80" />
                      <button type="button" onClick={() => setSuShow((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent">
                        {suShow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </FieldWithIcon>

                    <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground select-none cursor-pointer">
                      <Checkbox checked={suRemember} onCheckedChange={(v) => setSuRemember(!!v)} />
                      Salvar senha neste dispositivo
                    </label>

                    <Button type="submit" className="w-full h-11 text-sm font-medium gap-2" disabled={suSubmitting}>
                      {suSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</> : <>Criar conta <ArrowRight className="h-3.5 w-3.5" /></>}
                    </Button>
                  </form>
                )}
              </>
            )}
          </div>

          <p className="mt-6 text-[11px] text-muted-foreground/80 leading-relaxed text-center px-4">
            Acesso restrito e monitorado. Todas as ações são registradas em auditoria.
          </p>
        </div>
      </div>

      <footer className="relative h-12 border-t border-border/60 flex items-center justify-between px-6 text-[11px] text-muted-foreground">
        <span>© {new Date().getFullYear()} Hyro — Admin Console</span>
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

function SignedUpSuccess({ whatsappUrl, onBack }: { whatsappUrl: string; onBack: () => void }) {
  return (
    <div className="text-center py-2">
      <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <CheckCircle2 className="h-9 w-9 text-emerald-500" strokeWidth={2} />
      </div>
      <h2 className="text-[20px] font-semibold tracking-tight">Cadastro criado com sucesso</h2>
      <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">
        Seu cadastro foi criado e agora precisa ser aprovado. Clique no link abaixo para solicitar aprovação pelo WhatsApp.
      </p>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center justify-center gap-2 w-full h-11 rounded-md bg-emerald-500 hover:bg-emerald-500/90 text-white font-medium text-[13.5px] transition-colors"
      >
        <MessageCircle className="h-4 w-4" /> Solicitar aprovação no WhatsApp
      </a>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
      >
        Voltar para login
      </button>
    </div>
  );
}
