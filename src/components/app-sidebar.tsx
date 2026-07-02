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
        <div className="h-7 w-7 rounded-md bg-sidebar-accent border border-sidebar-border flex items-center justify-center">
          <span className="text-[11px] font-bold text-sidebar-foreground tracking-tight">H</span>
        </div>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-[13.5px] font-semibold tracking-tight text-sidebar-foreground">Hyro</span>
          <span className="text-[10.5px] text-sidebar-foreground/50 uppercase tracking-[0.12em]">Admin</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2.5 mb-1.5 text-[10.5px] font-medium text-sidebar-foreground/45 uppercase tracking-[0.1em]">
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
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 h-8.5 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-sidebar-foreground/80" />
                  )}
                  <item.icon
                    className={[
                      "h-4 w-4 shrink-0",
                      active ? "text-sidebar-foreground" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                    ].join(" ")}
                    strokeWidth={active ? 2.1 : 1.75}
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
          <div className="h-7 w-7 rounded-md bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-[11px] font-semibold text-sidebar-foreground shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate leading-tight text-sidebar-foreground">
              {session?.user.name ?? "Administrador"}
            </div>
            <div className="text-[11px] text-sidebar-foreground/55 truncate leading-tight mt-0.5">
              {session?.user.email}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="h-7 w-7 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent flex items-center justify-center transition-colors"
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
