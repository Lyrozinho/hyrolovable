import { createServerFn } from "@tanstack/react-start";

export type PixChargeInput = {
  planId: string;
  planName: string;
  amountCents: number;
  customerName: string;
  customerDocument: string;
  customerEmail?: string;
};

export const createVexoPayPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: PixChargeInput) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos");
    const amount = Math.trunc(Number(data.amountCents));
    if (!Number.isFinite(amount) || amount < 100) throw new Error("Valor inválido (mínimo R$ 1,00)");
    const name = String(data.customerName ?? "").trim();
    if (name.length < 3) throw new Error("Nome completo é obrigatório");
    const doc = String(data.customerDocument ?? "").replace(/\D+/g, "");
    if (doc.length !== 11) throw new Error("CPF inválido — informe 11 dígitos");
    const planId = String(data.planId ?? "").slice(0, 40);
    const planName = String(data.planName ?? "").slice(0, 80) || "Pacote Hyro";
    const email = data.customerEmail ? String(data.customerEmail).trim().slice(0, 120) : undefined;
    return { planId, planName, amountCents: amount, customerName: name.slice(0, 120), customerDocument: doc, customerEmail: email };
  })
  .handler(async ({ data }) => {
    const { createPixCharge } = await import("./vexopay.server");
    const externalId = `hyro-${data.planId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const description = `Hyro ${data.planName}`.slice(0, 80);
    const r = await createPixCharge({
      amountCents: data.amountCents,
      description,
      externalId,
      customer: {
        name: data.customerName,
        document: data.customerDocument,
        email: data.customerEmail,
      },
    });
    if (!r.ok) throw new Error(r.message || "Falha ao gerar cobrança PIX");
    return {
      id: r.id,
      qrCodeBase64: r.qrCodeBase64,
      qrCodeText: r.qrCodeText,
      expiresAt: r.expiresAt,
      status: r.status,
      externalId,
      amountCents: data.amountCents,
    };
  });

export const checkVexoPayPixStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => {
    const id = String(data?.id ?? "").trim();
    if (!id) throw new Error("id obrigatório");
    return { id };
  })
  .handler(async ({ data }) => {
    const { checkPixStatus } = await import("./vexopay.server");
    const r = await checkPixStatus(data.id);
    if (!r.ok) return { status: "unknown", error: r.message };
    return { status: r.status };
  });
