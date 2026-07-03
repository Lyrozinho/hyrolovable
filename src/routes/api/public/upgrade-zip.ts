import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "upgrade-files";
const ZIP_PATH = "upgrade/latest.zip";
const META_PATH = "upgrade/latest.json";
const FALLBACK_FILE_NAME = "HERO-Lovable-v5.8-FINAL.zip";

type StoredMeta = {
  fileName?: string;
  mime?: string;
};

function downloadHeaders(fileName: string, contentType = "application/zip") {
  return {
    "content-type": contentType,
    "cache-control": "no-store, max-age=0",
    "content-disposition": `attachment; filename="${fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  };
}

async function fallbackZip() {
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile("public/hyro-lovable.zip");
  return new Response(bytes, { headers: downloadHeaders(FALLBACK_FILE_NAME) });
}

export const Route = createFileRoute("/api/public/upgrade-zip")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const [{ data: zip, error: zipError }, { data: metaBlob }] = await Promise.all([
            supabaseAdmin.storage.from(BUCKET).download(ZIP_PATH),
            supabaseAdmin.storage.from(BUCKET).download(META_PATH),
          ]);

          if (!zipError && zip) {
            let meta: StoredMeta = {};
            if (metaBlob) {
              try {
                meta = JSON.parse(await metaBlob.text()) as StoredMeta;
              } catch {
                meta = {};
              }
            }

            return new Response(zip, {
              headers: downloadHeaders(meta.fileName || FALLBACK_FILE_NAME, meta.mime || "application/zip"),
            });
          }
        } catch {
          // Fall back to the bundled ZIP below.
        }

        return fallbackZip();
      },
    },
  },
});