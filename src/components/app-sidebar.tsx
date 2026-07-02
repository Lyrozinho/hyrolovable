import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, KeyRound, Users, LogOut, ShieldCheck, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Licenças", url: "/licenses", icon: KeyRound },
  { title: "Revendedores", url: "/resellers", icon: Users },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { session, signOut } = useAuth();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow">
          <ShieldCheck className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Hyro Admin</span>
          <span className="text-[10.5px] text-muted-foreground uppercase tracking-wider">
            Console
          </span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="px-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Geral
        </div>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const active = pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <Link
                key={item.url}
                to={item.url}
                className={[
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                ].join(" ")}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-sidebar-accent/50 transition-colors">
          <div className="h-9 w-9 rounded-lg bg-gradient-brand flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {(session?.user.name?.[0] ?? session?.user.email[0] ?? "A").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{session?.user.name ?? "Admin"}</div>
            <div className="text-[11px] text-muted-foreground truncate">{session?.user.email}</div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 mt-1 text-muted-foreground hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );
}
