import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2, Coins, MessageCircle, Rocket, Crown, Building2,
  Check, ArrowRight, Users, ShieldCheck, TrendingUp, Handshake,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { supabase as cloud } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { OWNER_EMAIL, fetchPrimaryLicenseForUser, fetchLicensePerms } from "@/lib/permissions";

export const Route = createFileRoute("/_dash/resellers")({
  component: ResellersPage,
});

const WHATSAPP_NUMBER = "5527981359051";

type Reseller = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  created_at: string;
  balance?: number;
};

type PartnerPlan = {
  id: string;
  name: string;
  tagline: string;
  icon: typeof Rocket;
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
    name: "Starter",
    tagline: "Comece a revender com previsibilidade e margem sólida.",
    icon: Rocket,
    setup: 497,
    monthly: 149,
    licensesMonth: 15,
    commission: 25,
    perks: [
      "15 licenças mensais para revender",
      "25% de comissão sobre renovações",
      "Painel próprio de gestão",
      "Material de venda pronto",
      "Suporte via WhatsApp em horário comercial",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "O plano dos revendedores que faturam de verdade.",
    icon: TrendingUp,
    setup: 997,
    monthly: 349,
    licensesMonth: 50,
    commission: 35,
    featured: true,
    badge: "Mais escolhido",
    perks: [
      "50 licenças mensais + créditos acumuláveis",
      "35% de comissão + bônus por meta",
      "White-label parcial (sua marca no painel)",
      "Prioridade em ativações e suporte",
      "Treinamento de vendas ao vivo",
      "Relatórios avançados de conversão",
    ],
  },
  {
    id: "elite",
    name: "Elite Partner",
    tagline: "Operação escalável com margem premium e exclusividade.",
    icon: Crown,
    setup: 2497,
    monthly: 897,
    licensesMonth: "ilimitado",
    commission: 50,
    badge: "Máxima margem",
    perks: [
      "Licenças ilimitadas para revenda",
      "50% de comissão vitalícia",
      "White-label completo com domínio próprio",
      "Gerente de conta dedicado",
      "Acesso à API + integrações personalizadas",
      "Exclusividade regional negociável",
    ],
  },
];

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildPartnerWhatsapp(plan: PartnerPlan) {
  const msg =
    `Olá! Quero ativar o plano *${plan.name}* do Programa de Parceiros Hyro.\n` +
    `Setup: ${fmtBRL(plan.setup)} · Mensalidade: ${fmtBRL(plan.monthly)}\n` +
    `Licenças/mês: ${plan.licensesMonth === "ilimitado" ? "Ilimitadas" : plan.licensesMonth} · Comissão: ${plan.commission}%\n\n` +
    `Aguardo os próximos passos para começar a revender.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function ResellersPage() {
  const { session } = useAuth();
  const isCloudAdmin = session?.user.role !== "client";
  const isOwner = isCloudAdmin && session?.user.email?.toLowerCase() === OWNER_EMAIL;
  const [createOpen, setCreateOpen] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState<Reseller | null>(null);
  const [tab, setTab] = useState<"plans" | "list">("plans");

  // Slots contratados/dispon\u00edveis do dono da licen\u00e7a (apenas para clientes)
  const { data: mySlots } = useQuery({
    queryKey: ["my-slots", session?.user.id],
    enabled: !!session && !isCloudAdmin,
    queryFn: async () => {
      const licId = await fetchPrimaryLicenseForUser(session!.user.id);
      if (!licId) return { unlimited: false, total: 0, used: 0 };
      const perms = await fetchLicensePerms(licId);
      const { count } = await supabase
        .from("hyro_extension_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "reseller")
        .eq("created_by", session!.user.id);
      return { unlimited: perms.unlimited, total: perms.package_slots || 0, used: count || 0 };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["resellers", isOwner ? "all" : session?.user.id],
    enabled: isCloudAdmin || !!session,
    refetchInterval: 30_000,
    queryFn: async () => {
      // hyro_extension_users NÃO possui coluna `created_by`. Escopo por criador
      // é feito via hyro_extension_licenses.reseller_id/created_by mais abaixo.
      const q = supabase
        .from("hyro_extension_users")
        .select("id, email, name, role, active, created_at, hyro_reseller_balances(balance)")
        .eq("role", "reseller")
        .order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;

      let resellers = (data ?? []).map((r: any) => ({
        ...r,
        balance: r.hyro_reseller_balances?.[0]?.balance ?? 0,
      })) as Reseller[];

      // Non-owner: mostra apenas revendedores cujas licenças foram criadas por mim.
      if (!isOwner && session) {
        const { data: mine } = await supabase
          .from("hyro_extension_licenses")
          .select("reseller_id")
          .eq("created_by", session.user.id)
          .not("reseller_id", "is", null);
        const allowed = new Set((mine ?? []).map((l: any) => l.reseller_id));
        resellers = resellers.filter((r) => allowed.has(r.id));
      }

      // Contagem RÍGIDA de licenças criadas por cada revendedor
      const ids = resellers.map((r) => r.id);
      const usedMap: Record<string, number> = {};
      if (ids.length) {
        const { data: lic } = await supabase
          .from("hyro_extension_licenses")
          .select("id, created_by")
          .in("created_by", ids);
        for (const row of lic ?? []) {
          const k = (row as any).created_by as string;
          if (!k) continue;
          usedMap[k] = (usedMap[k] ?? 0) + 1;
        }
      }
      return resellers.map((r) => {
        const used = usedMap[r.id] ?? 0;
        const available = r.balance ?? 0;
        const allocated = used + available;
        return { ...r, used, available, allocated } as Reseller & {
          used: number; available: number; allocated: number;
        };
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Hero — Programa de Parceiros */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 px-6 py-5">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.3] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, color-mix(in oklab, var(--color-foreground) 6%, transparent) 0, transparent 40%), radial-gradient(circle at 85% 70%, color-mix(in oklab, var(--color-foreground) 4%, transparent) 0, transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border bg-background/80 backdrop-blur text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-2">
              <Handshake className="h-3 w-3" />
              Programa de Parceiros
            </div>
            <h1 className="text-[22px] leading-[1.15] font-semibold tracking-tight">
              Revenda a Hyro com margem premium e estrutura profissional
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
              Créditos mensais garantidos, comissão recorrente e painel próprio.
              Ativação exclusiva mediante contato com o time comercial.
            </p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Quero saber mais sobre o Programa de Parceiros Hyro.")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[12.5px] font-medium px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors shadow-xs"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Falar com comercial
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("plans")}
              className={[
                "relative px-3 py-2 text-[13px] font-medium transition-colors",
                tab === "plans" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-1.5">
                <Handshake className="h-3.5 w-3.5" /> Planos de parceria
              </span>
              {tab === "plans" && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-foreground rounded-full" />}
            </button>
            <button
              onClick={() => setTab("list")}
              className={[
                "relative px-3 py-2 text-[13px] font-medium transition-colors",
                tab === "list" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Minhas revendas
                {(data?.length ?? 0) > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-muted text-[10px] font-mono tabular-nums text-muted-foreground border border-border">
                    {data!.length}
                  </span>
                )}
              </span>
              {tab === "list" && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-foreground rounded-full" />}
            </button>
          </div>
          {tab === "list" && (() => {
            const unlimited = isOwner || !!mySlots?.unlimited;
            const total = mySlots?.total ?? 0;
            const used = mySlots?.used ?? (data?.length ?? 0);
            const available = unlimited ? Infinity : Math.max(0, total - used);
            const canCreate = isOwner || available > 0;
            return (
              <div className="flex items-center gap-3">
                {!isCloudAdmin && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md border border-border bg-muted/40 text-muted-foreground">
                    <Coins className="h-3 w-3" />
                    Disponíveis: <span className="font-mono text-foreground">{unlimited ? "∞" : available}</span>
                    {!unlimited && <span className="text-muted-foreground/70">/ {total}</span>}
                  </span>
                )}
                {isOwner && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md border border-success/30 bg-success/10 text-success">
                    <Coins className="h-3 w-3" /> Ilimitado
                  </span>
                )}
                <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!canCreate} title={!canCreate ? "Sem licenças disponíveis no pacote" : undefined}>
                  <Users className="h-3.5 w-3.5 mr-1.5" /> Cadastrar revendedor
                </Button>
              </div>
            );
          })()}
      </div>

      {/* Partner plans */}
      {tab === "plans" && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PARTNER_PLANS.map((p) => (
              <PartnerCard key={p.id} plan={p} />
            ))}
          </div>
        </section>
      )}

      {/* Existing resellers */}
      {tab === "list" && (
        <section>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-border">
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Revendedor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Alocado</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Utilizadas</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Disponíveis</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-w-[160px]">Uso</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...
                    </TableCell>
                  </TableRow>
                ) : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-14">
                      <div className="mx-auto flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="h-10 w-10 rounded-lg border border-dashed border-border flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="text-[13px]">Nenhum revendedor cadastrado ainda</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.map((r: any) => {
                    const used = r.used ?? 0;
                    const available = r.available ?? (r.balance ?? 0);
                    const allocated = r.allocated ?? (used + available);
                    const pct = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;
                    const empty = available <= 0;
                    const low = !empty && available <= Math.max(2, Math.ceil(allocated * 0.15));
                    const tone = empty ? "bg-destructive" : low ? "bg-warning" : "bg-foreground";
                    return (
                    <TableRow key={r.id} className="border-border">
                      <TableCell className="align-top">
                        <div className="font-medium text-[13px] leading-tight">{r.name ?? "—"}</div>
                        <div className="text-[11.5px] text-muted-foreground mt-0.5">{r.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1.5 h-6 px-2 text-[11px] font-medium ${
                            r.active
                              ? "border-success/30 text-success bg-success/10"
                              : "border-border text-muted-foreground bg-muted/40"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${r.active ? "bg-success" : "bg-muted-foreground"}`} />
                          {r.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[13px] tabular-nums text-foreground">{allocated}</TableCell>
                      <TableCell className="font-mono text-[13px] tabular-nums text-muted-foreground">{used}</TableCell>
                      <TableCell>
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 font-mono text-[13px] tabular-nums px-2 py-0.5 rounded-md border",
                            empty
                              ? "text-destructive border-destructive/30 bg-destructive/10"
                              : low
                              ? "text-warning border-warning/30 bg-warning/10"
                              : "text-success border-success/30 bg-success/10",
                          ].join(" ")}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${empty ? "bg-destructive" : low ? "bg-warning" : "bg-success"}`} />
                          {available}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full ${tone} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setBalanceTarget(r)}>
                          <Coins className="h-3.5 w-3.5 mr-1" /> Saldo
                        </Button>
                      </TableCell>
                    </TableRow>
                  );})
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </section>
      )}

      <CreateResellerDialog open={createOpen} onOpenChange={setCreateOpen} ownerUserId={session?.user.id ?? null} isOwner={isOwner} />
      <AdjustBalanceDialog reseller={balanceTarget} onClose={() => setBalanceTarget(null)} />
    </div>
  );
}

function PartnerCard({ plan }: { plan: PartnerPlan }) {
  const Icon = plan.icon;
  const featured = plan.featured;
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
            featured
              ? "bg-background text-foreground"
              : "bg-foreground text-background",
          ].join(" ")}
        >
          {plan.badge}
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3">
        <div
          className={[
            "h-9 w-9 rounded-lg flex items-center justify-center border",
            featured
              ? "bg-background/10 border-background/20"
              : "bg-secondary border-border",
          ].join(" ")}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight leading-none">{plan.name}</div>
          <div className={["text-[10.5px] font-mono uppercase tracking-wider mt-1.5", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>
            {plan.commission}% de comissão
          </div>
        </div>
      </div>

      <p className={["text-[12.5px] leading-relaxed mb-5 min-h-[36px]", featured ? "text-background/75" : "text-muted-foreground"].join(" ")}>
        {plan.tagline}
      </p>

      {/* Pricing */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1.5">
          <span className={["text-[13px] font-medium", featured ? "text-background/80" : "text-muted-foreground"].join(" ")}>R$</span>
          <span className="text-[40px] leading-none font-semibold tracking-tight font-mono tabular-nums">
            {plan.monthly.toLocaleString("pt-BR")}
          </span>
          <span className={["text-[12.5px] ml-1", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>/mês</span>
        </div>
        <div className={["text-[11.5px] mt-1.5", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>
          + Setup único de <span className="font-medium">{fmtBRL(plan.setup)}</span>
        </div>
      </div>

      {/* Quick stats */}
      <div className={["grid grid-cols-2 gap-2 p-2.5 rounded-lg mb-5", featured ? "bg-background/10" : "bg-muted/40 border border-border"].join(" ")}>
        <div>
          <div className={["text-[10px] uppercase tracking-wider font-semibold", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>Licenças/mês</div>
          <div className="text-[15px] font-semibold font-mono mt-0.5">
            {plan.licensesMonth === "ilimitado" ? "∞" : plan.licensesMonth}
          </div>
        </div>
        <div>
          <div className={["text-[10px] uppercase tracking-wider font-semibold", featured ? "text-background/60" : "text-muted-foreground"].join(" ")}>Comissão</div>
          <div className="text-[15px] font-semibold font-mono mt-0.5">{plan.commission}%</div>
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

      <Button
        asChild
        className={[
          "w-full h-11 text-[13px] font-semibold group/btn",
          featured
            ? "bg-background text-foreground hover:bg-background/90"
            : "bg-foreground text-background hover:bg-foreground/90",
        ].join(" ")}
      >
        <a href={buildPartnerWhatsapp(plan)} target="_blank" rel="noreferrer">
          <MessageCircle className="h-3.5 w-3.5" />
          Ativar via WhatsApp
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
        </a>
      </Button>

      <p className={["text-[10.5px] mt-3 text-center", featured ? "text-background/50" : "text-muted-foreground"].join(" ")}>
        Ativação sujeita a análise comercial
      </p>
    </div>
  );
}

function CreateResellerDialog({
  open,
  onOpenChange,
  ownerUserId,
  isOwner,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ownerUserId: string | null;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [mode, setMode] = useState<"normal" | "personalizado">("normal");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const reset = () => {
    setEmail(""); setName(""); setPassword(""); setBalance("0");
    setMode("normal"); setCreatedUrl(null); setCopiedLink(false);
  };

  const submit = async () => {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm.includes("@")) { toast.error("E-mail inválido."); return; }

    setSubmitting(true);
    try {
      if (mode === "personalizado") {
        // Link personalizado: cria hyro_redemption_links com kind='reseller'.
        // O signup pelo /r/:slug irá promover o usuário para role='reseller'
        // e aplicar o saldo inicial de licenças.
        const slug = (await import("@/lib/redemption")).generateSlug();
        const { data, error } = await (cloud as any)
          .from("hyro_redemption_links")
          .insert({
            slug,
            kind: "reseller",
            license_id: null,
            target_email: emailNorm,
            target_name: name.trim() || null,
            created_by: session?.user.email ?? "",
            reseller_slots: Math.max(0, parseInt(balance) || 0),
            reseller_owner_id: ownerUserId ?? session?.user.id ?? null,
          })
          .select("slug")
          .single();
        if (error) throw error;

        const url = `https://hyrolovable.lovable.app/r/${(data as any).slug}`;
        setCreatedUrl(url);
        toast.success("Link personalizado de revenda criado");
        qc.invalidateQueries({ queryKey: ["resellers"] });
        return;
      }

      // Modo normal — cria direto via RPC.
      const { error } = await supabase.rpc("admin_create_reseller", {
        p_email: emailNorm,
        p_name: name,
        p_password: password,
        p_initial_balance: parseInt(balance) || 0,
      });
      if (error) throw error;

      // hyro_extension_users não possui coluna created_by — a atribuição de
      // "dono" do revendedor é derivada de hyro_extension_licenses.created_by
      // (licenças criadas por este dono). Nenhum update adicional necessário.

      toast.success("Revendedor criado");
      qc.invalidateQueries({ queryKey: ["resellers"] });
      qc.invalidateQueries({ queryKey: ["my-slots"] });
      qc.invalidateQueries({ queryKey: ["dash-stats"] });
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!createdUrl) return;
    await navigator.clipboard.writeText(createdUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); } onOpenChange(o); }}>
      <DialogContent className="glass-panel border-0 sm:max-w-[480px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold tracking-tight">Cadastrar revendedor</DialogTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">Onboard manual ou por link personalizado.</p>
            </div>
          </div>
        </DialogHeader>

        {createdUrl ? (
          <div className="px-6 py-6 space-y-4">
            <div className="rounded-md border border-success/30 bg-success/10 p-4 text-[13px] text-success">
              Link personalizado gerado. Envie ao futuro revendedor — o IP dele será travado no primeiro acesso.
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">URL de convite</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={createdUrl} className="h-10 text-[12.5px] font-mono" />
                <Button size="sm" variant="outline" onClick={copyLink} className="h-10 shrink-0">
                  {copiedLink ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pacote reservado: <span className="font-mono text-foreground">{balance}</span> licenças.
              </p>
            </div>
            <DialogFooter className="px-0 pt-2 gap-2">
              <Button variant="ghost" size="sm" onClick={() => { reset(); }}>
                Criar outro
              </Button>
              <Button size="sm" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Tipo de cadastro</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "normal", title: "Normal", desc: "Cria a conta diretamente com senha definida por você." },
                    { id: "personalizado", title: "Personalizado", desc: "Gera link de convite travado por e-mail e IP." },
                  ] as const).map((opt) => {
                    const active = mode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMode(opt.id)}
                        className={[
                          "text-left rounded-md border px-3 py-2.5 transition-colors",
                          active ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/40 hover:bg-muted/40",
                        ].join(" ")}
                      >
                        <div className="text-[12.5px] font-medium">{opt.title}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Nome {mode === "personalizado" && <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 text-[13px]" />
              </div>
              {mode === "normal" && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Senha inicial</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 text-[13px]" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Pacote de licenças</Label>
                <Input type="number" min={0} value={balance} onChange={(e) => setBalance(e.target.value)} className="h-10 text-[13px]" />
                <p className="text-[11px] text-muted-foreground">
                  Quantas licenças este revendedor poderá criar.
                </p>
              </div>
            </div>
            <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2">
              <Button variant="ghost" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
              <Button
                size="sm"
                onClick={submit}
                disabled={submitting || !email || (mode === "normal" && !password)}
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                {mode === "personalizado" ? "Gerar link" : "Criar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdjustBalanceDialog({
  reseller,
  onClose,
}: {
  reseller: Reseller | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!reseller) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_adjust_reseller_balance", {
        p_reseller_id: reseller.id,
        p_delta: parseInt(delta) || 0,
        p_note: note || null,
      });
      if (error) throw error;
      toast.success("Saldo atualizado");
      qc.invalidateQueries({ queryKey: ["resellers"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!reseller} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-panel border-0 sm:max-w-[460px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold tracking-tight">Ajustar saldo</DialogTitle>
              <p className="text-[12.5px] text-muted-foreground mt-0.5 truncate">{reseller.email}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="px-6 py-5 space-y-4">
          <div className="text-[12.5px] text-muted-foreground">
            Saldo atual: <span className="font-mono text-foreground">{reseller.balance ?? 0}</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Variação (negativo debita)</Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className="h-10 text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Observação</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-10 text-[13px]" />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
