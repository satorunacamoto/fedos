/**
 * Payment Hardening (Commerce E2E Completion arc, Agent P) — generic,
 * rail-neutral HMAC-SHA256 callback/webhook signature helpers.
 *
 * Built on WebCrypto (`crypto.subtle`), the SAME primitive already used by
 * `os/messenger/adapters/nostr/protocol/crypto.ts` (`webCryptoSha256Hex`),
 * so this stays usable both in Node (18+) and in a Worker without a
 * `node:crypto` import or any `@types/node` dependency — consistent with
 * this codebase's existing convention of avoiding ambient Node built-ins in
 * domain code.
 *
 * No provider-specific (BTCPay, Stripe, ...) wire format is modeled here —
 * a real adapter (built inside its own `payment/adapters/<rail>/`
 * directory, per the existing reserved-directory pattern documented in
 * `payment/adapters/btcpay/README.md`) would call `verifyHmacSha256Hex`
 * with ITS OWN secret/message shape; this file only supplies the
 * rail-neutral primitive, exactly like `commerce_bridge.ts` stays a pure,
 * rail-neutral bridge.
 *
 * Used by `PlaceholderPaymentProvider.ingestCallback()`
 * (`./noop_payment.ts`) to reject a forged/unsigned callback whenever it is
 * configured with a `callbackSecret` — see that file's own header for the
 * Gap #5 hardening this closes
 * (`docs/commerce/COMMERCE-GAP-CLASSIFICATION.md`).
 */

function utf8Bytes(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value);
}

/** Parses a lowercase/uppercase hex string into bytes, or `null` if it is not well-formed hex. Never throws. */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", utf8Bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Computes a lowercase-hex HMAC-SHA256 over `message`, keyed by `secret`. Exposed mainly for tests (to construct a validly-signed callback) and for a caller minting its own outbound signed payloads. */
export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, utf8Bytes(message));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verifies a lowercase-hex HMAC-SHA256 signature over `message`, keyed by
 * `secret`, using WebCrypto's own `verify` — a real, standard cryptographic
 * comparison (not a manual/leaky one). Returns `false` (never throws) for a
 * malformed hex signature or any other failure — a rejected verification is
 * data, never an exception, matching this module's `PaymentProvider`
 * contract's own "every method is total" discipline.
 */
export async function verifyHmacSha256Hex(secret: string, message: string, signatureHex: string): Promise<boolean> {
  const signatureBytes = hexToBytes(signatureHex);
  if (signatureBytes === null) return false;
  try {
    const key = await importHmacKey(secret);
    return await crypto.subtle.verify("HMAC", key, signatureBytes, utf8Bytes(message));
  } catch {
    return false;
  }
}
