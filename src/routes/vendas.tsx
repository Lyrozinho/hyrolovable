import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  Zap,
  Infinity as InfinityIcon,
  Sparkles,
  Check,
  Copy,
  Clock,
  QrCode,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Star,
  CreditCard,
  BadgeCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createVexoPayPixCharge, checkVexoPayPixStatus } from "@/lib/vexopay.functions";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Lovable Extensão Ilimitada — Use sem se preocupar com créditos" },
      {
        name: "description",
        content:
          "Acesso ilimitado à extensão Lovable. Sem limite de créditos. Ative em minutos com pagamento via PIX.",
      },
      { property: "og:title", content: "Lovable Extensão Ilimitada" },
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
type Plan = {
  id: PlanId;
  name: string;
  period: string;
  priceCents: number;
  highlight?: boolean;
  perks: string[];
};

const PLANS: Plan[] = [
  {
    id: "semanal",
    name: "Plano 7 Dias",
    period: "7 dias de acesso",
    priceCents: 5900,
    perks: [
      "Extensão Lovable ilimitada",
      "Sem limite de créditos",
      "Suporte prioritário",
      "Ativação instantânea",
    ],
  },
  {
    id: "mensal",
    name: "Plano Mensal",
    period: "30 dias de acesso",
    priceCents: 8900,
    highlight: true,
    perks: [
      "Extensão Lovable ilimitada",
      "Sem limite de créditos",
      "Suporte prioritário 24/7",
      "Atualizações inclusas",
      "Estabilidade garantida",
    ],
  },
];

const BUMP_CENTS = 2700;

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function maskCPF(v: string) {
  const d = v.replace(/\D+/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function isValidCPF(v: string) {
  const cpf = v.replace(/\D+/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

function VendasPage() {
  const [selected, setSelected] = useState<PlanId>("mensal");
  const [bump, setBump] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");

  // Checkout state
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "pix" | "paid">("form");
  const [pix, setPix] = useState<null | {
    id: string;
    qrCodeBase64: string | null;
    qrCodeText: string | null;
    amountCents: number;
  }>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [expired, setExpired] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  // Top-bar promo countdown (24h persisted)
  const [promoLeft, setPromoLeft] = useState<number>(24 * 60 * 60);
  useEffect(() => {
    const KEY = "hyro_promo_end";
    let end = Number(localStorage.getItem(KEY) || 0);
    const now = Date.now();
    if (!end || end - now <= 0 || end - now > 25 * 60 * 60 * 1000) {
      end = now + 24 * 60 * 60 * 1000;
      localStorage.setItem(KEY, String(end));
    }
    const upd = () => setPromoLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    upd();
    const i = window.setInterval(upd, 1000);
    return () => clearInterval(i);
  }, []);
  const ph = String(Math.floor(promoLeft / 3600)).padStart(2, "0");
  const pm = String(Math.floor((promoLeft % 3600) / 60)).padStart(2, "0");
  const ps = String(promoLeft % 60).padStart(2, "0");

  const plan = PLANS.find((p) => p.id === selected)!;
  const totalCents = plan.priceCents + (bump ? BUMP_CENTS : 0);

  const canSubmit =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    isValidEmail(email) &&
    isValidCPF(cpf) &&
    !submitting;

  const createFn = useServerFn(createVexoPayPixCharge);
  const statusFn = useServerFn(checkVexoPayPixStatus);

  // Countdown + polling during pix step
  useEffect(() => {
    if (step !== "pix" || !pix) return;
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setExpired(true);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await statusFn({ data: { id: pix.id } });
        const s = (r?.status || "").toLowerCase();
        if (["paid", "approved", "completed", "success", "confirmed"].includes(s)) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
          setStep("paid");
        }
      } catch { /* silent */ }
    }, 4000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pix?.id]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = useMemo(
    () => Math.max(0, Math.min(100, (secondsLeft / 300) * 100)),
    [secondsLeft],
  );

  const submit = async () => {
    if (!canSubmit) {
      toast.error("Preencha todos os campos corretamente.");
      return;
    }
    setSubmitting(true);
    try {
      const label = bump ? `${plan.name} + Painel de Revenda` : plan.name;
      const res = await createFn({
        data: {
          planId: bump ? `${plan.id}-bump` : plan.id,
          planName: label,
          amountCents: totalCents,
          customerName: `${firstName.trim()} ${lastName.trim()}`.slice(0, 120),
          customerDocument: cpf.replace(/\D+/g, ""),
          customerEmail: email.trim(),
        },
      });
      if (!res?.qrCodeBase64 && !res?.qrCodeText) {
        throw new Error("Cobrança gerada, mas provedor não retornou QR. Tente novamente.");
      }
      setPix({
        id: res.id,
        qrCodeBase64: res.qrCodeBase64,
        qrCodeText: res.qrCodeText,
        amountCents: res.amountCents,
      });
      setSecondsLeft(300);
      setExpired(false);
      setStep("pix");
      setTimeout(() => {
        document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível gerar o PIX.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!pix?.qrCodeText) return;
    try {
      await navigator.clipboard.writeText(pix.qrCodeText);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Não foi possível copiar."); }
  };

  const checkNow = async () => {
    if (!pix) return;
    setChecking(true);
    try {
      const r = await statusFn({ data: { id: pix.id } });
      const s = (r?.status || "").toLowerCase();
      if (["paid", "approved", "completed", "success", "confirmed"].includes(s)) {
        setStep("paid");
      } else {
        toast.info("Pagamento ainda não identificado. Aguarde a confirmação.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar status.");
    } finally {
      setChecking(false);
    }
  };

  const qrSrc = pix?.qrCodeBase64
    ? pix.qrCodeBase64.startsWith("data:")
      ? pix.qrCodeBase64
      : `data:image/png;base64,${pix.qrCodeBase64}`
    : null;

  const scrollToCheckout = () => {
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground antialiased">
      {/* Promo bar */}
      <div className="w-full border-b border-border/60 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1.5 px-4 py-2 text-center sm:flex-row sm:gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Oferta ilimitada
          </span>
          <span className="text-[12px] text-muted-foreground">
            Expira em{" "}
            <span className="font-mono tabular-nums font-semibold text-foreground">
              {ph}:{pm}:{ps}
            </span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_0_1px_hsl(var(--border))]">
            <InfinityIcon className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Lovable Ilimitado</span>
        </div>
        <Button size="sm" variant="secondary" onClick={scrollToCheckout} className="text-[12.5px]">
          Adquirir agora
        </Button>
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
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-14 md:pb-20 md:pt-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                Extensão oficial · v2026
              </span>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
                Lovable{" "}
                <span className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                  sem limites
                </span>
                <br />
                de créditos.
              </h1>
              <p className="max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Use a Lovable sem se preocupar com créditos. Prompts ilimitados,
                estabilidade profissional e ativação instantânea via PIX.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={scrollToCheckout} className="h-12 px-6 text-[14px]">
                  <Zap className="mr-2 h-4 w-4" /> Ativar acesso agora
                </Button>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Pagamento seguro · PIX
                </div>
              </div>
              <ul className="grid gap-2 pt-2 text-[13.5px] text-muted-foreground sm:grid-cols-2">
                {[
                  "Prompts ilimitados",
                  "Sem travas de crédito",
                  "Ativação instantânea",
                  "Suporte humano",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right visual card */}
            <div className="relative">
              <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-[0_20px_60px_-30px_hsl(var(--primary)/0.35)] backdrop-blur">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-[11.5px] uppercase tracking-[0.18em] text-muted-foreground">
                      Conta ativa
                    </span>
                  </div>
                  <span className="rounded-md border border-border bg-background/60 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                    v2026.7
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-4">
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Créditos
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-2xl font-semibold tracking-tight">
                      <InfinityIcon className="h-6 w-6 text-primary" />
                      <span>Ilimitado</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Prompts hoje
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight font-mono tabular-nums">
                      1.284
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
                  {[
                    "Refinar UI da landing",
                    "Adicionar checkout PIX",
                    "Otimizar responsividade mobile",
                  ].map((t, i) => (
                    <div key={t} className="flex items-center justify-between text-[12.5px]">
                      <div className="flex items-center gap-2">
                        <div className="grid h-5 w-5 place-items-center rounded-md bg-primary/15">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-foreground/90">{t}</span>
                      </div>
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {i === 0 ? "agora" : i === 1 ? "1m" : "3m"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 text-center md:grid-cols-4">
          {[
            { icon: Lock, label: "Pagamento criptografado" },
            { icon: ShieldCheck, label: "SSL 256-bit" },
            { icon: CreditCard, label: "PIX Bacen" },
            { icon: Star, label: "+2.400 clientes" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-[11.5px]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Checkout */}
      <section id="checkout" className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="mb-8 text-center md:mb-10">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Escolha seu acesso
          </h2>
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            Ativação imediata após a confirmação do PIX.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
          {/* Left: plans + order bump */}
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {PLANS.map((p) => {
                const active = selected === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                      active
                        ? "border-primary/80 bg-primary/[0.05] shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                        : "border-border bg-card/40 hover:border-border/80"
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
                        Mais popular
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5" /> {p.period}
                    </div>
                    <div className="mt-1.5 text-[17px] font-semibold tracking-tight">
                      {p.name}
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold font-mono tabular-nums tracking-tight">
                        {fmtBRL(p.priceCents)}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-1.5 text-[12.5px] text-muted-foreground">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex items-center gap-2 text-[11.5px]">
                      <span
                        className={`grid h-4 w-4 place-items-center rounded-full border ${
                          active
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {active && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                        )}
                      </span>
                      <span className={active ? "text-foreground" : "text-muted-foreground"}>
                        {active ? "Selecionado" : "Selecionar"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Order bump */}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-dashed p-4 transition-all ${
                bump
                  ? "border-primary/70 bg-primary/[0.06]"
                  : "border-border bg-card/30 hover:border-border/80"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={bump}
                onChange={(e) => setBump(e.target.checked)}
              />
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                  bump ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`}
              >
                {bump && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                    <Sparkles className="h-3 w-3" /> Bônus
                  </span>
                  <span className="text-[14px] font-semibold tracking-tight">
                    Painel de Revenda
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    + {fmtBRL(BUMP_CENTS)}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  Acesso ao painel para gerar e revender chaves ilimitadas com suas margens.
                  Adicione ao pedido em 1 clique.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3 text-primary" /> Multi-revendedor
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3 w-3 text-primary" /> Chaves ilimitadas
                  </span>
                </div>
              </div>
            </label>
          </div>

          {/* Right: form / pix / paid */}
          <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-[0_20px_60px_-30px_hsl(var(--primary)/0.35)] backdrop-blur md:sticky md:top-4 md:self-start">
            {step === "form" && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Resumo
                    </div>
                    <div className="mt-0.5 text-[15px] font-semibold tracking-tight">
                      {plan.name}
                      {bump ? " + Painel de Revenda" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                      Total
                    </div>
                    <div className="font-mono text-xl font-semibold tabular-nums">
                      {fmtBRL(totalCents)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border/60 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="fn" className="text-[11.5px]">Nome</Label>
                      <Input
                        id="fn"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="João"
                        maxLength={60}
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ln" className="text-[11.5px]">Sobrenome</Label>
                      <Input
                        id="ln"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Silva"
                        maxLength={60}
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="em" className="text-[11.5px]">E-mail</Label>
                    <Input
                      id="em"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                      maxLength={120}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cpf" className="text-[11.5px]">CPF</Label>
                    <Input
                      id="cpf"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {cpf.length >= 14 && !isValidCPF(cpf) && (
                      <p className="text-[11px] text-destructive">CPF inválido</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-[11.5px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    Seus dados são utilizados exclusivamente para emitir a cobrança PIX.
                    Ambiente com criptografia TLS.
                  </span>
                </div>

                <Button
                  className="mt-4 h-12 w-full text-[14px]"
                  disabled={!canSubmit}
                  onClick={submit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Gerando PIX...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1.5 h-4 w-4" /> Pagar {fmtBRL(totalCents)}
                    </>
                  )}
                </Button>

                <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-primary" /> SSL
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3 text-primary" /> AES-256
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-primary" /> PIX Bacen
                  </span>
                </div>
              </>
            )}

            {step === "pix" && pix && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[15px] font-semibold tracking-tight">Pague com PIX</div>
                  <span className="font-mono tabular-nums text-[12.5px] text-muted-foreground">
                    {mm}:{ss}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="relative rounded-xl border border-border bg-white p-3 shadow-sm">
                    {qrSrc ? (
                      <img
                        src={qrSrc}
                        alt="QR Code PIX"
                        width={220}
                        height={220}
                        className="block rounded-md"
                      />
                    ) : (
                      <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 text-[12px] text-muted-foreground">
                        <QrCode className="h-8 w-8" />
                        Use o copia e cola
                      </div>
                    )}
                    {expired && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/85 backdrop-blur-sm">
                        <AlertTriangle className="mb-1 h-5 w-5 text-destructive" />
                        <div className="text-[12.5px] font-medium">PIX expirado</div>
                      </div>
                    )}
                  </div>

                  <div className="w-full">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Expira em
                      </span>
                      <span className="font-mono tabular-nums text-foreground">
                        {mm}:{ss}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          expired
                            ? "bg-destructive"
                            : secondsLeft < 60
                              ? "bg-warning"
                              : "bg-foreground"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="w-full space-y-1.5">
                    <Label
                      className={`text-[11.5px] ${expired ? "text-muted-foreground/60" : ""}`}
                    >
                      PIX copia e cola
                    </Label>
                    <div
                      className={`flex items-stretch gap-2 transition-opacity ${
                        expired ? "pointer-events-none select-none opacity-40" : ""
                      }`}
                    >
                      <div className="max-h-[72px] flex-1 overflow-auto break-all rounded-md border border-border bg-muted/40 px-2.5 py-2 font-mono text-[11px]">
                        {expired ? "—" : pix.qrCodeText || "—"}
                      </div>
                      <Button
                        variant="outline"
                        onClick={copyCode}
                        disabled={!pix.qrCodeText || expired}
                        className="shrink-0"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between border-t border-border pt-3 text-[12px] text-muted-foreground">
                    <span>Valor</span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {fmtBRL(pix.amountCents)}
                    </span>
                  </div>

                  <div className="flex w-full items-center justify-between gap-2 pt-1">
                    {expired ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setStep("form");
                          setPix(null);
                        }}
                        className="w-full"
                      >
                        Gerar novo PIX
                      </Button>
                    ) : (
                      <Button
                        onClick={checkNow}
                        disabled={checking}
                        className="w-full"
                      >
                        {checking ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Verificando...
                          </>
                        ) : (
                          "Já paguei"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {step === "paid" && (
              <div className="flex flex-col items-center gap-3 py-6 text-center animate-in fade-in-0 zoom-in-95 duration-500">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-success/30 bg-success/15">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div className="text-[16px] font-semibold tracking-tight">
                  Pagamento confirmado
                </div>
                <p className="max-w-[320px] text-[12.5px] leading-relaxed text-muted-foreground">
                  Recebemos seu pagamento. Enviamos as instruções de ativação para{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                </p>
                <a
                  href="/"
                  className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Voltar ao início
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ mini */}
      <section className="border-t border-border/60 bg-card/20">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <h3 className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
            Perguntas frequentes
          </h3>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                q: "Como recebo o acesso?",
                a: "Assim que o PIX é confirmado, você recebe por e-mail o link e a chave de ativação da extensão.",
              },
              {
                q: "É realmente ilimitado?",
                a: "Sim. Sem cotas de crédito, sem limite diário. Use sem se preocupar.",
              },
              {
                q: "Posso cancelar?",
                a: "Os planos têm duração fixa (7 ou 30 dias). Ao final, você decide se renova.",
              },
              {
                q: "É seguro?",
                a: "Pagamento processado com criptografia TLS e via PIX regulado pelo Bacen.",
              },
            ].map((f) => (
              <div key={f.q} className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-[13.5px] font-semibold tracking-tight">{f.q}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-[11.5px] text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Lovable Ilimitado. Todos os direitos reservados.</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Ambiente seguro
            </span>
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-primary" /> SSL 256-bit
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
