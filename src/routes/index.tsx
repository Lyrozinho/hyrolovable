import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getSessionHome, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? getSessionHome(session) : "/login", replace: true });
  }, [loading, navigate, session]);

  return <div className="min-h-screen bg-background" />;
}
