import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, KeyRound, Users, LogOut, Sparkles, PanelLeftClose, PanelLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar";

const items = [
  { title: "Visão geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Licenças", url: "/licenses", icon: KeyRound },
  { title: "Revendedores", url: "/resellers", icon: Users },
  { title: "Assinatura", url: "/subscription", icon: Sparkles },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { session, signOut } = useAuth();
  const { collapsed, toggle } = useSidebar();

  const initial = (
    session?.user.name?.[0] ??
    session?.user.email[0] ??
    "A"
  ).toUpperCase();

  return (
    <aside
      className={[
        "hidden md:flex fixed left-0 top-0 h-screen flex-col border-r transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-64",
      ].join(" ")}
      style={{
        backgroundColor: "oklch(0.115 0.003 250)",
        color: "oklch(0.88 0.003 250)",
        borderRightColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Brand + collapse */}
      <div className={["flex items-center gap-3 py-5", collapsed ? "px-3 justify-center" : "px-5"].join(" ")}>
        <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0">
          <div className="h-3.5 w-3.5 border-2 border-zinc-900 rounded-[2px] rotate-45" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none flex-1 min-w-0">
            <span className="text-[15px] font-semibold tracking-tight text-white">Hyro</span>
            <span className="text-[10px] font-medium text-white/45 uppercase tracking-[0.14em] mt-1">
              Admin Console
            </span>
          </div>
        )}
        <button
          onClick={toggle}
          className={[
            "h-7 w-7 rounded-md text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0",
            collapsed ? "absolute -right-3 top-6 bg-zinc-900 border border-white/10" : "",
          ].join(" ")}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className={["flex-1 overflow-y-auto pt-3", collapsed ? "px-2" : "px-3"].join(" ")}>
        {!collapsed && (
          <div className="px-2 mb-2 text-[11px] font-bold text-white/35 uppercase tracking-[0.14em]">
            Overview
          </div>
        )}
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <li key={item.url}>
                <Link
                  to={item.url}
                  title={collapsed ? item.title : undefined}
                  className={[
                    "flex items-center gap-3 rounded-md text-[13.5px] font-medium transition-colors",
                    collapsed ? "px-2.5 py-2 justify-center" : "px-3 py-2",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className={["border-t p-3", collapsed ? "" : "p-4"].join(" ")} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className={["flex items-center gap-3 rounded-lg hover:bg-white/5 transition-colors", collapsed ? "p-1 justify-center" : "p-2"].join(" ")}>
          <div className="h-8 w-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[11.5px] font-semibold text-white shrink-0">
            {initial}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate text-white leading-tight">
                  {session?.user.name ?? "Administrador"}
                </div>
                <div className="text-[11.5px] text-white/50 truncate leading-tight mt-0.5">
                  {session?.user.email}
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="h-7 w-7 rounded-md text-white/55 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
