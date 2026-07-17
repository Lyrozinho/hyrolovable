// Retorna o domínio público correto para links compartilháveis.
// Em previews do Lovable (id-preview--*.lovable.app, *.lovable.dev, sandbox, localhost),
// força o uso do domínio publicado oficial.
export const PUBLIC_ORIGIN = "https://hyrolovable.lovable.app";

export function getPublicOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_ORIGIN;
  try {
    const host = window.location.hostname;
    const isPreview =
      host.startsWith("id-preview--") ||
      host.endsWith(".lovable.dev") ||
      host.endsWith(".sandbox.lovable.dev") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost");
    if (isPreview) return PUBLIC_ORIGIN;
    // Se já está no domínio publicado (hyrolovable.lovable.app) ou domínio próprio, usa o atual.
    return window.location.origin;
  } catch {
    return PUBLIC_ORIGIN;
  }
}
