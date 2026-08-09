/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Canonical Serialization.
 *
 * Phase D — ONE canonical byte representation of a
 * `FedosDeletionRequestRecordV1`, used as the `content` of the Nostr
 * event this Arc's own real signing boundary (Phase F) signs. Built by
 * EXPLICIT, fixed-order string concatenation — never
 * `JSON.stringify(record)` on the whole object at once, whose own
 * output order would depend on how the input object's keys happened to
 * be inserted (this Arc's own Phase D instruction: "Do not sign JSON
 * produced by arbitrary object iteration"). `JSON.stringify` is used
 * ONLY per leaf STRING value, for its own well-defined escaping — never
 * on a compound value.
 *
 * PROPERTIES:
 *   - Deterministic field order: the fourteen
 *     `FedosDeletionRequestRecordV1` fields, in the EXACT order declared
 *     below, always — never the input object's own enumeration order.
 *   - Explicit version: `schemaVersion`/`capabilityVersion` are the
 *     first and second-to-last fields respectively, both real,
 *     validated `1` literals.
 *   - Bounded lengths / normalized identifiers: inherited from
 *     `isWellFormedFedosDeletionRequestRecordV1`'s own shape checks —
 *     this function's own precondition is that `record` already passed
 *     that validator.
 *   - No locale-dependent formatting: `issuedAt`/`expiresAt` are emitted
 *     via a plain integer-to-decimal-string conversion, never
 *     `toLocaleString`/`Intl`.
 *   - No floating-point time: both timestamp fields are validated
 *     non-negative INTEGERS upstream; this function asserts that again
 *     defensively and throws (a programmer error, never reachable for a
 *     validated record) rather than silently emitting a fractional
 *     value.
 *   - No optional-field ambiguity: `requesterDeviceRef`/
 *     `recipientDeviceRef`/`reasonCode` always emit either `null` or a
 *     `JSON.stringify`-escaped string — never an omitted key.
 */

import type { FedosDeletionRequestRecordV1 } from "./fedos_deletion_request_record.js";

function integerLiteral(value: number): string {
  if (!Number.isInteger(value)) {
    throw new Error("fedos_deletion_request_canonical_bytes: non-integer timestamp reached canonicalization — validate the record first.");
  }
  return String(value);
}

function nullableStringLiteral(value: string | null): string {
  return value === null ? "null" : JSON.stringify(value);
}

/**
 * Builds the canonical string. Precondition: `record` already passed
 * `isWellFormedFedosDeletionRequestRecordV1` — this function does not
 * re-validate field shapes, only fixes their ORDER and ENCODING.
 */
export function canonicalizeFedosDeletionRequestRecordV1(record: FedosDeletionRequestRecordV1): string {
  const parts: readonly string[] = [
    `"schemaVersion":${integerLiteral(record.schemaVersion)}`,
    `"requestId":${JSON.stringify(record.requestId)}`,
    `"requesterAccountRef":${JSON.stringify(record.requesterAccountRef)}`,
    `"requesterDeviceRef":${nullableStringLiteral(record.requesterDeviceRef)}`,
    `"recipientAccountRef":${JSON.stringify(record.recipientAccountRef)}`,
    `"recipientDeviceRef":${nullableStringLiteral(record.recipientDeviceRef)}`,
    `"conversationId":${JSON.stringify(record.conversationId)}`,
    `"targetEnvelopeId":${JSON.stringify(record.targetEnvelopeId)}`,
    `"scope":${JSON.stringify(record.scope)}`,
    `"issuedAt":${integerLiteral(record.issuedAt)}`,
    `"expiresAt":${integerLiteral(record.expiresAt)}`,
    `"nonce":${JSON.stringify(record.nonce)}`,
    `"capabilityVersion":${integerLiteral(record.capabilityVersion)}`,
    `"reasonCode":${nullableStringLiteral(record.reasonCode)}`,
  ];
  return `{${parts.join(",")}}`;
}

/** UTF-8 bytes of the canonical string — what an actual signature/hash is computed over. */
export function canonicalBytesForFedosDeletionRequestRecordV1(record: FedosDeletionRequestRecordV1): Uint8Array {
  return new TextEncoder().encode(canonicalizeFedosDeletionRequestRecordV1(record));
}
