import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "upgrade-files";
const META_PATH = "upgrade/latest.json";

type StoredMeta = {
  fileName?: string;
  size?: number;
  mime?: string;
  version?: string;
  notes?: string;
  updatedAt?: number;
};

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
              fileName: meta.fileName || "atualizacao.zip",
              size: meta.size || 0,
              mime: meta.mime || "application/zip",
              version: meta.version,
              notes: meta.notes,
              updatedAt: meta.updatedAt || Date.now(),
              source: "cloud",
            });
          }
        } catch {
          // fall through to 404
        }

        return Response.json(
          { error: "Nenhuma atualização disponível." },
          { status: 404 },
        );
      },
    },
  },
});
