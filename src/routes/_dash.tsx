import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_dash")({
  ssr: false,
  component: DashLayout,
});

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
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
      <div className="md:pl-64">
        <header className="h-16 sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl flex items-center px-6 gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Console</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="h-9 w-64 pl-8 bg-muted/50 border-transparent focus-visible:bg-background"
              />
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="p-6 lg:p-8 max-w-[1600px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
