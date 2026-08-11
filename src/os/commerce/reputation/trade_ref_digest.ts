/**
 * Reputation / Persona Epoch — REAL `tradeRefDigestHex` computation (Wave B,
 * Agent R closure pass).
 *
 * `attestation_types.ts`'s header reserved `tradeRefDigestHex` as "a
 * ONE-WAY DIGEST (hex) of the real trade/order identifier... Salting the
 * pre-image... is a REQUIRED implementation detail, not optional — an
 * unsalted digest of a small order-id space is brute-forceable." This file
 * is that implementation: a salted SHA-256 commitment to a real
 * `Order.id` (`../order/order_types.ts`, never imported here — this file
 * takes a plain `orderId: string`, keeping the same "opaque cross-territory
 * reference" discipline `receipt/receipt_types.ts` documents), never the
 * raw order id itself.
 *
 * WHY A LENGTH-PREFIXED PRE-IMAGE, NOT A PLAIN CONCATENATION
 * ----------------------------------------------------------------------
 * `sha256(orderId + saltHex)` is ambiguous: `orderId="ab"` + `saltHex="cd"`
 * and `orderId="a"` + `saltHex="bcd"` hash identically. This file instead
 * hashes a netstring-shaped pre-image (`"<len>:<orderId>:<saltHex>"`,
 * mirroring this repo's own fixed-field canonicalization discipline seen
 * throughout `src/os/trust/envelope/fedos_trust_canonical_bytes.ts`), which
 * removes that ambiguity.
 *
 * WHAT A MATCHING DIGEST PROVES, AND TO WHOM
 * ----------------------------------------------------------------------
 * `tradeRefDigestHex` is designed to be publishable (it appears inside a
 * signed, potentially-shared `TradeCompletionAttestationPayload`) without
 * revealing the real order id to a PUBLIC/PSEUDONYMOUS_PROOF-layer viewer —
 * see `disclosure_layers.ts`. An AUTHORIZED-layer party who is separately
 * shown the real `orderId`/`saltHex` pair (e.g. in a dispute) can use
 * `verifyTradeRefDigest` below to confirm the attestation genuinely
 * references that specific order, without the digest itself ever leaking
 * the order id to anyone who wasn't shown the pre-image out of band.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes as nobleRandomBytes } from "@noble/hashes/utils.js";

const HEX_PATTERN = /^[0-9a-f]+$/;
/** 16 bytes = 32 hex chars — generous against brute-force of the salt space
 * itself, small enough to stay well inside `tradeRefDigestHex`'s own
 * pre-image without needing a bound of its own. */
const TRADE_REF_SALT_BYTE_LENGTH = 16;

function netstringPreimage(orderId: string, saltHex: string): Uint8Array {
  return new TextEncoder().encode(`${orderId.length}:${orderId}:${saltHex}`);
}

/** Generates a fresh random salt (hex) — REQUIRED before computing a
 * `tradeRefDigestHex` for a real order id (see this file's header on why an
 * unsalted digest is brute-forceable). Injectable RNG for deterministic
 * tests, mirroring `../catalog/product_id.ts`'s own `randomBytesFn` seam. */
export function generateTradeRefSaltHex(
  randomBytesFn: (length: number) => Uint8Array = nobleRandomBytes,
): string {
  return bytesToHex(randomBytesFn(TRADE_REF_SALT_BYTE_LENGTH));
}

export function isWellFormedTradeRefSaltHex(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && HEX_PATTERN.test(value);
}

/**
 * Computes the salted one-way digest a `TradeCompletionAttestationPayload.tradeRefDigestHex`
 * carries. Throws `RangeError` on a malformed `orderId`/`saltHex` — this is
 * an internal-construction helper (mirrors this repo's `issue*`/`build*`
 * fail-fast convention), not a boundary parser.
 */
export function computeTradeRefDigestHex(orderId: string, saltHex: string): string {
  if (typeof orderId !== "string" || orderId.length === 0 || orderId.length > 512) {
    throw new RangeError("trade ref digest: orderId must be a non-empty string up to 512 chars");
  }
  if (!isWellFormedTradeRefSaltHex(saltHex)) {
    throw new RangeError("trade ref digest: saltHex must be a non-empty hex string");
  }
  return bytesToHex(sha256(netstringPreimage(orderId, saltHex)));
}

/**
 * Recomputes the digest from a claimed `(orderId, saltHex)` pair and
 * compares it to `claimedDigestHex` — the AUTHORIZED-layer verification
 * path this file's header describes. Fails closed to `false` on any
 * malformed input or a mismatch; never throws (unlike `computeTradeRefDigestHex`,
 * this is a boundary-facing check over caller-supplied data, so it must not
 * throw on garbage input).
 */
export function verifyTradeRefDigest(orderId: unknown, saltHex: unknown, claimedDigestHex: unknown): boolean {
  if (typeof orderId !== "string" || orderId.length === 0 || orderId.length > 512) return false;
  if (!isWellFormedTradeRefSaltHex(saltHex)) return false;
  if (typeof claimedDigestHex !== "string" || !/^[0-9a-f]{64}$/.test(claimedDigestHex)) return false;
  try {
    return computeTradeRefDigestHex(orderId, saltHex) === claimedDigestHex;
  } catch {
    return false;
  }
}
