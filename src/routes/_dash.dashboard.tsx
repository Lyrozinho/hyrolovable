import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { KeyRound, Users, Activity, TrendingUp, ArrowUpRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export const Route = createFileRoute("/_dash/dashboard")({
  component: DashboardPage,
});

type Stats = {
  activeLicenses: number;
  onlineSessions: number;
  activeResellers: number;
  chart: { date: string; count: number }[];
};

async function fetchStats(): Promise<Stats> {
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

  const buckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    buckets[d] = 0;
  }
  (licList.data ?? []).forEach((r: { created_at: string }) => {
    const d = r.created_at.slice(0, 10);
    if (d in buckets) buckets[d]++;
  });

  return {
    activeLicenses: licRes.count ?? 0,
    onlineSessions: sessRes.count ?? 0,
    activeResellers: resRes.count ?? 0,
    chart: Object.entries(buckets).map(([date, count]) => ({ date, count })),
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof KeyRound;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="group relative rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold tracking-tight tabular-nums leading-none">
          {loading ? "—" : value.toLocaleString("pt-BR")}
        </span>
        {hint && !loading && (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dash-stats"], queryFn: fetchStats });

  const total30 = data?.chart.reduce((a, b) => a + b.count, 0) ?? 0;
  const total15 = data?.chart.slice(-15).reduce((a, b) => a + b.count, 0) ?? 0;
  const prev15 = data?.chart.slice(0, 15).reduce((a, b) => a + b.count, 0) ?? 0;
  const delta = prev15 === 0 ? (total15 > 0 ? 100 : 0) : ((total15 - prev15) / prev15) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
            Visão geral
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Indicadores em tempo real do ambiente de licenças.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Sincronizado · {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Licenças ativas"
          value={data?.activeLicenses ?? 0}
          icon={KeyRound}
          loading={isLoading}
        />
        <StatCard
          label="Sessões online"
          value={data?.onlineSessions ?? 0}
          icon={Activity}
          hint="agora"
          loading={isLoading}
        />
        <StatCard
          label="Revendedores"
          value={data?.activeResellers ?? 0}
          icon={Users}
          hint="ativos"
          loading={isLoading}
        />
        <StatCard
          label="Ativações · 30d"
          value={total30}
          icon={TrendingUp}
          hint={
            delta === 0
              ? "estável"
              : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% vs. período anterior`
          }
          loading={isLoading}
        />
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-end justify-between flex-wrap gap-3 px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-[14px] font-semibold leading-tight">Ativações por dia</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Novas licenças criadas nos últimos 30 dias
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-foreground" /> Ativações
            </span>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-foreground hover:opacity-70"
            >
              Ver relatório <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="h-[320px] w-full px-3 pt-4 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chart ?? []} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                fontSize={10.5}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(d) => {
                  const [, m, day] = d.split("-");
                  return `${day}/${m}`;
                }}
                minTickGap={24}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={10.5}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  padding: "6px 10px",
                  boxShadow: "var(--shadow-md)",
                }}
                labelStyle={{ color: "var(--color-muted-foreground)", fontSize: 11, marginBottom: 2 }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-foreground)"
                strokeWidth={1.5}
                fill="url(#cGrad)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: "var(--color-foreground)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
