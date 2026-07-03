import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { GraduationCap, Plus, Play, Pencil, Trash2, Clock, X, Upload, MessageCircle, LifeBuoy, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTutorials, type Tutorial, detectVideoKind } from "@/lib/tutorials";
import { VideoPlayer } from "@/components/video-player";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_dash/tutorials")({
  component: TutorialsPage,
});

const PAGE_SIZE = 6;

function TutorialsPage() {
  const { list, add, update, remove } = useTutorials();
  const { session } = useAuth();
  const isAdmin = session?.user.role !== "client";

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Tutorial | null>(null);
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Tutorial | null>(null);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, currentPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              Tutoriais
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aprenda a usar o Hyro Lovable com nossos vídeos passo a passo.
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" />
            Novo tutorial
          </Button>
        )}
      </div>

      {/* Grid */}
      {list.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <div className="mt-3 text-sm font-medium text-foreground">Nenhum tutorial ainda</div>
          <div className="text-xs text-muted-foreground mt-1">
            {isAdmin
              ? "Clique em 'Novo tutorial' para publicar o primeiro vídeo."
              : "Volte em breve — novos tutoriais serão publicados."}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((t, idx) => (
            <TutorialCard
              key={t.id}
              tutorial={t}
              index={(currentPage - 1) * PAGE_SIZE + idx + 1}
              isAdmin={isAdmin}
              onPlay={() => setSelected(t)}
              onEdit={() => setEditing(t)}
              onDelete={() => setConfirmDelete(t)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="sm"
              className="min-w-9"
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Player modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
          {selected && (
            <>
              <div className="bg-black">
                <VideoPlayer
                  src={selected.videoUrl}
                  poster={selected.thumbnailUrl}
                  title={selected.title}
                />
              </div>
              <div className="p-5">
                <DialogHeader>
                  <DialogTitle className="text-lg">{selected.title}</DialogTitle>
                  {selected.description && (
                    <DialogDescription className="text-sm leading-relaxed pt-1">
                      {selected.description}
                    </DialogDescription>
                  )}
                </DialogHeader>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin: create/edit */}
      {isAdmin && (
        <TutorialFormDialog
          open={creating || !!editing}
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={(payload) => {
            if (editing) {
              update(editing.id, payload);
              toast.success("Tutorial atualizado");
            } else {
              add(payload);
              toast.success("Tutorial publicado");
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {/* Confirm delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir tutorial</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <span className="font-medium">{confirmDelete?.title}</span>? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) {
                  remove(confirmDelete.id);
                  toast.success("Tutorial excluído");
                }
                setConfirmDelete(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Precisa de ajuda?</div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Fale com nosso suporte pelo WhatsApp — respondemos em minutos, de segunda a sábado.
            </p>
          </div>
        </div>
        <a
          href="https://wa.me/5527981359051"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors shrink-0"
        >
          <MessageCircle className="h-4 w-4" />
          Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}

function TutorialCard({
  tutorial,
  index,
  isAdmin,
  onPlay,
  onEdit,
  onDelete,
}: {
  tutorial: Tutorial;
  index: number;
  isAdmin: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasVideo = !!tutorial.videoUrl;
  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onPlay}
        className="relative block w-full aspect-video bg-muted overflow-hidden"
        aria-label={`Assistir ${tutorial.title}`}
      >
        {tutorial.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tutorial.thumbnailUrl}
            alt={tutorial.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/15 via-muted to-muted flex items-center justify-center">
            <GraduationCap className="h-10 w-10 text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-white/95 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-5 w-5 text-black ml-0.5" fill="currentColor" />
          </div>
        </div>
        <div className="absolute top-2 left-2 text-[10.5px] font-semibold uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded">
          #{index}
        </div>
        {!hasVideo && (
          <div className="absolute top-2 right-2 text-[10.5px] font-medium bg-amber-500/90 text-white px-1.5 py-0.5 rounded">
            Sem vídeo
          </div>
        )}
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
            {tutorial.title}
          </h3>
          {tutorial.duration && (
            <span className="text-[11px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {tutorial.duration}
            </span>
          )}
        </div>
        {tutorial.description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {tutorial.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={onPlay} className="flex-1">
            <Play className="h-3.5 w-3.5 mr-1" fill="currentColor" />
            Assistir
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit} aria-label="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDelete}
                aria-label="Excluir"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TutorialFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Tutorial;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration?: string;
  }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? "");
  const [duration, setDuration] = useState(initial?.duration ?? "");

  // Reset when opening with new initial
  useMemo(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setVideoUrl(initial?.videoUrl ?? "");
      setThumbnailUrl(initial?.thumbnailUrl ?? "");
      setDuration(initial?.duration ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const kind = detectVideoKind(videoUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      videoUrl: videoUrl.trim(),
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      duration: duration.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar tutorial" : "Novo tutorial"}</DialogTitle>
          <DialogDescription>
            Configure o título e o link do vídeo. Suporta URL direta de MP4 ou link do YouTube.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tut-title">Título *</Label>
            <Input
              id="tut-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Como instalar extensão"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tut-desc">Descrição</Label>
            <Textarea
              id="tut-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve resumo do que o aluno vai aprender..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tut-url">URL do vídeo</Label>
            <Input
              id="tut-url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://... .mp4 ou https://youtube.com/watch?v=..."
            />
            <div className="text-[11px] text-muted-foreground">
              {kind === "youtube" && "Link do YouTube detectado — será exibido via player oficial."}
              {kind === "mp4" && "URL de mídia direta — será usado o player nativo do Hyro."}
              {kind === "empty" && "Deixe em branco para publicar como rascunho."}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Capa do vídeo</Label>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              {thumbnailUrl ? (
                <div className="relative aspect-video w-full rounded overflow-hidden bg-black">
                  <img src={thumbnailUrl} alt="Capa" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setThumbnailUrl("")}
                    className="absolute top-2 right-2 h-7 w-7 rounded-md bg-black/70 hover:bg-black text-white flex items-center justify-center"
                    aria-label="Remover capa"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="aspect-video w-full rounded bg-muted flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-[11.5px]">Nenhuma capa selecionada</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 2 * 1024 * 1024) {
                      toast.error("Imagem muito grande (máx. 2MB).");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setThumbnailUrl(String(reader.result));
                    reader.readAsDataURL(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Enviar imagem
                </Button>
                <Input
                  value={thumbnailUrl.startsWith("data:") ? "" : thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="ou cole uma URL..."
                  className="h-9 flex-1 text-[12.5px]"
                />
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Formatos: JPG, PNG, WebP · máx. 2MB.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tut-dur">Duração (opcional)</Label>
            <Input
              id="tut-dur"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex: 5:32"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit">
              {initial ? "Salvar alterações" : "Publicar tutorial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
