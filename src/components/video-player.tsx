import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2 } from "lucide-react";
import { detectVideoKind, youtubeEmbedUrl } from "@/lib/tutorials";

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  poster,
  title,
}: {
  src: string;
  poster?: string;
  title?: string;
}) {
  const kind = detectVideoKind(src);

  if (kind === "empty") {
    return (
      <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center border border-border">
        <div className="text-center px-6">
          <div className="text-sm font-medium text-foreground">Vídeo indisponível</div>
          <div className="text-xs text-muted-foreground mt-1">
            Nenhuma URL de vídeo foi configurada ainda.
          </div>
        </div>
      </div>
    );
  }

  if (kind === "youtube") {
    const embed = youtubeEmbedUrl(src);
    if (!embed) return null;
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={embed}
          title={title ?? "Vídeo"}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return <NativePlayer src={src} poster={poster} title={title} />;
}

function NativePlayer({ src, poster, title }: { src: string; poster?: string; title?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const seek = (val: number) => {
    const v = videoRef.current;
    if (!v || !isFinite(duration)) return;
    v.currentTime = (val / 100) * duration;
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const scheduleHide = () => {
    setShowUI(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowUI(false);
    }, 2500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA"].includes(active.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") toggleMute();
      else if (e.key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className="relative aspect-video w-full rounded-lg overflow-hidden bg-black group select-none"
      onMouseMove={scheduleHide}
      onMouseLeave={() => {
        if (videoRef.current && !videoRef.current.paused) setShowUI(false);
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setShowUI(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setBuffering(false);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        preload="metadata"
        playsInline
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" />
        </div>
      )}

      {!playing && !buffering && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          aria-label="Reproduzir"
        >
          <div className="h-16 w-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
            <Play className="h-7 w-7 text-black ml-1" fill="currentColor" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className={[
          "absolute inset-x-0 bottom-0 px-3 pb-2 pt-6 transition-opacity",
          "bg-gradient-to-t from-black/85 via-black/40 to-transparent",
          showUI || !playing ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {/* Progress */}
        <div className="relative group/prog h-4 flex items-center cursor-pointer">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-white/25 rounded-full">
            <div
              className="h-full bg-white rounded-full transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={(e) => seek(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Progresso"
          />
        </div>

        <div className="flex items-center gap-2 mt-1.5 text-white">
          <button
            onClick={togglePlay}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/10"
            aria-label={playing ? "Pausar" : "Reproduzir"}
          >
            {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
          </button>

          <div className="flex items-center gap-1.5 group/vol">
            <button
              onClick={toggleMute}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/10"
              aria-label={muted ? "Ativar som" : "Silenciar"}
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-0 group-hover/vol:w-20 transition-all h-1 accent-white cursor-pointer"
              aria-label="Volume"
            />
          </div>

          <div className="text-[11.5px] tabular-nums text-white/90 ml-1">
            {fmt(current)} <span className="text-white/50">/</span> {fmt(duration)}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/10"
              aria-label="Tela cheia"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
