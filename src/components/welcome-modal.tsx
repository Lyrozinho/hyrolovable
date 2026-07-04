import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PartyPopper, Rocket, GraduationCap, ArrowRight, Check,
  Handshake, KeyRound, Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchUserFlags, upsertUserFlags, getClientIP } from "@/lib/redemption";
import { supabase as ext } from "@/lib/supabase";

const OWNER_STEPS = [
  {
    icon: PartyPopper,
    title: "Seja bem-vindo(a) à Hyro Lovable!",
    body: "Estamos muito felizes em ter você por aqui. Preparamos um pequeno tour para você começar com o pé direito.",
  },
  {
    icon: Rocket,
    title: "Tudo pronto para acelerar seu trabalho",
    body: "Aqui você gerencia sua licença, revendedores, assinatura e tem acesso a tutoriais completos sempre que precisar.",
  },
  {
    icon: GraduationCap,
    title: "Assista ao tutorial",
    body: "Antes de continuar, é importante que você veja o tutorial. Ele mostra os passos essenciais para usar a extensão sem dificuldades.",
    isFinal: true,
    finalCta: "Ver tutorial agora",
    finalIcon: GraduationCap,
    finalRoute: "/tutorials" as const,
  },
];

const RESELLER_STEPS = [
  {
    icon: Handshake,
    title: "Bem-vindo(a) ao painel de revenda Hyro!",
    body: "Sua área foi ativada com sucesso. Aqui você acompanha suas licenças, gerencia clientes e organiza sua operação.",
  },
  {
    icon: KeyRound,
    title: "Crie licenças em segundos",
    body: "Na aba Licenças você gera novas chaves a partir do seu pacote. O saldo disponível aparece sempre no topo.",
  },
  {
    icon: Sparkles,
    title: "Tudo pronto para começar",
    body: "Explore o painel no seu ritmo. Se precisar de ajuda, os tutoriais estão sempre disponíveis no menu lateral.",
    isFinal: true,
    finalCta: "Entrar no painel",
    finalIcon: ArrowRight,
    finalRoute: "/subscription" as const,
  },
];

export function WelcomeModal() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isReseller, setIsReseller] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.user.email) return;
      // Detecta se é revendedor
      let reseller = false;
      try {
        const { data: u } = await ext
          .from("hyro_extension_users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        reseller = (u as any)?.role === "reseller";
      } catch { /* ignore */ }
      if (cancelled) return;
      setIsReseller(reseller);

      const flags = await fetchUserFlags(session.user.email);
      if (cancelled) return;
      if (!flags?.welcome_seen) {
        setStep(0);
        setOpen(true);
        const ip = await getClientIP();
        upsertUserFlags(session.user.email, {
          first_ip: flags?.first_ip ?? ip ?? null,
        }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user.email, session?.user.id]);

  const steps = isReseller ? RESELLER_STEPS : OWNER_STEPS;

  const finish = async () => {
    if (!session?.user.email) return;
    setOpen(false);
    upsertUserFlags(session.user.email, { welcome_seen: true }).catch(() => {});
    const finalRoute = steps[steps.length - 1].finalRoute!;
    // Só navega se ainda não estiver no destino
    if (pathname !== finalRoute) navigate({ to: finalRoute });
  };

  const current = steps[step];
  const Icon = current.icon;
  const isFinal = !!current.isFinal;
  const FinalIcon = (current as any).finalIcon ?? ArrowRight;
  const finalCta = (current as any).finalCta ?? "Continuar";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) return; }}
    >
      <DialogContent
        className="max-w-md p-0 overflow-hidden [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">{current.body}</DialogDescription>
        <div className="p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
            <Icon className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.body}</p>

          <div className="flex items-center justify-center gap-1.5 mt-6">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Passo {step + 1} de {steps.length}
          </span>
          {isFinal ? (
            <Button size="sm" onClick={finish}>
              <FinalIcon className="h-3.5 w-3.5 mr-1.5" />
              {finalCta}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}>
              Próximo
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
        </div>
        <span className="hidden"><Check className="h-0 w-0" /></span>
      </DialogContent>
    </Dialog>
  );
}
