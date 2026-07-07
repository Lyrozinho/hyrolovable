import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Copy, Check, QrCode, Clock, ShieldCheck, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { createVexoPayPixCharge, checkVexoPayPixStatus } from "@/lib/vexopay.functions";

import { adjustResellerBalance } from "@/lib/reseller-balance";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planId: string;
  planName: string;
  amountCents: number;
  licensesCount?: number;
  resellerUserId?: string | null;
  defaultEmail?: string | null;
};


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

export function VexoPayCheckoutDialog({ open, onOpenChange, planId, planName, amountCents, defaultEmail }: Props) {
  const [step, setStep] = useState<"form" | "pix" | "paid">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cpf, setCpf] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  const createFn = useServerFn(createVexoPayPixCharge);
  const statusFn = useServerFn(checkVexoPayPixStatus);

  const reset = () => {
    setStep("form");
    setFirstName(""); setLastName(""); setCpf("");
    setPix(null); setCopied(false); setSecondsLeft(300); setExpired(false); setChecking(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  // Countdown + polling — only during "pix" step
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
  const progress = useMemo(() => Math.max(0, Math.min(100, (secondsLeft / 300) * 100)), [secondsLeft]);

  const canSubmit = firstName.trim().length >= 2 && lastName.trim().length >= 2 && isValidCPF(cpf);

  const submit = async () => {
    if (!canSubmit) { toast.error("Preencha nome, sobrenome e CPF válido."); return; }
    setSubmitting(true);
    try {
      const res = await createFn({
        data: {
          planId,
          planName,
          amountCents,
          customerName: `${firstName.trim()} ${lastName.trim()}`.slice(0, 120),
          customerDocument: cpf.replace(/\D+/g, ""),
          customerEmail: defaultEmail || undefined,
        },
      });
      if (!res?.qrCodeBase64 && !res?.qrCodeText) {
        throw new Error("Cobrança criada, mas provedor não retornou QR Code. Tente novamente em instantes.");
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
    ? (pix.qrCodeBase64.startsWith("data:") ? pix.qrCodeBase64 : `data:image/png;base64,${pix.qrCodeBase64}`)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-br from-card via-card to-secondary/40">
          <DialogHeader className="space-y-1.5">
            <div className="inline-flex items-center gap-2 self-start px-2 py-0.5 rounded-full border border-border bg-background/80 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
              <KeyRound className="h-3 w-3" /> {planName}
            </div>
            <DialogTitle className="text-[18px] font-semibold tracking-tight">
              {step === "form" && "Finalizar compra"}
              {step === "pix" && "Pague com PIX"}
              {step === "paid" && "Pagamento confirmado"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {step === "form" && <>Total a pagar: <span className="font-semibold text-foreground">{fmtBRL(amountCents)}</span></>}
              {step === "pix" && <>Escaneie o QR Code ou use o copia e cola. Expira em <span className="font-mono tabular-nums text-foreground">{mm}:{ss}</span>.</>}
              {step === "paid" && <>Recebemos seu pagamento. Nosso time libera o pacote em instantes.</>}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {step === "form" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fn" className="text-[11.5px]">Nome</Label>
                  <Input id="fn" autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="João" maxLength={60} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln" className="text-[11.5px]">Sobrenome</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Silva" maxLength={60} />
                </div>
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

              <div className="flex items-start gap-2 text-[11.5px] text-muted-foreground rounded-md border border-border bg-muted/30 p-2.5">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Seus dados são usados apenas para processar o pagamento via PIX (VexoPay). Nada é compartilhado.</span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
                <Button onClick={submit} disabled={!canSubmit || submitting} className="min-w-[130px]">
                  {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Gerando...</> : <>Confirmar</>}
                </Button>
              </div>
            </>
          )}

          {step === "pix" && pix && (
            <>
              <div className="flex flex-col items-center gap-3">
                <div className="relative rounded-xl border border-border bg-white p-3 shadow-sm">
                  {qrSrc ? (
                    <img src={qrSrc} alt="QR Code PIX" width={220} height={220} className="block rounded-md" />
                  ) : (
                    <div className="h-[220px] w-[220px] flex flex-col items-center justify-center text-muted-foreground text-[12px] gap-2">
                      <QrCode className="h-8 w-8" />
                      Use o copia e cola
                    </div>
                  )}
                  {expired && (
                    <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                      <AlertTriangle className="h-5 w-5 text-destructive mb-1" />
                      <div className="text-[12.5px] font-medium">PIX expirado</div>
                    </div>
                  )}
                </div>

                <div className="w-full">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Expira em</span>
                    <span className="font-mono tabular-nums text-foreground">{mm}:{ss}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all ${expired ? "bg-destructive" : secondsLeft < 60 ? "bg-warning" : "bg-foreground"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="w-full space-y-1.5">
                  <Label className="text-[11.5px]">PIX copia e cola</Label>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 rounded-md border border-border bg-muted/40 px-2.5 py-2 font-mono text-[11px] break-all max-h-[72px] overflow-auto">
                      {pix.qrCodeText || "—"}
                    </div>
                    <Button variant="outline" onClick={copyCode} disabled={!pix.qrCodeText || expired} className="shrink-0">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="w-full flex items-center justify-between text-[12px] text-muted-foreground border-t border-border pt-3">
                  <span>Valor</span>
                  <span className="font-semibold text-foreground font-mono tabular-nums">{fmtBRL(pix.amountCents)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
                <div className="flex items-center gap-2">
                  {expired && (
                    <Button variant="outline" onClick={() => { setStep("form"); }}>
                      Gerar novo PIX
                    </Button>
                  )}
                  <Button onClick={checkNow} disabled={checking || expired}>
                    {checking ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Verificando...</> : "Já paguei"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "paid" && (
            <div className="flex flex-col items-center text-center py-4 gap-3">
              <div className="h-14 w-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <div className="text-[14px] font-medium">Pagamento aprovado</div>
              <p className="text-[12.5px] text-muted-foreground max-w-[320px]">
                Seu pacote <span className="font-semibold text-foreground">{planName}</span> será liberado no painel em instantes.
              </p>
              <Button className="mt-2" onClick={() => onOpenChange(false)}>Concluir</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
