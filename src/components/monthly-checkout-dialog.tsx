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
import { Loader2, Copy, Check, QrCode, Clock, ShieldCheck, KeyRound, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { createVexoPayPixCharge, checkVexoPayPixStatus } from "@/lib/vexopay.functions";
import { supabase as ext } from "@/lib/supabase";
import { generateLicenseKey } from "@/lib/license-key";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userEmail: string;
  userName?: string | null;
  onCompleted?: () => void;
};

const AMOUNT_CENTS = 6990;
const PLAN_NAME = "Licença Mensal Hyro";

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
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

export function MonthlyCheckoutDialog({ open, onOpenChange, userId, userEmail, userName, onCompleted }: Props) {
  const initialParts = (userName ?? "").trim().split(/\s+/);
  const [step, setStep] = useState<"form" | "pix" | "paid">("form");
  const [firstName, setFirstName] = useState(initialParts[0] ?? "");
  const [lastName, setLastName] = useState(initialParts.slice(1).join(" "));
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
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [bonus, setBonus] = useState<{ granted: boolean; key?: string } | null>(null);
  const settledRef = useRef(false);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const createFn = useServerFn(createVexoPayPixCharge);
  const statusFn = useServerFn(checkVexoPayPixStatus);

  const reset = () => {
    setStep("form");
    setCpf("");
    setPix(null); setCopied(false); setSecondsLeft(300); setExpired(false); setChecking(false);
    setLicenseKey(null); setBonus(null);
    settledRef.current = false;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };
  useEffect(() => { if (!open) reset(); /* eslint-disable-next-line */ }, [open]);

  const settle = async () => {
    if (settledRef.current || !pix) return;
    settledRef.current = true;
    try {
      // 1) Cria licença mensal 30 dias para o comprador
      const key = generateLicenseKey();
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const { error: licErr } = await ext.from("hyro_extension_licenses").insert({
        id: key,
        user_id: userId,
        status: "ativa",
        expires_at: expiresAt.toISOString(),
        created_by: null,
        reseller_id: null,
      });
      if (licErr) throw licErr;
      setLicenseKey(key);

      // 2) Atualiza referral (se houver) — via RPC hyro_award_referral
      try {
        const { data: awardData } = await (ext as any).rpc("hyro_award_referral", {
          p_order_id: pix.id,
          p_referred_user_id: userId,
          p_amount_cents: AMOUNT_CENTS,
          p_license_id: key,
        });
        // esperado: { lifetime_granted: boolean, lifetime_key?: string }
        const info = awardData as any;
        if (info?.lifetime_granted) {
          setBonus({ granted: true, key: info.lifetime_key });
        }
      } catch { /* silent — award é auxiliar */ }

      toast.success("Licença ativada!", { description: `Chave: ${key}` });
      onCompleted?.();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ativar sua licença. Contate o suporte.");
    }
  };

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
          void settle();
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
          planId: "mensal-6990",
          planName: PLAN_NAME,
          amountCents: AMOUNT_CENTS,
          customerName: `${firstName.trim()} ${lastName.trim()}`.slice(0, 120),
          customerDocument: cpf.replace(/\D+/g, ""),
          customerEmail: userEmail || undefined,
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
      setSecondsLeft(300); setExpired(false); setStep("pix");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível gerar o PIX.");
    } finally { setSubmitting(false); }
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
        void settle();
      } else {
        toast.info("Pagamento ainda não identificado. Aguarde a confirmação.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar status.");
    } finally { setChecking(false); }
  };

  const qrSrc = pix?.qrCodeBase64
    ? (pix.qrCodeBase64.startsWith("data:") ? pix.qrCodeBase64 : `data:image/png;base64,${pix.qrCodeBase64}`)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-br from-card via-card to-secondary/40">
          <DialogHeader className="space-y-1.5">
            <div className="inline-flex items-center gap-2 self-start px-2 py-0.5 rounded-full border border-border bg-background/80 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
              <KeyRound className="h-3 w-3" /> {PLAN_NAME}
            </div>
            <DialogTitle className="text-[18px] font-semibold tracking-tight">
              {step === "form" && "Adquirir licença mensal"}
              {step === "pix" && "Pague com PIX"}
              {step === "paid" && "Licença ativada"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {step === "form" && <>Total: <span className="font-semibold text-foreground">{fmtBRL(AMOUNT_CENTS)}</span> — 30 dias de acesso completo.</>}
              {step === "pix" && <>Escaneie o QR Code ou use o copia e cola. Expira em <span className="font-mono tabular-nums text-foreground">{mm}:{ss}</span>.</>}
              {step === "paid" && <>Sua licença foi liberada automaticamente.</>}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === "form" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mfn" className="text-[11.5px]">Nome</Label>
                  <Input id="mfn" autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="João" maxLength={60} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mln" className="text-[11.5px]">Sobrenome</Label>
                  <Input id="mln" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Silva" maxLength={60} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mcpf" className="text-[11.5px]">CPF</Label>
                <Input id="mcpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                {cpf.length >= 14 && !isValidCPF(cpf) && <p className="text-[11px] text-destructive">CPF inválido</p>}
              </div>
              <div className="flex items-start gap-2 text-[11.5px] text-muted-foreground rounded-md border border-border bg-muted/30 p-2.5">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Pagamento seguro via PIX. Sua licença é liberada automaticamente após a confirmação.</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
                <Button onClick={submit} disabled={!canSubmit || submitting} className="min-w-[130px]">
                  {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Gerando...</> : <>Gerar PIX</>}
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
                    <div className={`h-full transition-all ${expired ? "bg-destructive" : secondsLeft < 60 ? "bg-warning" : "bg-foreground"}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="w-full space-y-1.5">
                  <Label className={`text-[11.5px] ${expired ? "text-muted-foreground/60" : ""}`}>PIX copia e cola</Label>
                  <div className={`flex items-stretch gap-2 transition-opacity ${expired ? "opacity-40 pointer-events-none select-none" : ""}`}>
                    <div className="flex-1 rounded-md border border-border bg-muted/40 px-2.5 py-2 font-mono text-[11px] break-all max-h-[72px] overflow-auto">
                      {expired ? "—" : (pix.qrCodeText || "—")}
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
                  {expired && <Button variant="outline" onClick={() => setStep("form")}>Gerar novo PIX</Button>}
                  <Button onClick={checkNow} disabled={checking || expired}>
                    {checking ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Verificando...</> : "Já paguei"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "paid" && (
            <div className="flex flex-col items-center text-center py-4 gap-3 animate-in fade-in-0 zoom-in-95 duration-500">
              <div className="h-14 w-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <div className="text-[15px] font-semibold tracking-tight">Recebemos seu pagamento</div>
              {licenseKey ? (
                <>
                  <p className="text-[12.5px] text-muted-foreground max-w-[340px]">
                    Sua licença mensal está ativa por 30 dias. Chave:
                  </p>
                  <div className="font-mono text-[12.5px] font-semibold border border-border rounded-md px-3 py-1.5 bg-muted/50">{licenseKey}</div>
                </>
              ) : (
                <p className="text-[12.5px] text-muted-foreground max-w-[340px] inline-flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Ativando sua licença…
                </p>
              )}
              {bonus?.granted && (
                <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-left w-full">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-warning">
                    <Sparkles className="h-4 w-4" /> Bônus vitalício desbloqueado!
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    Você atingiu 3 indicações pagas. Uma licença vitalícia foi adicionada automaticamente à sua conta.
                  </p>
                  {bonus.key && (
                    <div className="mt-2 font-mono text-[11.5px] font-semibold border border-border rounded-md px-2.5 py-1 bg-background inline-block">{bonus.key}</div>
                  )}
                </div>
              )}
              <Button className="mt-2" onClick={() => onOpenChange(false)}>Concluir</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
