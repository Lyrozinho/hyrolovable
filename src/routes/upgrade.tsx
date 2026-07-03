import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Rocket, Download, LifeBuoy, Loader2, FileArchive, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchUpgradeBlob, useUpgrade } from "@/lib/upgrade-store";
import { toast } from "sonner";

export const Route = createFileRoute("/upgrade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atualizar Extensão — Hyro Lovable" },
      { name: "description", content: "Baixe a versão mais recente da extensão Hyro Lovable e siga o guia rápido de instalação." },
      { property: "og:title", content: "Atualizar Extensão — Hyro Lovable" },
      { property: "og:description", content: "Baixe a versão mais recente da extensão Hyro Lovable." },
    ],
  }),
  component: UpgradePage,
});

const WHATSAPP_NUMBER = "5527981359051";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function UpgradePage() {
  const { meta } = useUpgrade();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      // Prefer admin-uploaded ZIP (IndexedDB). Only fall back to bundled file
      // if there's no metadata AT ALL — never silently override an uploaded one.
      if (meta) {
        const uploaded = await fetchUpgradeBlob();
        if (!uploaded) {
          throw new Error(
            "Arquivo enviado não foi encontrado no armazenamento local. Envie novamente em /upgrade-admin."
          );
        }
        const url = URL.createObjectURL(uploaded.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = uploaded.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`Baixando ${uploaded.fileName}`);
        return;
      }
      const res = await fetch("/hyro-lovable.zip", { cache: "no-store" });
      if (!res.ok) throw new Error(`Falha no download: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hyro-lovable.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Baixando hyro-lovable.zip (versão padrão)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no download");
    } finally {
      setDownloading(false);
    }
  };


  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center py-10 px-4">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 20%, color-mix(in oklab, var(--color-primary) 14%, transparent) 0, transparent 55%)",
        }}
      />

      <div className="relative w-full max-w-xl text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shadow-elegant">
          <Rocket className="h-7 w-7 text-primary" />
        </div>

        <h1 className="mt-6 text-[26px] md:text-[30px] font-semibold tracking-tight">
          Nova Versão Disponível
        </h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground max-w-md mx-auto leading-relaxed">
          Mantenha sua extensão atualizada para aproveitar as últimas melhorias e correções de segurança.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card px-6 py-6 md:px-8 md:py-7 shadow-xs text-left">
          <div className="text-center">
            <div className="text-[15px] font-semibold tracking-tight">Atualização da Extensão</div>
            <div className="text-[12.5px] text-muted-foreground mt-1">
              {meta?.version
                ? `Versão ${meta.version} · atualizada em ${new Date(meta.updatedAt).toLocaleDateString("pt-BR")}`
                : "Versão mais recente do Hyro Lovable"}
            </div>
          </div>

          {/* Which file will be served — makes any mismatch obvious */}
          <div className={[
            "mt-5 rounded-xl border px-4 py-3 flex items-start gap-3",
            meta ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5",
          ].join(" ")}>
            {meta ? (
              <FileArchive className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1 text-left">
              {meta ? (
                <>
                  <div className="text-[12.5px] font-medium text-foreground truncate">
                    {meta.fileName}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {formatSize(meta.size)} · enviado {new Date(meta.updatedAt).toLocaleString("pt-BR")}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[12.5px] font-medium text-foreground">
                    Nenhum arquivo enviado
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Será usado o arquivo padrão embutido no projeto (<span className="font-mono">hyro-lovable.zip</span>). Envie o correto em <span className="font-mono">/upgrade-admin</span>.
                  </div>
                </>
              )}
            </div>
          </div>

          {meta?.notes && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12.5px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {meta.notes}
            </div>
          )}


          <div className="mt-6 rounded-xl border border-border bg-secondary/50 px-5 py-4">
            <div className="text-[13px] font-semibold mb-2">Como instalar:</div>
            <ol className="space-y-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
              <li>1. Baixe o arquivo ZIP abaixo</li>
              <li>2. Extraia o conteúdo em uma pasta</li>
              <li>
                3. Vá para{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[11.5px] text-foreground">
                  chrome://extensions
                </code>
              </li>
              <li>4. Ative o "Modo do desenvolvedor"</li>
              <li>5. Clique em "Carregar sem compactação" e selecione a pasta extraída</li>
            </ol>
          </div>

          <Button
            onClick={download}
            disabled={downloading}
            className="mt-6 w-full h-12 text-[14px] font-semibold tracking-wide bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar Atualização
              </>
            )}
          </Button>

        </div>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            "Olá! Preciso de ajuda com a instalação da extensão Hyro Lovable."
          )}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          Se precisar de ajuda, entre em contato com o suporte.
        </a>
      </div>
    </div>
  );
}
