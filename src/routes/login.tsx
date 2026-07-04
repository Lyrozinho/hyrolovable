import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionHome, useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: getSessionHome(session), replace: true });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error, redirectTo } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: redirectTo ?? getSessionHome(session), replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Ambient background — subtle, no neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 24px 24px, color-mix(in oklab, var(--color-foreground) 10%, transparent) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-foreground) 18%, transparent), transparent)",
        }}
      />

      {/* Top bar */}
      <header className="relative h-14 flex items-center px-6 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center shadow-sm">
            <span className="text-[11px] font-bold text-background tracking-tight">H</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight">Hyro</span>
            <span className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
              Admin Console
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/70 animate-ping opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono">Todos os sistemas operacionais</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Body */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          {/* Card */}
          <div className="relative">
            {/* Card frame accents */}
            <div
              aria-hidden
              className="absolute -inset-px rounded-2xl border border-border/70"
            />
            <div className="relative rounded-2xl bg-card border border-border shadow-elegant p-8 sm:p-9">
              {/* Header */}
              <div className="flex items-center justify-between mb-7">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 font-medium">
                    Autenticação segura
                  </div>
                  <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
                    Entrar no painel
                  </h1>
                  <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
                    Acesse com suas credenciais de administrador.
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg border border-border bg-secondary/40 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    E-mail
                  </Label>
                  <div className="group relative">
                    <Mail
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 transition-colors group-focus-within:text-foreground"
                      strokeWidth={1.75}
                    />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@empresa.com"
                      className="h-11 pl-10 pr-3 text-sm bg-secondary/30 border-border/80 focus-visible:bg-background transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Senha
                    </Label>
                  </div>
                  <div className="group relative">
                    <Lock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 transition-colors group-focus-within:text-foreground"
                      strokeWidth={1.75}
                    />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="h-11 pl-10 pr-10 text-sm bg-secondary/30 border-border/80 focus-visible:bg-background transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                      ) : (
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-medium gap-2 mt-2 group"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Autenticando…
                    </>
                  ) : (
                    <>
                      Entrar no painel
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  Segurança
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Trust row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "SSO", v: "Pronto" },
                  { k: "2FA", v: "Suportado" },
                  { k: "Audit", v: "Ativo" },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="rounded-lg border border-border/70 bg-secondary/20 py-2.5 px-2"
                  >
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {item.k}
                    </div>
                    <div className="text-[11px] font-medium text-foreground/90 mt-0.5 font-mono">
                      {item.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footnote */}
          <p className="mt-6 text-[11px] text-muted-foreground/80 leading-relaxed text-center px-4">
            Acesso restrito e monitorado. Todas as ações realizadas neste painel
            são registradas em auditoria.
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
