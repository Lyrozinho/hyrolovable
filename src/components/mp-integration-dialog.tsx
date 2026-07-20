import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle, Copy, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveMpIntegration, testMpIntegration, deleteMpIntegration, getMpIntegrationStatus } from "@/lib/mp.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
};

export function MpIntegrationDialog({ open, onOpenChange, userId }: Props) {
  const qc = useQueryClient();
  const getStatus = useServerFn(getMpIntegrationStatus);
  const saveFn = useServerFn(saveMpIntegration);
  const testFn = useServerFn(testMpIntegration);
  const delFn = useServerFn(deleteMpIntegration);

  const statusQ = useQuery({
    queryKey: ["mp-status", userId, open],
    enabled: open && !!userId,
    queryFn: () => getStatus({ data: { userId } }),
    staleTime: 0,
  });

  const [mode, setMode] = useState<"sandbox" | "live">("live");
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (open) {
      const s = statusQ.data;
      setMode(s?.mode ?? "live");
      setActive(s?.active ?? true);
      // never prefill secrets
      setAccessToken("");
      setPublicKey(s?.publicKey ?? "");
      setWebhookSecret("");
    }
  }, [open, statusQ.data]);

  const webhookUrl = `${getPublicOrigin()}/api/public/mercadopago/webhook?r=${encodeURIComponent(userId)}`;

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { userId, mode, accessToken, publicKey, webhookSecret, active } }),
    onSuccess: (r) => {
      toast.success(`Conectado: ${r.account_info?.nickname ?? r.account_info?.email ?? "conta MP"}`);
      qc.invalidateQueries({ queryKey: ["mp-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const testMut = useMutation({
    mutationFn: () => testFn({ data: { userId } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`OK · ${r.account?.nickname ?? r.account?.email ?? r.account?.id}`);
      else toast.error(r.message ?? "Falha no teste");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no teste"),
  });

  const deleteMut = useMutation({
    mutationFn: () => delFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Integração removida");
      qc.invalidateQueries({ queryKey: ["mp-status"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Configurar Mercado Pago
          </DialogTitle>
          <DialogDescription>
            Suas credenciais ficam armazenadas com segurança e nunca são expostas no navegador.
          </DialogDescription>
        </DialogHeader>

        {statusQ.data?.configured && (
          <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 flex items-center gap-2 text-[12.5px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="font-medium">Conta conectada</span>
            <span className="text-muted-foreground">
              · {statusQ.data.accountNickname ?? statusQ.data.accountEmail ?? statusQ.data.accountId}
              · modo <span className="font-mono">{statusQ.data.mode}</span>
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <div className="text-[12.5px] font-medium">Ambiente</div>
              <div className="text-[11px] text-muted-foreground">
                Produção usa dinheiro real. Sandbox para testes.
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className={mode === "sandbox" ? "text-foreground font-medium" : "text-muted-foreground"}>Sandbox</span>
              <Switch checked={mode === "live"} onCheckedChange={(v) => setMode(v ? "live" : "sandbox")} />
              <span className={mode === "live" ? "text-foreground font-medium" : "text-muted-foreground"}>Produção</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px]">Access Token</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={statusQ.data?.configured ? "•••••• (deixe em branco para manter o atual)" : "APP_USR-..."}
              className="font-mono text-[12px]"
            />
            <p className="text-[10.5px] text-muted-foreground">
              Painel MP → Suas integrações → sua aplicação → Credenciais.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px]">Public Key</Label>
            <Input
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="APP_USR-..."
              className="font-mono text-[12px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px]">Webhook Secret</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={statusQ.data?.configured ? "•••••• (mantém se em branco)" : "hmac secret"}
              className="font-mono text-[12px]"
            />
            <p className="text-[10.5px] text-muted-foreground">
              Painel MP → Notificações/Webhooks → gerar chave.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px]">URL do Webhook (cadastre esta URL no MP)</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-[11px]" />
              <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <div className="text-[12.5px] font-medium">Integração ativa</div>
              <div className="text-[11px] text-muted-foreground">Desligue para pausar sem apagar credenciais</div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          {statusQ.data?.configured && (
            <>
              <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="sm:mr-auto">
                {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Remover"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
                {testMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                Testar conexão
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              if (!accessToken || !publicKey || !webhookSecret) {
                toast.error("Preencha Access Token, Public Key e Webhook Secret");
                return;
              }
              saveMut.mutate();
            }}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Validando…</> : "Salvar"}
          </Button>
        </div>

        <a
          href="https://www.mercadopago.com.br/developers/panel/app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
        >
          Abrir painel Mercado Pago <ExternalLink className="h-3 w-3" />
        </a>
      </DialogContent>
    </Dialog>
  );
}
