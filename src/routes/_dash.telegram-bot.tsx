import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Copy, Loader2, Plug, PlugZap, RefreshCw, Send, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  tgAllow,
  tgDeleteWebhook,
  tgListAllowed,
  tgRevoke,
  tgSetWebhook,
  tgWebhookInfo,
} from "@/lib/telegram-admin.functions";

const OWNER_EMAIL = "adminpainel@gmail.com";

export const Route = createFileRoute("/_dash/telegram-bot")({
  ssr: false,
  component: TelegramBotPage,
});

function TelegramBotPage() {
  const { session, authReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady) return;
    const email = session?.user.email?.toLowerCase();
    if (email !== OWNER_EMAIL) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authReady, session, navigate]);

  const qc = useQueryClient();
  const listFn = useServerFn(tgListAllowed);
  const allowFn = useServerFn(tgAllow);
  const revokeFn = useServerFn(tgRevoke);
  const infoFn = useServerFn(tgWebhookInfo);
  const setWhFn = useServerFn(tgSetWebhook);
  const delWhFn = useServerFn(tgDeleteWebhook);

  const isOwner = session?.user.email?.toLowerCase() === OWNER_EMAIL;

  const users = useQuery({
    queryKey: ["telegram-allowed"],
    queryFn: () => listFn(),
    enabled: isOwner,
  });
  const info = useQuery({
    queryKey: ["telegram-webhook"],
    queryFn: () => infoFn(),
    enabled: isOwner,
    refetchInterval: 15_000,
  });

  const [newId, setNewId] = useState("");
  const [newNote, setNewNote] = useState("");

  const suggestedUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/public/telegram/webhook`;
  }, []);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  useEffect(() => {
    const current = (info.data?.config as any)?.webhook_url as string | undefined;
    if (current) setWebhookUrl(current);
    else if (suggestedUrl) setWebhookUrl(suggestedUrl);
  }, [info.data, suggestedUrl]);

  const addUser = useMutation({
    mutationFn: (v: { telegram_id: string; note?: string | null }) => allowFn({ data: v }),
    onSuccess: () => {
      toast.success("Usuário liberado");
      setNewId("");
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["telegram-allowed"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao liberar"),
  });

  const removeUser = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { telegram_id: id } }),
    onSuccess: () => {
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["telegram-allowed"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao remover"),
  });

  const setWh = useMutation({
    mutationFn: (url: string) => setWhFn({ data: { url } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Webhook registrado");
      else toast.error(r?.description || "Falha ao registrar webhook");
      qc.invalidateQueries({ queryKey: ["telegram-webhook"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const delWh = useMutation({
    mutationFn: () => delWhFn({}),
    onSuccess: () => {
      toast.success("Webhook desativado");
      qc.invalidateQueries({ queryKey: ["telegram-webhook"] });
    },
  });

  if (!isOwner) return null;

  const wh = (info.data?.info as any)?.result;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Bot Telegram</h1>
          <p className="text-[13px] text-muted-foreground">
            Gerencie licenças e revendedores direto pelo Telegram. Apenas IDs autorizados podem usar o bot.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] flex items-center gap-2">
              <Plug className="h-4 w-4" /> Conexão do webhook
            </CardTitle>
            <CardDescription>
              O bot recebe mensagens em <code>/api/public/telegram/webhook</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">URL do webhook</Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={suggestedUrl}
                className="h-9 text-[12.5px] font-mono"
              />
              <div className="text-[11px] text-muted-foreground">
                Sugerida: <code>{suggestedUrl}</code>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setWh.mutate(webhookUrl.trim())}
                disabled={setWh.isPending || !webhookUrl.trim()}
              >
                {setWh.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 mr-1.5" />}
                Registrar / atualizar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => info.refetch()}
                disabled={info.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${info.isFetching ? "animate-spin" : ""}`} />
                Atualizar status
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => delWh.mutate()}
                disabled={delWh.isPending}
              >
                Desativar
              </Button>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 text-[12px] space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                {wh?.url ? (
                  <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Desconectado</Badge>
                )}
              </div>
              {wh?.url && (
                <div className="truncate"><span className="text-muted-foreground">URL:</span> <code>{wh.url}</code></div>
              )}
              {typeof wh?.pending_update_count === "number" && (
                <div><span className="text-muted-foreground">Pendentes:</span> {wh.pending_update_count}</div>
              )}
              {wh?.last_error_message && (
                <div className="text-red-500"><span className="text-muted-foreground">Último erro:</span> {wh.last_error_message}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Como usar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] flex items-center gap-2">
              <Send className="h-4 w-4" /> Como usar o bot
            </CardTitle>
            <CardDescription>Abra uma conversa com o bot e envie <code>/start</code>.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[12.5px]">
            <ol className="list-decimal pl-4 space-y-1">
              <li>Registre o webhook ao lado.</li>
              <li>No Telegram, abra o bot e envie <code>/start</code>.</li>
              <li>Use o menu para criar licenças, links personalizados ou revendedores.</li>
              <li>O bot devolve a *mensagem pronta* — copie e envie ao cliente.</li>
            </ol>
            <div className="pt-2 text-[11.5px] text-muted-foreground">
              Comandos: <code>/start</code>, <code>/menu</code>, <code>/cancel</code>, <code>/id</code>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usuários autorizados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[14px] flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Usuários autorizados
          </CardTitle>
          <CardDescription>
            Apenas os IDs listados abaixo conseguem usar o bot. Você (superadmin) não pode ser removido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[12px]">ID do Telegram</Label>
              <Input
                value={newId}
                onChange={(e) => setNewId(e.target.value.replace(/\D/g, ""))}
                placeholder="123456789"
                className="h-9 text-[12.5px] font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px]">Rótulo (opcional)</Label>
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ex.: João - suporte"
                className="h-9 text-[12.5px]"
              />
            </div>
            <Button
              size="sm"
              onClick={() => addUser.mutate({ telegram_id: newId, note: newNote || null })}
              disabled={!newId || addUser.isPending}
              className="h-9"
            >
              {addUser.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-1.5" />}
              Liberar
            </Button>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">ID</th>
                  <th className="text-left px-3 py-2 font-medium">Rótulo</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-right px-3 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.isLoading ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
                ) : (users.data ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nenhum usuário liberado.</td></tr>
                ) : (
                  (users.data ?? []).map((u: any) => (
                    <tr key={u.telegram_id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground text-foreground/80"
                          onClick={() => { navigator.clipboard.writeText(u.telegram_id); toast.success("ID copiado"); }}
                          title="Copiar ID"
                        >
                          {u.telegram_id} <Copy className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-3 py-2">{u.note ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2">
                        {u.is_super ? (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">Superadmin</Badge>
                        ) : (
                          <Badge variant="secondary">Autorizado</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {u.is_super ? (
                          <span className="text-[11px] text-muted-foreground">protegido</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-500 hover:text-red-600"
                            onClick={() => removeUser.mutate(u.telegram_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
