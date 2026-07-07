// Server-only helpers for VexoPay integration.
// Do NOT import this from client bundles — it reads process.env at call time.

// VexoPay's production gateway is served from the main site.
// The API's `api.vexopay.com` host in the public docs currently returns a
// TLS SNI error at Cloudflare (surfaces in the browser as HTTP 525).
const BASE_URL = process.env.VEXOPAY_BASE_URL || "https://www.vexopay.com.br";

export type PixCreateInput = {
  amountCents: number;
  description: string;
  externalId: string;
  customer?: {
    name?: string | null;
    document?: string | null;
    email?: string | null;
  };
};

export type PixCreateResult = {
  ok: true;
  id: string;
  qrCodeBase64: string | null;
  qrCodeText: string | null;
  expiresAt: string | null;
  status: string | null;
  raw: unknown;
};

export type PixErrorResult = {
  ok: false;
  status: number;
  message: string;
  raw: unknown;
};

function getCreds() {
  const ci = process.env.VEXOPAY_CLIENT_ID;
  const cs = process.env.VEXOPAY_CLIENT_SECRET;
  if (!ci || !cs) throw new Error("VexoPay não configurado: defina VEXOPAY_CLIENT_ID e VEXOPAY_CLIENT_SECRET.");
  return { ci, cs };
}

function pick<T = string>(obj: any, keys: string[]): T | null {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const parts = k.split(".");
    let cur: any = obj;
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (cur != null && cur !== "") return cur as T;
  }
  return null;
}

async function callJson(path: string, init: RequestInit): Promise<{ status: number; json: any; text: string }> {
  const { ci, cs } = getCreds();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ci,
      cs,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json, text };
}

export async function createPixCharge(input: PixCreateInput): Promise<PixCreateResult | PixErrorResult> {
  const c = input.customer ?? {};
  const documentDigits = (c.document || "").replace(/\D/g, "");
  const amountReais = Math.round(input.amountCents) / 100;

  // Payload shape per VexoPay docs: amount in BRL (number), payerName, payerDocument (digits).
  const body: Record<string, unknown> = {
    amount: Number(amountReais.toFixed(2)),
    payerName: (c.name || "Cliente").toString().slice(0, 120),
    payerDocument: documentDigits,
    description: input.description,
  };

  const r = await callJson("/api/gateway/pix-create", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (r.status >= 200 && r.status < 300 && r.json?.success !== false) {
    const data = r.json ?? {};
    const inner = data.data ?? data.result ?? data;
    const id =
      pick<string>(inner, ["transactionId", "transaction_id", "id", "externalId"]) ??
      input.externalId;
    const qrB64 = pick<string>(inner, ["qrCodeBase64", "qr_code_base64", "qrCodeUrl"]);
    const qrText = pick<string>(inner, ["copyPaste", "copy_paste", "qrCode", "qr_code", "brcode", "emv"]);
    const expiresAt = pick<string>(inner, ["expiresAt", "expires_at", "expiration"]);
    const status = pick<string>(inner, ["status", "state"]);
    return { ok: true, id: String(id), qrCodeBase64: qrB64, qrCodeText: qrText, expiresAt, status, raw: data };
  }

  const providerMsg =
    pick<string>(r.json, ["error", "message", "detail", "errors.0.message"]) ||
    (r.text ? r.text.slice(0, 200) : "") ||
    "Falha ao criar PIX";
  const providerCode = pick<string>(r.json, ["errorCode", "code"]);
  const msg = providerCode ? `${providerMsg} [${providerCode}]` : providerMsg;
  return { ok: false, status: r.status || 500, message: String(msg).slice(0, 400), raw: r.json ?? r.text ?? null };
}

export async function checkPixStatus(id: string): Promise<{ ok: true; status: string; raw: any } | PixErrorResult> {
  const paths = [
    `/api/gateway/pix-status?transactionId=${encodeURIComponent(id)}`,
    `/api/gateway/pix-status?id=${encodeURIComponent(id)}`,
    `/v1/pix/status/${encodeURIComponent(id)}`,
    `/gateway/pix-status/${encodeURIComponent(id)}`,
  ];
  let last: { status: number; json: any; text: string } | null = null;
  for (const p of paths) {
    try {
      const r = await callJson(p, { method: "GET" });
      last = r;
      if (r.status >= 200 && r.status < 300) {
        const inner = (r.json?.data ?? r.json?.result ?? r.json) ?? {};
        const status = pick<string>(inner, ["status","state"]) ?? "unknown";
        return { ok: true, status: String(status).toLowerCase(), raw: r.json };
      }
      if (r.status !== 404) break;
    } catch (err) {
      console.error("[vexopay] status error", p, err);
    }
  }
  const s = last?.status ?? 500;
  const msg = pick<string>(last?.json, ["message","error","detail"]) || last?.text || "Falha ao consultar status";
  return { ok: false, status: s, message: String(msg).slice(0, 300), raw: last?.json ?? last?.text ?? null };
}
