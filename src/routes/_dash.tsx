import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { WelcomeModal } from "@/components/welcome-modal";
import { Menu, Search, Coins } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarProvider, useSidebar } from "@/lib/sidebar";
import { installSecurityGuard } from "@/lib/security-guard";
import { supabase as ext } from "@/lib/supabase";
import { supabase as cloud } from "@/integrations/supabase/client";
import { getResellerBalance } from "@/lib/reseller-balance";
import { useRealtimeInvalidation } from "@/lib/realtime-invalidation";

export const Route = createFileRoute("/_dash")({
  ssr: false,
  component: DashLayout,
});

const titles: Record<string, string> = {
  "/dashboard": "Visão geral",
  "/licenses": "Licenças",
  "/resellers": "Revendedores",
  "/subscription": "Assinatura",
  "/tutorials": "Tutoriais",
  "/upgrade-admin": "Atualização",
};

function DashLayout() {
  return (
    <SidebarProvider>
      <DashInner />
    </SidebarProvider>
  );
}

function DashInner() {
  const { session, loading, sessionKey, authReady } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { collapsed, toggleMobile } = useSidebar();
  const qc = useQueryClient();
  const lastSessionKeyRef = useRef<string | null>(null);

  const extRealtimeBindings = useMemo(() => [
    {
      table: "hyro_extension_licenses",
      queryKeys: [["dash-stats"], ["licenses"], ["subscription-license-stats"], ["resellers"], ["my-slots"], ["reseller-balance"]],
    },
    {
      table: "hyro_extension_sessions",
      queryKeys: [["dash-stats"]],
    },
    {
      table: "hyro_extension_users",
      queryKeys: [["dash-stats"], ["licenses"], ["resellers"], ["my-slots"], ["reseller-balance"], ["subscription-license-stats"]],
    },
    {
      table: "hyro_reseller_balances",
      queryKeys: [["reseller-balance"], ["resellers"], ["my-slots"]],
    },
  ], []);

  const cloudRealtimeBindings = useMemo(() => [
    {
      table: "hyro_redemption_links",
      queryKeys: [["resellers"], ["my-slots"]],
    },
    {
      table: "hyro_user_flags",
      queryKeys: [["user-flags"]],
    },
  ], []);

  useRealtimeInvalidation({
    client: ext as any,
    enabled: authReady && !!session,
    channelName: `hyro-ext-live-${sessionKey}`,
    bindings: extRealtimeBindings,
  });

  useRealtimeInvalidation({
    client: cloud as any,
    enabled: authReady && !!session,
    channelName: `hyro-cloud-live-${sessionKey}`,
    bindings: cloudRealtimeBindings,
  });

  useEffect(() => {
    installSecurityGuard();
  }, []);

  // ISOLAMENTO RÍGIDO: sempre que a conta muda, zera o cache de queries para
  // evitar que dados da conta anterior vazem visualmente para a nova sessão.
  useEffect(() => {
    if (lastSessionKeyRef.current !== null && lastSessionKeyRef.current !== sessionKey) {
      qc.cancelQueries();
      qc.clear();
    }
    lastSessionKeyRef.current = sessionKey;
  }, [sessionKey, qc]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  // Role-based route gating — /dashboard e / são só de admin.
  useEffect(() => {
    if (!session) return;
    if (session.user.role === "client") {
      if (pathname === "/dashboard" || pathname === "/") {
        navigate({ to: "/subscription", replace: true });
      }
    }
  }, [session, pathname, navigate]);

  // Saldo de licenças disponíveis para revendedor (badge no header).
  const isReseller = session?.user.role === "client";
  const { data: resellerInfo } = useQuery({
    queryKey: ["reseller-balance", sessionKey],
    enabled: authReady && !!session && isReseller,
    refetchInterval: 5_000,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      try {
        const uid = session!.user.id;
        const { data: u, error } = await ext
          .from("hyro_extension_users")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (error) throw error;
        const role = (u as any)?.role;
        if (role !== "reseller") return null;
        return { balance: await getResellerBalance(uid) };
      } catch (error) {
        console.error("Erro ao carregar saldo do revendedor", error);
        return null;
      }
    },
  });

  if (!authReady || loading || !session) {
    return <div className="min-h-screen bg-background" />;
  }

  const title = titles[pathname] ?? "Painel";

  return (
    <div key={sessionKey} className="min-h-screen bg-background">
      <AppSidebar />
      <div className={collapsed ? "md:pl-[72px] transition-[padding] duration-200" : "md:pl-64 transition-[padding] duration-200"}>
        <header className="h-14 md:h-16 sticky top-0 z-30 border-b border-border bg-card flex items-center px-3 md:px-6 gap-2 md:gap-4">
          <button
            type="button"
            onClick={toggleMobile}
            className="md:hidden h-9 w-9 rounded-md flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-muted"
            aria-label="Abrir menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <div className="flex items-center gap-3 text-[13px] min-w-0">
            <span className="hidden sm:inline text-muted-foreground">Console</span>
            <span className="hidden sm:inline text-border">/</span>
            <span className="text-foreground font-medium truncate">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {resellerInfo && (
              <div
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-muted/40 text-[12px] font-medium"
                title="Licenças disponíveis para você criar"
              >
                <Coins className="h-3.5 w-3.5 text-foreground/70" />
                <span className="hidden sm:inline text-muted-foreground">Licenças disponíveis:</span>
                <span className="sm:hidden text-muted-foreground">Disp.:</span>
                <span className="font-mono tabular-nums text-foreground">
                  {resellerInfo.balance}
                </span>
              </div>
            )}
            <div className="relative hidden md:block">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="h-9 w-64 pl-9 pr-3 text-[12.5px] rounded-full bg-muted border-transparent focus-visible:bg-background focus-visible:border-border focus-visible:ring-0"
              />

            </div>
            <ThemeToggle />
          </div>
        </header>
        <main key={sessionKey} className="px-4 md:px-6 lg:px-8 xl:px-10 py-5 md:py-6 mx-auto w-full max-w-[1600px]">
          <Outlet />
        </main>
      </div>
      <WelcomeModal />
    </div>
  );
}

