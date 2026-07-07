import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "upgrade-files";
const ZIP_PATH = "upgrade/latest.zip";
const META_PATH = "upgrade/latest.json";

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
              headers: downloadHeaders(meta.fileName || "atualizacao.zip", meta.mime || "application/zip"),
            });
          }
        } catch {
          // fall through to 404
        }

        return new Response("Nenhuma atualização disponível.", { status: 404 });
      },
    },
  },
});
