import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarProvider, useSidebar } from "@/lib/sidebar";

export const Route = createFileRoute("/_dash")({
  ssr: false,
  component: DashLayout,
});

const titles: Record<string, string> = {
  "/dashboard": "Visão geral",
  "/licenses": "Licenças",
  "/resellers": "Revendedores",
  "/subscription": "Assinatura",
};

function DashLayout() {
  return (
    <SidebarProvider>
      <DashInner />
    </SidebarProvider>
  );
}

function DashInner() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { collapsed } = useSidebar();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return <div className="min-h-screen bg-background" />;
  }

  const title = titles[pathname] ?? "Painel";

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className={collapsed ? "md:pl-[68px] transition-[padding] duration-200" : "md:pl-64 transition-[padding] duration-200"}>
        <header className="h-16 sticky top-0 z-30 border-b border-border bg-card flex items-center px-6 gap-4">
          <div className="flex items-center gap-3 text-[13px] min-w-0">
            <span className="text-muted-foreground">Console</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium truncate">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="h-9 w-64 pl-9 pr-10 text-[12.5px] rounded-full bg-muted border-transparent focus-visible:bg-background focus-visible:border-border focus-visible:ring-0"
              />
              <kbd className="hidden lg:flex absolute right-2.5 top-1/2 -translate-y-1/2 h-5 items-center justify-center rounded border border-border bg-background px-1.5 font-mono text-[10px] font-bold text-muted-foreground">
                ⌘K
              </kbd>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
