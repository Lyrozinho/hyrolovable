import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, KeyRound, Users, LogOut, Sparkles, ChevronsLeft, ChevronsRight, GraduationCap, Rocket, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar";
import {
  DEFAULT_PERMS,
  OWNER_EMAIL,
  fetchLicensePerms,
  fetchParentLicenseForReseller,
  fetchPrimaryLicenseForUser,
  type MenuKey,
  type SidePerms,
} from "@/lib/permissions";
import { supabase as ext } from "@/lib/supabase";
import hyroLogo from "@/assets/hyro-logo.png";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: Array<"admin" | "client">;
  permKey?: MenuKey; // se definido, respeita permissões para role=client
  ownerOnly?: boolean; // visível apenas para OWNER_EMAIL
};

const items: NavItem[] = [
  { title: "Visão geral", url: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { title: "Minhas licenças", url: "/my-license", icon: KeyRound, roles: ["client"] },
  { title: "Licenças", url: "/licenses", icon: KeyRound, roles: ["admin", "client"], permKey: "licenses" },
  { title: "Revendedores", url: "/resellers", icon: Users, roles: ["admin", "client"], permKey: "resellers" },
  { title: "Tutoriais", url: "/tutorials", icon: GraduationCap, roles: ["admin", "client"], permKey: "tutorials" },
  { title: "Atualização", url: "/upgrade-admin", icon: Rocket, roles: ["admin"] },
  { title: "Bot Telegram", url: "/telegram-bot", icon: Bot, roles: ["admin"], ownerOnly: true },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { session, sessionKey, authReady, signOut } = useAuth();
  const qc = useQueryClient();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
  };

  // ADMIN estrito: apenas sessão com role "admin" (login via Lovable Cloud) é admin.
  // Qualquer outra coisa (client, reseller, user, ausente) NÃO tem privilégios de admin.
  const role = (session?.user.role === "admin" ? "admin" : "client") as "admin" | "client";
  const isOwnerAdmin = role === "admin" && session?.user.email?.toLowerCase() === OWNER_EMAIL;

  // Carrega perms quando é cliente
  const [clientPerms, setClientPerms] = useState<SidePerms | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!authReady || role !== "client" || !session?.user.id) {
      setClientPerms(null);
      return;
    }
    setClientPerms(null);
    (async () => {
      try {
        // descobre se é reseller
        const { data: u } = await ext
          .from("hyro_extension_users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        const isReseller = (u as any)?.role === "reseller";
        const licId = isReseller
          ? await fetchParentLicenseForReseller(session.user.id)
          : await fetchPrimaryLicenseForUser(session.user.id);
        if (!licId) {
          if (!cancelled) setClientPerms(DEFAULT_PERMS[isReseller ? "resellers" : "owner"]);
          return;
        }
        const p = await fetchLicensePerms(licId);
        if (!cancelled) setClientPerms(isReseller ? p.resellers : p.owner);
      } catch {
        if (!cancelled) setClientPerms(DEFAULT_PERMS.owner);
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, role, sessionKey, session?.user.id]);

  const visible = items.filter((i) => {
    if (!i.roles.includes(role)) return false;
    if (i.ownerOnly && !isOwnerAdmin) return false;
    if (role === "admin") return true;
    if (!i.permKey) return true;
    // Enquanto perms ainda não carregou, esconde abas sensíveis (não vazar)
    if (!clientPerms) return i.permKey !== "resellers" && i.permKey !== "licenses";
    return !!clientPerms[i.permKey];
  });


  const initial = (
    session?.user.name?.[0] ??
    session?.user.email[0] ??
    "A"
  ).toUpperCase();

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Detect mobile viewport → no collapse allowed
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // On mobile, never render as collapsed (drawer is always expanded).
  const isCollapsed = collapsed && !isMobile;

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
          isCollapsed ? "px-0 justify-center" : "px-5 gap-3",
        ].join(" ")}
      >
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0">
          <img
            src={hyroLogo}
            alt="Hyro"
            draggable={false}
            className="h-10 w-10 object-contain select-none pointer-events-none"
          />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col leading-none flex-1 min-w-0">
            <span className="text-[15px] font-semibold tracking-tight text-white">Hyro</span>
            <span className="text-[10px] font-medium text-white/45 uppercase tracking-[0.14em] mt-1">
              {role === "client" ? "Painel do Cliente" : "Admin Console"}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={["flex-1 overflow-y-auto pt-2", isCollapsed ? "px-2" : "px-3"].join(" ")}>
        {!isCollapsed && (
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
                  title={isCollapsed ? item.title : undefined}
                  className={[
                    "flex items-center rounded-md text-[13.5px] font-medium transition-colors",
                    isCollapsed ? "h-10 w-full justify-center" : "px-3 py-2 gap-3",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                  ].join(" ")}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  {!isCollapsed && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle — só em desktop */}
      {!isMobile && (
        <div className={["border-t shrink-0", isCollapsed ? "px-2 py-2" : "px-3 py-2"].join(" ")} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button
            onClick={toggle}
            className={[
              "flex items-center rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors text-[12px] font-medium",
              isCollapsed ? "h-9 w-full justify-center" : "h-9 w-full px-3 gap-2",
            ].join(" ")}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* User */}
      <div className={["border-t shrink-0", isCollapsed ? "p-2" : "p-3"].join(" ")} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className={["flex items-center rounded-lg hover:bg-white/5 transition-colors", isCollapsed ? "flex-col gap-2 p-1" : "gap-3 p-2"].join(" ")}>
          <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[12px] font-semibold text-white shrink-0">
            {initial}
          </div>
          {!isCollapsed && (
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
            onClick={handleSignOut}
            className={[
              "rounded-md text-white/55 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0",
              isCollapsed ? "h-8 w-8" : "h-7 w-7",
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

