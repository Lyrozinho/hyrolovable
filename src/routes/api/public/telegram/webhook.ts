import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { deriveWebhookSecret, handleUpdate } = await import("@/lib/telegram-bot.server");
        const expected = deriveWebhookSecret();
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (got !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        let update: any = null;
        try {
          update = await request.json();
        } catch {
          return new Response("bad request", { status: 400 });
        }
        // Fire-and-forget in the sense we always reply 200 to Telegram fast.
        try {
          await handleUpdate(update);
        } catch (e) {
          console.error("[telegram] webhook handler error", e);
        }
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, message: "Telegram webhook alive" }),
    },
  },
});
