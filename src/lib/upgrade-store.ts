import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase as cloud } from "@/integrations/supabase/client";
import { clearUpgradeFiles } from "@/lib/upgrade.functions";

export type UpgradeMeta = {
  fileName: string;
  size: number;
  mime: string;
  version?: string;
  notes?: string;
  updatedAt: number;
  source: "cloud" | "bundled";
};

const EVENT = "hyro_upgrade_change";
const BUCKET = "upgrade-files";
const ZIP_PATH = "upgrade/latest.zip";
const META_PATH = "upgrade/latest.json";

type WritableUpgradeMeta = Omit<UpgradeMeta, "source">;

function cleanText(value?: string) {
  const text = value?.trim();
  return text ? text : undefined;
}

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

async function uploadMetadata(meta: WritableUpgradeMeta) {
  const blob = new Blob([JSON.stringify(meta)], { type: "application/json" });
  const { error } = await cloud.storage.from(BUCKET).upload(META_PATH, blob, {
    upsert: true,
    cacheControl: "30",
    contentType: "application/json",
  });
  if (error) throw error;
}

export async function fetchUpgradeMeta(): Promise<UpgradeMeta | null> {
  const res = await fetch(`/api/public/upgrade-meta?t=${Date.now()}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Falha ao buscar atualização: ${res.status}`);
  return (await res.json()) as UpgradeMeta;
}

function fileNameFromDisposition(value: string | null) {
  if (!value) return null;
  const utf = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf) return decodeURIComponent(utf.replace(/\"/g, ""));
  const ascii = value.match(/filename="?([^";]+)"?/i)?.[1];
  return ascii ?? null;
}

export async function fetchUpgradeBlob(): Promise<{ blob: Blob; fileName: string }> {
  const res = await fetch(`/api/public/upgrade-zip?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha no download: ${res.status}`);
  const blob = await res.blob();
  const fileName = fileNameFromDisposition(res.headers.get("content-disposition")) ?? "HERO-Lovable-v5.8-FINAL.zip";
  return { blob, fileName };
}

export function useUpgrade() {
  const [meta, setMeta] = useState<UpgradeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clearFn = useServerFn(clearUpgradeFiles);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await fetchUpgradeMeta();
      setMeta(next);
      return next;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar atualização.";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    window.addEventListener(EVENT, refresh);
    return () => window.removeEventListener(EVENT, refresh);
  }, [refresh]);

  const setUpgrade = useCallback(async (file: File, extra?: { version?: string; notes?: string }) => {
    const next: WritableUpgradeMeta = {
      fileName: file.name,
      size: file.size,
      mime: file.type || "application/zip",
      version: cleanText(extra?.version),
      notes: cleanText(extra?.notes),
      updatedAt: Date.now(),
    };

    const { error: zipError } = await cloud.storage.from(BUCKET).upload(ZIP_PATH, file, {
      upsert: true,
      cacheControl: "30",
      contentType: "application/zip",
    });
    if (zipError) throw zipError;

    await uploadMetadata(next);
    const saved: UpgradeMeta = { ...next, source: "cloud" };
    setMeta(saved);
    emitChange();
    return saved;
  }, []);

  const updateInfo = useCallback(async (extra: { version?: string; notes?: string }) => {
    if (!meta || meta.source !== "cloud") return;
    const next: WritableUpgradeMeta = {
      fileName: meta.fileName,
      size: meta.size,
      mime: meta.mime,
      version: cleanText(extra.version),
      notes: cleanText(extra.notes),
      updatedAt: Date.now(),
    };
    await uploadMetadata(next);
    setMeta({ ...next, source: "cloud" });
    emitChange();
  }, [meta]);

  const clearUpgrade = useCallback(async () => {
    await clearFn();
    setMeta(null);
    setError(null);
    emitChange();
  }, [clearFn]);

  return { meta, loading, error, refresh, setUpgrade, updateInfo, clearUpgrade };
}
