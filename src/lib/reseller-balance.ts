import { supabase } from "@/lib/supabase";

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function getResellerBalance(resellerId: string): Promise<number> {
  if (!resellerId) return 0;
  const { data, error } = await supabase.rpc("admin_adjust_reseller_balance", {
    p_reseller_id: resellerId,
    p_delta: 0,
    p_note: "Leitura de saldo",
  });
  if (!error) return Math.max(0, asInt(data));

  const { data: row, error: readError } = await supabase
    .from("hyro_reseller_balances")
    .select("balance")
    .eq("reseller_id", resellerId)
    .maybeSingle();
  if (readError) throw readError;
  return Math.max(0, asInt((row as any)?.balance));
}

async function writeResellerBalance(resellerId: string, balance: number) {
  const safeBalance = Math.max(0, asInt(balance));
  const { error } = await supabase
    .from("hyro_reseller_balances")
    .upsert(
      { reseller_id: resellerId, balance: safeBalance },
      { onConflict: "reseller_id" },
    );
  if (error) throw error;
  return safeBalance;
}

export async function setResellerBalance(resellerId: string, targetBalance: number, note?: string | null) {
  const target = Math.max(0, asInt(targetBalance));
  const current = await getResellerBalance(resellerId).catch(() => 0);
  const delta = target - current;
  if (delta === 0) return current;

  const { data, error } = await supabase.rpc("admin_adjust_reseller_balance", {
    p_reseller_id: resellerId,
    p_delta: delta,
    p_note: note ?? null,
  });
  if (!error) return Math.max(0, asInt(data));

  try {
    return await writeResellerBalance(resellerId, target);
  } catch {
    throw error;
  }
}

export async function adjustResellerBalance(input: {
  resellerId: string;
  delta: number;
  note?: string | null;
}) {
  const delta = asInt(input.delta);
  if (!input.resellerId) throw new Error("Revendedor inválido.");
  if (delta === 0) return getResellerBalance(input.resellerId);

  const before = await getResellerBalance(input.resellerId).catch(() => 0);
  if (before + delta < 0) {
    throw new Error("Saldo insuficiente para debitar essa quantidade.");
  }

  const target = before + delta;

  const { data, error } = await supabase.rpc("admin_adjust_reseller_balance", {
    p_reseller_id: input.resellerId,
    p_delta: delta,
    p_note: input.note ?? null,
  });
  if (!error) return Math.max(0, asInt(data));

  try {
    return await writeResellerBalance(input.resellerId, target);
  } catch {
    throw error;
  }
}

export async function consumeResellerLicenseCredit(resellerId: string) {
  const current = await getResellerBalance(resellerId);
  if (current <= 0) {
    throw new Error("Sem licenças disponíveis. Adicione créditos antes de criar novas licenças.");
  }
  return adjustResellerBalance({
    resellerId,
    delta: -1,
    note: "Consumo automático ao criar licença",
  });
}