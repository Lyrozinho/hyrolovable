import { useEffect, useState, useCallback } from "react";

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;      // mp4 URL or YouTube URL
  thumbnailUrl?: string;
  duration?: string;
  createdAt: number;
};

const STORAGE_KEY = "hyro_tutorials_v1";

const SEED: Tutorial[] = [
  {
    id: "install-extension",
    title: "Como instalar extensão",
    description:
      "Passo a passo completo para instalar a extensão Hyro Lovable no seu navegador Chrome ou Edge. Baixe o arquivo ZIP, extraia e carregue no modo desenvolvedor.",
    videoUrl: "",
    thumbnailUrl: "",
    createdAt: Date.now(),
  },
];

function read(): Tutorial[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as Tutorial[];
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED;
    return parsed;
  } catch {
    return SEED;
  }
}

function write(list: Tutorial[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("hyro_tutorials_change"));
}

export function useTutorials() {
  const [list, setList] = useState<Tutorial[]>(() => read());

  useEffect(() => {
    const sync = () => setList(read());
    sync();
    window.addEventListener("hyro_tutorials_change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hyro_tutorials_change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((t: Omit<Tutorial, "id" | "createdAt">) => {
    const next: Tutorial = {
      ...t,
      id: `tut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };
    const cur = read();
    write([next, ...cur]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<Tutorial, "id" | "createdAt">>) => {
    const cur = read();
    write(cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const remove = useCallback((id: string) => {
    const cur = read();
    write(cur.filter((t) => t.id !== id));
  }, []);

  return { list, add, update, remove };
}

export function detectVideoKind(url: string): "youtube" | "mp4" | "empty" {
  if (!url) return "empty";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  return "mp4";
}

export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.searchParams.get("v")) id = u.searchParams.get("v")!;
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/embed/")[1];
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  } catch {
    return null;
  }
}
