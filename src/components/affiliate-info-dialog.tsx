import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Copy, Check, Link2, Trophy, Share2, Gift, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getPublicOrigin } from "@/lib/public-origin";

type Referral = { id: string; referred_email: string | null; status: string };

export function AffiliateInfoDialog({
  open,
  onOpenChange,
  affiliateCode,
  referrals,
  lifetimeGranted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  affiliateCode: string | null;
  referrals: Referral[];
  lifetimeGranted: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const origin = getPublicOrigin();
  const link = affiliateCode ? `${origin}/a/${affiliateCode}` : "";

  const paid = referrals.filter((r) => (r.status || "").toLowerCase() === "paid").length;
  const goal = 3;
  const progress = Math.min(100, (paid / goal) * 100);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const steps = [
    { icon: Share2, title: "Compartilhe seu link", desc: "Envie para amigos por WhatsApp, Instagram, grupos e redes sociais." },
    { icon: Users, title: "Eles compram usando seu link", desc: "Cada pessoa que assinar via seu link conta como uma indicação paga." },
    { icon: Gift, title: "Ganhe uma licença vitalícia", desc: "Ao completar 3 indicações pagas, sua conta vira vitalícia automaticamente." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/15 via-card to-card px-6 pt-6 pb-5 border-b border-border">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-primary/30 bg-background/60 text-[10px] uppercase tracking-[0.16em] text-primary font-semibold mb-3">
            <Trophy className="h-3 w-3" /> Programa de indicações
          </div>
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-[18px] font-semibold tracking-tight">
              Indique 3 amigos, ganhe vitalícia
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-relaxed">
              Compartilhe seu link único. A cada assinatura confirmada, você avança rumo ao seu bônus vitalício.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Como funciona */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
              Como funciona
            </div>
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

          {/* Progresso */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Seu progresso
              </span>
              <span className="text-[13px] font-semibold tabular-nums">
                {paid}<span className="text-muted-foreground">/{goal}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${lifetimeGranted || paid >= goal ? "bg-success" : "bg-primary"}`}
                style={{ width: `${lifetimeGranted ? 100 : progress}%` }}
              />
            </div>
            {lifetimeGranted && (
              <div className="mt-2 text-[11.5px] text-success font-medium flex items-center gap-1">
                <Check className="h-3 w-3" /> Bônus vitalício desbloqueado
              </div>
            )}
          </div>

          {/* Link */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-1.5">
              Seu link de indicação
            </div>
            <div className="flex gap-2">
              <div className="flex-1 rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[11.5px] truncate flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{link || "Gerando…"}</span>
              </div>
              <Button variant="default" onClick={copy} disabled={!link}>
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Entendi <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
