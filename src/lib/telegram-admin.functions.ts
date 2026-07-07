import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_EMAIL = "adminpainel@gmail.com";

function ensureOwner(claims: any) {
  const email = String(claims?.email ?? "").toLowerCase();
  if (email !== OWNER_EMAIL) throw new Error("Forbidden");
}

export const tgListAllowed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    ensureOwner((context as any).claims);
    const { listAllowed } = await import("@/lib/telegram-bot.server");
    return listAllowed();
  });

export const tgAllow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegram_id: string; note?: string | null }) => d)
  .handler(async ({ data, context }) => {
    ensureOwner((context as any).claims);
    const { allowUser } = await import("@/lib/telegram-bot.server");
    await allowUser(data.telegram_id, data.note ?? null);
    return { ok: true };
  });

export const tgRevoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegram_id: string }) => d)
  .handler(async ({ data, context }) => {
    ensureOwner((context as any).claims);
    const { revokeUser } = await import("@/lib/telegram-bot.server");
    await revokeUser(data.telegram_id);
    return { ok: true };
  });

export const tgWebhookInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    ensureOwner((context as any).claims);
    const { getWebhookInfo } = await import("@/lib/telegram-bot.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const info = await getWebhookInfo();
    const { data: cfg } = await supabaseAdmin
      .from("hyro_telegram_config")
      .select("webhook_url,webhook_set_at,last_error")
      .eq("id", 1)
      .maybeSingle();
    return { info, config: cfg ?? null };
  });

export const tgSetWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data, context }) => {
    ensureOwner((context as any).claims);
    const { setWebhook } = await import("@/lib/telegram-bot.server");
    const res = await setWebhook(data.url);
    return res;
  });

export const tgDeleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    ensureOwner((context as any).claims);
    const { tg } = await import("@/lib/telegram-bot.server");
    const r = await tg("deleteWebhook", { drop_pending_updates: false });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("hyro_telegram_config")
      .upsert(
        { id: 1, webhook_url: null, webhook_set_at: null, updated_at: new Date().toISOString() } as any,
        { onConflict: "id" },
      );
    return r;
  });
