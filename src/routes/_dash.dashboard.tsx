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
      accent: "from-violet-500/20 to-violet-500/0",
      iconClass: "text-violet-500 bg-violet-500/10",
    },
    {
      label: "Usuários Online",
      value: data?.onlineSessions ?? 0,
      icon: Activity,
      accent: "from-emerald-500/20 to-emerald-500/0",
      iconClass: "text-emerald-500 bg-emerald-500/10",
    },
    {
      label: "Revendedores Ativos",
      value: data?.activeResellers ?? 0,
      icon: Users,
      accent: "from-amber-500/20 to-amber-500/0",
      iconClass: "text-amber-500 bg-amber-500/10",
    },
    {
      label: "Ativações (30d)",
      value: data?.chart.reduce((a, b) => a + b.count, 0) ?? 0,
      icon: TrendingUp,
      accent: "from-sky-500/20 to-sky-500/0",
      iconClass: "text-sky-500 bg-sky-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas principais e crescimento de ativações em tempo real.
          </p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-1.5">
          Atualizado agora · {new Date().toLocaleTimeString("pt-BR")}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            className="relative p-5 border-border/60 overflow-hidden shadow-elegant"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${c.accent} pointer-events-none opacity-60`}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {c.label}
                </div>
                <div className="text-3xl font-semibold mt-2 tracking-tight">
                  {isLoading ? "—" : c.value.toLocaleString("pt-BR")}
                </div>
              </div>
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.iconClass}`}
              >
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 border-border/60 shadow-elegant">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold">Ativações (últimos 30 dias)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Novas licenças criadas por dia
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" /> Ativações
            </span>
          </div>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chart ?? []} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: "var(--shadow-elegant)",
                }}
                labelStyle={{ color: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#cGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
