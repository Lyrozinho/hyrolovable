import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Check, Sparkles, Zap, Crown, MessageCircle, KeyRound,
  CalendarClock, AlertTriangle, ShieldCheck, ArrowRight, Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_dash/subscription")({
  component: SubscriptionPage,
});

const WHATSAPP_NUMBER = "5527981359051";

type Plan = {
  id: string;
  name: string;
  price: number;         // monthly-equivalent for display
  originalPrice?: number; // strike-through anchor
  totalPrice: number;    // total billed
  period: string;
  months: number;
  discount?: number;     // percent
  savings?: number;      // R$ saved vs mensal
  featured?: boolean;
  icon: typeof Sparkles;
  tagline: string;
  badge?: string;
  perks: string[];
};

// Preço âncora: R$ 30,90/mês
// Trimestral: R$ 25,90/mês → R$ 77,70/tri (economia R$ 15,00 / ~16%)
// Anual:      R$ 19,90/mês → R$ 238,80/ano (economia R$ 132,00 / ~36% ≈ "quase 4 meses grátis")
const PLANS: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    price: 30.9,
    totalPrice: 30.9,
    period: "mês",
    months: 1,
    icon: Sparkles,
    tagline: "Perfeito para começar. Cancele quando quiser.",
    perks: [
      "Painel administrativo completo",
      "Licenças ilimitadas de gestão",
      "Suporte via WhatsApp",
      "Atualizações contínuas",
    ],
  },
  {
    id: "trimestral",
    name: "Trimestral",
    price: 25.9,
    originalPrice: 30.9,
    totalPrice: 77.7,
    period: "trimestre",
    months: 3,
    discount: 16,
    savings: 15,
    featured: true,
    badge: "Mais escolhido",
    icon: Zap,
    tagline: "O favorito dos profissionais. Economia real com flexibilidade.",
    perks: [
      "Tudo do plano Mensal",
      "Economia de R$ 15 no período",
      "Prioridade em novos recursos",
      "Relatórios avançados de uso",
      "SLA de resposta em 24h",
    ],
  },
  {
    id: "anual",
    name: "Anual",
    price: 19.9,
    originalPrice: 30.9,
    totalPrice: 238.8,
    period: "ano",
    months: 12,
    discount: 36,
    savings: 132,
    icon: Crown,
    badge: "Melhor custo-benefício",
    tagline: "Máxima economia. Equivale a quase 4 meses grátis.",
    perks: [
      "Tudo do plano Trimestral",
      "Economia de R$ 132 por ano",
      "Gerente de conta dedicado",
      "Onboarding personalizado",
      "Backup e auditoria estendida",
    ],
  },
];

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function splitPrice(n: number) {
  const [int, dec] = n.toFixed(2).split(".");
  return { int, dec };
}

function buildWhatsappLink(plan: Plan) {
  const msg =
    `Olá! Quero adquirir o plano *${plan.name}* do Hyro Admin.\n` +
    `Valor: ${fmtBRL(plan.totalPrice)} / ${plan.period}\n` +
    `(equivalente a ${fmtBRL(plan.price)}/mês)`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function SubscriptionPage() {
  const { data: stats } = useQuery({
    queryKey: ["subscription-license-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hyro_extension_licenses")
        .select("id,status,expires_at");
      if (error) throw error;
      const now = Date.now();
      const in30 = now + 30 * 24 * 60 * 60 * 1000;
      let active = 0, expired = 0, expiringSoon = 0, lifetime = 0;
      let nearest: string | null = null;
      for (const r of data ?? []) {
        const exp = new Date(r.expires_at).getTime();
        const isActive = r.status === "ativa" && exp > now;
        if (isActive) active++;
        if (exp <= now) expired++;
        if (isActive && exp <= in30) expiringSoon++;
        if (new Date(r.expires_at).getUTCFullYear() >= 2099) lifetime++;
        if (isActive && (!nearest || exp < new Date(nearest).getTime())) nearest = r.expires_at;
      }
      return { total: data?.length ?? 0, active, expired, expiringSoon, lifetime, nearest };
    },
    refetchInterval: 60_000,
  });

  const nearestFmt = useMemo(() => {
    if (!stats?.nearest) return "—";
    const d = new Date(stats.nearest);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }, [stats?.nearest]);

  return (
    <div className="space-y-6">
      {/* Header — compact editorial */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 px-6 py-5">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.3] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--color-foreground) 6%, transparent) 0, transparent 40%), radial-gradient(circle at 80% 60%, color-mix(in oklab, var(--color-foreground) 4%, transparent) 0, transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border bg-background/80 backdrop-blur text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Faturamento
            </div>
            <h1 className="text-[22px] leading-[1.15] font-semibold tracking-tight">
              Escolha o plano ideal para escalar sua operação
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
              Planos flexíveis, sem taxas ocultas. Ative em minutos e cancele quando quiser.
            </p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Tenho dúvidas sobre os planos do Hyro Admin.")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[12.5px] font-medium px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors shadow-xs"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Falar com atendimento
          </a>
        </div>
      </div>


      {/* License validation */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Situação das suas licenças</h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Sincronizado com o banco de licenças em tempo real</p>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            Próx. expiração · <span className="text-foreground">{nearestFmt}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={KeyRound} label="Ativas" value={stats?.active ?? 0} />
          <StatCard icon={CalendarClock} label="Vencem em 30d" value={stats?.expiringSoon ?? 0} tone={stats?.expiringSoon ? "warn" : "default"} />
          <StatCard icon={AlertTriangle} label="Expiradas" value={stats?.expired ?? 0} tone={stats?.expired ? "danger" : "default"} />
          <StatCard icon={ShieldCheck} label="Lifetime" value={stats?.lifetime ?? 0} />
        </div>
      </section>

      {/* Plans */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Planos disponíveis</h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Valores em Reais (BRL) · Ativação em até 5 minutos</p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> Pagamento seguro via WhatsApp
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="rounded-xl border border-border bg-card px-6 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TrustItem
            icon={ShieldCheck}
            title="Ativação garantida"
            desc="Em até 5 minutos após a confirmação do pagamento."
          />
          <TrustItem
            icon={MessageCircle}
            title="Suporte humano"
            desc="Atendimento direto por WhatsApp com o time técnico."
          />
          <TrustItem
            icon={Lock}
            title="Sem fidelidade"
            desc="Cancele quando quiser, sem multas ou burocracia."
          />
        </div>
      </section>

      <p className="text-[11.5px] text-muted-foreground text-center">
        Ao adquirir você será redirecionado ao WhatsApp para finalizar o pagamento com nosso time.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone = "default",
}: {
  icon: typeof KeyRound;
  label: string;
  value: number;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={`mt-2.5 text-[26px] leading-none font-semibold font-mono tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function TrustItem({ icon: Icon, title, desc }: { icon: typeof ShieldCheck; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-secondary border border-border flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium tracking-tight">{title}</div>
        <div className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const Icon = plan.icon;
  const featured = plan.featured;
  const { int, dec } = splitPrice(plan.price);

  return (
    <div
      className={[
        "group relative rounded-2xl p-6 flex flex-col transition-all duration-300",
        featured
          ? [
              // LIGHT: bloco escuro premium sobre canvas claro
              "bg-primary text-primary-foreground dark:text-foreground border border-primary/60 shadow-elegant lg:-translate-y-2",
              // DARK: bloco elevado escuro com destaque sutil (evita branco puro estourado)
              "dark:bg-[oklch(0.22_0.006_250)] dark:text-foreground dark:border-white/10 dark:shadow-none dark:ring-1 dark:ring-white/10",
            ].join(" ")
          : "bg-card text-card-foreground border border-border hover:border-foreground/30 hover:-translate-y-0.5 shadow-xs",
      ].join(" ")}
    >
      {plan.badge && (
        <div
          className={[
            "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.16em] whitespace-nowrap shadow-xs",
            featured
              ? "bg-primary-foreground dark:bg-foreground text-primary dark:text-background border border-primary-foreground dark:border-foreground"
              : "bg-foreground text-background",
          ].join(" ")}
        >
          {plan.badge}
        </div>
      )}


      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className={[
              "h-10 w-10 rounded-xl flex items-center justify-center border",
              featured
                ? "bg-primary-foreground/10 dark:bg-foreground/10 border-primary-foreground/20 dark:border-foreground/20 text-primary-foreground dark:text-foreground"
                : "bg-secondary border-border text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight leading-none">{plan.name}</div>
            <div
              className={[
                "text-[10.5px] font-mono uppercase tracking-wider mt-1.5",
                featured ? "text-primary-foreground/60 dark:text-foreground/60" : "text-muted-foreground",
              ].join(" ")}
            >
              {plan.months === 1 ? "Cobrança mensal" : `Cobrança a cada ${plan.months} meses`}
            </div>
          </div>
        </div>
        {plan.discount ? (
          <span
            className={[
              "px-2 py-1 rounded-md text-[10px] font-bold tracking-wide",
              featured
                ? "bg-primary-foreground/15 dark:bg-foreground/15 text-primary-foreground dark:text-foreground"
                : "bg-success/10 text-success border border-success/20",
            ].join(" ")}
          >
            −{plan.discount}%
          </span>
        ) : null}
      </div>

      <p
        className={[
          "text-[13px] leading-relaxed mb-6 min-h-[40px]",
          featured ? "text-primary-foreground/75 dark:text-foreground/75" : "text-muted-foreground",
        ].join(" ")}
      >
        {plan.tagline}
      </p>

      {/* Price */}
      <div className="mb-6">
        {plan.originalPrice && (
          <div
            className={[
              "text-[12px] mb-1 font-mono",
              featured ? "text-primary-foreground/50 dark:text-foreground/50" : "text-muted-foreground",
            ].join(" ")}
          >
            De <span className="line-through">{fmtBRL(plan.originalPrice)}</span> por
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          <span
            className={[
              "text-[15px] font-medium mt-2",
              featured ? "text-primary-foreground/80 dark:text-foreground/80" : "text-muted-foreground",
            ].join(" ")}
          >
            R$
          </span>
          <span className="text-[54px] leading-none font-semibold tracking-tight font-mono tabular-nums">
            {int}
          </span>
          <span className="text-[22px] font-semibold font-mono tabular-nums -ml-0.5">
            ,{dec}
          </span>
          <span
            className={[
              "text-[13px] ml-1",
              featured ? "text-primary-foreground/60 dark:text-foreground/60" : "text-muted-foreground",
            ].join(" ")}
          >
            /mês
          </span>
        </div>
        <div
          className={[
            "text-[11.5px] mt-2 flex items-center gap-1.5",
            featured ? "text-primary-foreground/60 dark:text-foreground/60" : "text-muted-foreground",
          ].join(" ")}
        >
          {plan.months === 1
            ? "Sem compromisso · cancele a qualquer momento"
            : (
              <>
                <span>{fmtBRL(plan.totalPrice)} cobrados a cada {plan.months} meses</span>
                {plan.savings ? (
                  <>
                    <span className={featured ? "text-primary-foreground/30 dark:text-foreground/30" : "text-border"}>·</span>
                    <span className={featured ? "text-primary-foreground dark:text-foreground font-medium" : "text-success font-medium"}>
                      Economize {fmtBRL(plan.savings)}
                    </span>
                  </>
                ) : null}
              </>
            )}
        </div>
      </div>

      <div
        className={[
          "h-px w-full mb-5",
          featured ? "bg-primary-foreground/15 dark:bg-foreground/15" : "bg-border",
        ].join(" ")}
      />

      <ul className="space-y-3 mb-7 flex-1">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5 text-[13px] leading-snug">
            <span
              className={[
                "h-4 w-4 mt-0.5 rounded-full flex items-center justify-center shrink-0",
                featured ? "bg-primary-foreground/15 dark:bg-foreground/15" : "bg-secondary border border-border",
              ].join(" ")}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
            </span>
            <span className={featured ? "text-primary-foreground/90 dark:text-foreground/90" : "text-foreground/90"}>{perk}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        className={[
          "w-full h-11 text-[13px] font-semibold tracking-wide group/btn",
          featured
            ? "bg-primary-foreground dark:bg-foreground text-primary dark:text-background hover:bg-primary-foreground/90 dark:hover:bg-foreground/90 dark:bg-foreground/90"
            : "bg-foreground text-background hover:bg-foreground/90",
        ].join(" ")}
      >

        <a href={buildWhatsappLink(plan)} target="_blank" rel="noreferrer">
          Adquirir agora
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
        </a>
      </Button>
    </div>
  );
}
