import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plug, Settings, CheckCircle2, XCircle, DollarSign, Loader2 } from "lucide-react";
import { supabase as ext } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { MpIntegrationDialog } from "@/components/mp-integration-dialog";
import { ResellerPricingDialog } from "@/components/reseller-pricing-dialog";
import { getMpIntegrationStatus, getResellerPricing } from "@/lib/mp.functions";
import mpLogo from "@/assets/mercado-pago-logo.png";

export const Route = createFileRoute("/_dash/integrations")({
  component: IntegrationsPage,
});

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function IntegrationsPage() {
  const { session, authReady } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id ?? null;
  const role = session?.user.role;

  const [access, setAccess] = useState<"loading" | "granted" | "denied">("loading");
  const [mpOpen, setMpOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const getMp = useServerFn(getMpIntegrationStatus);
  const getPricing = useServerFn(getResellerPricing);

  useEffect(() => {
    if (!authReady) return;
    if (!userId) { setAccess("denied"); return; }
    if (role === "admin") { setAccess("granted"); return; }
    (async () => {
      const { data } = await ext
        .from("hyro_extension_users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      setAccess((data as any)?.role === "reseller" ? "granted" : "denied");
    })();
  }, [authReady, userId, role]);

  useEffect(() => {
    if (access === "denied") navigate({ to: "/" });
  }, [access, navigate]);

  const mpQ = useQuery({
    queryKey: ["mp-status-page", userId],
    enabled: access === "granted" && !!userId,
    queryFn: () => getMp({ data: { userId: userId! } }),
    staleTime: 15_000,
  });

  const pricingQ = useQuery({
    queryKey: ["reseller-pricing-page", userId],
    enabled: access === "granted" && !!userId,
    queryFn: () => getPricing({ data: { resellerUserId: userId! } }),
    staleTime: 15_000,
  });

  if (access !== "granted" || !userId) {
    return (
      <div className="p-8 flex items-center justify-center text-muted-foreground text-[13px]">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Verificando acesso…
      </div>
    );
  }

  const mp = mpQ.data;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 px-6 py-5">
        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border bg-background/80 backdrop-blur text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-2">
          <Plug className="h-3 w-3" /> Integrações
        </div>
        <h1 className="text-[22px] leading-[1.15] font-semibold tracking-tight">Conecte gateways de pagamento</h1>
        <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
          Cada revendedor conecta sua própria conta. Os pagamentos vão direto para você.
        </p>
      </div>

      <section>
        <h2 className="text-[15px] font-semibold tracking-tight mb-4">Gateways</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Mercado Pago */}
          <div className="rounded-xl border border-border bg-card p-5 hover:border-foreground/25 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden">
                  <img src={mpLogo} alt="Mercado Pago" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold tracking-tight">Mercado Pago</div>
                  <div className="text-[11px] text-muted-foreground">PIX, cartão e boleto</div>
                </div>
              </div>
              {mpQ.isLoading ? (
                <span className="text-[10px] text-muted-foreground">…</span>
              ) : mp?.configured && mp.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-success/10 text-success border border-success/20">
                  <CheckCircle2 className="h-3 w-3" /> Ativo
                </span>
              ) : mp?.configured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
                  Pausado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                  <XCircle className="h-3 w-3" /> Não conectado
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-muted-foreground min-h-[36px]">
              {mp?.configured ? (
                <>Conta: <span className="font-medium text-foreground">{mp.accountNickname ?? mp.accountEmail ?? mp.accountId}</span> · modo <span className="font-mono">{mp.mode}</span></>
              ) : (
                "Configure suas credenciais para receber pagamentos das renovações."
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => setMpOpen(true)}>
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                {mp?.configured ? "Configurar" : "Conectar"}
              </Button>
            </div>
          </div>

          {/* Preço de renovação */}
          <div className="rounded-xl border border-border bg-card p-5 hover:border-foreground/25 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold tracking-tight">Preço de renovação</div>
                  <div className="text-[11px] text-muted-foreground">Valor mostrado aos seus clientes</div>
                </div>
              </div>
              {pricingQ.data?.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-success/10 text-success border border-success/20">
                  <CheckCircle2 className="h-3 w-3" /> Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                  Não configurado
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-muted-foreground min-h-[36px]">
              {pricingQ.data ? (
                <>Valor: <span className="font-semibold text-foreground font-mono">{fmtMoney(pricingQ.data.priceCents)}</span> · Duração: <span className="font-medium text-foreground">+{pricingQ.data.renewalDays} dias</span></>
              ) : (
                "Defina o preço e a duração da renovação para os clientes."
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => setPriceOpen(true)}>
                <Settings className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
            </div>
          </div>
        </div>
      </section>

      <MpIntegrationDialog open={mpOpen} onOpenChange={setMpOpen} userId={userId} />
      <ResellerPricingDialog open={priceOpen} onOpenChange={setPriceOpen} resellerUserId={userId} />
    </div>
  );
}
