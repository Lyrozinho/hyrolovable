import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = { collapsed: boolean; toggle: () => void; setCollapsed: (v: boolean) => void };
const SidebarCtx = createContext<Ctx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("hyro_sidebar_collapsed");
    if (stored) setCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("hyro_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <SidebarCtx.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c), setCollapsed }}>
      {children}
    </SidebarCtx.Provider>
  );
}

export function useSidebar() {
  const c = useContext(SidebarCtx);
  if (!c) throw new Error("useSidebar must be used within SidebarProvider");
  return c;
}
