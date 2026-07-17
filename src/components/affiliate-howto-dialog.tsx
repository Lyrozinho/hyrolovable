import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, Users, Wallet, TrendingUp, Percent, Info, ShieldCheck, ArrowRight } from "lucide-react";

export function AffiliateHowToDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const steps = [
    { icon: Share2, title: "Compartilhe seu link", desc: "Envie seu link único para clientes, grupos e redes. O código do afiliado é aplicado automaticamente no cadastro." },
    { icon: Users, title: "O cliente se cadastra e compra", desc: "Qualquer compra feita por quem entrou pelo seu link fica atribuída à sua revenda — sem depender de cupom." },
    { icon: Wallet, title: "Comissão creditada", desc: "A venda aparece no seu painel assim que o pagamento é confirmado, com valor bruto e sua comissão detalhada." },
  ];

  const margins = [
    { label: "Licença mensal do cliente", value: "R$ 69,90" },
    { label: "Sua comissão por venda mensal", value: "35%", hint: "≈ R$ 24,46 por indicação paga" },
    { label: "Renovações do mesmo cliente", value: "Contam", hint: "Você recebe também nas próximas mensalidades" },
    { label: "Ticket dos seus pacotes", value: "R$ 35 – R$ 40,90", hint: "Chaves compradas em Início › Pacote personalizado" },
  ];

  const rules = [
    "Atribuição automática pelo link — sem digitar cupom.",
    "Pagamento e antifraude validam a venda antes de creditar.",
    "Cancelamentos e estornos removem a comissão referente.",
    "Sem limite de indicações — a comissão é recorrente por cliente.",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden max-h-[85vh] overflow-y-auto">
        <div className="relative bg-gradient-to-br from-primary/15 via-card to-card px-6 pt-6 pb-5 border-b border-border">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-primary/30 bg-background/60 text-[10px] uppercase tracking-[0.16em] text-primary font-semibold mb-3">
            <Info className="h-3 w-3" /> Como funciona
          </div>
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-[18px] font-semibold tracking-tight">
              Programa de afiliado — Revenda
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-relaxed">
              Ganhe comissão recorrente indicando clientes finais. Sem meta, sem limite, sem burocracia.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Passos */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Fluxo</div>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center text-[11px] font-bold font-mono">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                      <s.icon className="h-3.5 w-3.5" /> {s.title}
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Margens */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Percent className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">Margens & valores</span>
            </div>
            <div className="grid gap-2.5">
              {margins.map((m, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium">{m.label}</div>
                    {m.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</div>}
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums shrink-0">{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Regras */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Regras rápidas</span>
            </div>
            <ul className="space-y-1.5">
              {rules.map((r, i) => (
                <li key={i} className="text-[12px] text-muted-foreground flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[12px] leading-relaxed">
              Dica: compartilhe o QR do painel em atendimentos — a atribuição é instantânea e você acompanha cada venda na tabela abaixo.
            </p>
          </div>

          <Button variant="default" className="w-full" onClick={() => onOpenChange(false)}>
            Entendi <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
