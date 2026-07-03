import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, KeyRound, Users, LogOut, Sparkles, ChevronsLeft, ChevronsRight, GraduationCap } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: Array<"admin" | "client">;
};

const items: NavItem[] = [
  { title: "Visão geral", url: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { title: "Licenças", url: "/licenses", icon: KeyRound, roles: ["admin"] },
  { title: "Revendedores", url: "/resellers", icon: Users, roles: ["admin", "client"] },
  { title: "Assinatura", url: "/subscription", icon: Sparkles, roles: ["admin", "client"] },
  { title: "Tutoriais", url: "/tutorials", icon: GraduationCap, roles: ["admin", "client"] },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { session, signOut } = useAuth();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();

  const role = (session?.user.role === "client" ? "client" : "admin") as "admin" | "client";
  const visible = items.filter((i) => i.roles.includes(role));

  const initial = (
    session?.user.name?.[0] ??
    session?.user.email[0] ??
    "A"
  ).toUpperCase();

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // On mobile, force expanded look (never collapsed) while drawer is open
  const isCollapsed = collapsed;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        />
      )}
      <aside
        className={[
          "fixed left-0 top-0 h-screen flex flex-col border-r transition-[width,transform] duration-200 ease-out z-50",
          // desktop width
          isCollapsed ? "md:w-[72px]" : "md:w-64",
          // mobile: fixed 260px wide drawer, slide in/out
          "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        style={{
          backgroundColor: "oklch(0.115 0.003 250)",
          color: "oklch(0.88 0.003 250)",
          borderRightColor: "rgba(255,255,255,0.06)",
        }}
      >
      {/* Brand */}
      <div
        className={[
          "flex items-center py-5 shrink-0",
          collapsed ? "px-0 justify-center" : "px-5 gap-3",
        ].join(" ")}
      >
        <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center shrink-0">
          <div className="h-3.5 w-3.5 border-2 border-zinc-900 rounded-[2px] rotate-45" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none flex-1 min-w-0">
            <span className="text-[15px] font-semibold tracking-tight text-white">Hyro</span>
            <span className="text-[10px] font-medium text-white/45 uppercase tracking-[0.14em] mt-1">
              {role === "client" ? "Painel do Cliente" : "Admin Console"}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={["flex-1 overflow-y-auto pt-2", collapsed ? "px-2" : "px-3"].join(" ")}>
        {!collapsed && (
          <div className="px-2 mb-2 text-[10.5px] font-bold text-white/35 uppercase tracking-[0.14em]">
            {role === "client" ? "Sua conta" : "Overview"}
          </div>
        )}
        <ul className="space-y-0.5">
          {visible.map((item) => {
            const active =
              pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <li key={item.url}>
                <Link
                  to={item.url}
                  title={collapsed ? item.title : undefined}
                  className={[
                    "flex items-center rounded-md text-[13.5px] font-medium transition-colors",
                    collapsed ? "h-10 w-full justify-center" : "px-3 py-2 gap-3",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                  ].join(" ")}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle (inline, no floating) */}
      <div className={["border-t shrink-0", collapsed ? "px-2 py-2" : "px-3 py-2"].join(" ")} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button
          onClick={toggle}
          className={[
            "flex items-center rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors text-[12px] font-medium",
            collapsed ? "h-9 w-full justify-center" : "h-9 w-full px-3 gap-2",
          ].join(" ")}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>

      {/* User */}
      <div className={["border-t shrink-0", collapsed ? "p-2" : "p-3"].join(" ")} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className={["flex items-center rounded-lg hover:bg-white/5 transition-colors", collapsed ? "flex-col gap-2 p-1" : "gap-3 p-2"].join(" ")}>
          <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[12px] font-semibold text-white shrink-0">
            {initial}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate text-white leading-tight">
                {session?.user.name ?? (role === "client" ? "Cliente" : "Administrador")}
              </div>
              <div className="text-[11.5px] text-white/50 truncate leading-tight mt-0.5">
                {session?.user.email}
              </div>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className={[
              "rounded-md text-white/55 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0",
              collapsed ? "h-8 w-8" : "h-7 w-7",
            ].join(" ")}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}

