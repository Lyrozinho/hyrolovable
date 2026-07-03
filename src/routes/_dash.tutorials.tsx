import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GraduationCap,
  Plus,
  Play,
  Pencil,
  Trash2,
  Clock,
  X,
  Upload,
  MessageCircle,
  LifeBuoy,
  ImageIcon,
  FileVideo,
  Loader2,
} from "lucide-react";
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
import { useTutorials, useBlobUrl, type Tutorial } from "@/lib/tutorials";
import { putBlob, deleteBlob } from "@/lib/media-store";
import { VideoPlayer } from "@/components/video-player";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_dash/tutorials")({
  component: TutorialsPage,
});

const PAGE_SIZE = 6;
const MAX_VIDEO_MB = 200;
const MAX_THUMB_MB = 3;

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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
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

      <PlayerDialog tutorial={selected} onClose={() => setSelected(null)} />

      {isAdmin && (
        <TutorialFormDialog
          open={creating || !!editing}
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (payload) => {
            if (editing) {
              await update(editing.id, payload);
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
              onClick={async () => {
                if (confirmDelete) {
                  await remove(confirmDelete.id);
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

function PlayerDialog({ tutorial, onClose }: { tutorial: Tutorial | null; onClose: () => void }) {
  const videoUrl = useBlobUrl(tutorial?.videoBlobId);
  const thumbUrl = useBlobUrl(tutorial?.thumbnailBlobId);
  return (
    <Dialog open={!!tutorial} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
        {tutorial && (
          <>
            <div className="bg-black">
              <VideoPlayer
                src={videoUrl}
                poster={thumbUrl}
                title={tutorial.title}
                mime={tutorial.videoMime}
              />
            </div>
            <div className="p-5">
              <DialogHeader>
                <DialogTitle className="text-lg">{tutorial.title}</DialogTitle>
                {tutorial.description && (
                  <DialogDescription className="text-sm leading-relaxed pt-1">
                    {tutorial.description}
                  </DialogDescription>
                )}
              </DialogHeader>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  const hasVideo = !!tutorial.videoBlobId;
  const thumb = useBlobUrl(tutorial.thumbnailBlobId);
  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onPlay}
        className="relative block w-full aspect-video bg-muted overflow-hidden"
        aria-label={`Assistir ${tutorial.title}`}
      >
        {thumb ? (
          <img
            src={thumb}
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

type FormPayload = {
  title: string;
  description: string;
  videoBlobId?: string;
  videoMime?: string;
  thumbnailBlobId?: string;
  duration?: string;
};

function TutorialFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Tutorial;
  onClose: () => void;
  onSubmit: (payload: FormPayload) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");

  // Video state — either an existing blob id (persisted) or a freshly uploaded one (pending).
  const [videoBlobId, setVideoBlobId] = useState<string | undefined>(undefined);
  const [videoMime, setVideoMime] = useState<string | undefined>(undefined);
  const [videoName, setVideoName] = useState<string>("");
  const [videoSize, setVideoSize] = useState<number>(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [thumbBlobId, setThumbBlobId] = useState<string | undefined>(undefined);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  // Track blob ids we created in this session but did NOT commit (cleanup on cancel).
  const pendingRef = useRef<{ video?: string; thumb?: string }>({});

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const thumbPreview = useBlobUrl(thumbBlobId);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setDuration(initial?.duration ?? "");
      setVideoBlobId(initial?.videoBlobId);
      setVideoMime(initial?.videoMime);
      setVideoName("");
      setVideoSize(0);
      setThumbBlobId(initial?.thumbnailBlobId);
      pendingRef.current = {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo válido.");
      return;
    }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Vídeo muito grande (máx. ${MAX_VIDEO_MB}MB).`);
      return;
    }
    setUploadingVideo(true);
    try {
      const id = await putBlob(f, "vid");
      // Clean up previous pending upload (if user swapped without saving).
      if (pendingRef.current.video && pendingRef.current.video !== initial?.videoBlobId) {
        await deleteBlob(pendingRef.current.video);
      }
      pendingRef.current.video = id;
      setVideoBlobId(id);
      setVideoMime(f.type || "video/mp4");
      setVideoName(f.name);
      setVideoSize(f.size);
      toast.success("Vídeo carregado");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar vídeo no navegador.");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleThumbChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.");
      return;
    }
    if (f.size > MAX_THUMB_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx. ${MAX_THUMB_MB}MB).`);
      return;
    }
    setUploadingThumb(true);
    try {
      const id = await putBlob(f, "thumb");
      if (pendingRef.current.thumb && pendingRef.current.thumb !== initial?.thumbnailBlobId) {
        await deleteBlob(pendingRef.current.thumb);
      }
      pendingRef.current.thumb = id;
      setThumbBlobId(id);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar imagem.");
    } finally {
      setUploadingThumb(false);
    }
  };

  const clearVideo = async () => {
    if (pendingRef.current.video) {
      await deleteBlob(pendingRef.current.video);
      pendingRef.current.video = undefined;
    }
    setVideoBlobId(undefined);
    setVideoMime(undefined);
    setVideoName("");
    setVideoSize(0);
  };

  const clearThumb = async () => {
    if (pendingRef.current.thumb) {
      await deleteBlob(pendingRef.current.thumb);
      pendingRef.current.thumb = undefined;
    }
    setThumbBlobId(undefined);
  };

  const handleClose = async () => {
    // Discard pending uploads that were never committed.
    if (pendingRef.current.video && pendingRef.current.video !== initial?.videoBlobId) {
      await deleteBlob(pendingRef.current.video);
    }
    if (pendingRef.current.thumb && pendingRef.current.thumb !== initial?.thumbnailBlobId) {
      await deleteBlob(pendingRef.current.thumb);
    }
    pendingRef.current = {};
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }
    // Commit — clear pending so handleClose doesn't delete them.
    pendingRef.current = {};
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      videoBlobId,
      videoMime,
      thumbnailBlobId: thumbBlobId,
      duration: duration.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar tutorial" : "Novo tutorial"}</DialogTitle>
          <DialogDescription>
            Envie o vídeo e a capa direto do seu dispositivo. Nada de URL externa.
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

          {/* Video upload */}
          <div className="space-y-1.5">
            <Label>Vídeo do tutorial *</Label>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              {videoBlobId ? (
                <div className="flex items-center gap-3 rounded bg-background border border-border p-2.5">
                  <div className="h-10 w-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileVideo className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-foreground truncate">
                      {videoName || "Vídeo salvo"}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {videoMime || "video/*"}
                      {videoSize > 0 && ` · ${(videoSize / (1024 * 1024)).toFixed(1)} MB`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearVideo}
                    className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive flex items-center justify-center shrink-0"
                    aria-label="Remover vídeo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="aspect-video w-full rounded bg-muted flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                  <FileVideo className="h-6 w-6" />
                  <span className="text-[11.5px]">Nenhum vídeo selecionado</span>
                </div>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                className="hidden"
                onChange={handleVideoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => videoInputRef.current?.click()}
                className="w-full"
                disabled={uploadingVideo}
              >
                {uploadingVideo ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {videoBlobId ? "Trocar vídeo" : "Enviar vídeo do dispositivo"}
                  </>
                )}
              </Button>
              <p className="text-[10.5px] text-muted-foreground">
                Formatos recomendados: MP4 (H.264), WebM · máx. {MAX_VIDEO_MB}MB.
              </p>
            </div>
          </div>

          {/* Cover upload */}
          <div className="space-y-1.5">
            <Label>Capa do vídeo</Label>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              {thumbPreview ? (
                <div className="relative aspect-video w-full rounded overflow-hidden bg-black">
                  <img src={thumbPreview} alt="Capa" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearThumb}
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
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleThumbChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => thumbInputRef.current?.click()}
                className="w-full"
                disabled={uploadingThumb}
              >
                {uploadingThumb ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {thumbBlobId ? "Trocar capa" : "Enviar capa do dispositivo"}
                  </>
                )}
              </Button>
              <p className="text-[10.5px] text-muted-foreground">
                Formatos: JPG, PNG, WebP · máx. {MAX_THUMB_MB}MB.
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
            <Button type="button" variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit" disabled={uploadingVideo || uploadingThumb}>
              {initial ? "Salvar alterações" : "Publicar tutorial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
