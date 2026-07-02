import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Check, Sparkles, Zap, Crown, MessageCircle, KeyRound,
  CalendarClock, AlertTriangle, ShieldCheck,
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
  price: number;        // monthly-equivalent for display
  totalPrice: number;   // total billed
  period: string;       // e.g., "mensal"
  months: number;
  discount?: number;    // percent
  featured?: boolean;
  icon: typeof Sparkles;
  tagline: string;
  perks: string[];
};

const PLANS: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    price: 83,
    totalPrice: 83,
    period: "mês",
    months: 1,
    icon: Sparkles,
    tagline: "Ideal para começar sem compromisso.",
    perks: [
      "Licenças ilimitadas de gestão",
      "Painel administrativo completo",
      "Suporte prioritário via WhatsApp",
      "Atualizações contínuas",
    ],
  },
  {
    id: "trimestral",
    name: "Trimestral",
    price: 71,
    totalPrice: 213,
    period: "trimestre",
    months: 3,
    discount: 15,
    featured: true,
    icon: Zap,
    tagline: "O melhor equilíbrio entre economia e flexibilidade.",
    perks: [
      "Tudo do plano Mensal",
      "15% de desconto",
      "Prioridade em novos recursos",
      "Relatórios avançados de uso",
      "SLA de resposta em 24h",
    ],
  },
  {
    id: "anual",
    name: "Anual",
    price: 58,
    totalPrice: 697,
    period: "ano",
    months: 12,
    discount: 30,
    icon: Crown,
    tagline: "Máxima economia e recursos premium.",
    perks: [
      "Tudo do plano Trimestral",
      "30% de desconto (2 meses grátis)",
      "Gerente de conta dedicado",
      "Onboarding personalizado",
      "Backup e auditoria estendida",
    ],
  },
];

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
        // lifetime = year >= 2099
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5 font-medium">
            Faturamento
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Atualize seu plano</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Escolha o plano ideal para o volume da sua operação. Ao adquirir, você
            será redirecionado ao WhatsApp para finalizar o pagamento.
          </p>
        </div>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Tenho dúvidas sobre os planos do Hyro Admin.")}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[12.5px] font-medium px-3.5 py-2 rounded-md border border-border bg-card hover:bg-accent transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Falar com atendimento
        </a>
      </div>

      {/* License validation card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard icon={KeyRound} label="Licenças ativas" value={stats?.active ?? 0} />
        <StatCard icon={CalendarClock} label="Vencendo em 30 dias" value={stats?.expiringSoon ?? 0} tone={stats?.expiringSoon ? "warn" : "default"} />
        <StatCard icon={AlertTriangle} label="Expiradas" value={stats?.expired ?? 0} tone={stats?.expired ? "danger" : "default"} />
        <StatCard icon={ShieldCheck} label="Lifetime" value={stats?.lifetime ?? 0} />
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12.5px]">
        <span className="text-muted-foreground">Próxima expiração:</span>
        <span className="font-medium font-mono">{nearestFmt}</span>
        <span className="text-border">·</span>
        <span className="text-muted-foreground">Total de licenças:</span>
        <span className="font-medium font-mono">{stats?.total ?? 0}</span>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      <p className="text-[11.5px] text-muted-foreground text-center">
        Pagamento processado manualmente via WhatsApp • Ativação em até 5 minutos após a confirmação
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const Icon = plan.icon;
  const featured = plan.featured;
  return (
    <div
      className={[
        "relative rounded-xl border p-6 flex flex-col transition-all",
        featured
          ? "border-foreground/80 bg-card shadow-elegant scale-[1.02]"
          : "border-border bg-card hover:border-foreground/30",
      ].join(" ")}
    >
      {featured && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-foreground text-background text-[10px] font-bold uppercase tracking-[0.16em]">
          Mais popular
        </div>
      )}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center border border-border">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[15px] font-semibold tracking-tight">{plan.name}</div>
          {plan.discount ? (
            <div className="text-[10.5px] font-mono text-success uppercase tracking-wider">
              −{plan.discount}% de desconto
            </div>
          ) : (
            <div className="text-[10.5px] font-mono text-muted-foreground uppercase tracking-wider">
              Sem fidelidade
            </div>
          )}
        </div>
      </div>

      <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
        {plan.tagline}
      </p>

      <div className="mb-5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tracking-tight font-mono tabular-nums">
            {fmtBRL(plan.price).replace(/\s/g, "")}
          </span>
          <span className="text-[13px] text-muted-foreground">/mês</span>
        </div>
        <div className="text-[11.5px] text-muted-foreground mt-1">
          {plan.months === 1
            ? "Cobrado mensalmente"
            : `${fmtBRL(plan.totalPrice)} cobrados a cada ${plan.months} meses`}
        </div>
      </div>

      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5 text-[13px]">
            <Check className="h-4 w-4 mt-0.5 text-foreground shrink-0" strokeWidth={2.5} />
            <span className="text-foreground/85">{perk}</span>
          </li>
        ))}
      </ul>

      <Button asChild variant={featured ? "default" : "outline"} className="w-full h-11 text-sm font-medium">
        <a href={buildWhatsappLink(plan)} target="_blank" rel="noreferrer">
          Adquirir {plan.name}
        </a>
      </Button>
    </div>
  );
}
