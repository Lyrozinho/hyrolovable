import { createServerFn } from "@tanstack/react-start";

// ============================================================
// Common helpers
// ============================================================
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function extAdmin() {
  // Uses the "extension" supabase (hyro_extension_*) with anon key.
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = "https://zoxdnsjhdpdhwyxbluax.supabase.co";
  const SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpveGRuc2poZHBkaHd5eGJsdWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzU0ODIsImV4cCI6MjA5ODUxMTQ4Mn0.Tb_TKnYsIroEmmjoIFLJcQCrtCZw3AlUWHf6dzj_4g0";
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeCpf(v: unknown): string {
  return String(v ?? "").replace(/\D+/g, "");
}
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ============================================================
// Save / test / delete MP integration
// ============================================================
export type SaveMpInput = {
  userId: string;
  mode: "sandbox" | "live";
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  active: boolean;
};

export const saveMpIntegration = createServerFn({ method: "POST" })
  .inputValidator((d: SaveMpInput) => {
    const userId = String(d?.userId ?? "").trim();
    if (!userId) throw new Error("userId obrigatório");
    const mode = d.mode === "sandbox" ? "sandbox" : "live";
    const accessToken = String(d.accessToken ?? "").trim();
    if (accessToken.length < 20) throw new Error("Access Token inválido");
    const publicKey = String(d.publicKey ?? "").trim();
    if (publicKey.length < 20) throw new Error("Public Key inválida");
    const webhookSecret = String(d.webhookSecret ?? "").trim();
    if (webhookSecret.length < 8) throw new Error("Webhook Secret inválido (mín. 8 caracteres)");
    return { userId, mode, accessToken, publicKey, webhookSecret, active: !!d.active };
  })
  .handler(async ({ data }) => {
    const { mpGetMe } = await import("./mp.server");
    const test = await mpGetMe(data.accessToken);
    if (!test.ok) throw new Error(`Credenciais inválidas: ${test.message}`);
    const account_info = {
      id: test.user.id,
      nickname: test.user.nickname ?? null,
      email: test.user.email ?? null,
      site_id: test.user.site_id ?? null,
      country_id: test.user.country_id ?? null,
      last_verified_at: new Date().toISOString(),
    };
    const sb = await admin();
    const { error } = await sb.from("hyro_payment_integrations").upsert(
      {
        user_id: data.userId,
        provider: "mercadopago",
        mode: data.mode,
        access_token: data.accessToken,
        public_key: data.publicKey,
        webhook_secret: data.webhookSecret,
        active: data.active,
        account_info,
      } as any,
      { onConflict: "user_id,provider" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, account_info };
  });

export const testMpIntegration = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => {
    const userId = String(d?.userId ?? "").trim();
    if (!userId) throw new Error("userId obrigatório");
    return { userId };
  })
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row, error } = await sb
      .from("hyro_payment_integrations")
      .select("access_token")
      .eq("user_id", data.userId)
      .eq("provider", "mercadopago")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, message: "Nenhuma credencial salva" };
    const { mpGetMe } = await import("./mp.server");
    const r = await mpGetMe((row as any).access_token);
    if (!r.ok) return { ok: false, message: r.message };
    return { ok: true, account: { id: r.user.id, nickname: r.user.nickname ?? null, email: r.user.email ?? null } };
  });

export const deleteMpIntegration = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => ({ userId: String(d?.userId ?? "").trim() }))
  .handler(async ({ data }) => {
    if (!data.userId) throw new Error("userId obrigatório");
    const sb = await admin();
    const { error } = await sb
      .from("hyro_payment_integrations")
      .delete()
      .eq("user_id", data.userId)
      .eq("provider", "mercadopago");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Never returns access_token; only status metadata for card display.
export type MpIntegrationStatus = {
  configured: true;
  mode: "sandbox" | "live";
  active: boolean;
  publicKey: string | null;
  accountNickname: string | null;
  accountEmail: string | null;
  accountId: number | null;
  updatedAt: string;
};

export const getMpIntegrationStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => ({ userId: String(d?.userId ?? "").trim() }))
  .handler(async ({ data }): Promise<MpIntegrationStatus | null> => {
    if (!data.userId) return null;
    const sb = await admin();
    const { data: row } = await sb
      .from("hyro_payment_integrations")
      .select("mode, active, account_info, public_key, updated_at")
      .eq("user_id", data.userId)
      .eq("provider", "mercadopago")
      .maybeSingle();
    if (!row) return null;
    const info = (((row as any).account_info ?? {}) as Record<string, unknown>);
    return {
      configured: true,
      mode: (row as any).mode as "sandbox" | "live",
      active: !!(row as any).active,
      publicKey: (row as any).public_key as string | null,
      accountNickname: (info.nickname as string) ?? null,
      accountEmail: (info.email as string) ?? null,
      accountId: typeof info.id === "number" ? (info.id as number) : null,
      updatedAt: (row as any).updated_at as string,
    };
  });

// ============================================================
// Reseller pricing
// ============================================================
export type SavePricingInput = {
  resellerUserId: string;
  priceCents: number;
  renewalDays: number;
  active: boolean;
};

export const saveResellerPricing = createServerFn({ method: "POST" })
  .inputValidator((d: SavePricingInput) => {
    const resellerUserId = String(d?.resellerUserId ?? "").trim();
    if (!resellerUserId) throw new Error("resellerUserId obrigatório");
    const priceCents = Math.trunc(Number(d.priceCents));
    if (!Number.isFinite(priceCents) || priceCents < 50) throw new Error("Preço mínimo R$ 0,50");
    if (priceCents > 100_000_00) throw new Error("Preço máximo R$ 100.000,00");
    const renewalDays = Math.trunc(Number(d.renewalDays));
    if (!Number.isFinite(renewalDays) || renewalDays < 1 || renewalDays > 3650) {
      throw new Error("renewalDays deve estar entre 1 e 3650");
    }
    return { resellerUserId, priceCents, renewalDays, active: !!d.active };
  })
  .handler(async ({ data }) => {
    const sb = await admin();
    const { error } = await sb.from("hyro_reseller_pricing").upsert(
      {
        reseller_user_id: data.resellerUserId,
        renewal_price_cents: data.priceCents,
        renewal_days: data.renewalDays,
        active: data.active,
      } as any,
      { onConflict: "reseller_user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getResellerPricing = createServerFn({ method: "POST" })
  .inputValidator((d: { resellerUserId: string }) => ({ resellerUserId: String(d?.resellerUserId ?? "").trim() }))
  .handler(async ({ data }) => {
    if (!data.resellerUserId) return null;
    const sb = await admin();
    const { data: row } = await sb
      .from("hyro_reseller_pricing")
      .select("renewal_price_cents, renewal_days, currency, active, updated_at")
      .eq("reseller_user_id", data.resellerUserId)
      .maybeSingle();
    if (!row) return null;
    return {
      priceCents: (row as any).renewal_price_cents as number,
      renewalDays: (row as any).renewal_days as number,
      currency: (row as any).currency as string,
      active: !!(row as any).active,
      updatedAt: (row as any).updated_at as string,
    };
  });

// Client-facing: given a license, resolve which reseller and their price + whether MP is active.
export const getRenewalOfferForLicense = createServerFn({ method: "POST" })
  .inputValidator((d: { licenseId: string; clientUserId: string }) => {
    const licenseId = String(d?.licenseId ?? "").trim();
    const clientUserId = String(d?.clientUserId ?? "").trim();
    if (!licenseId || !clientUserId) throw new Error("licenseId e clientUserId obrigatórios");
    return { licenseId, clientUserId };
  })
  .handler(async ({ data }) => {
    const ext = await extAdmin();
    const { data: lic } = await ext
      .from("hyro_extension_licenses")
      .select("id, user_id, reseller_id, created_by, expires_at, status")
      .eq("id", data.licenseId)
      .maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    if ((lic as any).user_id !== data.clientUserId) throw new Error("Licença não pertence a este cliente");
    const resellerId = (lic as any).reseller_id ?? (lic as any).created_by ?? null;
    if (!resellerId) return { available: false, reason: "Licença sem revendedor vinculado" };

    const sb = await admin();
    const [{ data: pricing }, { data: mp }] = await Promise.all([
      sb.from("hyro_reseller_pricing").select("renewal_price_cents, renewal_days, active").eq("reseller_user_id", resellerId).maybeSingle(),
      sb.from("hyro_payment_integrations").select("active, mode").eq("user_id", resellerId).eq("provider", "mercadopago").maybeSingle(),
    ]);
    if (!pricing || !(pricing as any).active) return { available: false, reason: "Revendedor não configurou preço de renovação" };
    if (!mp || !(mp as any).active) return { available: false, reason: "Revendedor não configurou pagamento" };
    return {
      available: true,
      resellerId,
      priceCents: (pricing as any).renewal_price_cents as number,
      renewalDays: (pricing as any).renewal_days as number,
      mpMode: (mp as any).mode as "sandbox" | "live",
      licenseExpiresAt: (lic as any).expires_at as string,
    };
  });

// ============================================================
// Create renewal order (generates PIX) + poll status
// ============================================================
export type CreateRenewalInput = {
  licenseId: string;
  clientUserId: string;
  payerName: string;
  payerLastName: string;
  payerEmail: string;
  payerCpf: string;
};

export const createRenewalOrder = createServerFn({ method: "POST" })
  .inputValidator((d: CreateRenewalInput) => {
    const licenseId = String(d?.licenseId ?? "").trim();
    const clientUserId = String(d?.clientUserId ?? "").trim();
    const payerName = String(d?.payerName ?? "").trim();
    const payerLastName = String(d?.payerLastName ?? "").trim();
    const payerEmail = String(d?.payerEmail ?? "").trim().toLowerCase();
    const payerCpf = normalizeCpf(d?.payerCpf);
    if (!licenseId || !clientUserId) throw new Error("Licença/cliente inválidos");
    if (payerName.length < 2) throw new Error("Nome inválido");
    if (payerLastName.length < 2) throw new Error("Sobrenome inválido");
    if (!isEmail(payerEmail)) throw new Error("Email inválido");
    if (payerCpf.length !== 11) throw new Error("CPF inválido");
    return { licenseId, clientUserId, payerName, payerLastName, payerEmail, payerCpf };
  })
  .handler(async ({ data }) => {
    const ext = await extAdmin();
    const { data: lic } = await ext
      .from("hyro_extension_licenses")
      .select("id, user_id, reseller_id, created_by, expires_at, status")
      .eq("id", data.licenseId)
      .maybeSingle();
    if (!lic) throw new Error("Licença não encontrada");
    if ((lic as any).user_id !== data.clientUserId) throw new Error("Licença não pertence a este cliente");
    const resellerId = (lic as any).reseller_id ?? (lic as any).created_by ?? null;
    if (!resellerId) throw new Error("Licença sem revendedor vinculado");

    const sb = await admin();
    const { data: pricing } = await sb
      .from("hyro_reseller_pricing")
      .select("renewal_price_cents, renewal_days, active")
      .eq("reseller_user_id", resellerId)
      .maybeSingle();
    if (!pricing || !(pricing as any).active) throw new Error("Revendedor sem preço de renovação configurado");

    const { data: mp } = await sb
      .from("hyro_payment_integrations")
      .select("access_token, active, mode")
      .eq("user_id", resellerId)
      .eq("provider", "mercadopago")
      .maybeSingle();
    if (!mp || !(mp as any).active) throw new Error("Revendedor sem gateway ativo");

    const priceCents = (pricing as any).renewal_price_cents as number;
    const renewalDays = (pricing as any).renewal_days as number;
    const amountReais = priceCents / 100;

    // Insere pedido
    const { data: order, error: orderErr } = await sb
      .from("hyro_payment_orders")
      .insert({
        client_user_id: data.clientUserId,
        reseller_user_id: resellerId,
        license_id: data.licenseId,
        provider: "mercadopago",
        amount_cents: priceCents,
        renewal_days: renewalDays,
        status: "pending",
        payer_name: `${data.payerName} ${data.payerLastName}`.slice(0, 200),
        payer_email: data.payerEmail,
        payer_cpf: data.payerCpf,
      } as any)
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Falha ao criar pedido");

    const orderId = (order as any).id as string;
    const notificationUrl = `https://hyrolovable.lovable.app/api/public/mercadopago/webhook?r=${encodeURIComponent(resellerId)}`;

    const { mpCreatePixPayment } = await import("./mp.server");
    const created = await mpCreatePixPayment({
      accessToken: (mp as any).access_token,
      amount: amountReais,
      description: `Renovação de licença ${data.licenseId}`,
      externalReference: orderId,
      notificationUrl,
      payer: {
        email: data.payerEmail,
        first_name: data.payerName,
        last_name: data.payerLastName,
        cpf: data.payerCpf,
      },
      expirationMinutes: 30,
    });

    if (!created.ok) {
      await sb.from("hyro_payment_orders").update({ status: "rejected", raw_payload: { error: created.message } as any }).eq("id", orderId);
      throw new Error(created.message);
    }

    const p = created.payment;
    const qrCode = p.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrBase64 = p.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    const ticketUrl = p.point_of_interaction?.transaction_data?.ticket_url ?? null;
    const expiresAtIso = p.date_of_expiration ?? new Date(Date.now() + 30 * 60_000).toISOString();

    await sb.from("hyro_payment_orders").update({
      provider_payment_id: String(p.id),
      qr_code: qrCode,
      qr_code_base64: qrBase64,
      ticket_url: ticketUrl,
      expires_at: expiresAtIso,
      external_reference: orderId,
      raw_payload: p as any,
    }).eq("id", orderId);

    return {
      orderId,
      paymentId: String(p.id),
      qrCode,
      qrCodeBase64: qrBase64,
      ticketUrl,
      expiresAt: expiresAtIso,
      amountCents: priceCents,
      renewalDays,
      status: p.status,
    };
  });

export const checkOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: string; clientUserId: string }) => {
    const orderId = String(d?.orderId ?? "").trim();
    const clientUserId = String(d?.clientUserId ?? "").trim();
    if (!orderId || !clientUserId) throw new Error("orderId/clientUserId obrigatórios");
    return { orderId, clientUserId };
  })
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: order } = await sb
      .from("hyro_payment_orders")
      .select("id, status, provider_payment_id, reseller_user_id, client_user_id, license_id, renewal_days, paid_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    if ((order as any).client_user_id !== data.clientUserId) throw new Error("Acesso negado");

    // Se já aprovado, retorna direto.
    if ((order as any).status === "approved") {
      return { status: "approved", paidAt: (order as any).paid_at as string | null };
    }

    // Poll ativo no MP (backup ao webhook)
    const paymentId = (order as any).provider_payment_id as string | null;
    if (paymentId) {
      const { data: mp } = await sb
        .from("hyro_payment_integrations")
        .select("access_token")
        .eq("user_id", (order as any).reseller_user_id)
        .eq("provider", "mercadopago")
        .maybeSingle();
      if (mp) {
        const { mpGetPayment } = await import("./mp.server");
        const r = await mpGetPayment((mp as any).access_token, paymentId);
        if (r.ok) {
          const st = r.payment.status ?? "pending";
          if (st === "approved" && (order as any).status !== "approved") {
            await settlePaidOrder({
              orderId: data.orderId,
              licenseId: (order as any).license_id as string,
              renewalDays: (order as any).renewal_days as number,
              rawPayment: r.payment as unknown as Record<string, unknown>,
            });
            return { status: "approved", paidAt: new Date().toISOString() };
          }
          if (st === "rejected" || st === "cancelled" || st === "refunded") {
            await sb.from("hyro_payment_orders").update({ status: st }).eq("id", data.orderId);
            return { status: st };
          }
        }
      }
    }
    return { status: (order as any).status as string };
  });

// Extends license expires_at by renewal_days. Idempotent.
async function settlePaidOrder(input: {
  orderId: string;
  licenseId: string;
  renewalDays: number;
  rawPayment: Record<string, unknown>;
}) {
  const sb = await admin();
  const { data: existing } = await sb.from("hyro_payment_orders").select("status").eq("id", input.orderId).maybeSingle();
  if ((existing as any)?.status === "approved") return;

  await sb.from("hyro_payment_orders").update({
    status: "approved",
    paid_at: new Date().toISOString(),
    raw_payload: input.rawPayment as any,
  }).eq("id", input.orderId);

  const ext = await extAdmin();
  const { data: lic } = await ext
    .from("hyro_extension_licenses")
    .select("id, expires_at, status")
    .eq("id", input.licenseId)
    .maybeSingle();
  if (!lic) return;

  const now = Date.now();
  const currentExpiry = (lic as any).expires_at ? new Date((lic as any).expires_at).getTime() : now;
  const base = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(base + input.renewalDays * 24 * 60 * 60 * 1000).toISOString();

  await ext.from("hyro_extension_licenses").update({
    expires_at: newExpiry,
    status: "ativa",
  }).eq("id", input.licenseId);
}

// Exposed for webhook route.
export { settlePaidOrder as _settlePaidOrder };
