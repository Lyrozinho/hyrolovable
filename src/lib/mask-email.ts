/**
 * Mask an email address preserving the first characters and the domain suffix.
 * Examples:
 *   john.doe@gmail.com   -> joh***@gmail.com
 *   ab@x.com             -> ab*@x.com
 *   a@x.com              -> a*@x.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const raw = String(email).trim();
  if (!raw) return "—";
  const at = raw.lastIndexOf("@");
  if (at <= 0) return raw.length <= 2 ? raw + "***" : raw.slice(0, 2) + "***";
  const local = raw.slice(0, at);
  const domain = raw.slice(at);
  const keep = Math.min(3, Math.max(1, local.length - 1));
  return local.slice(0, keep) + "***" + domain;
}
