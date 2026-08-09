/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Deletion Request Record.
 *
 * Phase C — the closed, versioned, UNSIGNED request body — restates the
 * normative review's own schema (`860a58e`, Doc 07) field-for-field,
 * nothing added, nothing renamed. This is the record whose canonical
 * bytes (`fedos_deletion_request_canonical_bytes.ts`) become a signed
 * Nostr event's own `content` (Phase D/F) — it therefore carries only
 * JSON-representable, wire-safe scalar fields: `conversationId` and
 * `targetEnvelopeId` are plain strings here (their OWN branded types,
 * `FedosConversationId`/`FedosConversationEnvelopeId`, exist only
 * in-process; a wire body has no branded types) — this file's own
 * validator still enforces the SAME shape rules those branded
 * constructors enforce (non-empty, no path characters), never loosening
 * them at the wire boundary.
 *
 * HARD GUARDRAILS (restated from this Arc's own Absolute Prohibitions):
 *   - No free-form command field.
 *   - No arbitrary JSON policy field.
 *   - No raw filesystem path field.
 *   - No secret, no message plaintext, anywhere in this shape.
 *   - Unknown top-level fields fail closed (exact property-count check,
 *     mirrors `isWellFormedFedosNostrUnsignedEventRequest`, Alpha 442).
 */

import { isFedosDeletionRequestScope, type FedosDeletionRequestScope } from "./fedos_deletion_request_scope.js";
import { isFedosDeletionRequestReasonCode, type FedosDeletionRequestReasonCode } from "./fedos_deletion_request_reason_code.js";
import { isFedosDeletionRequestId } from "./fedos_deletion_request_id.js";

export const FEDOS_DELETION_REQUEST_SCHEMA_VERSION = 1 as const;
export const FEDOS_DELETION_REQUEST_CAPABILITY_VERSION = 1 as const;

/** Bounds this Arc's own new proposal (no existing constant to anchor to) — generous for a real opaque id, tight enough to bound wire size. */
const MAX_IDENTIFIER_LENGTH = 256;
const NONCE_HEX_LENGTH = 32; // 128 bits
const NONCE_PATTERN = new RegExp(`^[0-9a-f]{${NONCE_HEX_LENGTH}}$`);

export interface FedosDeletionRequestRecordV1 {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly requesterAccountRef: string;
  /** Opaque, advisory, non-cryptographically-bound label — `null` if the requester's own local build tracks no Device identity. Never a fabricated value. */
  readonly requesterDeviceRef: string | null;
  readonly recipientAccountRef: string;
  readonly recipientDeviceRef: string | null;
  readonly conversationId: string;
  readonly targetEnvelopeId: string;
  readonly scope: FedosDeletionRequestScope;
  /** Unix seconds, non-negative integer. */
  readonly issuedAt: number;
  /** Unix seconds, strictly greater than `issuedAt`. */
  readonly expiresAt: number;
  /** 128-bit, lower-hex — binds one SIGNATURE attempt (Phase F), distinct from `requestId`'s own job of naming the logical request across retries. */
  readonly nonce: string;
  readonly capabilityVersion: 1;
  readonly reasonCode: FedosDeletionRequestReasonCode | null;
}

const REQUEST_RECORD_FIELD_NAMES: readonly string[] = [
  "schemaVersion",
  "requestId",
  "requesterAccountRef",
  "requesterDeviceRef",
  "recipientAccountRef",
  "recipientDeviceRef",
  "conversationId",
  "targetEnvelopeId",
  "scope",
  "issuedAt",
  "expiresAt",
  "nonce",
  "capabilityVersion",
  "reasonCode",
];

function isBoundedNonEmptyIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_IDENTIFIER_LENGTH && !value.includes("/") && !value.includes("\\") && !value.includes("..");
}

function isBoundedNonEmptyIdentifierOrNull(value: unknown): value is string | null {
  return value === null || isBoundedNonEmptyIdentifier(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Strict, closed, never-throwing validator. Rejects any extra/missing
 * property (exact field-count check, mirrors
 * `isWellFormedFedosNostrUnsignedEventRequest`), any malformed field,
 * and any `expiresAt` not strictly after `issuedAt`. Does NOT check the
 * review's own 14-day-max-lifetime bound (Phase L's own retry-planner
 * concern, evaluated with a real clock) or authorization (Phase H) —
 * this function checks SHAPE only.
 */
export function isWellFormedFedosDeletionRequestRecordV1(candidate: unknown): candidate is FedosDeletionRequestRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== REQUEST_RECORD_FIELD_NAMES.length) return false;
  for (const name of REQUEST_RECORD_FIELD_NAMES) {
    if (!(name in value)) return false;
  }

  if (value.schemaVersion !== FEDOS_DELETION_REQUEST_SCHEMA_VERSION) return false;
  if (!isFedosDeletionRequestId(value.requestId)) return false;
  if (!isBoundedNonEmptyIdentifier(value.requesterAccountRef)) return false;
  if (!isBoundedNonEmptyIdentifierOrNull(value.requesterDeviceRef)) return false;
  if (!isBoundedNonEmptyIdentifier(value.recipientAccountRef)) return false;
  if (!isBoundedNonEmptyIdentifierOrNull(value.recipientDeviceRef)) return false;
  if (!isBoundedNonEmptyIdentifier(value.conversationId)) return false;
  if (!isBoundedNonEmptyIdentifier(value.targetEnvelopeId)) return false;
  if (!isFedosDeletionRequestScope(value.scope)) return false;
  if (!isNonNegativeInteger(value.issuedAt)) return false;
  if (!isNonNegativeInteger(value.expiresAt)) return false;
  if (value.expiresAt <= value.issuedAt) return false;
  if (typeof value.nonce !== "string" || !NONCE_PATTERN.test(value.nonce)) return false;
  if (value.capabilityVersion !== FEDOS_DELETION_REQUEST_CAPABILITY_VERSION) return false;
  if (value.reasonCode !== null && !isFedosDeletionRequestReasonCode(value.reasonCode)) return false;

  return true;
}

/** Deep-freezes an already-validated record — mirrors `freezeFedosNostrUnsignedEventRequest`'s own role. */
export function freezeFedosDeletionRequestRecordV1(record: FedosDeletionRequestRecordV1): FedosDeletionRequestRecordV1 {
  return Object.freeze({ ...record });
}
