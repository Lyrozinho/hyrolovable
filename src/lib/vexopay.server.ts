// Server-only helpers for VexoPay integration.
// Do NOT import this from client bundles — it reads process.env at call time.

const BASE_URL = process.env.VEXOPAY_BASE_URL || "https://api.vexopay.com";

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
  const body: Record<string, unknown> = {
    amount: input.amountCents,
    description: input.description,
    external_id: input.externalId,
  };
  if (input.customer) {
    const c = input.customer;
    if (c.name) body.customer_name = c.name;
    if (c.document) body.customer_document = c.document;
    if (c.email) body.customer_email = c.email;
    body.customer = {
      name: c.name || undefined,
      document: c.document || undefined,
      email: c.email || undefined,
    };
  }

  // Try known endpoint paths in order.
  const paths = ["/v1/pix/create", "/gateway/pix-create", "/v1/pix-create"];
  let last: { status: number; json: any; text: string } | null = null;
  for (const p of paths) {
    try {
      const r = await callJson(p, { method: "POST", body: JSON.stringify(body) });
      last = r;
      if (r.status >= 200 && r.status < 300) {
        const data = r.json ?? {};
        const inner = data.data ?? data.result ?? data;
        const id = pick<string>(inner, ["id", "transaction_id", "transactionId", "external_id", "externalId"]) ?? input.externalId;
        const qrB64 = pick<string>(inner, [
          "qrCodeBase64","qr_code_base64","qrcodeBase64","qrcode_base64",
          "pix.qrCodeBase64","pix.qr_code_base64","qr.image","qrImage",
        ]);
        const qrText = pick<string>(inner, [
          "qrCode","qr_code","copyPaste","copy_paste","emv","brcode","brCode",
          "pix.qrCode","pix.copyPaste","pix.brcode","qr.text","payload",
        ]);
        const expiresAt = pick<string>(inner, ["expires_at","expiresAt","expiration","expiration_date"]);
        const status = pick<string>(inner, ["status","state"]);
        return { ok: true, id: String(id), qrCodeBase64: qrB64, qrCodeText: qrText, expiresAt, status, raw: data };
      }
      // If not 404, don't try other paths.
      if (r.status !== 404) break;
    } catch (err) {
      console.error("[vexopay] request error", p, err);
    }
  }
  const s = last?.status ?? 500;
  const msg = pick<string>(last?.json, ["message","error","detail","errors.0.message"]) || last?.text || "Falha ao criar PIX";
  return { ok: false, status: s, message: String(msg).slice(0, 300), raw: last?.json ?? last?.text ?? null };
}

export async function checkPixStatus(id: string): Promise<{ ok: true; status: string; raw: any } | PixErrorResult> {
  const paths = [`/v1/pix/status/${encodeURIComponent(id)}`, `/v1/pix/${encodeURIComponent(id)}`, `/gateway/pix-status/${encodeURIComponent(id)}`, `/v1/pix/status?id=${encodeURIComponent(id)}`];
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
