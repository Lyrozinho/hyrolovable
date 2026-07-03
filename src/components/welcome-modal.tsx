import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, Rocket, GraduationCap, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchUserFlags, upsertUserFlags, getClientIP } from "@/lib/redemption";

const STEPS = [
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
  },
];

export function WelcomeModal() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.user.email) return;
      const flags = await fetchUserFlags(session.user.email);
      if (cancelled) return;
      if (!flags?.welcome_seen) {
        setStep(0);
        setOpen(true);
        // register first_ip (best-effort)
        const ip = await getClientIP();
        upsertUserFlags(session.user.email, {
          first_ip: flags?.first_ip ?? ip ?? null,
        }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user.email]);

  const finish = async () => {
    if (!session?.user.email) return;
    await upsertUserFlags(session.user.email, { welcome_seen: true }).catch(() => {});
    setOpen(false);
    navigate({ to: "/tutorials" });
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isFinal = !!current.isFinal;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Não permite fechar
        if (!o) return;
      }}
    >
      <DialogContent
        className="max-w-md p-0 overflow-hidden [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
            <Icon className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.body}</p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {STEPS.map((_, i) => (
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
            Passo {step + 1} de {STEPS.length}
          </span>
          {isFinal ? (
            <Button size="sm" onClick={finish}>
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
              Ver tutorial agora
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}>
              Próximo
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
