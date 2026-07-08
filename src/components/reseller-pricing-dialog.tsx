import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveResellerPricing, getResellerPricing } from "@/lib/mp.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resellerUserId: string;
};

export function ResellerPricingDialog({ open, onOpenChange, resellerUserId }: Props) {
  const qc = useQueryClient();
  const getPricing = useServerFn(getResellerPricing);
  const savePricing = useServerFn(saveResellerPricing);

  const q = useQuery({
    queryKey: ["reseller-pricing", resellerUserId, open],
    enabled: open && !!resellerUserId,
    queryFn: () => getPricing({ data: { resellerUserId } }),
    staleTime: 0,
  });

  const [priceReais, setPriceReais] = useState("59,00");
  const [renewalDays, setRenewalDays] = useState(30);
  const [active, setActive] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open) { setHydrated(false); return; }
    if (q.isFetching || hydrated) return;
    const d = q.data;
    setPriceReais(((d?.priceCents ?? 5900) / 100).toFixed(2).replace(".", ","));
    setRenewalDays(d?.renewalDays ?? 30);
    setActive(d?.active ?? true);
    setHydrated(true);
  }, [open, q.data, q.isFetching, hydrated]);

  const mut = useMutation({
    mutationFn: () => {
      const cents = Math.round(parseFloat(priceReais.replace(",", ".")) * 100);
      return savePricing({ data: { resellerUserId, priceCents: cents, renewalDays, active } });
    },
    onSuccess: () => {
      toast.success("Preço salvo");
      qc.invalidateQueries({ queryKey: ["reseller-pricing"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Preço de renovação
          </DialogTitle>
          <DialogDescription>
            Este valor será mostrado aos seus clientes na renovação.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading && !hydrated ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={priceReais}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d,\.]/g, "").replace(".", ",");
                  setPriceReais(raw);
                }}
                placeholder="59,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Duração da renovação (dias)</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={renewalDays}
                onChange={(e) => setRenewalDays(Math.max(1, Math.min(3650, parseInt(e.target.value || "0", 10) || 0)))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <div className="text-[12.5px] font-medium">Disponível para clientes</div>
                <div className="text-[11px] text-muted-foreground">Desligue para ocultar o botão de renovar</div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
                {mut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Salvando…</> : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
