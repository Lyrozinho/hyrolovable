import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  KeyRound, CalendarClock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Infinity as InfinityIcon, Clock, Copy, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RenewLicenseDialog } from "@/components/renew-license-dialog";

export const Route = createFileRoute("/_dash/my-license")({
  component: MyLicensePage,
});

type LicenseRow = {
  id: string;
  status: string;
  expires_at: string;
  created_at: string;
  user_id: string | null;
  created_by: string | null;
  reseller_id: string | null;
};

function isLifetime(exp: string) {
  return new Date(exp).getUTCFullYear() >= 2099;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function MyLicensePage() {
  const { session, sessionKey, authReady } = useAuth();
  const userId = session?.user.id ?? null;
  const qc = useQueryClient();
  const [renewTarget, setRenewTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-licenses", sessionKey, userId],
    enabled: authReady && !!userId,
    queryFn: async () => {
      // Descobre role no ext-users
      const { data: u } = await supabase
        .from("hyro_extension_users")
        .select("role")
        .eq("id", userId!)
        .maybeSingle();
      const role = (u as any)?.role;
      let q = supabase
        .from("hyro_extension_licenses")
        .select("id, status, expires_at, created_at, user_id, created_by, reseller_id")
        .order("created_at", { ascending: false });
      q = role === "reseller"
        ? q.or(`created_by.eq.${userId},reseller_id.eq.${userId}`)
        : q.eq("user_id", userId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LicenseRow[];
    },
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const now = new Date();
    let active = 0, expired = 0, expiringSoon = 0, lifetime = 0;
    let nearest: string | null = null;
    for (const r of rows) {
      const exp = new Date(r.expires_at);
      const isLife = isLifetime(r.expires_at);
      const isActive = r.status === "ativa" && exp > now;
      if (isActive) active++;
      if (exp <= now) expired++;
      if (isActive && !isLife && daysBetween(exp, now) <= 30) expiringSoon++;
      if (isLife) lifetime++;
      if (isActive && !isLife && (!nearest || exp < new Date(nearest))) nearest = r.expires_at;
    }
    return { total: rows.length, active, expired, expiringSoon, lifetime, nearest };
  }, [data]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 px-6 py-5">
        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-border bg-background/80 backdrop-blur text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Minhas licenças
        </div>
        <h1 className="text-[22px] leading-[1.15] font-semibold tracking-tight">
          Acompanhe suas licenças e validades
        </h1>
        <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
          Visualização somente-leitura das licenças vinculadas à sua conta.
        </p>
      </div>

      {/* Stats */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Situação geral</h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Atualizado em tempo real</p>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            Próx. expiração ·{" "}
            <span className="text-foreground">
              {stats.nearest ? fmtDate(stats.nearest) : "—"}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={KeyRound} label="Ativas" value={stats.active} />
          <StatCard
            icon={CalendarClock}
            label="Vencem em 30d"
            value={stats.expiringSoon}
            tone={stats.expiringSoon ? "warn" : "default"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Expiradas"
            value={stats.expired}
            tone={stats.expired ? "danger" : "default"}
          />
          <StatCard icon={ShieldCheck} label="Lifetime" value={stats.lifetime} />
        </div>
      </section>

      {/* List */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Suas licenças {data ? <span className="text-muted-foreground font-mono text-[12px] ml-1">({data.length})</span> : null}
          </h2>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
            Carregando…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <KeyRound className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13.5px] font-medium">Nenhuma licença encontrada</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Quando uma licença for atribuída à sua conta, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.map((l) => {
              const now = new Date();
              const exp = new Date(l.expires_at);
              const life = isLifetime(l.expires_at);
              const expired = exp <= now;
              const isActive = l.status === "ativa" && !expired;
              const dLeft = life ? Infinity : daysBetween(exp, now);
              const tone = !isActive
                ? "danger"
                : life
                ? "success"
                : dLeft <= 7
                ? "danger"
                : dLeft <= 30
                ? "warn"
                : "success";
              const toneClasses = {
                success: "border-success/30 bg-success/5",
                warn: "border-warning/30 bg-warning/5",
                danger: "border-destructive/30 bg-destructive/5",
              }[tone];
              return (
                <div
                  key={l.id}
                  className={`rounded-xl border ${toneClasses} p-4 hover:border-foreground/25 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <button
                          onClick={() => copy(l.id)}
                          className="font-mono text-[12.5px] font-medium tracking-tight truncate hover:underline inline-flex items-center gap-1.5 group"
                          title="Copiar chave"
                        >
                          <span className="truncate">{l.id}</span>
                          <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
                        </button>
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-1 font-mono uppercase tracking-wider">
                        Criada em {fmtDate(l.created_at)}
                      </div>
                    </div>
                    <StatusBadge active={isActive} expired={expired} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                        Validade
                      </div>
                      <div className="text-[13px] font-medium flex items-center gap-1.5">
                        {life ? (
                          <>
                            <InfinityIcon className="h-3.5 w-3.5" />
                            <span>Vitalícia</span>
                          </>
                        ) : (
                          fmtDate(l.expires_at)
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                        {expired ? "Expirada há" : "Restam"}
                      </div>
                      <div
                        className={`text-[13px] font-medium flex items-center gap-1.5 ${
                          tone === "danger"
                            ? "text-destructive"
                            : tone === "warn"
                            ? "text-warning"
                            : "text-foreground"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {life
                          ? "—"
                          : expired
                          ? `${Math.abs(dLeft)} dia${Math.abs(dLeft) === 1 ? "" : "s"}`
                          : `${dLeft} dia${dLeft === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone = "default",
}: {
  icon: typeof KeyRound;
  label: string;
  value: number;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={`mt-2.5 text-[26px] leading-none font-semibold font-mono tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ active, expired }: { active: boolean; expired: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-success/10 text-success border border-success/20">
        <CheckCircle2 className="h-3 w-3" /> Ativa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20">
      <XCircle className="h-3 w-3" /> {expired ? "Expirada" : "Inativa"}
    </span>
  );
}
