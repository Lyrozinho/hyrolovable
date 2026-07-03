import { useCallback, useEffect, useState } from "react";
import { deleteBlob, getBlob, putBlob } from "./media-store";

export type UpgradeMeta = {
  blobId: string;
  fileName: string;
  size: number;
  mime: string;
  version?: string;
  notes?: string;
  updatedAt: number;
};

const STORAGE_KEY = "hyro_upgrade_v1";
const EVENT = "hyro_upgrade_change";

function read(): UpgradeMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UpgradeMeta;
  } catch {
    return null;
  }
}

function write(meta: UpgradeMeta | null) {
  if (meta) localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useUpgrade() {
  const [meta, setMeta] = useState<UpgradeMeta | null>(() => read());

  useEffect(() => {
    const sync = () => setMeta(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setUpgrade = useCallback(
    async (file: File, extra?: { version?: string; notes?: string }) => {
      const prev = read();
      const id = await putBlob(file, "upg");
      const next: UpgradeMeta = {
        blobId: id,
        fileName: file.name,
        size: file.size,
        mime: file.type || "application/zip",
        version: extra?.version?.trim() || undefined,
        notes: extra?.notes?.trim() || undefined,
        updatedAt: Date.now(),
      };
      write(next);
      if (prev?.blobId) await deleteBlob(prev.blobId);
      return next;
    },
    [],
  );

  const updateInfo = useCallback((extra: { version?: string; notes?: string }) => {
    const prev = read();
    if (!prev) return;
    write({
      ...prev,
      version: extra.version?.trim() || undefined,
      notes: extra.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
  }, []);

  const clearUpgrade = useCallback(async () => {
    const prev = read();
    write(null);
    if (prev?.blobId) await deleteBlob(prev.blobId);
  }, []);

  return { meta, setUpgrade, updateInfo, clearUpgrade };
}

export async function fetchUpgradeBlob(): Promise<{ blob: Blob; fileName: string } | null> {
  const meta = read();
  if (!meta) return null;
  const blob = await getBlob(meta.blobId);
  if (!blob) return null;
  return { blob, fileName: meta.fileName };
}
