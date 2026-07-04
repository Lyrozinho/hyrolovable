import { supabase as cloud } from "@/integrations/supabase/client";

export type RedemptionLink = {
  slug: string;
  license_id: string | null;
  target_email: string;
  target_name: string | null;
  locked_ip: string | null;
  claimed_user_id: string | null;
  claimed_at: string | null;
  created_by: string;
  created_at: string;
  kind?: "license" | "reseller" | string;
  reseller_slots?: number | null;
  reseller_owner_id?: string | null;
};

const IP_CACHE_KEY = "hyro_client_ip";

/** Retrieve visitor's public IP (best-effort). */
export async function getClientIP(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const cached = sessionStorage.getItem(IP_CACHE_KEY);
    if (cached) return cached;
  } catch {}
  const endpoints = [
    "https://api.ipify.org?format=json",
    "https://ipapi.co/json/",
    "https://api.myip.com",
  ];
  for (const u of endpoints) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      const ip = (j.ip || j.query || "").toString().trim();
      if (ip) {
        try { sessionStorage.setItem(IP_CACHE_KEY, ip); } catch {}
        return ip;
      }
    } catch {}
  }
  return "";
}

export function generateSlug(): string {
  const alpha = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alpha[b % alpha.length]).join("");
}

export async function fetchLink(slug: string): Promise<RedemptionLink | null> {
  const { data } = await (cloud as any)
    .from("hyro_redemption_links")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as RedemptionLink | null) ?? null;
}

export async function createLink(input: {
  license_id: string;
  target_email: string;
  target_name?: string | null;
  created_by: string;
}): Promise<RedemptionLink> {
  const slug = generateSlug();
  const { data, error } = await (cloud as any)
    .from("hyro_redemption_links")
    .insert({
      slug,
      license_id: input.license_id,
      target_email: input.target_email.trim().toLowerCase(),
      target_name: input.target_name ?? null,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as RedemptionLink;
}

export async function listLinksForLicense(license_id: string): Promise<RedemptionLink[]> {
  const { data } = await (cloud as any)
    .from("hyro_redemption_links")
    .select("*")
    .eq("license_id", license_id)
    .order("created_at", { ascending: false });
  return (data as RedemptionLink[]) ?? [];
}

export async function deleteLink(slug: string) {
  const { error } = await (cloud as any).from("hyro_redemption_links").delete().eq("slug", slug);
  if (error) throw error;
}

/** Locks link to given IP if not yet locked. Returns updated link or throws when denied. */
export async function bindOrCheckIP(slug: string, ip: string): Promise<RedemptionLink> {
  const link = await fetchLink(slug);
  if (!link) throw new Error("Link inválido ou removido.");
  if (!ip) throw new Error("Não foi possível identificar seu IP. Tente novamente.");
  if (!link.locked_ip) {
    const { data, error } = await (cloud as any)
      .from("hyro_redemption_links")
      .update({ locked_ip: ip })
      .eq("slug", slug)
      .is("locked_ip", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (data) return data as RedemptionLink;
    // Race: someone else locked. Refetch.
    const fresh = await fetchLink(slug);
    if (!fresh) throw new Error("Link inválido.");
    if (fresh.locked_ip !== ip) throw new Error("Este link já está vinculado a outro acesso.");
    return fresh;
  }
  if (link.locked_ip !== ip) {
    throw new Error("Este link já está vinculado a outro acesso.");
  }
  return link;
}

export async function markLinkClaimed(slug: string, user_id: string) {
  await (cloud as any)
    .from("hyro_redemption_links")
    .update({ claimed_user_id: user_id, claimed_at: new Date().toISOString() })
    .eq("slug", slug);
}

// ---- user flags ----
export type UserFlags = {
  user_email: string;
  welcome_seen: boolean;
  tutorial_seen: boolean;
  first_ip: string | null;
};

export async function fetchUserFlags(email: string): Promise<UserFlags | null> {
  const { data } = await (cloud as any)
    .from("hyro_user_flags")
    .select("*")
    .eq("user_email", email.toLowerCase())
    .maybeSingle();
  return (data as UserFlags | null) ?? null;
}

export async function upsertUserFlags(email: string, patch: Partial<UserFlags>) {
  const emailNorm = email.toLowerCase();
  await (cloud as any)
    .from("hyro_user_flags")
    .upsert({ user_email: emailNorm, ...patch }, { onConflict: "user_email" });
}
