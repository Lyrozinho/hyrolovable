import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, KeyRound, Users, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — Brand panel */}
      <div className="hidden lg:flex relative flex-1 overflow-hidden bg-gradient-brand text-white">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "oklch(0.75 0.2 320 / 0.4)" }}
        />
        <div
          className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "oklch(0.7 0.2 220 / 0.4)" }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Hyro Admin</div>
              <div className="text-[11px] opacity-75">License management</div>
            </div>
          </div>

          <div className="max-w-md space-y-8">
            <div>
              <h2 className="text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.05]">
                Controle total sobre suas licenças.
              </h2>
              <p className="mt-4 text-white/80 text-[15px] leading-relaxed">
                Gerencie chaves, revendedores e sessões em tempo real com uma
                interface pensada para operações de alto volume.
              </p>
            </div>

            <ul className="space-y-3 text-sm">
              {[
                { icon: KeyRound, text: "Emissão instantânea de licenças" },
                { icon: Users, text: "Rede de revendedores com saldo próprio" },
                { icon: Activity, text: "Monitoramento de sessões ativas" },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 ring-1 ring-white/15 flex items-center justify-center">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <span className="text-white/90">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-xs text-white/60">
            © {new Date().getFullYear()} Hyro. Todos os direitos reservados.
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="h-9 w-9 rounded-lg bg-gradient-brand flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">Hyro Admin</span>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">Entrar na conta</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Acesso restrito a administradores autorizados.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-brand hover:opacity-95 text-white shadow-glow gap-2"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Entrar <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-8 text-xs text-muted-foreground text-center">
              Sistema protegido. Todas as ações são registradas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
