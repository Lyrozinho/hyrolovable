import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getClientIP, bindOrCheckIP, type RedemptionLink } from "@/lib/redemption";

export const Route = createFileRoute("/r/$slug")({
  ssr: false,
  component: RedeemPage,
});

function RedeemPage() {
  const { slug } = useParams({ from: "/r/$slug" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "claimed" | "error">("loading");
  const [error, setError] = useState<string>("");
  const [link, setLink] = useState<RedemptionLink | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ip = await getClientIP();
        const bound = await bindOrCheckIP(slug, ip);
        if (cancelled) return;
        setLink(bound);
        if (bound.claimed_user_id) {
          setStatus("claimed");
        } else {
          // vai direto para /signup com o ref
          navigate({ to: "/signup", search: { ref: slug }, replace: true });
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Link inválido.");
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-14 flex items-center px-6 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-[11px] font-bold text-background">H</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Hyro</span>
        </div>
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[420px] rounded-2xl bg-card border border-border p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Validando seu link…</p>
            </>
          )}
          {status === "claimed" && link && (
            <>
              <div className="h-12 w-12 mx-auto rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <KeyRound className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-lg font-semibold">Link já resgatado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sua conta ({link.target_email}) já foi criada. Faça login para acessar sua licença.
              </p>
              <Button className="mt-5 w-full" onClick={() => navigate({ to: "/login" })}>
                Ir para login <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="h-12 w-12 mx-auto rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-lg font-semibold">Acesso bloqueado</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Link to="/login" className="mt-5 inline-block text-[13px] text-primary hover:underline">
                Ir para login →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
