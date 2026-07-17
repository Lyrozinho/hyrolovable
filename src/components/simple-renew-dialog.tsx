import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, CalendarClock, Check, Zap } from "lucide-react";

type LicenseLike = {
  id: string;
  expires_at: string;
};

const OPTIONS: Array<{ days: number; price: number; label: string; tag: string; featured?: boolean }> = [
  { days: 7, price: 59, label: "7 dias", tag: "Rápido" },
  { days: 30, price: 89, label: "30 dias", tag: "Melhor valor", featured: true },
];

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function SimpleRenewDialog({
  license,
  onClose,
  onRenewed,
}: {
  license: LicenseLike | null;
  onClose: () => void;
  onRenewed: () => void;
}) {
  const [selected, setSelected] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const open = !!license;

  const now = new Date();
  const current = license ? new Date(license.expires_at) : null;
  const isExpired = current ? current < now : false;

  const preview = useMemo(() => {
    if (!license) return null;
    const base = isExpired ? now : current!;
    return new Date(base.getTime() + selected * 86400000);
  }, [license, selected, isExpired]);

  const opt = OPTIONS.find((o) => o.days === selected)!;

  const doRenew = async () => {
    if (!license || !preview) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("hyro_extension_licenses")
        .update({ expires_at: preview.toISOString(), status: "ativa" })
        .eq("id", license.id);
      if (error) throw error;
      toast.success(`Licença renovada por +${selected} dias`);
      onRenewed();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao renovar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">Renovar licença</DialogTitle>
          <DialogDescription className="text-[12px]">
            <span className="font-mono">{license?.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            {OPTIONS.map((o) => {
              const active = selected === o.days;
              return (
                <button
                  key={o.days}
                  onClick={() => setSelected(o.days)}
                  className={[
                    "relative rounded-xl border p-4 text-left transition-all",
                    active
                      ? "border-foreground bg-foreground/5 shadow-sm"
                      : "border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  {o.featured && (
                    <span className="absolute -top-2 right-3 px-1.5 py-0.5 rounded-full bg-foreground text-background text-[9px] font-bold uppercase tracking-wider">
                      {o.tag}
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {o.label}
                    </span>
                    {active && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[11px] text-muted-foreground">R$</span>
                    <span className="text-[24px] font-semibold tabular-nums leading-none">{o.price}</span>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-1.5 font-mono">
                    R$ {(o.price / o.days).toFixed(2)}/dia
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Validade atual</span>
              <span className={isExpired ? "text-destructive" : ""}>
                {current ? fmtDate(current) : "—"}
                {isExpired && " (expirada)"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px] pt-1.5 border-t border-border">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Nova validade
              </span>
              <span className="font-semibold">{preview ? fmtDate(preview) : "—"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={doRenew} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Zap className="h-3.5 w-3.5 mr-1.5" />
              )}
              Renovar por R$ {opt.price}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
