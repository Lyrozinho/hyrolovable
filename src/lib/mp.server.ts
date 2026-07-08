// Mercado Pago API server-only helpers (never import from client bundles).
// Docs: https://www.mercadopago.com.br/developers/pt/reference

const MP_BASE = "https://api.mercadopago.com";

function authHeaders(accessToken: string, idempotencyKey?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) h["X-Idempotency-Key"] = idempotencyKey;
  return h;
}

export type MPUser = { id: number; nickname?: string; email?: string; site_id?: string; country_id?: string };

export async function mpGetMe(accessToken: string): Promise<{ ok: true; user: MPUser } | { ok: false; status: number; message: string }> {
  try {
    const r = await fetch(`${MP_BASE}/users/me`, { headers: authHeaders(accessToken) });
    const text = await r.text();
    if (!r.ok) return { ok: false, status: r.status, message: `MP /users/me falhou: ${text.slice(0, 200)}` };
    const j = JSON.parse(text) as MPUser;
    return { ok: true, user: j };
  } catch (e: any) {
    return { ok: false, status: 0, message: e?.message ?? "Falha de rede ao chamar Mercado Pago" };
  }
}

export type MPPaymentCreate = {
  accessToken: string;
  amount: number; // reais (float)
  description: string;
  externalReference: string;
  notificationUrl: string;
  payer: { email: string; first_name: string; last_name: string; cpf: string };
  expirationMinutes?: number; // default 30
};

export type MPPayment = {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount?: number;
  date_of_expiration?: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export async function mpCreatePixPayment(input: MPPaymentCreate): Promise<{ ok: true; payment: MPPayment } | { ok: false; status: number; message: string }> {
  const expiration = input.expirationMinutes ?? 30;
  const expiresAtIso = new Date(Date.now() + expiration * 60_000).toISOString();
  const body = {
    transaction_amount: Math.round(input.amount * 100) / 100,
    description: input.description.slice(0, 200),
    payment_method_id: "pix",
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    date_of_expiration: expiresAtIso.replace("Z", "-03:00"), // MP requires timezone offset
    payer: {
      email: input.payer.email,
      first_name: input.payer.first_name,
      last_name: input.payer.last_name,
      identification: { type: "CPF", number: input.payer.cpf },
    },
  };
  try {
    const r = await fetch(`${MP_BASE}/v1/payments`, {
      method: "POST",
      headers: authHeaders(input.accessToken, cryptoRandom()),
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, status: r.status, message: `MP payments falhou (${r.status}): ${text.slice(0, 300)}` };
    const j = JSON.parse(text) as MPPayment;
    return { ok: true, payment: j };
  } catch (e: any) {
    return { ok: false, status: 0, message: e?.message ?? "Falha de rede" };
  }
}

export async function mpGetPayment(accessToken: string, paymentId: string | number): Promise<{ ok: true; payment: MPPayment } | { ok: false; status: number; message: string }> {
  try {
    const r = await fetch(`${MP_BASE}/v1/payments/${paymentId}`, { headers: authHeaders(accessToken) });
    const text = await r.text();
    if (!r.ok) return { ok: false, status: r.status, message: `MP get payment falhou (${r.status})` };
    const j = JSON.parse(text) as MPPayment;
    return { ok: true, payment: j };
  } catch (e: any) {
    return { ok: false, status: 0, message: e?.message ?? "Falha de rede" };
  }
}

function cryptoRandom(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Validates MP webhook signature (v1 header).
// Manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>
export function verifyMpWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): boolean {
  if (!opts.xSignature || !opts.xRequestId || !opts.secret) return false;
  // header format: ts=1234,v1=abcdef...
  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${opts.dataId};request-id:${opts.xRequestId};ts:${ts};`;
  // dynamic import to avoid pulling crypto into client bundles
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require("crypto") as typeof import("crypto");
  const hmac = nodeCrypto.createHmac("sha256", opts.secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return nodeCrypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
