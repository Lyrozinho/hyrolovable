// Generate license keys in the format XXX-XXXX-XXX-XXX using a crypto-safe RNG.
// Excludes ambiguous characters (0/O, 1/I) for readability.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateLicenseKey(): string {
  return [randomChars(3), randomChars(4), randomChars(3), randomChars(3)].join("-");
}
