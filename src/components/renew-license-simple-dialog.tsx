import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, RefreshCw, PartyPopper, Copy, Check, CalendarClock } from "lucide-react";

type LicenseLike = {
  id: string;
  status: string;
  expires_at: string;
  created_at: string;
  user_email?: string | null;
};

function isLifetime(iso: string) {
  return new Date(iso).getUTCFullYear() >= 2090;
}

function daysBetween(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function RenewLicenseSimpleDialog({
  license,
  onClose,
  onRenewed,
}: {
  license: LicenseLike | null;
  onClose: () => void;
  onRenewed: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ days: number; newExpires: Date } | null>(null);
  const [copied, setCopied] = useState(false);

  const open = !!license;
  const lifetime = license ? isLifetime(license.expires_at) : false;

  const planDays = useMemo(() => {
    if (!license) return 0;
    return daysBetween(new Date(license.expires_at), new Date(license.created_at));
  }, [license]);

  const currentExpires = license ? new Date(license.expires_at) : null;
  const now = new Date();
  const isExpired = currentExpires ? currentExpires < now : false;

  const previewNewExpires = useMemo(() => {
    if (!license) return null;
    const base = isExpired ? now : currentExpires!;
    return new Date(base.getTime() + planDays * 86400000);
  }, [license, planDays, isExpired]);

  const message = useMemo(() => {
    if (!license || !result) return "";
    return [
      "✅ Sua licença foi renovada com sucesso!",
      "",
      `🔑 Chave: ${license.id}`,
      `📅 Nova validade: ${fmtDate(result.newExpires)}`,
      `⏳ Renovação: +${result.days} dias`,
      "",
      "Qualquer dúvida, estamos à disposição.",
    ].join("\n");
  }, [license, result]);

  const doRenew = async () => {
    if (!license || lifetime) return;
    setLoading(true);
    try {
      const newExpires = previewNewExpires!;
      const { error } = await supabase
        .from("hyro_extension_licenses")
        .update({ expires_at: newExpires.toISOString(), status: "ativa" })
        .eq("id", license.id);
      if (error) throw error;
      setResult({ days: planDays, newExpires });
      onRenewed();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao renovar");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setResult(null);
      setCopied(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {!result ? (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-[15px] font-semibold tracking-tight">Renovar licença</DialogTitle>
                  <DialogDescription className="text-[12.5px] mt-0.5">
                    Estende a validade pelo mesmo período do plano original.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Chave</span>
                  <span className="font-mono">{license?.id}</span>
                </div>
                {license?.user_email && (
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-muted-foreground">Cliente</span>
                    <span>{license.user_email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-medium">{planDays} dias</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Expira atualmente</span>
                  <span className={isExpired ? "text-destructive" : ""}>
                    {currentExpires ? fmtDate(currentExpires) : "—"}
                    {isExpired && " (expirada)"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12.5px] pt-2 border-t border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" /> Nova validade
                  </span>
                  <span className="font-semibold text-foreground">
                    {previewNewExpires ? fmtDate(previewNewExpires) : "—"}
                  </span>
                </div>
              </div>

              {lifetime && (
                <p className="text-[12px] text-muted-foreground">
                  Licença vitalícia não precisa ser renovada.
                </p>
              )}
            </div>

            <DialogFooter className="px-6 pb-6 gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button onClick={doRenew} disabled={loading || lifetime}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Renovar +{planDays} dias
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-success/15 text-success flex items-center justify-center shrink-0">
                  <PartyPopper className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-[15px] font-semibold tracking-tight">
                    Licença renovada com sucesso
                  </DialogTitle>
                  <DialogDescription className="text-[12.5px] mt-0.5">
                    Copie a mensagem abaixo e envie ao cliente.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-3 grid grid-cols-2 gap-3 text-[12.5px]">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Nova validade</div>
                  <div className="font-semibold mt-0.5">{fmtDate(result.newExpires)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Renovação</div>
                  <div className="font-semibold mt-0.5">+{result.days} dias</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Mensagem para o cliente
                </div>
                <Textarea
                  readOnly
                  value={message}
                  className="min-h-[160px] font-mono text-[12px] leading-relaxed resize-none"
                />
              </div>
            </div>

            <DialogFooter className="px-6 pb-6 gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? "Copiado" : "Copiar mensagem"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
