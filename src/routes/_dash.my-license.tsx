import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  KeyRound, CalendarClock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Infinity as InfinityIcon, Clock, Copy, RefreshCw,
  Check, ArrowRight, MessageCircle, Sparkles, Zap, Minus, Plus, Settings2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { supabase as cloud } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RenewLicenseDialog } from "@/components/renew-license-dialog";
import { VexoPayCheckoutDialog } from "@/components/vexopay-checkout-dialog";

export const Route = createFileRoute("/_dash/my-license")({
  component: MyLicensePage,
});

const WHATSAPP_NUMBER = "5527981359051";

type PartnerPlan = {
  id: string;
  name: string;
  tagline: string;
  setup: number;
  monthly: number;
  licensesMonth: number | "ilimitado";
  commission: number;
  featured?: boolean;
  badge?: string;
  perks: string[];
};

const PARTNER_PLANS: PartnerPlan[] = [
  {
    id: "starter",
    name: "Pacote Essencial",
    tagline: "Comece a revender com um pacote enxuto de chaves mensais.",
    setup: 0, monthly: 149, licensesMonth: 5, commission: 0,
    perks: [
      "Chaves entregues instantaneamente",
      "Painel próprio de gestão",
      "Renovação mensal simplificada",
      "Suporte via WhatsApp",
    ],
  },
  {
    id: "growth",
    name: "Pacote Pro",
    tagline: "Mais chaves por mês com melhor custo por chave.",
    setup: 0, monthly: 349, licensesMonth: 15, commission: 0,
    featured: true, badge: "Mais escolhido",
    perks: [
      "Volume maior de chaves mensais",
      "Melhor custo por chave",
      "Prioridade em ativações",
      "Suporte prioritário",
    ],
  },
  {
    id: "elite",
    name: "Pacote Elite",
    tagline: "Alto volume de chaves com o melhor valor unitário.",
    setup: 0, monthly: 897, licensesMonth: 50, commission: 0,
    badge: "Melhor valor por chave",
    perks: [
      "Grande volume de chaves mensais",
      "Menor custo por chave",
      "Atendimento dedicado",
      "Fluxo de revenda otimizado",
    ],
  },
];

type PlanOverride = {
  setup?: number | null;
  monthly?: number | null;
  licensesMonth?: number | "ilimitado" | null;
  commission?: number | null;
};
type PlansConfig = Record<string, PlanOverride>;

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mergePlan(plan: PartnerPlan, cfg?: PlanOverride | null): PartnerPlan {
  if (!cfg) return plan;
  return {
    ...plan,
    setup: cfg.setup ?? plan.setup,
    monthly: cfg.monthly ?? plan.monthly,
    licensesMonth: (cfg.licensesMonth ?? plan.licensesMonth) as PartnerPlan["licensesMonth"],
    commission: cfg.commission ?? plan.commission,
  };
}

function perLicensePrice(plan: PartnerPlan): number | null {
  if (typeof plan.licensesMonth !== "number" || plan.licensesMonth <= 0) return null;
  if (!Number.isFinite(plan.monthly) || plan.monthly <= 0) return null;
  return plan.monthly / plan.licensesMonth;
}

function buildPartnerWhatsapp(plan: PartnerPlan, hasValues: boolean) {
  const per = perLicensePrice(plan);
  const pricing = hasValues
    ? `Valor: ${fmtBRL(plan.monthly)} / mês\nChaves: ${plan.licensesMonth === "ilimitado" ? "Ilimitadas" : plan.licensesMonth}${per ? ` · ${fmtBRL(per)} por chave/mês` : ""}\n\n`
    : "";
  const msg =
    `Olá! Quero ativar o *${plan.name}* do Programa de Parceiros Hyro.\n` +
    pricing +
    `Aguardo os próximos passos para começar a revender.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

type LicenseRow = {
  id: string;
  status: string;
  expires_at: string;
  created_at: string;
  user_id: string | null;
  created_by: string | null;
  reseller_id: string | null;
};

function isLifetime(exp: string) {
  return new Date(exp).getUTCFullYear() >= 2099;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function MyLicensePage() {
  const { session, sessionKey, authReady } = useAuth();
  const userId = session?.user.id ?? null;
  const qc = useQueryClient();
  const [renewTarget, setRenewTarget] = useState<string | null>(null);

  const { data: roleData } = useQuery({
    queryKey: ["my-role", sessionKey, userId],
    enabled: authReady && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase
        .from("hyro_extension_users")
        .select("role")
        .eq("id", userId!)
        .maybeSingle();
      return (u as any)?.role ?? null;
    },
  });
  const isReseller = roleData === "reseller";

  const { data: plansConfig } = useQuery({
    queryKey: ["partner-plans-config"],
    enabled: authReady && isReseller,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (cloud as any)
        .from("hyro_partner_plans_config")
        .select("plans")
        .eq("id", 1)
        .maybeSingle();
      return ((data as any)?.plans ?? {}) as PlansConfig;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["my-licenses", sessionKey, userId, roleData],
    enabled: authReady && !!userId && roleData !== undefined,
    queryFn: async () => {
      let q = supabase
        .from("hyro_extension_licenses")
        .select("id, status, expires_at, created_at, user_id, created_by, reseller_id")
        .order("created_at", { ascending: false });
      q = roleData === "reseller"
        ? q.or(`created_by.eq.${userId},reseller_id.eq.${userId}`)
        : q.eq("user_id", userId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LicenseRow[];
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const now = new Date();
    let active = 0, expired = 0, expiringSoon = 0, lifetime = 0;
    let nearest: string | null = null;
    for (const r of rows) {
      const exp = new Date(r.expires_at);
      const isLife = isLifetime(r.expires_at);
      const isActive = r.status === "ativa" && exp > now;
      if (isActive) active++;
      if (exp <= now) expired++;
      if (isActive && !isLife && daysBetween(exp, now) <= 30) expiringSoon++;
      if (isLife) lifetime++;
      if (isActive && !isLife && (!nearest || exp < new Date(nearest))) nearest = r.expires_at;
    }
    return { total: rows.length, active, expired, expiringSoon, lifetime, nearest };
  }, [data]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 px-6 py-5">
        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border bg-background/80 backdrop-blur text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          {isReseller ? "Dashboard" : "Minhas licenças"}
        </div>
        <h1 className="text-[22px] leading-[1.15] font-semibold tracking-tight">
          {isReseller ? "Bem-vindo, revendedor" : "Acompanhe suas licenças e validades"}
        </h1>
        <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
          {isReseller
            ? "Confira os pacotes disponíveis e acompanhe suas licenças ativas."
            : "Visualização somente-leitura das licenças vinculadas à sua conta."}
        </p>
      </div>

      {/* Stats */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Situação geral</h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Atualizado em tempo real</p>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            Próx. expiração ·{" "}
            <span className="text-foreground">
              {stats.nearest ? fmtDate(stats.nearest) : "—"}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={KeyRound} label="Ativas" value={stats.active} />
          <StatCard
            icon={CalendarClock}
            label="Vencem em 30d"
            value={stats.expiringSoon}
            tone={stats.expiringSoon ? "warn" : "default"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Expiradas"
            value={stats.expired}
            tone={stats.expired ? "danger" : "default"}
          />
          <StatCard icon={ShieldCheck} label="Lifetime" value={stats.lifetime} />
        </div>
      </section>

      {/* Oferta destaque: Chave Vitalícia (apenas revendedores) */}
      {isReseller && <LifetimeKeyBanner userId={userId} defaultEmail={session?.user.email ?? null} />}

      {/* Planos revenda (visíveis para reseller) */}
      {isReseller && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Planos disponíveis</h2>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                Pacotes configurados para revenda. Selecione o ideal para o seu volume.
              </p>
            </div>
          </div>
          {plansConfig === undefined ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card/60 h-[380px] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {PARTNER_PLANS.map((p) => (
                  <PlanCard key={p.id} plan={p} override={plansConfig?.[p.id] ?? null} />
                ))}
              </div>
              <CustomPlanCard userId={userId} defaultEmail={session?.user.email ?? null} />
            </div>
          )}
        </section>
      )}


      {/* List de licenças — clientes vêem sempre; reseller vê depois dos planos */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {isReseller ? "Licenças da sua carteira" : "Suas licenças"}
            {data ? <span className="text-muted-foreground font-mono text-[12px] ml-1">({data.length})</span> : null}
          </h2>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
            Carregando…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <KeyRound className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13.5px] font-medium">Nenhuma licença encontrada</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              {isReseller
                ? "Ao ativar um plano, suas licenças aparecerão aqui."
                : "Quando uma licença for atribuída à sua conta, ela aparecerá aqui."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.map((l) => {
              const now = new Date();
              const exp = new Date(l.expires_at);
              const life = isLifetime(l.expires_at);
              const expired = exp <= now;
              const isActive = l.status === "ativa" && !expired;
              const dLeft = life ? Infinity : daysBetween(exp, now);
              const tone = !isActive
                ? "danger"
                : life
                ? "success"
                : dLeft <= 7
                ? "danger"
                : dLeft <= 30
                ? "warn"
                : "success";
              const toneClasses = {
                success: "border-success/30 bg-success/5",
                warn: "border-warning/30 bg-warning/5",
                danger: "border-destructive/30 bg-destructive/5",
              }[tone];
              return (
                <div
                  key={l.id}
                  className={`rounded-xl border ${toneClasses} p-4 hover:border-foreground/25 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <button
                          onClick={() => copy(l.id)}
                          className="font-mono text-[12.5px] font-medium tracking-tight truncate hover:underline inline-flex items-center gap-1.5 group"
                          title="Copiar chave"
                        >
                          <span className="truncate">{l.id}</span>
                          <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
                        </button>
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-1 font-mono uppercase tracking-wider">
                        Criada em {fmtDate(l.created_at)}
                      </div>
                    </div>
                    <StatusBadge active={isActive} expired={expired} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                        Validade
                      </div>
                      <div className="text-[13px] font-medium flex items-center gap-1.5">
                        {life ? (
                          <>
                            <InfinityIcon className="h-3.5 w-3.5" />
                            <span>Vitalícia</span>
                          </>
                        ) : (
                          fmtDate(l.expires_at)
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                        {expired ? "Expirada há" : "Restam"}
                      </div>
                      <div
                        className={`text-[13px] font-medium flex items-center gap-1.5 ${
                          tone === "danger"
                            ? "text-destructive"
                            : tone === "warn"
                            ? "text-warning"
                            : "text-foreground"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {life
                          ? "—"
                          : expired
                          ? `${Math.abs(dLeft)} dia${Math.abs(dLeft) === 1 ? "" : "s"}`
                          : `${dLeft} dia${dLeft === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </div>

                  {!life && !isReseller && (
                    <div className="pt-3 mt-3 border-t border-border">
                      <Button
                        size="sm"
                        variant={tone === "danger" || tone === "warn" ? "default" : "secondary"}
                        className="w-full"
                        onClick={() => setRenewTarget(l.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Renovar licença
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {renewTarget && userId && (
        <RenewLicenseDialog
          open={!!renewTarget}
          onOpenChange={(v) => !v && setRenewTarget(null)}
          licenseId={renewTarget}
          clientUserId={userId}
          clientName={session?.user.name ?? null}
          clientEmail={session?.user.email ?? null}
          onRenewed={() => qc.invalidateQueries({ queryKey: ["my-licenses"] })}
        />
      )}
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
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={`mt-2.5 text-[26px] leading-none font-semibold font-mono tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ active, expired }: { active: boolean; expired: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-success/10 text-success border border-success/20">
        <CheckCircle2 className="h-3 w-3" /> Ativa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20">
      <XCircle className="h-3 w-3" /> {expired ? "Expirada" : "Inativa"}
    </span>
  );
}

function PlanCard({ plan: base, override }: { plan: PartnerPlan; override?: PlanOverride | null }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { session } = useAuth();
  const plan = mergePlan(base, override);
  const featured = plan.featured;
  const hasMonthly = override?.monthly != null || base.monthly > 0;
  const hasLicenses = override?.licensesMonth != null || (typeof base.licensesMonth === "number" && base.licensesMonth > 0) || base.licensesMonth === "ilimitado";
  const hasAny = hasMonthly || hasLicenses;
  const per = perLicensePrice(plan);
  const licensesLabel = plan.licensesMonth === "ilimitado" ? "Ilimitadas" : `${plan.licensesMonth} chaves`;
  return (
    <div
      className={[
        "relative rounded-2xl p-6 flex flex-col transition-all duration-300",
        featured
          ? "bg-foreground text-background border border-foreground shadow-elegant lg:-translate-y-1.5"
          : "bg-card text-foreground border border-border hover:border-foreground/30 hover:-translate-y-0.5",
      ].join(" ")}
    >
      {plan.badge && (
        <div
          className={[
            "absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.16em] whitespace-nowrap",
            featured ? "bg-background text-foreground" : "bg-foreground text-background",
          ].join(" ")}
        >
          {plan.badge}
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3">
        <div
          className={[
            "h-10 w-10 rounded-xl flex items-center justify-center border shadow-inner",
            featured
              ? "bg-background/10 border-background/20"
              : "bg-gradient-to-br from-amber-100 to-amber-300/60 border-amber-300/60 dark:from-amber-500/20 dark:to-amber-700/10 dark:border-amber-400/30",
          ].join(" ")}
        >
          <KeyRound
            className={featured ? "h-5 w-5" : "h-5 w-5 text-amber-700 dark:text-amber-300 -rotate-45"}
            strokeWidth={2.2}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight leading-none">{plan.name}</div>
          <div className={["text-[10.5px] font-mono uppercase tracking-wider mt-1.5", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>
            {hasLicenses ? licensesLabel : "Volume sob consulta"}
          </div>
        </div>
      </div>

      <p className={["text-[12.5px] leading-relaxed mb-5 min-h-[36px]", featured ? "text-background/75" : "text-muted-foreground"].join(" ")}>
        {plan.tagline}
      </p>

      <div className="mb-5">
        {hasMonthly ? (
          <div className="flex items-baseline gap-1.5">
            <span className={["text-[13px] font-medium", featured ? "text-background/80" : "text-muted-foreground"].join(" ")}>R$</span>
            <span className="text-[40px] leading-none font-semibold tracking-tight font-mono tabular-nums">
              {plan.monthly.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={["text-[12.5px] ml-1", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>/mês</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] leading-none font-semibold tracking-tight">Sob consulta</span>
          </div>
        )}
        <div className={["text-[11.5px] mt-1.5", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>
          {per
            ? <><span className="font-medium">{fmtBRL(per)}</span> por chave/mês</>
            : plan.licensesMonth === "ilimitado"
              ? "Chaves ilimitadas por mês"
              : "Valor por chave sob consulta"}
        </div>
      </div>

      <div className={["grid grid-cols-2 gap-2 p-2.5 rounded-lg mb-5", featured ? "bg-background/10" : "bg-muted/40 border border-border"].join(" ")}>
        <div>
          <div className={["text-[10px] uppercase tracking-wider font-semibold", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>Chaves/mês</div>
          <div className="text-[15px] font-semibold font-mono mt-0.5">
            {hasLicenses ? (plan.licensesMonth === "ilimitado" ? "∞" : plan.licensesMonth) : "—"}
          </div>
        </div>
        <div>
          <div className={["text-[10px] uppercase tracking-wider font-semibold", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>Por chave</div>
          <div className="text-[15px] font-semibold font-mono mt-0.5">{per ? fmtBRL(per) : "—"}</div>
        </div>
      </div>

      <div className={["h-px w-full mb-4", featured ? "bg-background/15" : "bg-border"].join(" ")} />

      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-[12.5px] leading-snug">
            <span
              className={[
                "h-4 w-4 mt-0.5 rounded-full flex items-center justify-center shrink-0",
                featured ? "bg-background/15" : "bg-secondary border border-border",
              ].join(" ")}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
            </span>
            <span className={featured ? "text-background/90" : "text-foreground/90"}>{perk}</span>
          </li>
        ))}
      </ul>

      {hasMonthly ? (
        <Button
          onClick={() => setCheckoutOpen(true)}
          className={[
            "w-full h-11 text-[13px] font-semibold group/btn",
            featured ? "bg-background text-foreground hover:bg-background/90" : "bg-foreground text-background hover:bg-foreground/90",
          ].join(" ")}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Comprar
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
        </Button>
      ) : (
        <Button
          asChild
          className={[
            "w-full h-11 text-[13px] font-semibold group/btn",
            featured ? "bg-background text-foreground hover:bg-background/90" : "bg-foreground text-background hover:bg-foreground/90",
          ].join(" ")}
        >
          <a href={buildPartnerWhatsapp(plan, hasAny)} target="_blank" rel="noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            Falar com comercial
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </a>
        </Button>
      )}

      <p className={["text-[10.5px] mt-3 text-center", featured ? "text-background/50" : "text-muted-foreground"].join(" ")}>
        {hasMonthly ? "Pagamento seguro via PIX" : "Ativação sujeita a análise comercial"}
      </p>

      {hasMonthly && (
        <VexoPayCheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          planId={plan.id}
          planName={plan.name}
          amountCents={Math.round(plan.monthly * 100)}
          licensesCount={typeof plan.licensesMonth === "number" ? plan.licensesMonth : 0}
          resellerUserId={session?.user.id ?? null}
          defaultEmail={session?.user.email ?? null}
        />
      )}
    </div>
  );
}

function LifetimeKeyBanner({ userId, defaultEmail }: { userId: string | null; defaultEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const price = 150;
  return (
    <section aria-label="Oferta: Chave Vitalícia">
      <div
        className={[
          "relative overflow-hidden rounded-2xl border border-border/80",
          "bg-gradient-to-br from-card via-card to-secondary/40",
          "hover:border-foreground/25 transition-colors",
        ].join(" ")}
      >
        {/* subtle backdrop pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 20%, color-mix(in oklab, var(--color-foreground) 7%, transparent) 0, transparent 42%), radial-gradient(circle at 88% 80%, color-mix(in oklab, var(--color-foreground) 5%, transparent) 0, transparent 48%)",
          }}
        />
        <div className="relative flex flex-wrap items-center gap-5 p-5 md:p-6">
          {/* Ícone */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-200 to-amber-400/70 dark:from-amber-500/25 dark:to-amber-700/15 border border-amber-300/60 dark:border-amber-400/30 flex items-center justify-center shadow-inner">
                <KeyRound className="h-5 w-5 text-amber-700 dark:text-amber-300 -rotate-45" strokeWidth={2.2} />
              </div>
              <span className="absolute -top-1.5 -right-1.5 inline-flex items-center gap-0.5 rounded-full bg-foreground text-background text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 shadow-sm">
                <Sparkles className="h-2.5 w-2.5" /> Novo
              </span>
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-1">
                <InfinityIcon className="h-3 w-3" /> Oferta exclusiva
              </div>
              <div className="text-[15px] md:text-[16px] font-semibold tracking-tight leading-tight">
                Chave Vitalícia Hyro
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug max-w-md">
                Pagamento único, sem renovação mensal. Uma chave que nunca expira.
              </p>
            </div>
          </div>

          {/* Perks compactos */}
          <div className="hidden md:flex items-center gap-4 text-[11.5px] text-muted-foreground pl-2 border-l border-border/70">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-success" /> Sem mensalidade</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-success" /> Ativação imediata</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-success" /> Validade infinita</span>
          </div>

          {/* Preço + CTA */}
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right">
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-[12px] text-muted-foreground">R$</span>
                <span className="text-[26px] font-semibold font-mono tabular-nums leading-none">{price}</span>
              </div>
              <div className="text-[10.5px] text-muted-foreground mt-0.5 uppercase tracking-wider font-mono">pagamento único</div>
            </div>
            <Button
              onClick={() => setOpen(true)}
              className="h-11 px-5 text-[13px] font-semibold gap-2 group/lt"
            >
              <Zap className="h-3.5 w-3.5" />
              Comprar agora
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/lt:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>

      <VexoPayCheckoutDialog
        open={open}
        onOpenChange={setOpen}
        planId="lifetime-key"
        planName="Chave Vitalícia Hyro"
        amountCents={price * 100}
        licensesCount={1}
        resellerUserId={userId}
        defaultEmail={defaultEmail}
      />
    </section>
  );
}
