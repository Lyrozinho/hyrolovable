import { useEffect, useState, useCallback } from "react";
import { deleteBlob, getBlobUrl } from "./media-store";

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  videoBlobId?: string;      // IndexedDB id for uploaded video
  videoMime?: string;
  thumbnailBlobId?: string;  // IndexedDB id for uploaded cover
  duration?: string;
  createdAt: number;
};

const STORAGE_KEY = "hyro_tutorials_v2";

const SEED: Tutorial[] = [
  {
    id: "install-extension",
    title: "Como instalar extensão",
    description:
      "Passo a passo completo para instalar a extensão Hyro Lovable no seu navegador Chrome ou Edge. Baixe o arquivo ZIP, extraia e carregue no modo desenvolvedor.",
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
    if (!Array.isArray(parsed)) return SEED;
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

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Tutorial, "id" | "createdAt">>) => {
      const cur = read();
      const prev = cur.find((t) => t.id === id);
      // If we replaced blobs, free the previous ones from IDB.
      if (prev) {
        if (
          "videoBlobId" in patch &&
          prev.videoBlobId &&
          prev.videoBlobId !== patch.videoBlobId
        ) {
          await deleteBlob(prev.videoBlobId);
        }
        if (
          "thumbnailBlobId" in patch &&
          prev.thumbnailBlobId &&
          prev.thumbnailBlobId !== patch.thumbnailBlobId
        ) {
          await deleteBlob(prev.thumbnailBlobId);
        }
      }
      write(cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    const cur = read();
    const target = cur.find((t) => t.id === id);
    if (target) {
      if (target.videoBlobId) await deleteBlob(target.videoBlobId);
      if (target.thumbnailBlobId) await deleteBlob(target.thumbnailBlobId);
    }
    write(cur.filter((t) => t.id !== id));
  }, []);

  return { list, add, update, remove };
}

// Resolves an IndexedDB blob id into a usable object URL for <img>/<video>.
export function useBlobUrl(id?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setUrl(null);
      return;
    }
    getBlobUrl(id).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return url;
}
