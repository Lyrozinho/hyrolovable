import { useEffect, useState, useCallback } from "react";
import { supabase as cloud } from "@/integrations/supabase/client";
import { supabase as ext } from "@/lib/supabase";

export const OWNER_EMAIL = "adminpainel@gmail.com";

export type MenuKey = "licenses" | "resellers" | "subscription" | "tutorials";

export type SidePerms = {
  licenses: boolean;
  resellers: boolean;
  subscription: boolean;
  tutorials: boolean;
};

export type LicensePerms = {
  package_slots: number; // quantidade de revendas que a licença pode criar
  unlimited: boolean;    // ignora package_slots
  owner: SidePerms;      // abas visíveis para o dono da licença
  resellers: SidePerms;  // abas visíveis para os revendedores criados por ele
};

export const DEFAULT_PERMS: LicensePerms = {
  package_slots: 0,
  unlimited: false,
  owner: { licenses: false, resellers: false, subscription: true, tutorials: true },
  // Revendedor: agora enxerga a aba Licenças por padrão (para criar/gerenciar as próprias).
  resellers: { licenses: true, resellers: false, subscription: true, tutorials: true },
};

export function mergePerms(raw: unknown): LicensePerms {
  const p = (raw ?? {}) as Partial<LicensePerms>;
  return {
    package_slots: Number((p as any).package_slots ?? 0) || 0,
    unlimited: !!(p as any).unlimited,
    owner: { ...DEFAULT_PERMS.owner, ...((p as any).owner ?? {}) },
    resellers: { ...DEFAULT_PERMS.resellers, ...((p as any).resellers ?? {}) },
  };
}

export async function fetchLicensePerms(licenseId: string): Promise<LicensePerms> {
  const { data } = await cloud
    .from("hyro_license_permissions")
    .select("perms")
    .eq("license_id", licenseId)
    .maybeSingle();
  return mergePerms((data as any)?.perms);
}

export async function saveLicensePerms(licenseId: string, perms: LicensePerms) {
  const { error } = await cloud
    .from("hyro_license_permissions")
    .upsert({ license_id: licenseId, perms: perms as any }, { onConflict: "license_id" });
  if (error) throw error;
}

export function useLicensePerms(licenseId?: string | null) {
  const [perms, setPerms] = useState<LicensePerms | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!licenseId) return;
    setLoading(true);
    try { setPerms(await fetchLicensePerms(licenseId)); } finally { setLoading(false); }
  }, [licenseId]);
  useEffect(() => { load(); }, [load]);
  return { perms, loading, reload: load, setPerms };
}

// Retorna a licença "principal" (ativa, não expirada, não teste) do usuário.
export async function fetchPrimaryLicenseForUser(userId: string): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data } = await ext
    .from("hyro_extension_licenses")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("status", "ativa")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });
  const first = (data ?? []).find((l: any) => !String(l.id).startsWith("TST-"));
  return first?.id ?? null;
}

// Se o usuário é revendedor, retorna a licença do "dono" que o criou.
export async function fetchParentLicenseForReseller(resellerId: string): Promise<string | null> {
  const { data: link } = await (cloud as any)
    .from("hyro_redemption_links")
    .select("reseller_owner_id")
    .eq("kind", "reseller")
    .eq("claimed_user_id", resellerId)
    .not("reseller_owner_id", "is", null)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let parentId = (link as any)?.reseller_owner_id ?? null;

  // Compatibilidade com contas antigas, sem depender desta coluna existir.
  if (!parentId) {
    const { data: u, error } = await ext
      .from("hyro_extension_users")
      .select("created_by")
      .eq("id", resellerId)
      .maybeSingle();
    if (!error) parentId = (u as any)?.created_by ?? null;
  }
  if (!parentId) return null;
  return fetchPrimaryLicenseForUser(parentId);
}
