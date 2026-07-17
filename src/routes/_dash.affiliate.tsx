import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  TrendingUp, DollarSign, ShoppingBag, Users, Copy, Check, Link2, BarChart3, Loader2, ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { supabase as ext } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getPublicOrigin } from "@/lib/public-origin";

export const Route = createFileRoute("/_dash/affiliate")({
  ssr: false,
  component: AffiliatePage,
});

type Sale = {
  id: string;
  affiliate_user_id: string;
  buyer_user_id: string | null;
  buyer_email: string | null;
  buyer_whatsapp: string | null;
  amount_cents: number;
  commission_cents: number | null;
  code_used: string | null;
  order_id: string | null;
  license_id: string | null;
  status: string;
  created_at: string;
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function AffiliatePage() {
  const { session, sessionKey, authReady } = useAuth();
  const userId = session?.user.id ?? null;

  const { data: me } = useQuery({
    queryKey: ["me-affiliate", sessionKey, userId],
    enabled: authReady && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await ext
        .from("hyro_extension_users")
        .select("id, role, affiliate_code, name, email")
        .eq("id", userId!)
        .maybeSingle();
      return data as any;
    },
  });

  const affiliateCode: string | null = me?.affiliate_code ?? null;
  const role = me?.role ?? null;
  const isEligible = role === "reseller" || session?.user.role === "admin";

  const { data: sales, isLoading } = useQuery({
    queryKey: ["affiliate-sales", sessionKey, userId],
    enabled: authReady && !!userId && isEligible,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await (ext as any)
        .from("hyro_affiliate_sales")
        .select("*")
        .eq("affiliate_user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const stats = useMemo(() => {
    const rows = sales ?? [];
    const paid = rows.filter((r) => ["paid", "confirmed", "approved"].includes((r.status || "").toLowerCase()) || rows === rows);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let total = 0, monthTotal = 0, commission = 0, count = 0, monthCount = 0;
    for (const r of paid) {
      total += r.amount_cents || 0;
      commission += r.commission_cents || 0;
      count++;
      if (new Date(r.created_at).getTime() >= monthStart) {
        monthTotal += r.amount_cents || 0;
        monthCount++;
      }
    }
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, monthTotal, commission, count, monthCount, avg };
  }, [sales]);

  const chartData = useMemo(() => {
    // últimos 30 dias
    const map = new Map<string, number>();
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      map.set(k, 0);
    }
    for (const s of sales ?? []) {
      const k = s.created_at.slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) || 0) + (s.amount_cents || 0));
    }
    return Array.from(map.entries()).map(([date, cents]) => ({
      date: fmtDate(date + "T00:00:00"),
      valor: cents / 100,
    }));
  }, [sales]);

  const topBuyers = useMemo(() => {
    const map = new Map<string, { email: string; total: number; count: number }>();
    for (const s of sales ?? []) {
      const k = s.buyer_email || s.buyer_user_id || "—";
      const cur = map.get(k) ?? { email: k, total: 0, count: 0 };
      cur.total += s.amount_cents || 0;
      cur.count++;
      map.set(k, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((r) => ({ name: (r.email || "—").split("@")[0].slice(0, 12), valor: r.total / 100 }));
  }, [sales]);

  const [copied, setCopied] = useState(false);
  const origin = getPublicOrigin();
  const affLink = affiliateCode ? `${origin}/a/${affiliateCode}` : "";
  const copyLink = async () => {
    if (!affLink) return;
    try {
      await navigator.clipboard.writeText(affLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 1800);
    } catch { toast.error("Falha ao copiar"); }
  };

  const [page, setPage] = useState(0);
  const pageSize = 10;
  const paged = (sales ?? []).slice(page * pageSize, page * pageSize + pageSize);
  const totalPages = Math.max(1, Math.ceil((sales?.length ?? 0) / pageSize));

  if (authReady && role && !isEligible) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="inline-flex h-12 w-12 rounded-full bg-muted items-center justify-center mb-3">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Painel de afiliado indisponível</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Esta área é exclusiva para revendedores.</p>
        <Link to="/my-license" className="text-primary text-[13px] hover:underline mt-3 inline-block">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 px-6 py-5">
        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border bg-background/80 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-2">
          <Users className="h-3 w-3" /> Afiliado
        </div>
        <h1 className="text-[22px] leading-[1.15] font-semibold tracking-tight">Painel de afiliado</h1>
        <p className="text-[12.5px] text-muted-foreground mt-1.5">Seu link único, indicações, comissões e vendas atribuídas — tudo em um só lugar.</p>
      </div>

      {/* Affiliate link card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-1">Seu link de revenda</div>
            <div className="text-[16px] font-semibold tracking-tight">Compartilhe e ganhe</div>
            <p className="text-[12.5px] text-muted-foreground mt-1 max-w-lg">
              Todo cliente que se cadastrar por esse link e adquirir uma licença é atribuído a você automaticamente.
            </p>
          </div>
          {affiliateCode && (
            <div className="rounded-lg border border-border bg-muted/30 p-2 shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(affLink)}`}
                alt="QR do seu link"
                width={110} height={110}
                className="block rounded"
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex items-stretch gap-2">
          <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-[12px] truncate flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{affLink || "—"}</span>
          </div>
          <Button variant="outline" onClick={copyLink} disabled={!affLink}>
            {copied ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar</>}
          </Button>
        </div>
        {affiliateCode && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Código: <span className="font-mono font-semibold text-foreground">{affiliateCode}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Total vendido" value={fmtBRL(stats.total)} sub={`${stats.count} ${stats.count === 1 ? "venda" : "vendas"}`} />
        <StatCard icon={TrendingUp} label="Este mês" value={fmtBRL(stats.monthTotal)} sub={`${stats.monthCount} ${stats.monthCount === 1 ? "venda" : "vendas"}`} tone="success" />
        <StatCard icon={ArrowUpRight} label="Comissão" value={fmtBRL(stats.commission)} sub="acumulada" />
        <StatCard icon={ShoppingBag} label="Ticket médio" value={fmtBRL(stats.avg)} sub="por venda" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-tight">Receita — últimos 30 dias</h2>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">Valor total por dia</p>
            </div>
          </div>
          <div className="h-[260px] w-full">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradFin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
                  />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} fill="url(#gradFin)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-[14px] font-semibold tracking-tight">Top clientes</h2>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">Por volume</p>
          </div>
          <div className="h-[260px]">
            {topBuyers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-[12px] gap-2">
                <Users className="h-5 w-5" />
                Sem dados ainda
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBuyers} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Total"]}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight">Vendas recentes</h2>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">{sales?.length ?? 0} vendas atribuídas ao seu código</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Data</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Valor</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Comissão</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma venda ainda. Compartilhe seu link para começar.
                </td></tr>
              ) : paged.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[11.5px] text-muted-foreground">{fmtDateTime(s.created_at)}</td>
                  <td className="px-4 py-2.5 truncate max-w-[200px]">{s.buyer_email || "—"}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums font-semibold">{fmtBRL(s.amount_cents)}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-muted-foreground">{fmtBRL(s.commission_cents ?? 0)}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Próxima</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone = "default" }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success";
}) {
  const iconTone = tone === "success" ? "text-success" : "text-foreground/70";
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${iconTone}`} />
      </div>
      <div className="text-[19px] font-semibold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const tone = ["paid", "approved", "confirmed", "completed"].includes(s)
    ? "success"
    : ["canceled", "cancelled", "refunded", "failed"].includes(s) ? "danger" : "warn";
  const label = s === "paid" || s === "approved" || s === "confirmed" || s === "completed" ? "Pago"
    : s === "canceled" || s === "cancelled" ? "Cancelado"
    : s === "refunded" ? "Reembolsado"
    : s === "failed" ? "Falhou"
    : s === "pending" ? "Pendente"
    : (status || "—");
  const cls = tone === "success" ? "border-success/30 bg-success/10 text-success"
    : tone === "danger" ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-warning/30 bg-warning/10 text-warning";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10.5px] font-medium uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
