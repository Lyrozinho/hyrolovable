import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "upgrade-files";
const ZIP_PATH = "upgrade/latest.zip";
const META_PATH = "upgrade/latest.json";

export const clearUpgradeFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verify caller is admin
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("hyro_user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr || !roleRow) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([ZIP_PATH, META_PATH]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
