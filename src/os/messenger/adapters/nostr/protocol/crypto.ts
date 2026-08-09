/**
 * Minimal hashing helpers.
 *
 * Uses the WebCrypto API (`crypto.subtle`), which is available both in
 * Cloudflare Workers and in Node 18+. The core event logic does NOT import
 * this directly — it takes a `Sha256Hex` function by injection so it stays
 * pure and trivially testable. This module just provides the default impl.
 */

/** Hashes a UTF-8 string and returns lowercase hex. */
export type Sha256Hex = (data: string) => Promise<string>;

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/** Default WebCrypto-backed SHA-256 (Workers + Node compatible). */
export const webCryptoSha256Hex: Sha256Hex = async (data) => {
  const encoded = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(new Uint8Array(digest));
};

/**
 * Length-constant comparison of two hex strings.
 * Not a substitute for verified crypto, but avoids trivially leaking the
 * compare position when checking ids.
 */
export function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
