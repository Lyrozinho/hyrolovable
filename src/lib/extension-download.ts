import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase as ext } from "@/lib/supabase";
import { fetchPrimaryLicenseForUser, fetchParentLicenseForReseller } from "@/lib/permissions";
import { getResellerBalance } from "@/lib/reseller-balance";
import { fetchUpgradeBlob, fetchUpgradeMeta, type UpgradeMeta } from "@/lib/upgrade-store";

/**
 * Entitlement rígido para baixar a extensão.
 * - admin: sempre pode
 * - reseller: só se saldo > 0 OU se possui licença herdada do dono
 * - client: só se possui licença ativa (não-teste)
 *
 * A verificação real de acesso ao ZIP acontece no backend via RLS/Storage;
 * este hook apenas evita expor o botão a quem não tem direito.
 */
export function useExtensionEntitlement() {
  const { session, authReady, sessionKey } = useAuth();
  const isAdmin = session?.user.role === "admin";
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ["extension-entitlement", sessionKey],
    enabled: authReady && !!uid && !isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      if (!uid) return { entitled: false };
      try {
        const { data: u } = await ext
          .from("hyro_extension_users")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        const role = (u as any)?.role;
        if (role === "reseller") {
          const [balance, parentLic] = await Promise.all([
            getResellerBalance(uid).catch(() => 0),
            fetchParentLicenseForReseller(uid).catch(() => null),
          ]);
          return { entitled: balance > 0 || !!parentLic };
        }
        const lic = await fetchPrimaryLicenseForUser(uid);
        return { entitled: !!lic };
      } catch {
        return { entitled: false };
      }
    },
  });

  return {
    entitled: isAdmin ? true : !!q.data?.entitled,
    ready: isAdmin ? true : q.isSuccess || q.isError,
  };
}

/** Metadados da versão publicada (nome do arquivo é intencionalmente omitido do UI). */
export function useUpgradeVersion() {
  const [meta, setMeta] = useState<UpgradeMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const m = await fetchUpgradeMeta();
        if (!cancelled) setMeta(m);
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const onChange = () => load();
    window.addEventListener("hyro_upgrade_change", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hyro_upgrade_change", onChange);
    };
  }, []);

  const version = meta?.version?.trim() || null;
  return { version, loading, available: !!meta };
}

/** Trigger de download seguro (verifica entitlement antes). */
export function useExtensionDownload() {
  const { entitled } = useExtensionEntitlement();
  const [downloading, setDownloading] = useState(false);

  const download = useCallback(async () => {
    if (!entitled) {
      toast.error("Você precisa de uma licença ativa para baixar a extensão.");
      return;
    }
    if (downloading) return;
    setDownloading(true);
    try {
      const { blob, fileName } = await fetchUpgradeBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no download");
    } finally {
      setDownloading(false);
    }
  }, [entitled, downloading]);

  return { download, downloading };
}
