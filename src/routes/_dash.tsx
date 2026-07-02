import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_dash")({
  ssr: false,
  component: DashLayout,
});

const titles: Record<string, string> = {
  "/dashboard": "Visão geral",
  "/licenses": "Licenças",
  "/resellers": "Revendedores",
};

function DashLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

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
      <div className="md:pl-60">
        <header className="h-14 sticky top-0 z-30 border-b border-border/60 glass-header flex items-center px-6 gap-4">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Console</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="h-8 w-64 pl-8 text-[12.5px] bg-muted/60 border-transparent focus-visible:bg-background focus-visible:border-border"
              />
              <kbd className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="p-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
