/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (§8).
 *
 * SHA-256 content-addressing for media bytes — the EXACT SAME technique
 * `computeFedosConversationArchiveContentHash()`
 * (`src/os/messenger/conversations/archive/fedos_conversation_archive_integrity.ts`)
 * already uses in production (`@noble/hashes`, already one of this
 * repository's declared production dependencies — no new dependency).
 * `os/commerce` cannot import that file directly (`os/messenger` is
 * architecturally forbidden — `test/architecture_boundary_commerce.test.ts`),
 * so this is a same-technique, commerce-local reimplementation, not a
 * cross-boundary import.
 *
 * Callers MUST pass the bytes that will actually be stored — for
 * `classification: "protected"` media that means CIPHERTEXT bytes only
 * (see `./product_media_encryption.ts`), never plaintext. This module has
 * no opinion of its own about classification; `./product_media_types.ts`'s
 * `validateProductMedia()` is what enforces the "protected implies
 * ciphertext" rule at the record level.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** SHA-256 hex digest over `bytes`. The content-addressed key `MediaStorePort` implementations derive `put()` results from. */
export function computeCommerceMediaContentHash(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

/** Plain string equality, mirroring `fedosConversationArchiveContentHashesAreEqual()`'s own reasoning: a hash of already-stored (non-secret, non-key) bytes needs no timing-attack-resistant comparison. */
export function commerceMediaContentHashesAreEqual(a: string, b: string): boolean {
  return a === b;
}

/**
 * `true` iff `bytes` actually hashes to `expectedChecksum`. This is the
 * TAMPER-DETECTION primitive: any caller that receives bytes alongside a
 * claimed checksum from an untrusted source (a Nostr event, a future
 * remote `MediaStore` adapter, a corrupted local file) MUST call this
 * before trusting the bytes at all. Returns `false` (never throws) on any
 * mismatch, including a malformed `expectedChecksum`.
 */
export function verifyCommerceMediaContentAddress(bytes: Uint8Array, expectedChecksum: string): boolean {
  return commerceMediaContentHashesAreEqual(computeCommerceMediaContentHash(bytes), expectedChecksum);
}
