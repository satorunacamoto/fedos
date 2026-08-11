/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc.
 *
 * Product id generation. Mirrors `generateFedosDeletionRequestId()`
 * (`src/os/messenger/conversations/deletion_request/fedos_deletion_request_id.ts`)
 * exactly: a client-generated, cryptographically random 256-bit value,
 * lower-hex encoded, using the SAME already-declared-dependency primitive
 * (`@noble/hashes/utils.js`'s `randomBytes()`) — no new dependency, no
 * hand-rolled randomness. `randomBytesFn` is injected purely for
 * deterministic tests, matching that file's own convention.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

const PRODUCT_ID_BYTE_LENGTH = 16;
const PRODUCT_MEDIA_ID_BYTE_LENGTH = 16;
const HEX_ID_RE = /^[0-9a-f]+$/;

/** A fresh, random, lower-hex product id (128 bits). */
export function generateFedosProductId(randomBytesFn: (length: number) => Uint8Array = nobleRandomBytes): string {
  return bytesToHex(randomBytesFn(PRODUCT_ID_BYTE_LENGTH));
}

/** A fresh, random, lower-hex `ProductMedia` id (128 bits) — deliberately a SEPARATE id space from product ids. */
export function generateFedosProductMediaId(randomBytesFn: (length: number) => Uint8Array = nobleRandomBytes): string {
  return bytesToHex(randomBytesFn(PRODUCT_MEDIA_ID_BYTE_LENGTH));
}

/** `true` iff `value` looks like an id this module generates (non-empty lowercase hex) — a light shape check, not a registry lookup. */
export function isPlausibleFedosCommerceHexId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && HEX_ID_RE.test(value);
}
