import { supabase as cloud } from "@/integrations/supabase/client";

const IP_KEY = "hyro_client_ip";

async function resolveIp(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.sessionStorage.getItem(IP_KEY);
    if (cached) return cached;
  } catch {
    // storage not available
  }
  try {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { ip?: string };
    const ip = json.ip ?? null;
    if (ip) {
      try { window.sessionStorage.setItem(IP_KEY, ip); } catch { /* ignore */ }
    }
    return ip;
  } catch {
    return null;
  }
}

export type ActivityActor = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export async function logActivity(
  actor: ActivityActor,
  event: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const email = (actor.email ?? "").trim().toLowerCase() || null;
    if (!email && !actor.id) return;
    const ip = await resolveIp();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : null;
    await (cloud as any).from("hyro_reseller_activity").insert({
      actor_id: actor.id ?? null,
      actor_email: email,
      actor_role: actor.role ?? null,
      event,
      metadata,
      ip,
      user_agent: ua,
      path,
    });
  } catch (error) {
    // logging is best-effort; never break the app flow
    console.warn("[activity] falha ao registrar", event, error);
  }
}

export async function heartbeatPresence(actor: ActivityActor) {
  try {
    const email = (actor.email ?? "").trim().toLowerCase();
    if (!email) return;
    const ip = await resolveIp();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : null;
    await (cloud as any)
      .from("hyro_reseller_presence")
      .upsert(
        {
          actor_id: actor.id ?? null,
          actor_email: email,
          actor_role: actor.role ?? null,
          actor_name: actor.name ?? null,
          last_seen: new Date().toISOString(),
          ip,
          user_agent: ua,
          path,
        },
        { onConflict: "actor_email" },
      );
  } catch (error) {
    console.warn("[presence] falha no heartbeat", error);
  }
}

export type ActivityRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  event: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  path: string | null;
  created_at: string;
};

export type PresenceRow = {
  actor_id: string | null;
  actor_email: string;
  actor_role: string | null;
  actor_name: string | null;
  last_seen: string;
  ip: string | null;
  user_agent: string | null;
  path: string | null;
};

export const ONLINE_WINDOW_MS = 90_000;

export function isOnline(lastSeenIso: string | null | undefined) {
  if (!lastSeenIso) return false;
  const t = new Date(lastSeenIso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < ONLINE_WINDOW_MS;
}
