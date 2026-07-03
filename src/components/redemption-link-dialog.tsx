import { useEffect, useState } from "react";
import { Link2, Copy, Check, Trash2, Loader2, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createLink, deleteLink, listLinksForLicense, type RedemptionLink } from "@/lib/redemption";

export function RedemptionLinkDialog({
  licenseId,
  licenseEmail,
  createdBy,
  open,
  onOpenChange,
}: {
  licenseId: string | null;
  licenseEmail: string | null;
  createdBy: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState<RedemptionLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const origin = "https://hyrolovable.lovable.app";

  const reload = async () => {
    if (!licenseId) return;
    setLoading(true);
    try { setLinks(await listLinksForLicense(licenseId)); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (open && licenseId) {
      setEmail(licenseEmail ?? "");
      setName("");
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, licenseId]);

  const submit = async () => {
    if (!licenseId) return;
    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) return toast.error("Informe um e-mail válido.");
    setCreating(true);
    try {
      const link = await createLink({
        license_id: licenseId,
        target_email: em,
        target_name: name.trim() || null,
        created_by: createdBy,
      });
      toast.success("Link personalizado criado");
      setLinks((l) => [link, ...l]);
      setName("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar link");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (slug: string) => {
    if (!confirm("Excluir este link? A pessoa não poderá mais resgatar por ele.")) return;
    try {
      await deleteLink(slug);
      setLinks((l) => l.filter((x) => x.slug !== slug));
      toast.success("Link removido");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  const copy = async (slug: string) => {
    const url = `${origin}/r/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1600);
    toast.success("Link copiado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-[15px]">Links de resgate personalizados</DialogTitle>
              <DialogDescription className="text-[12.5px]">
                Gere um link único vinculado à licença <span className="font-mono">{licenseId}</span>. A pessoa que abrir o link tem o IP travado (só ela poderá resgatar).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">E-mail destino</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@exemplo.com" className="h-9 pl-9 text-[13px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome (opcional)</Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" className="h-9 pl-9 text-[13px]" />
              </div>
            </div>
          </div>
          <Button onClick={submit} disabled={creating} size="sm" className="w-full">
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Gerar link personalizado
          </Button>

          <div className="pt-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Links existentes</div>
            {loading ? (
              <div className="text-[12.5px] text-muted-foreground py-4 text-center">Carregando…</div>
            ) : links.length === 0 ? (
              <div className="text-[12.5px] text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
                Nenhum link ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((l) => {
                  const url = `${origin}/r/${l.slug}`;
                  const status = l.claimed_user_id
                    ? { txt: "Resgatado", cls: "text-emerald-600" }
                    : l.locked_ip
                    ? { txt: `Aberto (IP ${l.locked_ip})`, cls: "text-amber-600" }
                    : { txt: "Aguardando", cls: "text-muted-foreground" };
                  return (
                    <div key={l.slug} className="rounded-md border border-border p-2.5 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12px] truncate">{url}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {l.target_email} · <span className={status.cls}>{status.txt}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => copy(l.slug)} title="Copiar">
                        {copied === l.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(l.slug)} title="Excluir" className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
