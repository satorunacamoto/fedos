/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase C: the closed, versioned suppression fact.
 *
 * A `FedosArchiveSuppressionFact` is the minimum durable, authenticated
 * claim an authorized Device needs to know that a specific payload must
 * not be restored from an older Archive — never a claim that any other
 * Device physically erased anything, never a claim every Device received
 * it. Mirrors `FedosPayloadRetentionDecision`'s own discipline
 * (`./fedos_payload_retention_decision.ts`, Alpha 795) exactly:
 * immutable, one record per logical fact, only a dedicated validator
 * constructs one.
 *
 * `subjectRef` reuses the EXISTING `FedosConversationPayloadId` — the
 * same opaque, non-secret identifier Retention/Archive/Search already
 * key off — sufficient to match Archive entries without inventing a
 * second identifier scheme or exposing anything beyond what Retention
 * itself already exposes.
 *
 * `revision` is a per-`(subjectRef, sourceDeviceId)` monotonic counter
 * (the ORIGINATING Device's own count of suppression decisions it has
 * made for this subject) — NOT a wall-clock value, since Device clocks
 * are not assumed synchronized (Phase A reconciliation report §8's own
 * decision: the lighter, Delivery-Observation-shaped staleness model,
 * adapted to use an explicit revision rather than a timestamp).
 *
 * HARD GUARDRAILS:
 *   - No message content, ciphertext, sender/recipient display data,
 *     Archive path, Search token, Ratchet/session key, or free-form
 *     reason string anywhere in this type.
 *   - `suppressionMeaning` is a CLOSED vocabulary — an unrecognized
 *     value fails closed at construction and at parse time, never
 *     silently accepted as a new/unknown kind.
 *   - Every field `readonly`; no mutation method.
 *   - Only `createFedosArchiveSuppressionFact`/
 *     `validateFedosArchiveSuppressionFact` may produce a value of this
 *     type.
 */

import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";

/** Closed vocabulary (Phase C). An unrecognized value fails closed, never treated as a new/unsupported-but-tolerated kind. */
export type FedosArchiveSuppressionMeaning =
  | "suppress-payload-restore"
  | "suppress-envelope-restore"
  | "suppress-search-reindex"
  | "preserve-minimal-tombstone";

const FEDOS_ARCHIVE_SUPPRESSION_MEANINGS: ReadonlySet<string> = new Set([
  "suppress-payload-restore",
  "suppress-envelope-restore",
  "suppress-search-reindex",
  "preserve-minimal-tombstone",
]);

export function isFedosArchiveSuppressionMeaning(value: unknown): value is FedosArchiveSuppressionMeaning {
  return typeof value === "string" && FEDOS_ARCHIVE_SUPPRESSION_MEANINGS.has(value);
}

/** Only `"payload"` exists in V1 — Envelope suppression is expressed via `suppressionMeaning: "suppress-envelope-restore"` over the SAME `subjectRef` (the payload id), mirroring how `feff676`'s own restore gate already keys Envelope permission off `payloadId`, never a second identifier scheme. */
export type FedosArchiveSuppressionSubjectType = "payload";

export interface FedosArchiveSuppressionFact {
  readonly schemaVersion: 1;
  /** Deterministic: `fedosArchiveSuppressionFactId(accountRef, sourceDeviceId, subjectRef, revision)`. */
  readonly factId: string;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly sourceDeviceId: string;
  readonly subjectType: FedosArchiveSuppressionSubjectType;
  readonly subjectRef: FedosConversationPayloadId;
  readonly suppressionMeaning: FedosArchiveSuppressionMeaning;
  /** Per-`(subjectRef, sourceDeviceId)` monotonic counter — see this file's own header. */
  readonly revision: number;
  /** Unix seconds — when the ORIGINATING device made this decision, not when any receiver observed it. */
  readonly decidedAt: number;
  /** 128-bit hex, binds one signing attempt (mirrors `FedosDeletionRequestRecordV1.nonce`, Phase A reconciliation report §5) — replay-protection at the signature layer, distinct from `revision`'s own staleness role at the fact layer. */
  readonly nonce: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isValidRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

const NONCE_HEX_PATTERN = /^[0-9a-f]{32}$/;

function isValidNonce(value: unknown): value is string {
  return typeof value === "string" && NONCE_HEX_PATTERN.test(value);
}

function isWellFormedAccountRef(value: unknown): value is FedosDeviceBindingAccountRef {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 3) return false;
  if (!isNonEmptyString(record.authority)) return false;
  if (!isNonEmptyString(record.publicIdentifier)) return false;
  if (record.identityId !== null && !isNonEmptyString(record.identityId)) return false;
  return true;
}

/** Deterministic id — two calls with logically identical inputs always produce the identical id, mirroring `fedosPayloadRetentionDecisionKey`'s own convention. */
export function fedosArchiveSuppressionFactId(
  accountRef: FedosDeviceBindingAccountRef,
  sourceDeviceId: string,
  subjectRef: string,
  suppressionMeaning: string,
  revision: number,
): string {
  return `${accountRef.authority}::${accountRef.publicIdentifier}::${sourceDeviceId}::${subjectRef}::${suppressionMeaning}::${revision}`;
}

export interface FedosArchiveSuppressionFactCreateInput {
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly sourceDeviceId: string;
  readonly subjectType: FedosArchiveSuppressionSubjectType;
  readonly subjectRef: FedosConversationPayloadId;
  readonly suppressionMeaning: FedosArchiveSuppressionMeaning;
  readonly revision: number;
  readonly decidedAt: number;
  readonly nonce: string;
}

/** The ONLY constructor of a `FedosArchiveSuppressionFact`. Fails closed to `null` for anything malformed — never throws. */
export function createFedosArchiveSuppressionFact(input: FedosArchiveSuppressionFactCreateInput): FedosArchiveSuppressionFact | null {
  if (!isWellFormedAccountRef(input.accountRef)) return null;
  if (!isNonEmptyString(input.sourceDeviceId)) return null;
  if (input.subjectType !== "payload") return null;
  if (!isNonEmptyString(input.subjectRef as unknown as string)) return null;
  if (!isFedosArchiveSuppressionMeaning(input.suppressionMeaning)) return null;
  if (!isValidRevision(input.revision)) return null;
  if (!isValidUnixSeconds(input.decidedAt)) return null;
  if (!isValidNonce(input.nonce)) return null;

  return Object.freeze({
    schemaVersion: 1,
    factId: fedosArchiveSuppressionFactId(input.accountRef, input.sourceDeviceId, input.subjectRef, input.suppressionMeaning, input.revision),
    accountRef: Object.freeze({ ...input.accountRef }),
    sourceDeviceId: input.sourceDeviceId,
    subjectType: input.subjectType,
    subjectRef: input.subjectRef,
    suppressionMeaning: input.suppressionMeaning,
    revision: input.revision,
    decidedAt: input.decidedAt,
    nonce: input.nonce,
  });
}

/** Structural validation of an already-parsed candidate (e.g. after JSON.parse of received wire bytes) — does NOT verify any signature (that is `fedos_archive_suppression_fact_signing.ts`'s own, separate concern). Fails closed to `null`; never throws. */
export function validateFedosArchiveSuppressionFact(candidate: unknown): FedosArchiveSuppressionFact | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 10) return null;
  if (value.schemaVersion !== 1) return null;
  if (!isNonEmptyString(value.factId)) return null;
  if (!isWellFormedAccountRef(value.accountRef)) return null;
  if (!isNonEmptyString(value.sourceDeviceId)) return null;
  if (value.subjectType !== "payload") return null;
  if (!isNonEmptyString(value.subjectRef)) return null;
  if (!isFedosArchiveSuppressionMeaning(value.suppressionMeaning)) return null;
  if (!isValidRevision(value.revision)) return null;
  if (!isValidUnixSeconds(value.decidedAt)) return null;
  if (!isValidNonce(value.nonce)) return null;

  const accountRef = value.accountRef as FedosDeviceBindingAccountRef;
  const subjectRef = value.subjectRef as string;
  const expectedId = fedosArchiveSuppressionFactId(
    accountRef,
    value.sourceDeviceId as string,
    subjectRef,
    value.suppressionMeaning as string,
    value.revision as number,
  );
  if (value.factId !== expectedId) return null;

  return Object.freeze({
    schemaVersion: 1,
    factId: value.factId,
    accountRef: Object.freeze({ ...accountRef }),
    sourceDeviceId: value.sourceDeviceId as string,
    subjectType: "payload",
    subjectRef: subjectRef as unknown as FedosConversationPayloadId,
    suppressionMeaning: value.suppressionMeaning as FedosArchiveSuppressionMeaning,
    revision: value.revision as number,
    decidedAt: value.decidedAt as number,
    nonce: value.nonce as string,
  });
}

/** Fixed-field-order canonical JSON — the exact bytes any signature (Phase D) is computed over. Field order is frozen; changing it would silently break every previously-issued signature, mirroring `fedos_deletion_request_canonical_bytes.ts`'s own discipline. */
export function fedosArchiveSuppressionFactCanonicalBytes(fact: FedosArchiveSuppressionFact): Uint8Array {
  const canonical = {
    schemaVersion: fact.schemaVersion,
    factId: fact.factId,
    accountRef: { authority: fact.accountRef.authority, publicIdentifier: fact.accountRef.publicIdentifier, identityId: fact.accountRef.identityId },
    sourceDeviceId: fact.sourceDeviceId,
    subjectType: fact.subjectType,
    subjectRef: fact.subjectRef,
    suppressionMeaning: fact.suppressionMeaning,
    revision: fact.revision,
    decidedAt: fact.decidedAt,
    nonce: fact.nonce,
  };
  return new TextEncoder().encode(JSON.stringify(canonical));
}
