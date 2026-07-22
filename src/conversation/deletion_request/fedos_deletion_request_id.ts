/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Request Identity.
 *
 * Phase E — per the normative review (`860a58e`, Doc 06): a
 * client-generated, cryptographically random 256-bit value, lower-hex
 * encoded, generated ONCE for a logical request's entire lifetime and
 * reused verbatim on every retry. Never derived from `reasonCode`,
 * `targetEnvelopeId`, or any other content — pure entropy, so durable
 * state keyed by this id can never be predicted or targeted from
 * canonical facts alone.
 *
 * `randomBytesFn` is injected (mirrors this codebase's own
 * caller-supplied-clock convention, `clock?: () => number`, applied to
 * randomness instead of time) — defaults to `@noble/hashes/utils.js`'s
 * own `randomBytes()`, the SAME already-declared-dependency primitive
 * `FedosSecureRandomConversationEnvelopeIdGenerator`
 * (`../envelope/fedos_conversation_envelope_id.ts`, Alpha 853) already
 * uses for an identical purpose — no new dependency.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

const REQUEST_ID_BYTE_LENGTH = 32;
const HEX_64 = /^[0-9a-f]{64}$/;

export function generateFedosDeletionRequestId(randomBytesFn: (length: number) => Uint8Array = nobleRandomBytes): string {
  return bytesToHex(randomBytesFn(REQUEST_ID_BYTE_LENGTH));
}

/** `true` iff `value` is exactly 64 lowercase hex characters (256 bits) — never widened by case-insensitivity. */
export function isFedosDeletionRequestId(value: unknown): value is string {
  return typeof value === "string" && HEX_64.test(value);
}
