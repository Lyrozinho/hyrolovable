import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Rocket,
  Upload,
  Trash2,
  FileArchive,
  Loader2,
  Save,
  ExternalLink,
  Info,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { fetchUpgradeBlob, useUpgrade } from "@/lib/upgrade-store";
import { toast } from "sonner";


export const Route = createFileRoute("/_dash/upgrade-admin")({
  component: UpgradeAdminPage,
});

const MAX_ZIP_MB = 100;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function UpgradeAdminPage() {
  const { session } = useAuth();
  const isAdmin = session?.user.role !== "client";
  const { meta, setUpgrade, updateInfo, clearUpgrade } = useUpgrade();

  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [version, setVersion] = useState(meta?.version ?? "");
  const [notes, setNotes] = useState(meta?.notes ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVersion(meta?.version ?? "");
    setNotes(meta?.notes ?? "");
  }, [meta?.blobId]);

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="text-sm font-semibold text-foreground">Acesso restrito</div>
        <p className="text-xs text-muted-foreground mt-1">
          Esta área é exclusiva para administradores.
        </p>
      </div>
    );
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isZip =
      f.type === "application/zip" ||
      f.type === "application/x-zip-compressed" ||
      f.name.toLowerCase().endsWith(".zip");
    if (!isZip) {
      toast.error("Envie um arquivo .zip válido.");
      return;
    }
    if (f.size > MAX_ZIP_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx. ${MAX_ZIP_MB}MB).`);
      return;
    }
    setUploading(true);
    try {
      await setUpgrade(f, { version, notes });
      toast.success("Atualização publicada com sucesso");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const saveInfo = () => {
    if (!meta) return;
    updateInfo({ version, notes });
    toast.success("Informações atualizadas");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Atualização da Extensão
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Envie o arquivo <code className="text-xs font-mono px-1 py-0.5 rounded bg-muted">.zip</code> mais recente da extensão. Ele fica disponível para download em <code className="text-xs font-mono px-1 py-0.5 rounded bg-muted">/upgrade</code>.
          </p>
        </div>
      </div>

      {/* Current file */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-[13px] font-semibold text-foreground mb-3">Arquivo atual</div>
        {meta ? (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-background p-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileArchive className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-foreground truncate">
                {meta.fileName}
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{formatSize(meta.size)}</span>
                <span className="text-border">·</span>
                <span>Atualizado {new Date(meta.updatedAt).toLocaleString("pt-BR")}</span>
                {meta.version && (
                  <>
                    <span className="text-border">·</span>
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      v{meta.version}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const up = await fetchUpgradeBlob();
                  if (!up) return toast.error("Arquivo não encontrado no armazenamento.");
                  const url = URL.createObjectURL(up.blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = up.fileName;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Testar download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remover
              </Button>
            </div>
          </div>

        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            <FileArchive className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <div className="mt-2 text-[13px] font-medium text-foreground">Nenhum arquivo enviado</div>
            <div className="text-[11.5px] text-muted-foreground mt-1">
              O download em <code className="text-[10.5px] font-mono px-1 py-0.5 rounded bg-background">/upgrade</code> usará o arquivo padrão embutido no projeto.
            </div>
          </div>
        )}
      </div>

      {/* Upload / metadata */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="text-[13px] font-semibold text-foreground">
          {meta ? "Substituir arquivo" : "Enviar novo arquivo"}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="upg-version">Versão (opcional)</Label>
            <Input
              id="upg-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Ex: 1.4.0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Formato</Label>
            <div className="h-9 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/40 text-[12.5px] text-muted-foreground">
              <FileArchive className="h-3.5 w-3.5" />
              .zip · máx. {MAX_ZIP_MB}MB
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="upg-notes">Notas da versão (opcional)</Label>
          <Textarea
            id="upg-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Correção do login, suporte a Chrome 130..."
            rows={3}
          />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={onFile}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1.5" />
                {meta ? "Selecionar novo .zip" : "Enviar .zip do dispositivo"}
              </>
            )}
          </Button>
          {meta && (
            <Button type="button" variant="outline" onClick={saveInfo}>
              <Save className="h-4 w-4 mr-1.5" />
              Salvar versão/notas
            </Button>
          )}
        </div>

        <div className="flex items-start gap-2 text-[11.5px] text-muted-foreground border-t border-border pt-3">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            O arquivo é armazenado localmente no navegador (IndexedDB). Para servir globalmente a todos os clientes, hospede em um servidor/CDN — este modo funciona para testes e distribuição pessoal.
          </div>
        </div>

        <a
          href="/upgrade"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir página pública /upgrade
        </a>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remover arquivo de atualização</DialogTitle>
            <DialogDescription>
              O download em <code className="text-xs font-mono">/upgrade</code> voltará a usar o arquivo padrão embutido no projeto.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await clearUpgrade();
                setConfirmDelete(false);
                toast.success("Arquivo removido");
              }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
