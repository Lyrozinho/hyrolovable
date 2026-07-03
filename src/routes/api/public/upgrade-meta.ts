import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "upgrade-files";
const META_PATH = "upgrade/latest.json";
const FALLBACK_FILE_NAME = "HERO-Lovable-v5.8-FINAL.zip";

type StoredMeta = {
  fileName?: string;
  size?: number;
  mime?: string;
  version?: string;
  notes?: string;
  updatedAt?: number;
};

async function fallbackMeta() {
  let size = 0;
  try {
    const fs = await import("node:fs/promises");
    const stat = await fs.stat("public/hyro-lovable.zip");
    size = stat.size;
  } catch {
    size = 6759582;
  }

  return {
    fileName: FALLBACK_FILE_NAME,
    size,
    mime: "application/zip",
    version: "5.8",
    updatedAt: 1751558340000,
    source: "bundled" as const,
  };
}

export const Route = createFileRoute("/api/public/upgrade-meta")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(META_PATH);

          if (!error && data) {
            const meta = JSON.parse(await data.text()) as StoredMeta;
            return Response.json({
              fileName: meta.fileName || FALLBACK_FILE_NAME,
              size: meta.size || 0,
              mime: meta.mime || "application/zip",
              version: meta.version,
              notes: meta.notes,
              updatedAt: meta.updatedAt || Date.now(),
              source: "cloud",
            });
          }
        } catch {
          // Keep the public page downloadable even if cloud metadata is unavailable.
        }

        return Response.json(await fallbackMeta());
      },
    },
  },
});