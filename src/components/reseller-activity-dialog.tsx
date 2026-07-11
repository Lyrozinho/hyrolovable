import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase as cloud } from "@/integrations/supabase/client";
import {
  isOnline,
  type ActivityRow,
  type PresenceRow,
} from "@/lib/reseller-activity";
import {
  Activity, LogIn, LogOut, MousePointerClick, Loader2, Globe, Clock,
  ShieldCheck, KeyRound, RefreshCw, Wifi, WifiOff,
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  reseller: { id?: string; email: string; name?: string | null } | null;
};

const EVENT_META: Record<string, { label: string; icon: typeof Activity; tone: string }> = {
  login:       { label: "Entrou no painel",   icon: LogIn,             tone: "text-emerald-500" },
  logout:      { label: "Saiu do painel",     icon: LogOut,            tone: "text-muted-foreground" },
  page_view:   { label: "Visitou uma página", icon: MousePointerClick, tone: "text-blue-500" },
  license_create: { label: "Criou licença",   icon: KeyRound,          tone: "text-primary" },
  license_renew:  { label: "Renovou licença", icon: RefreshCw,         tone: "text-primary" },
  permission_change: { label: "Alterou permissões", icon: ShieldCheck, tone: "text-amber-500" },
};

function eventInfo(ev: string) {
  return EVENT_META[ev] ?? { label: ev, icon: Activity, tone: "text-muted-foreground" };
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function fmtRelative(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "agora mesmo";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function ResellerActivityDialog({ open, onClose, reseller }: Props) {
  const email = (reseller?.email ?? "").trim().toLowerCase();
  const [tick, setTick] = useState(0);

  // Force re-render every 15s so the "online" pill stays accurate.
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(iv);
  }, [open]);

  const { data: activity, isLoading, refetch } = useQuery({
    queryKey: ["reseller-activity", email],
    enabled: open && !!email,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await (cloud as any)
        .from("hyro_reseller_activity")
        .select("*")
        .eq("actor_email", email)
        .order("created_at", { ascending: false })
        .limit(200);
      if (res.error) throw res.error;
      return (res.data ?? []) as ActivityRow[];
    },
  });

  const { data: presence, refetch: refetchPresence } = useQuery({
    queryKey: ["reseller-presence", email],
    enabled: open && !!email,
    staleTime: 5_000,
    refetchInterval: open ? 15_000 : false,
    queryFn: async () => {
      const res = await (cloud as any)
        .from("hyro_reseller_presence")
        .select("*")
        .eq("actor_email", email)
        .maybeSingle();
      if (res.error && res.error.code !== "PGRST116") throw res.error;
      return (res.data ?? null) as PresenceRow | null;
    },
  });

  // Realtime — invalida ao vivo enquanto o modal está aberto.
  useEffect(() => {
    if (!open || !email) return;
    const ch = (cloud as any)
      .channel(`reseller-activity-${email}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hyro_reseller_activity", filter: `actor_email=eq.${email}` },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hyro_reseller_presence", filter: `actor_email=eq.${email}` },
        () => refetchPresence(),
      )
      .subscribe();
    return () => { (cloud as any).removeChannel(ch); };
  }, [open, email, refetch, refetchPresence]);

  const online = useMemo(() => isOnline(presence?.last_seen), [presence?.last_seen, tick]);

  const stats = useMemo(() => {
    const rows = activity ?? [];
    const logins = rows.filter((r) => r.event === "login").length;
    const pageviews = rows.filter((r) => r.event === "page_view").length;
    const lastLogin = rows.find((r) => r.event === "login")?.created_at ?? null;
    return { logins, pageviews, total: rows.length, lastLogin };
  }, [activity]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Atividade do revendedor
              </DialogTitle>
              <div className="mt-1 text-[12.5px] text-muted-foreground truncate">
                {reseller?.name ? `${reseller.name} · ` : ""}{reseller?.email}
              </div>
            </div>
            <div
              className={
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border " +
                (online
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-border bg-muted/40 text-muted-foreground")
              }
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online agora" : "Offline"}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            <StatCell label="Logins" value={stats.logins} />
            <StatCell label="Páginas" value={stats.pageviews} />
            <StatCell label="Eventos" value={stats.total} />
            <StatCell
              label="Último login"
              value={stats.lastLogin ? fmtRelative(stats.lastLogin) : "—"}
              mono={false}
            />
          </div>
          {presence && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última atividade: {fmtRelative(presence.last_seen)}
              </span>
              {presence.ip && (
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  IP {presence.ip}
                </span>
              )}
              {presence.path && (
                <span className="truncate max-w-[240px]" title={presence.path}>
                  em {presence.path}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando atividade...
            </div>
          ) : (activity ?? []).length === 0 ? (
            <div className="text-center py-16 text-[13px] text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(activity ?? []).map((row) => {
                const info = eventInfo(row.event);
                const Icon = info.icon;
                const meta = (row.metadata ?? {}) as Record<string, any>;
                const detail =
                  row.event === "page_view"
                    ? (meta.title as string) || (row.path ?? meta.path ?? "")
                    : row.event === "login" && meta.method
                    ? `via ${meta.method}${meta.role ? ` · ${meta.role}` : ""}`
                    : row.path ?? "";
                return (
                  <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                    <div className={"mt-0.5 h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0 " + info.tone}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-medium text-foreground truncate">{info.label}</div>
                        <div className="text-[11px] text-muted-foreground whitespace-nowrap" title={fmtDateTime(row.created_at)}>
                          {fmtRelative(row.created_at)}
                        </div>
                      </div>
                      {detail && (
                        <div className="text-[11.5px] text-muted-foreground truncate">{detail}</div>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground/80">
                        {row.ip && <span>{row.ip}</span>}
                        <span title={fmtDateTime(row.created_at)}>{fmtDateTime(row.created_at)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCell({ label, value, mono = true }: { label: string; value: number | string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={"text-[15px] font-semibold text-foreground mt-0.5 " + (mono ? "font-mono tabular-nums" : "")}>
        {value}
      </div>
    </div>
  );
}
