import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/a/$code")({
  ssr: false,
  component: AffiliateLandingPage,
});

function AffiliateLandingPage() {
  const { code } = useParams({ from: "/a/$code" });
  const navigate = useNavigate();

  useEffect(() => {
    const clean = (code ?? "").trim().toUpperCase().slice(0, 12);
    if (!clean) {
      navigate({ to: "/signup", replace: true });
      return;
    }
    try { sessionStorage.setItem("hyro_aff_code", clean); } catch { /* ignore */ }
    navigate({ to: "/signup", search: { aff: clean } as any, replace: true });
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecionando…
      </div>
    </div>
  );
}
