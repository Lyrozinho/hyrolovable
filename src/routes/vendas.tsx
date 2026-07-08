import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Zap,
  Infinity as InfinityIcon,
  Sparkles,
  Check,
  KeyRound,
  Star,
  Users,
  ArrowRight,
  Clock,
  Lock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Lovable Ilimitada — Extensão sem limite de créditos" },
      {
        name: "description",
        content:
          "Extensão Lovable com prompts ilimitados. Ative em minutos via PIX. 7 dias por R$ 59 ou mensal por R$ 89 com painel de revenda.",
      },
      { property: "og:title", content: "Lovable Ilimitada" },
      {
        property: "og:description",
        content: "Use a Lovable sem se preocupar com créditos. Ativação instantânea via PIX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: VendasPage,
});

type PlanId = "semanal" | "mensal";

const PLANS: {
  id: PlanId;
  name: string;
  badge?: string;
  period: string;
  priceCents: number;
  tagline: string;
  perks: string[];
  cta: string;
  highlight?: boolean;
}[] = [
  {
    id: "semanal",
    name: "Plano 7 Dias",
    period: "7 dias de acesso",
    priceCents: 5900,
    tagline: "Ideal para testar sem compromisso.",
    perks: [
      "Extensão Lovable ilimitada",
      "Sem limite de créditos",
      "Ativação instantânea",
      "Suporte por chat",
    ],
    cta: "Comprar 7 dias",
  },
  {
    id: "mensal",
    name: "Plano Mensal + Revenda",
    badge: "Mais popular",
    period: "30 dias de acesso",
    priceCents: 8900,
    highlight: true,
    tagline: "Uso ilimitado + painel de revenda incluso.",
    perks: [
      "Tudo do plano 7 dias",
      "Painel de Revenda incluso",
      "Chaves ilimitadas para revender",
      "Suporte prioritário 24/7",
      "Atualizações inclusas",
    ],
    cta: "Comprar mensal",
  },
];

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function VendasPage() {
  // 10-minute persisted countdown for the promo bar
  const [promoLeft, setPromoLeft] = useState<number>(10 * 60);
  useEffect(() => {
    const KEY = "hyro_promo_end_10m";
    let end = Number(localStorage.getItem(KEY) || 0);
    const now = Date.now();
    if (!end || end - now <= 0 || end - now > 11 * 60 * 1000) {
      end = now + 10 * 60 * 1000;
      localStorage.setItem(KEY, String(end));
    }
    const upd = () => setPromoLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    upd();
    const i = window.setInterval(upd, 1000);
    return () => clearInterval(i);
  }, []);
  const pm = String(Math.floor(promoLeft / 60)).padStart(2, "0");
  const ps = String(promoLeft % 60).padStart(2, "0");

  return (
    <div className="dark min-h-screen bg-background text-foreground antialiased">
      {/* Promo bar — red */}
      <div className="w-full bg-red-600 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1.5 px-4 py-2 text-center sm:flex-row sm:gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <Sparkles className="h-3.5 w-3.5" /> Oferta ilimitada
          </span>
          <span className="text-[12px] text-white/90">
            Expira em{" "}
            <span className="font-mono tabular-nums font-semibold text-white">
              {pm}:{ps}
            </span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
            <InfinityIcon className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Lovable Ilimitada</span>
        </div>
        <a
          href="#planos"
          className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver planos
        </a>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(60% 40% at 50% 0%, hsl(var(--primary) / 0.20), transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-4 pb-14 pt-10 text-center sm:pt-16 md:pb-20 md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Extensão oficial · v2026
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Lovable{" "}
            <span className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              sem limites
            </span>{" "}
            de créditos.
          </h1>
          <p className="mx-auto mt-5 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Use a Lovable sem se preocupar com créditos. Prompts ilimitados, estabilidade
            profissional e ativação instantânea via PIX.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <a href="#planos">
              <Button size="lg" className="h-12 px-6 text-[14px]">
                Ver planos <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> SSL 256-bit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary" /> Pagamento criptografado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-primary" /> PIX Bacen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-primary" /> +2.400 clientes
            </span>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Escolha seu plano
          </h2>
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            Ativação imediata após confirmação do PIX.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all ${
                p.highlight
                  ? "border-primary/70 bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
                  : "border-border bg-card/40"
              }`}
            >
              {p.badge && (
                <span className="absolute right-4 top-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
                  {p.badge}
                </span>
              )}
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" /> {p.period}
              </div>
              <div className="mt-2 text-[19px] font-semibold tracking-tight">{p.name}</div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{p.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
                  {fmtBRL(p.priceCents)}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  / {p.id === "semanal" ? "7 dias" : "mês"}
                </span>
              </div>

              <ul className="mt-5 flex-1 space-y-2 text-[13px] text-muted-foreground">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{perk}</span>
                  </li>
                ))}
                {p.id === "mensal" && (
                  <li className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 text-foreground">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-[12.5px]">
                      <span className="font-medium">Painel de Revenda incluso</span> — gere e
                      revenda chaves com suas margens.
                    </span>
                  </li>
                )}
              </ul>

              <Link
                to="/vendas/checkout"
                search={{ plan: p.id }}
                className="mt-6 block"
              >
                <Button
                  size="lg"
                  variant={p.highlight ? "default" : "secondary"}
                  className="h-11 w-full text-[13.5px]"
                >
                  {p.cta} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11.5px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Pagamento via PIX processado em segundos.
        </p>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60 bg-card/20">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <h3 className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
            Perguntas frequentes
          </h3>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                q: "Como recebo o acesso?",
                a: "Assim que o PIX é confirmado, você recebe por e-mail o link e a chave de ativação.",
              },
              {
                q: "É realmente ilimitado?",
                a: "Sim. Sem cotas de crédito, sem limite diário.",
              },
              {
                q: "Funciona em qualquer navegador?",
                a: "Funciona nos navegadores Chromium (Chrome, Edge, Brave, Opera).",
              },
              {
                q: "Posso cancelar?",
                a: "Sim. O plano não gera renovação automática — você compra pelo período.",
              },
            ].map((f) => (
              <div key={f.q} className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-[13.5px] font-medium">{f.q}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-[11.5px] text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Lovable Ilimitada</span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Ambiente seguro · TLS 1.3
          </span>
        </div>
      </footer>
    </div>
  );
}
