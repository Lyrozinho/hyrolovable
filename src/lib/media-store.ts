// Simple IndexedDB blob store for tutorial media (videos and thumbnails).
// Blobs are too large for localStorage, so metadata lives in localStorage
// and the actual binary data lives here, keyed by a stable id.

const DB_NAME = "hyro_media";
const STORE = "blobs";
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível neste navegador."));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function putBlob(blob: Blob, prefix = "blob"): Promise<string> {
  const db = await openDB();
  const id = newId(prefix);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return id;
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteBlob(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

// Cache of blob-id -> object URL so we don't recreate on every render.
const urlCache = new Map<string, string>();

export async function getBlobUrl(id: string): Promise<string | null> {
  if (!id) return null;
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function revokeBlobUrl(id: string) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}
