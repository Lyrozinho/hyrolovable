import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { KeyRound, Users, Activity, TrendingUp } from "lucide-react";
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

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dash-stats"], queryFn: fetchStats });

  const cards = [
    {
      label: "Licenças Ativas",
      value: data?.activeLicenses ?? 0,
      icon: KeyRound,
    },
    {
      label: "Usuários Online",
      value: data?.onlineSessions ?? 0,
      icon: Activity,
    },
    {
      label: "Revendedores Ativos",
      value: data?.activeResellers ?? 0,
      icon: Users,
    },
    {
      label: "Total últimos 30 dias",
      value: data?.chart.reduce((a, b) => a + b.count, 0) ?? 0,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">
          Métricas principais e crescimento de ativações.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 border-border/60">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-semibold mt-2">
                  {isLoading ? "—" : c.value.toLocaleString()}
                </div>
              </div>
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 border-border/60">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Ativações (últimos 30 dias)</h2>
          <p className="text-xs text-muted-foreground">Novas licenças criadas por dia</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chart ?? []}>
              <defs>
                <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#cGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
