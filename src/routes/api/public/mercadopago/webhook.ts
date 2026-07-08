import { createFileRoute } from "@tanstack/react-router";

// Webhook do Mercado Pago (por revendedor). URL:
//   /api/public/mercadopago/webhook?r=<reseller_user_id>
// MP envia: { action, type, data: { id } } + headers x-signature e x-request-id.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-signature, x-request-id",
} as const;

export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => new Response("ok", { status: 200, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const resellerId = url.searchParams.get("r") ?? "";
          if (!resellerId) return json({ error: "missing r" }, 400);

          const bodyText = await request.text();
          let body: any = {};
          try { body = JSON.parse(bodyText || "{}"); } catch { body = {}; }

          const type = body?.type ?? body?.topic ?? "";
          const dataId = String(body?.data?.id ?? body?.resource ?? url.searchParams.get("id") ?? "");
          if (!dataId) return json({ ok: true, ignored: "no data.id" }, 200);
          if (type && type !== "payment" && !/payment/i.test(String(type))) {
            return json({ ok: true, ignored: `type=${type}` }, 200);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: mp } = await supabaseAdmin
            .from("hyro_payment_integrations")
            .select("access_token, webhook_secret")
            .eq("user_id", resellerId)
            .eq("provider", "mercadopago")
            .maybeSingle();
          if (!mp) return json({ error: "reseller not configured" }, 404);

          // Valida assinatura HMAC
          const { verifyMpWebhookSignature, mpGetPayment } = await import("@/lib/mp.server");
          const okSig = verifyMpWebhookSignature({
            xSignature: request.headers.get("x-signature"),
            xRequestId: request.headers.get("x-request-id"),
            dataId,
            secret: (mp as any).webhook_secret ?? "",
          });
          if (!okSig) return json({ error: "invalid signature" }, 401);

          // Busca detalhes do pagamento no MP
          const paymentRes = await mpGetPayment((mp as any).access_token, dataId);
          if (!paymentRes.ok) return json({ error: paymentRes.message }, 502);
          const payment = paymentRes.payment;
          const externalRef = payment.external_reference ?? "";
          if (!externalRef) return json({ ok: true, ignored: "no external_reference" }, 200);

          const { data: order } = await supabaseAdmin
            .from("hyro_payment_orders")
            .select("id, status, license_id, renewal_days, reseller_user_id")
            .eq("id", externalRef)
            .maybeSingle();
          if (!order) return json({ error: "order not found" }, 404);
          if ((order as any).reseller_user_id !== resellerId) {
            return json({ error: "reseller mismatch" }, 403);
          }

          const st = payment.status ?? "pending";
          if (st === "approved" && (order as any).status !== "approved") {
            const { _settlePaidOrder } = await import("@/lib/mp.functions");
            await _settlePaidOrder({
              orderId: (order as any).id,
              licenseId: (order as any).license_id,
              renewalDays: (order as any).renewal_days,
              rawPayment: payment as unknown as Record<string, unknown>,
            });
          } else if (["rejected", "cancelled", "refunded"].includes(st)) {
            await supabaseAdmin
              .from("hyro_payment_orders")
              .update({ status: st, raw_payload: payment as any })
              .eq("id", (order as any).id);
          }

          return json({ ok: true }, 200);
        } catch (e: any) {
          console.error("[mp-webhook]", e);
          return json({ error: e?.message ?? "internal" }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
