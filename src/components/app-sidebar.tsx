import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, KeyRound, Users, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

const items = [
  { title: "Visão geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Licenças", url: "/licenses", icon: KeyRound },
  { title: "Revendedores", url: "/resellers", icon: Users },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { session, signOut } = useAuth();

  const initial = (
    session?.user.name?.[0] ??
    session?.user.email[0] ??
    "A"
  ).toUpperCase();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border">
        <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center">
          <span className="text-[10px] font-bold text-background tracking-tight">H</span>
        </div>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-[13px] font-semibold tracking-tight">Hyro</span>
          <span className="text-[10.5px] text-muted-foreground">Admin</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2.5 mb-1.5 text-[10.5px] font-medium text-muted-foreground/80 uppercase tracking-[0.08em]">
          Console
        </div>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <li key={item.url}>
                <Link
                  to={item.url}
                  className={[
                    "group flex items-center gap-2.5 rounded-md px-2.5 h-8 text-[13px] transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <item.icon
                    className={[
                      "h-4 w-4 shrink-0",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground/80 group-hover:text-foreground",
                    ].join(" ")}
                    strokeWidth={active ? 2.2 : 1.75}
                  />
                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="h-7 w-7 rounded-md bg-secondary border border-border flex items-center justify-center text-[11px] font-semibold text-foreground shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate leading-tight">
              {session?.user.name ?? "Administrador"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
              {session?.user.email}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent flex items-center justify-center transition-colors"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
