import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Mail, Lock } from "lucide-react";
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border/70 flex items-center px-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-[10px] font-bold text-background tracking-tight">H</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Hyro</span>
          <span className="text-xs text-muted-foreground ml-1">Admin Console</span>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
              Entrar no console
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Utilize suas credenciais de administrador para continuar.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-medium">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="h-10 pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium">
                  Senha
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="h-10 pl-9 text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-sm font-medium gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Entrar <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-[11px] text-muted-foreground/80 leading-relaxed">
            Acesso restrito e monitorado. Todas as ações realizadas neste console
            são registradas em auditoria.
          </p>
        </div>
      </div>

      <footer className="h-12 border-t border-border/70 flex items-center justify-between px-6 text-[11px] text-muted-foreground">
        <span>© {new Date().getFullYear()} Hyro</span>
        <span className="font-mono">v1.0</span>
      </footer>
    </div>
  );
}
