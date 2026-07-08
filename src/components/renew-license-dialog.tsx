import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, QrCode, Copy, CheckCircle2, Clock, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRenewalOfferForLicense, createRenewalOrder, checkOrderStatus } from "@/lib/mp.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  licenseId: string;
  clientUserId: string;
  clientName?: string | null;
  clientEmail?: string | null;
  onRenewed?: () => void;
};

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function maskCpf(v: string) {
  const d = v.replace(/\D+/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function RenewLicenseDialog({ open, onOpenChange, licenseId, clientUserId, clientName, clientEmail, onRenewed }: Props) {
  const [step, setStep] = useState<"form" | "pix" | "paid" | "expired">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [order, setOrder] = useState<Awaited<ReturnType<typeof createRenewalOrderFn>> | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const settledRef = useRef(false);

  const getOffer = useServerFn(getRenewalOfferForLicense);
  const createRenewalOrderFn = useServerFn(createRenewalOrder);
  const checkStatus = useServerFn(checkOrderStatus);

  const offerQ = useQuery({
    queryKey: ["renewal-offer", licenseId, clientUserId, open],
    enabled: open && !!licenseId && !!clientUserId,
    queryFn: () => getOffer({ data: { licenseId, clientUserId } }),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) {
      const [f, ...rest] = String(clientName ?? "").trim().split(/\s+/);
      setFirstName(f ?? "");
      setLastName(rest.join(" "));
      setEmail(clientEmail ?? "");
      setCpf("");
      setOrder(null);
      setStep("form");
      settledRef.current = false;
    }
  }, [open, clientName, clientEmail]);

  const createMut = useMutation({
    mutationFn: () =>
      createRenewalOrderFn({
        data: {
          licenseId,
          clientUserId,
          payerName: firstName.trim(),
          payerLastName: lastName.trim(),
          payerEmail: email.trim().toLowerCase(),
          payerCpf: cpf.replace(/\D+/g, ""),
        },
      }),
    onSuccess: (r) => {
      setOrder(r);
      setStep("pix");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar PIX"),
  });

  // Countdown + polling
  useEffect(() => {
    if (step !== "pix" || !order) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    const p = setInterval(async () => {
      try {
        const r = await checkStatus({ data: { orderId: order.orderId, clientUserId } });
        if (r.status === "approved" && !settledRef.current) {
          settledRef.current = true;
          setStep("paid");
          onRenewed?.();
        } else if (["rejected", "cancelled", "refunded", "expired"].includes(r.status)) {
          setStep("expired");
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => { clearInterval(t); clearInterval(p); };
  }, [step, order, checkStatus, clientUserId, onRenewed]);

  const remainingMs = useMemo(() => {
    if (!order?.expiresAt) return 0;
    return Math.max(0, new Date(order.expiresAt).getTime() - nowTick);
  }, [order?.expiresAt, nowTick]);

  useEffect(() => {
    if (step === "pix" && remainingMs === 0 && order) setStep("expired");
  }, [remainingMs, step, order]);

  const mm = Math.floor(remainingMs / 60_000).toString().padStart(2, "0");
  const ss = Math.floor((remainingMs % 60_000) / 1000).toString().padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 text-[16px]">
            <ShieldCheck className="h-4 w-4 text-primary" /> Renovar licença
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Licença <span className="font-mono">{licenseId}</span>
          </DialogDescription>
        </DialogHeader>

        {offerQ.isLoading ? (
          <div className="px-6 py-12 flex items-center justify-center text-muted-foreground text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando plano do revendedor…
          </div>
        ) : !offerQ.data?.available ? (
          <div className="px-6 py-10 text-center space-y-2">
            <XCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-[13.5px] font-medium">Renovação indisponível</p>
            <p className="text-[12px] text-muted-foreground">
              {offerQ.data && "reason" in offerQ.data ? offerQ.data.reason : "Fale com o seu revendedor."}
            </p>
          </div>
        ) : step === "form" ? (
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Valor</div>
                <div className="text-[20px] font-semibold font-mono">{fmtMoney(offerQ.data.priceCents)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Duração</div>
                <div className="text-[14px] font-medium">+{offerQ.data.renewalDays} dias</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11.5px]">Nome</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="João" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11.5px]">Sobrenome</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Silva" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
            </div>

            <Button
              className="w-full"
              disabled={createMut.isPending || firstName.trim().length < 2 || lastName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || cpf.replace(/\D+/g, "").length !== 11}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando PIX…</> : `Pagar ${fmtMoney(offerQ.data.priceCents)}`}
            </Button>
          </div>
        ) : step === "pix" && order ? (
          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Expira em
              </div>
              <div className="font-mono font-semibold text-foreground">{mm}:{ss}</div>
            </div>

            {order.qrCodeBase64 ? (
              <div className="flex justify-center bg-white rounded-lg p-4 border border-border">
                <img src={`data:image/png;base64,${order.qrCodeBase64}`} alt="QR PIX" className="h-56 w-56 object-contain" />
              </div>
            ) : (
              <div className="flex justify-center py-8 text-muted-foreground"><QrCode className="h-16 w-16" /></div>
            )}

            <div>
              <Label className="text-[11.5px] mb-1.5 block">PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input readOnly value={order.qrCode ?? ""} className="font-mono text-[11px]" />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!order.qrCode) return;
                    try { await navigator.clipboard.writeText(order.qrCode); toast.success("Código copiado"); }
                    catch { toast.error("Falha ao copiar"); }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Aguardando confirmação do Mercado Pago…
            </p>
          </div>
        ) : step === "paid" ? (
          <div className="px-6 py-10 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div>
              <p className="text-[15px] font-semibold">Pagamento aprovado</p>
              <p className="text-[12.5px] text-muted-foreground mt-1">
                Sua licença foi renovada por +{offerQ.data.renewalDays} dias.
              </p>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <div className="px-6 py-10 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <p className="text-[14px] font-semibold">PIX expirado</p>
            <p className="text-[12px] text-muted-foreground">Gere um novo código para renovar.</p>
            <Button variant="secondary" onClick={() => setStep("form")}>Gerar novo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
