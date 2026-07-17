import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  KeyRound, CalendarClock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Infinity as InfinityIcon, Clock, Copy, RefreshCw,
  Check, ArrowRight, MessageCircle, Sparkles, Zap, Minus, Plus, Settings2, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { supabase as cloud } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VexoPayCheckoutDialog } from "@/components/vexopay-checkout-dialog";
import { MonthlyCheckoutDialog } from "@/components/monthly-checkout-dialog";
import { SimpleRenewDialog } from "@/components/simple-renew-dialog";
import { AffiliateInfoDialog } from "@/components/affiliate-info-dialog";
import { Link2, Trophy } from "lucide-react";
import { getPublicOrigin } from "@/lib/public-origin";

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
  const [renewTarget, setRenewTarget] = useState<{ id: string; expires_at: string } | null>(null);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [affOpen, setAffOpen] = useState(false);

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
  const isRegularUser = authReady && !!userId && roleData !== undefined && roleData !== "reseller";

  // Cliente comum: código próprio de afiliado
  const { data: myAff } = useQuery({
    queryKey: ["my-affiliate-code", sessionKey, userId],
    enabled: isRegularUser,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("hyro_extension_users")
        .select("affiliate_code")
        .eq("id", userId!)
        .maybeSingle();
      return ((data as any)?.affiliate_code as string | null) ?? null;
    },
  });

  // Indicações do cliente
  const { data: referrals } = useQuery({
    queryKey: ["my-referrals", sessionKey, userId],
    enabled: isRegularUser,
    staleTime: 20_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hyro_affiliate_referrals")
        .select("id, referred_email, status, created_at, paid_at")
        .eq("affiliate_user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Array<{ id: string; referred_email: string | null; status: string; created_at: string; paid_at: string | null }>;
    },
  });

  // Flag vitalícia
  const { data: lifetimeFlag } = useQuery({
    queryKey: ["my-lifetime-flag", sessionKey, userId],
    enabled: isRegularUser,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("hyro_extension_users")
        .select("lifetime_bonus_granted")
        .eq("id", userId!)
        .maybeSingle();
      return !!(data as any)?.lifetime_bonus_granted;
    },
  });

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
    staleTime: 30_000,
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

      {/* Cliente comum: compra mensal + indicações */}
      {!isReseller && authReady && userId && (
        <ClientAffiliateCard
          userId={userId}
          userEmail={session?.user.email ?? ""}
          userName={session?.user.name ?? null}
          hasActiveLicense={stats.active > 0}
          affiliateCode={myAff ?? null}
          referrals={referrals ?? []}
          lifetimeGranted={!!lifetimeFlag}
          onOpenCheckout={() => setMonthlyOpen(true)}
          affCopied={affCopied}
          setAffCopied={setAffCopied}
        />
      )}

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

      {monthlyOpen && userId && (
        <MonthlyCheckoutDialog
          open={monthlyOpen}
          onOpenChange={setMonthlyOpen}
          userId={userId}
          userEmail={session?.user.email ?? ""}
          userName={session?.user.name ?? null}
          onCompleted={() => {
            qc.invalidateQueries({ queryKey: ["my-licenses"] });
            qc.invalidateQueries({ queryKey: ["my-referrals"] });
            qc.invalidateQueries({ queryKey: ["my-lifetime-flag"] });
          }}
        />
      )}
    </div>
  );
}

function ClientAffiliateCard({
  userId, userEmail, userName, hasActiveLicense, affiliateCode, referrals, lifetimeGranted, onOpenCheckout, affCopied, setAffCopied,
}: {
  userId: string;
  userEmail: string;
  userName: string | null;
  hasActiveLicense: boolean;
  affiliateCode: string | null;
  referrals: Array<{ id: string; referred_email: string | null; status: string; created_at: string; paid_at: string | null }>;
  lifetimeGranted: boolean;
  onOpenCheckout: () => void;
  affCopied: boolean;
  setAffCopied: (v: boolean) => void;
}) {
  const paidCount = referrals.filter((r) => (r.status || "").toLowerCase() === "paid").length;
  const pendingCount = referrals.filter((r) => (r.status || "").toLowerCase() === "pending").length;
  const goal = 3;
  const progress = Math.min(100, (paidCount / goal) * 100);
  const remaining = Math.max(0, goal - paidCount);

  const origin = getPublicOrigin();
  const link = affiliateCode ? `${origin}/a/${affiliateCode}` : "";
  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setAffCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setAffCopied(false), 1800);
    } catch { toast.error("Falha ao copiar"); }
  };

  const maskEmail = (e: string | null) => {
    if (!e) return "—";
    const [u, d] = e.split("@");
    if (!d) return e;
    const uMasked = u.length <= 2 ? u[0] + "•" : u.slice(0, 2) + "•".repeat(Math.min(4, u.length - 2));
    return `${uMasked}@${d}`;
  };

  return (
    <div className="space-y-4">
      {/* CTA compra mensal quando sem licença ativa */}
      {!hasActiveLicense && (
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-primary/30 bg-background/60 text-[10px] uppercase tracking-[0.16em] text-primary font-semibold mb-2">
                <Sparkles className="h-3 w-3" /> Ativação instantânea
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight">Adquira sua licença mensal</h3>
              <p className="text-[12.5px] text-muted-foreground mt-1 max-w-lg">
                Pagamento único de <span className="font-semibold text-foreground">R$ 69,90</span> via PIX. Liberação automática, 30 dias de acesso completo.
              </p>
            </div>
            <Button size="lg" onClick={onOpenCheckout} className="shrink-0">
              <Zap className="h-4 w-4 mr-1.5" /> Comprar por R$ 69,90
            </Button>
          </div>
        </div>
      )}

      {/* Progresso de indicações */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border bg-background/60 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-2">
              <Trophy className="h-3 w-3" /> Programa de indicações
            </div>
            <h3 className="text-[17px] font-semibold tracking-tight">
              {lifetimeGranted ? "Vitalícia conquistada!" : `Indique 3 e ganhe uma licença vitalícia`}
            </h3>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              {lifetimeGranted
                ? "Você já desbloqueou seu bônus vitalício. Continue indicando para ajudar amigos."
                : remaining === 0
                  ? "Você atingiu a meta! Seu bônus será liberado no próximo pagamento identificado."
                  : `Faltam ${remaining} ${remaining === 1 ? "indicação paga" : "indicações pagas"} para você ganhar uma licença vitalícia.`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Progresso</div>
            <div className="text-[22px] font-semibold tracking-tight tabular-nums">
              {paidCount}<span className="text-muted-foreground text-[14px]">/{goal}</span>
            </div>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
          <div
            className={`h-full transition-all duration-500 ${lifetimeGranted ? "bg-success" : paidCount >= goal ? "bg-success" : "bg-primary"}`}
            style={{ width: `${lifetimeGranted ? 100 : progress}%` }}
          />
        </div>

        {/* Link de afiliado */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Seu link de indicação</div>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[11.5px] truncate flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{link || (affiliateCode === null ? "Gerando seu código…" : "—")}</span>
            </div>
            <Button variant="outline" size="sm" onClick={copyLink} disabled={!link}>
              {affCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {affiliateCode && (
            <div className="mt-1.5 text-[10.5px] text-muted-foreground">
              Código: <span className="font-mono font-semibold text-foreground">{affiliateCode}</span>
            </div>
          )}
        </div>

        {/* Lista de indicados */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Suas indicações</span>
            <span className="text-[10.5px] text-muted-foreground font-mono">
              {paidCount} pagas · {pendingCount} pendentes
            </span>
          </div>
          {referrals.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
              Nenhuma indicação ainda. Compartilhe seu link para começar.
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {referrals.slice(0, 10).map((r) => {
                const s = (r.status || "").toLowerCase();
                const tone = s === "paid" ? "success" : s === "canceled" || s === "cancelled" ? "danger" : "warn";
                const cls = tone === "success" ? "border-success/30 bg-success/10 text-success"
                  : tone === "danger" ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-warning/30 bg-warning/10 text-warning";
                const label = s === "paid" ? "Pago" : s === "canceled" || s === "cancelled" ? "Cancelado" : "Aguardando";
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border bg-muted/20">
                    <span className="text-[12.5px] truncate flex-1">{maskEmail(r.referred_email)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider shrink-0 ${cls}`}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
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

// Pacote personalizado — preço por chave escalonado por volume.
// 1..5 chaves: R$ 40,90 · 6..15 chaves: R$ 40,00 · 16+ chaves: R$ 35,00.
function unitPriceForQty(qty: number): number {
  if (qty <= 0) return 0;
  if (qty <= 5) return 40.9;
  if (qty <= 15) return 40;
  return 35;
}

function CustomPlanCard({ userId, defaultEmail }: { userId: string | null; defaultEmail: string | null }) {
  const [qty, setQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const clamp = (n: number) => Math.max(1, Math.min(999, Math.trunc(Number.isFinite(n) ? n : 1)));
  const unit = useMemo(() => unitPriceForQty(qty), [qty]);
  const total = useMemo(() => Math.round(qty * unit * 100) / 100, [qty, unit]);

  // Faixa ativa para destacar visualmente.
  const tier = qty <= 5 ? 0 : qty <= 15 ? 1 : 2;
  const tiers = [
    { label: "1 – 5 chaves", price: "R$ 40,90", key: "por chave" },
    { label: "6 – 15 chaves", price: "R$ 40,00", key: "por chave" },
    { label: "16+ chaves", price: "R$ 35,00", key: "por chave" },
  ];

  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 md:p-6 hover:border-foreground/25 transition-colors">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-11 w-11 rounded-xl border border-border bg-gradient-to-br from-amber-100 to-amber-300/60 dark:from-amber-500/20 dark:to-amber-700/10 dark:border-amber-400/30 flex items-center justify-center shadow-inner shrink-0">
            <Settings2 className="h-5 w-5 text-amber-700 dark:text-amber-300" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-1">
              <Sparkles className="h-3 w-3" /> Personalizado
            </div>
            <div className="text-[15px] md:text-[16px] font-semibold tracking-tight leading-tight">
              Monte seu pacote
            </div>
            <p className="text-[12px] text-muted-foreground mt-1 leading-snug max-w-md">
              Escolha a quantidade de chaves. O valor por chave reduz conforme o volume aumenta.
            </p>
          </div>
        </div>

        {/* Preço */}
        <div className="text-left sm:text-right sm:ml-auto shrink-0">
          <div className="flex items-baseline gap-1 sm:justify-end">
            <span className="text-[12px] text-muted-foreground">R$</span>
            <span className="text-[26px] font-semibold font-mono tabular-nums leading-none">
              {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5 uppercase tracking-wider font-mono">
            {qty} {qty === 1 ? "chave" : "chaves"} · {fmtBRL(unit)} un.
          </div>
        </div>
      </div>


      {/* Controles */}
      <div className="mt-5 flex flex-col gap-3 md:grid md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="inline-flex items-center rounded-lg border border-border overflow-hidden self-start md:self-center">
          <button
            type="button"
            onClick={() => setQty((q) => clamp(q - 1))}
            className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
            disabled={qty <= 1}
            aria-label="Diminuir"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={qty}
            onChange={(e) => setQty(clamp(parseInt(e.target.value || "1", 10)))}
            className="h-11 w-16 sm:w-20 text-center font-mono tabular-nums text-[15px] font-semibold bg-background border-x border-border focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <button
            type="button"
            onClick={() => setQty((q) => clamp(q + 1))}
            className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Aumentar"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Faixas de preço */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full md:mx-3">
          {tiers.map((t, i) => (
            <div
              key={t.label}
              className={[
                "rounded-lg border px-1.5 py-2 sm:p-2 text-center transition-colors min-w-0",
                tier === i
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-muted/40 text-muted-foreground",
              ].join(" ")}
            >
              <div className={["text-[8.5px] sm:text-[10px] uppercase tracking-wider font-semibold truncate", tier === i ? "text-background/70" : "text-muted-foreground"].join(" ")}>
                {t.label}
              </div>
              <div className="text-[11px] sm:text-[13px] font-semibold font-mono tabular-nums mt-0.5 truncate">{t.price}</div>
              <div className={["text-[8.5px] sm:text-[10px] font-mono uppercase tracking-wider truncate", tier === i ? "text-background/60" : "text-muted-foreground"].join(" ")}>
                {t.key}
              </div>
            </div>
          ))}
        </div>


        <Button
          onClick={() => setCheckoutOpen(true)}
          className="h-11 px-5 text-[13px] font-semibold gap-2 group/cp w-full md:w-auto md:justify-self-end"
          disabled={qty < 1 || total <= 0}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Comprar agora
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cp:translate-x-0.5" />
        </Button>
      </div>


      <p className="text-[10.5px] mt-3 text-muted-foreground">
        Pagamento seguro via PIX · o valor é calculado automaticamente pela faixa de volume.
      </p>

      <VexoPayCheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        planId={`custom-${qty}`}
        planName={`Pacote Personalizado · ${qty} ${qty === 1 ? "chave" : "chaves"}`}
        amountCents={Math.round(total * 100)}
        licensesCount={qty}
        resellerUserId={userId}
        defaultEmail={defaultEmail}
      />
    </div>
  );
}
