import { supabase } from "@/lib/supabase";
import { queryOptions } from "@tanstack/react-query";

export type DashboardStats = {
  activeLicenses: number;
  onlineSessions: number;
  activeResellers: number;
  chart: { date: string; count: number }[];
};

const STATS_SNAPSHOT_KEY = "hyro_dashboard_stats_snapshot";

export function readDashboardStatsSnapshot(): DashboardStats | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STATS_SNAPSHOT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as DashboardStats;
    if (!Array.isArray(parsed.chart)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeDashboardStatsSnapshot(stats: DashboardStats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_SNAPSHOT_KEY, JSON.stringify(stats));
  } catch {
    // cache local é só aceleração visual; falha não bloqueia o painel
  }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const nowIso = new Date().toISOString();

  const [licRes, sessRes, resRes, licList] = await Promise.all([
    supabase
      .from("hyro_extension_licenses")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativa")
      .gt("expires_at", nowIso),
    supabase
      .from("hyro_extension_sessions")
      .select("token", { count: "exact", head: true })
      .gt("expires_at", nowIso),
    supabase
      .from("hyro_extension_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "reseller")
      .eq("active", true),
    supabase
      .from("hyro_extension_licenses")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString()),
  ]);

  const firstError = licRes.error ?? sessRes.error ?? resRes.error ?? licList.error;
  if (firstError) throw firstError;

  const buckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    buckets[d] = 0;
  }
  (licList.data ?? []).forEach((r: { created_at: string }) => {
    const d = r.created_at.slice(0, 10);
    if (d in buckets) buckets[d]++;
  });

  const stats = {
    activeLicenses: licRes.count ?? 0,
    onlineSessions: sessRes.count ?? 0,
    activeResellers: resRes.count ?? 0,
    chart: Object.entries(buckets).map(([date, count]) => ({ date, count })),
  };
  writeDashboardStatsSnapshot(stats);
  return stats;
}

export function dashboardStatsQueryOptions() {
  return queryOptions({
    queryKey: ["dash-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });

}

export async function warmDashboardStatsSnapshot() {
  return fetchDashboardStats().catch(() => undefined);
}