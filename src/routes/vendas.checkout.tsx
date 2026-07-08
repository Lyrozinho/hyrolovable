import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  Infinity as InfinityIcon,
  Sparkles,
  Check,
  Copy,
  Clock,
  QrCode,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ArrowLeft,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createVexoPayPixCharge, checkVexoPayPixStatus } from "@/lib/vexopay.functions";

type PlanId = "semanal" | "mensal";

const PLANS: Record<PlanId, {
  id: PlanId;
  name: string;
  short: string;
  period: string;
  priceCents: number;
  includesResale: boolean;
  perks: string[];
}> = {
  semanal: {
    id: "semanal",
    name: "Plano 7 Dias",
    short: "7 dias à vista",
    period: "7 dias",
    priceCents: 5900,
    includesResale: false,
    perks: [
      "Extensão Lovable ilimitada",
      "Sem limite de créditos",
      "Ativação instantânea",
    ],
  },
  mensal: {
    id: "mensal",
    name: "Plano Mensal + Revenda",
    short: "30 dias à vista",
    period: "30 dias",
    priceCents: 8900,
    includesResale: true,
    perks: [
      "Extensão Lovable ilimitada",
      "Sem limite de créditos",
      "Painel de Revenda incluso",
      "Chaves ilimitadas para revender",
      "Suporte prioritário 24/7",
    ],
  },
};

export const Route = createFileRoute("/vendas/checkout")({
  validateSearch: (search: Record<string, unknown>): { plan: PlanId } => {
    const p = search?.plan;
    return { plan: p === "semanal" ? "semanal" : "mensal" };
  },
  head: () => ({
    meta: [
      { title: "Checkout — Lovable Ilimitada" },
      { name: "description", content: "Finalize sua compra da Lovable Ilimitada com segurança via PIX." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});

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
function maskPhone(v: string) {
  const d = v.replace(/\D+/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => {
      let out = "";
      if (a) out += `(${a}`;
      if (a && a.length === 2) out += ") ";
      if (b) out += b;
      if (c) out += `-${c}`;
      return out;
    });
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}

function CheckoutPage() {
  const search = Route.useSearch() as { plan: PlanId };
  const planId: PlanId = search.plan;
  const plan = PLANS[planId];
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"pix" | "card">("pix");

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

  const totalCents = plan.priceCents;
  const feeCents = 99;
  const grandTotalCents = totalCents + feeCents;

  const createFn = useServerFn(createVexoPayPixCharge);
  const statusFn = useServerFn(checkVexoPayPixStatus);

  const canSubmit =
    method === "pix" &&
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    isValidEmail(email) &&
    isValidCPF(cpf) &&
    !submitting;

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
      const res = await createFn({
        data: {
          planId: plan.id,
          planName: plan.name,
          amountCents: grandTotalCents,
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
        document.getElementById("payment")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <div className="dark min-h-screen bg-background text-foreground antialiased">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            to="/vendas"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/60">
              <InfinityIcon className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-[13.5px] font-semibold tracking-tight">Lovable Ilimitada</span>
          </div>
          <span className="hidden items-center gap-1.5 text-[11.5px] text-muted-foreground sm:inline-flex">
            <Lock className="h-3.5 w-3.5 text-primary" /> Ambiente seguro
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT — form + payment + summary */}
          <div className="space-y-5">
            {/* Customer data */}
            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-full border border-border bg-background/60 text-[11px] font-semibold">
                  1
                </div>
                <h2 className="text-[14px] font-semibold tracking-tight">Seus dados</h2>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
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
                  <Label htmlFor="em" className="text-[11.5px]">Email</Label>
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
                <div className="grid gap-3 sm:grid-cols-2">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="ph" className="text-[11.5px]">Celular (opcional)</Label>
                    <Input
                      id="ph"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      maxLength={16}
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11.5px] text-primary/90 hover:text-primary transition-colors"
                >
                  <HelpCircle className="h-3 w-3" /> Por que pedimos esses dados?
                </button>
              </div>
            </section>

            {/* Payment */}
            <section id="payment" className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-full border border-border bg-background/60 text-[11px] font-semibold">
                  2
                </div>
                <h2 className="text-[14px] font-semibold tracking-tight">Pagamento</h2>
              </div>

              {step === "form" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => toast.info("Em breve — por enquanto apenas PIX.")}
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border p-4 transition-all ${
                        method === "card"
                          ? "border-primary/60 bg-primary/[0.05]"
                          : "border-border bg-background/40 hover:border-border/80"
                      }`}
                      aria-disabled
                    >
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[12.5px] font-medium">Cartão de Crédito</span>
                      <span className="absolute right-2 top-2 rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                        Em breve
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("pix")}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-4 transition-all ${
                        method === "pix"
                          ? "border-primary bg-primary/[0.08] shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                          : "border-border bg-background/40 hover:border-border/80"
                      }`}
                    >
                      <QrCode className="h-5 w-5 text-primary" />
                      <span className="text-[12.5px] font-medium">PIX</span>
                    </button>
                  </div>

                  <div className="mt-3 rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] p-3 text-[12px]">
                    <div className="flex items-center gap-2 text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>Liberação imediata</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>É simples, só usar o aplicativo do seu banco para pagar Pix</span>
                    </div>
                  </div>
                </>
              )}

              {step === "pix" && pix && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex w-full items-center justify-between text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Expira em
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-foreground">
                      {mm}:{ss}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        expired ? "bg-destructive" : secondsLeft < 60 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="relative rounded-xl border border-border bg-white p-3">
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

                  <div className="w-full space-y-1.5">
                    <Label className={`text-[11.5px] ${expired ? "text-muted-foreground/60" : ""}`}>
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

                  <div className="w-full">
                    {expired ? (
                      <Button
                        variant="outline"
                        onClick={() => { setStep("form"); setPix(null); }}
                        className="w-full"
                      >
                        Gerar novo PIX
                      </Button>
                    ) : (
                      <Button onClick={checkNow} disabled={checking} className="w-full">
                        {checking ? (
                          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Verificando...</>
                        ) : (
                          "Já paguei"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {step === "paid" && (
                <div className="flex flex-col items-center gap-3 py-6 text-center animate-in fade-in-0 zoom-in-95 duration-500">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <div className="text-[16px] font-semibold tracking-tight">
                    Pagamento confirmado
                  </div>
                  <p className="max-w-[360px] text-[12.5px] leading-relaxed text-muted-foreground">
                    Enviamos as instruções de ativação para{" "}
                    <span className="font-medium text-foreground">{email}</span>.
                  </p>
                  <button
                    onClick={() => navigate({ to: "/vendas" })}
                    className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </section>

            {/* Summary */}
            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-full border border-border bg-background/60 text-[11px] font-semibold">
                  3
                </div>
                <h2 className="text-[14px] font-semibold tracking-tight">Resumo do pedido</h2>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center gap-3 border-b border-border bg-background/40 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
                    <InfinityIcon className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{plan.name}</div>
                    <div className="text-[11px] text-muted-foreground">{plan.short}</div>
                  </div>
                  <div className="font-mono text-[13px] font-semibold tabular-nums">
                    {fmtBRL(plan.priceCents)}
                  </div>
                </div>
                <div className="flex items-center justify-between border-b border-border p-3 text-[12.5px]">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    Taxa de serviço
                    <HelpCircle className="h-3 w-3" />
                  </span>
                  <span className="font-mono tabular-nums">{fmtBRL(feeCents)}</span>
                </div>
                <div className="flex items-center justify-between bg-primary/[0.04] p-3">
                  <span className="text-[13px] font-semibold">Total</span>
                  <span className="font-mono text-[15px] font-semibold tabular-nums">
                    {fmtBRL(grandTotalCents)}
                  </span>
                </div>
              </div>

              {step === "form" && (
                <>
                  <Button
                    className="mt-4 h-12 w-full text-[14px]"
                    disabled={!canSubmit}
                    onClick={submit}
                  >
                    {submitting ? (
                      <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Gerando PIX...</>
                    ) : (
                      <><Lock className="mr-1.5 h-4 w-4" /> Pagar com PIX</>
                    )}
                  </Button>

                  <p className="mt-3 text-center text-[10.5px] text-muted-foreground">
                    Ao continuar, você concorda com os{" "}
                    <a href="#" className="underline hover:text-foreground">Termos de Compra</a>.
                  </p>
                </>
              )}
            </section>
          </div>

          {/* RIGHT — trust card */}
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
              <div className="bg-emerald-600 px-4 py-2.5 text-center text-[12.5px] font-semibold text-white">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Compra segura
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
                    <InfinityIcon className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{plan.name}</div>
                    <a href="#" className="text-[11.5px] text-primary hover:underline">
                      Precisa de ajuda?
                    </a>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Total
                  </div>
                  <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                    {fmtBRL(grandTotalCents)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{plan.short}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                O que está incluso
              </div>
              <ul className="mt-3 space-y-2 text-[12.5px]">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-foreground/90">{perk}</span>
                  </li>
                ))}
              </ul>
              {plan.includesResale && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 text-[11.5px]">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Painel de Revenda liberado automaticamente.</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary" /> SSL 256-bit
              </span>
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3 text-primary" /> AES-256
              </span>
              <span className="inline-flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-primary" /> PIX Bacen
              </span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
