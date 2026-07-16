import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Gift, PartyPopper, Copy, Check, CalendarClock } from "lucide-react";

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

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const DEFAULT_BONUS = 5;

export function BonusLicenseDialog({
  license,
  onClose,
  onBonused,
}: {
  license: LicenseLike | null;
  onClose: () => void;
  onBonused: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<string>(String(DEFAULT_BONUS));
  const [result, setResult] = useState<{ days: number; newExpires: Date } | null>(null);
  const [copied, setCopied] = useState(false);

  const open = !!license;
  const lifetime = license ? isLifetime(license.expires_at) : false;
  const currentExpires = license ? new Date(license.expires_at) : null;
  const now = new Date();
  const isExpired = currentExpires ? currentExpires < now : false;

  const bonusDays = Math.max(0, parseInt(days || "0", 10) || 0);

  const previewNewExpires = useMemo(() => {
    if (!license) return null;
    const base = isExpired ? now : currentExpires!;
    return new Date(base.getTime() + bonusDays * 86400000);
  }, [license, bonusDays, isExpired]);

  const message = useMemo(() => {
    if (!license || !result) return "";
    const lines = [
      "🎁 Sua licença ganhou dias de bônus!",
      "",
      `🔑 Chave: ${license.id}`,
      `📅 Nova validade: ${fmtDate(result.newExpires)}`,
      `✨ Bônus: +${result.days} dias`,
      "",
      "Aproveite! Qualquer dúvida, estamos à disposição.",
    ];
    return lines.join("\n");
  }, [license, result]);

  const doBonus = async () => {
    if (!license || lifetime || bonusDays <= 0) return;
    setLoading(true);
    try {
      const newExpires = previewNewExpires!;
      const { error } = await supabase
        .from("hyro_extension_licenses")
        .update({ expires_at: newExpires.toISOString(), status: "ativa" })
        .eq("id", license.id);
      if (error) throw error;
      setResult({ days: bonusDays, newExpires });
      onBonused();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao bonificar");
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
      setDays(String(DEFAULT_BONUS));
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
                  <Gift className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-[15px] font-semibold tracking-tight">Bonificar licença</DialogTitle>
                  <DialogDescription className="text-[12.5px] mt-0.5">
                    Adiciona dias de cortesia à validade atual, sem renovar o plano.
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
                    {previewNewExpires && bonusDays > 0 ? fmtDate(previewNewExpires) : "—"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Dias de bônus
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    disabled={lifetime}
                    className="h-9 text-[13px] w-28"
                  />
                  <div className="flex gap-1">
                    {[3, 5, 7, 15, 30].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDays(String(n))}
                        disabled={lifetime}
                        className={[
                          "h-9 px-2.5 rounded-md border text-[12px] transition-colors",
                          bonusDays === n
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground/40 hover:bg-muted/40",
                          lifetime ? "opacity-50 pointer-events-none" : "",
                        ].join(" ")}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {lifetime && (
                <p className="text-[12px] text-muted-foreground">
                  Licença vitalícia não precisa de bonificação.
                </p>
              )}
            </div>

            <DialogFooter className="px-6 pb-6 gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button onClick={doBonus} disabled={loading || lifetime || bonusDays <= 0}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Bonificar +{bonusDays} dias
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
                    Bonificação aplicada com sucesso
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
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Bônus</div>
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
