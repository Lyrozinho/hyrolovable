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
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <div className="h-3.5 w-3.5 border-2 border-sidebar-primary-foreground rounded-[2px] rotate-45" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Hyro</span>
          <span className="text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-[0.14em] mt-1">
            Admin Console
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pt-3">
        <div className="px-2 mb-2 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-[0.14em]">
          Overview
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
                    "flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/60 transition-colors">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-[11.5px] font-semibold text-sidebar-foreground shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate text-sidebar-foreground leading-tight">
              {session?.user.name ?? "Administrador"}
            </div>
            <div className="text-[11.5px] text-sidebar-foreground/55 truncate leading-tight mt-0.5">
              {session?.user.email}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="h-7 w-7 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent flex items-center justify-center transition-colors shrink-0"
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
