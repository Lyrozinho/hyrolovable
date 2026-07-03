import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  videoPath?: string;      // storage path in tutorials-media
  videoMime?: string;
  thumbnailPath?: string;  // storage path in tutorials-media
  duration?: string;
  createdAt: number;
};

const BUCKET = "tutorials-media";
const CHANGE_EVENT = "hyro_tutorials_change";
const SIGN_TTL = 60 * 60 * 6; // 6h

type Row = {
  id: string;
  title: string;
  description: string | null;
  video_path: string | null;
  video_mime: string | null;
  thumbnail_path: string | null;
  duration: string | null;
  created_at: string;
};

function fromRow(r: Row): Tutorial {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    videoPath: r.video_path ?? undefined,
    videoMime: r.video_mime ?? undefined,
    thumbnailPath: r.thumbnail_path ?? undefined,
    duration: r.duration ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  };
}

async function fetchAll(): Promise<Tutorial[]> {
  const { data, error } = await supabase
    .from("hyro_tutorials")
    .select("id,title,description,video_path,video_mime,thumbnail_path,duration,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetch tutorials", error);
    return [];
  }
  return (data as Row[]).map(fromRow);
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTutorials() {
  const [list, setList] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const rows = await fetchAll();
    setList(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const sync = () => reload();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, [reload]);

  const add = useCallback(
    async (t: Omit<Tutorial, "id" | "createdAt">) => {
      const id = `tut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const { error } = await supabase.from("hyro_tutorials").insert({
        id,
        title: t.title,
        description: t.description,
        video_path: t.videoPath ?? null,
        video_mime: t.videoMime ?? null,
        thumbnail_path: t.thumbnailPath ?? null,
        duration: t.duration ?? null,
      });
      if (error) throw error;
      notify();
    },
    [],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Tutorial, "id" | "createdAt">>) => {
      const cur = list.find((t) => t.id === id);
      // Free replaced files
      if (cur) {
        const removals: string[] = [];
        if ("videoPath" in patch && cur.videoPath && cur.videoPath !== patch.videoPath) {
          removals.push(cur.videoPath);
        }
        if ("thumbnailPath" in patch && cur.thumbnailPath && cur.thumbnailPath !== patch.thumbnailPath) {
          removals.push(cur.thumbnailPath);
        }
        if (removals.length) await supabase.storage.from(BUCKET).remove(removals);
      }
      const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("title" in patch) upd.title = patch.title;
      if ("description" in patch) upd.description = patch.description;
      if ("videoPath" in patch) upd.video_path = patch.videoPath ?? null;
      if ("videoMime" in patch) upd.video_mime = patch.videoMime ?? null;
      if ("thumbnailPath" in patch) upd.thumbnail_path = patch.thumbnailPath ?? null;
      if ("duration" in patch) upd.duration = patch.duration ?? null;
      const { error } = await supabase.from("hyro_tutorials").update(upd).eq("id", id);
      if (error) throw error;
      notify();
    },
    [list],
  );

  const remove = useCallback(
    async (id: string) => {
      const cur = list.find((t) => t.id === id);
      const removals: string[] = [];
      if (cur?.videoPath) removals.push(cur.videoPath);
      if (cur?.thumbnailPath) removals.push(cur.thumbnailPath);
      if (removals.length) await supabase.storage.from(BUCKET).remove(removals);
      const { error } = await supabase.from("hyro_tutorials").delete().eq("id", id);
      if (error) throw error;
      notify();
    },
    [list],
  );

  return { list, loading, add, update, remove };
}

// -------- Upload helpers --------

export async function uploadTutorialFile(file: File, kind: "video" | "thumb"): Promise<string> {
  const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase();
  const path = `${kind}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeTutorialFile(path?: string) {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

// -------- URL resolution (signed URLs, cached) --------

const urlCache = new Map<string, { url: string; exp: number }>();

async function signUrl(path: string): Promise<string | null> {
  const now = Date.now();
  const cached = urlCache.get(path);
  if (cached && cached.exp > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
  if (error || !data?.signedUrl) {
    console.error("signUrl", path, error);
    return null;
  }
  urlCache.set(path, { url: data.signedUrl, exp: now + SIGN_TTL * 1000 });
  return data.signedUrl;
}

export function useSignedMediaUrl(path?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    signUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}
