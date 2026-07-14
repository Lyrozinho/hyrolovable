// IP lock (frontend-only). Bloqueia login em IP diferente para usuários
// cujas licenças foram criadas por adminpainel@gmail.com ou laael@gmail.com.
// Armazena o IP autorizado no localStorage do dispositivo. Melhor esforço:
// se o IP público não puder ser obtido, não bloqueia (evita falso-positivo).
import { supabase as ext } from "@/lib/supabase";
import { getClientIP } from "@/lib/redemption";

const OWNER_EMAILS = ["adminpainel@gmail.com", "laael@gmail.com"];
const LOCK_PREFIX = "hyro_ip_lock_";

async function getOwnerIds(): Promise<string[]> {
  try {
    const { data } = await ext
      .from("hyro_extension_users")
      .select("id,email")
      .in("email", OWNER_EMAILS);
    return (data ?? []).map((r: any) => r.id).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Verifica se o usuário é "strict" (licença criada por admin/Lael) e enforça
 * o trava-IP local. Retorna mensagem de erro se violar; null caso OK.
 */
export async function enforceIpLock(userId: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const ownerIds = await getOwnerIds();
    const identifiers = new Set<string>([...OWNER_EMAILS, ...ownerIds]);

    const { data: lics, error } = await ext
      .from("hyro_extension_licenses")
      .select("created_by,reseller_id")
      .eq("user_id", userId);
    if (error) return null;

    const isStrict = (lics ?? []).some((l: any) =>
      (l?.created_by && identifiers.has(String(l.created_by))) ||
      (l?.reseller_id && identifiers.has(String(l.reseller_id)))
    );
    if (!isStrict) return null;

    const ip = await getClientIP();
    if (!ip) return null; // best-effort

    const key = LOCK_PREFIX + userId;
    const stored = localStorage.getItem(key);
    if (!stored) {
      try { localStorage.setItem(key, ip); } catch {}
      return null;
    }
    if (stored !== ip) {
      return "Acesso bloqueado: este login está travado em outro IP. Contate o administrador.";
    }
    return null;
  } catch {
    return null;
  }
}

/** Reset local do trava-IP (uso administrativo, se necessário). */
export function clearIpLock(userId: string) {
  try { localStorage.removeItem(LOCK_PREFIX + userId); } catch {}
}
