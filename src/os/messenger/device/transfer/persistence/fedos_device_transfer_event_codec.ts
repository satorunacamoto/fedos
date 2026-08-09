/**
 * Secure Runtime Alpha 3481–3560 — fail-closed codec for
 * `FedosPersistedDeviceTransferEventV1` (`./fedos_persisted_device_transfer_event_v1.ts`).
 * Mirrors `../../persistence/fedos_device_binding_codec.ts`'s own
 * exact-key-set, `schemaVersion === 1`-checked, "malformed input returns
 * `null`, never throws" discipline exactly.
 */

import type {
  FedosPersistedDeviceTransferAbortedEventV1,
  FedosPersistedDeviceTransferApprovedEventV1,
  FedosPersistedDeviceTransferChallengedEventV1,
  FedosPersistedDeviceTransferCompletedEventV1,
  FedosPersistedDeviceTransferEventV1,
  FedosPersistedDeviceTransferFailedEventV1,
  FedosPersistedDeviceTransferInvitedEventV1,
  FedosPersistedDeviceTransferPackageSentEventV1,
  FedosPersistedDeviceTransferVerifiedEventV1,
} from "../../../../../device/transfer/persistence/fedos_persisted_device_transfer_event_v1.js";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const NONCE_HEX_PATTERN = /^[0-9a-f]{32,64}$/;
const CONTENT_HASH_HEX_PATTERN = /^[0-9a-f]{64}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isWellFormedSessionId(value: unknown): value is string {
  return isNonEmptyString(value) && SESSION_ID_PATTERN.test(value);
}

export function deserializeFedosDeviceTransferInvitedEvent(record: unknown): FedosPersistedDeviceTransferInvitedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 9) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "invited") return null;
  if (!isWellFormedSessionId(value.sessionId)) return null;
  if (!isNonEmptyString(value.accountAuthority) || !isNonEmptyString(value.accountPublicIdentifier)) return null;
  if (!isNonEmptyString(value.initiatorDeviceId) || !isNonEmptyString(value.responderDeviceId)) return null;
  if (!isValidUnixSeconds(value.createdAt) || !isValidUnixSeconds(value.expiresAt)) return null;
  return {
    schemaVersion: 1,
    eventType: "invited",
    sessionId: value.sessionId,
    accountAuthority: value.accountAuthority,
    accountPublicIdentifier: value.accountPublicIdentifier,
    initiatorDeviceId: value.initiatorDeviceId,
    responderDeviceId: value.responderDeviceId,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  };
}

export function deserializeFedosDeviceTransferChallengedEvent(record: unknown): FedosPersistedDeviceTransferChallengedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 7) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "challenged") return null;
  if (!isWellFormedSessionId(value.sessionId)) return null;
  if (typeof value.nonce !== "string" || !NONCE_HEX_PATTERN.test(value.nonce)) return null;
  if (!isValidUnixSeconds(value.challengeIssuedAt) || !isValidUnixSeconds(value.challengeExpiresAt) || !isValidUnixSeconds(value.at)) return null;
  return {
    schemaVersion: 1,
    eventType: "challenged",
    sessionId: value.sessionId,
    nonce: value.nonce,
    challengeIssuedAt: value.challengeIssuedAt,
    challengeExpiresAt: value.challengeExpiresAt,
    at: value.at,
  };
}

export function deserializeFedosDeviceTransferApprovedEvent(record: unknown): FedosPersistedDeviceTransferApprovedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 4) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "approved") return null;
  if (!isWellFormedSessionId(value.sessionId) || !isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType: "approved", sessionId: value.sessionId, at: value.at };
}

export function deserializeFedosDeviceTransferPackageSentEvent(record: unknown): FedosPersistedDeviceTransferPackageSentEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 5) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "package-sent") return null;
  if (!isWellFormedSessionId(value.sessionId)) return null;
  if (typeof value.packageContentHash !== "string" || !CONTENT_HASH_HEX_PATTERN.test(value.packageContentHash)) return null;
  if (!isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType: "package-sent", sessionId: value.sessionId, packageContentHash: value.packageContentHash, at: value.at };
}

export function deserializeFedosDeviceTransferVerifiedEvent(record: unknown): FedosPersistedDeviceTransferVerifiedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 4) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "verified") return null;
  if (!isWellFormedSessionId(value.sessionId) || !isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType: "verified", sessionId: value.sessionId, at: value.at };
}

export function deserializeFedosDeviceTransferCompletedEvent(record: unknown): FedosPersistedDeviceTransferCompletedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 4) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "completed") return null;
  if (!isWellFormedSessionId(value.sessionId) || !isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType: "completed", sessionId: value.sessionId, at: value.at };
}

export function deserializeFedosDeviceTransferAbortedEvent(record: unknown): FedosPersistedDeviceTransferAbortedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 4) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "aborted") return null;
  if (!isWellFormedSessionId(value.sessionId) || !isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType: "aborted", sessionId: value.sessionId, at: value.at };
}

export function deserializeFedosDeviceTransferFailedEvent(record: unknown): FedosPersistedDeviceTransferFailedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 5) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "failed") return null;
  if (!isWellFormedSessionId(value.sessionId) || !isNonEmptyString(value.reason) || !isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType: "failed", sessionId: value.sessionId, reason: value.reason, at: value.at };
}

/** Dispatches on `eventType`. `null` for an unrecognized `eventType` or any malformed record — fails closed, never throws. */
export function deserializeFedosDeviceTransferEvent(record: unknown): FedosPersistedDeviceTransferEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const eventType = (record as Record<string, unknown>).eventType;
  switch (eventType) {
    case "invited":
      return deserializeFedosDeviceTransferInvitedEvent(record);
    case "challenged":
      return deserializeFedosDeviceTransferChallengedEvent(record);
    case "approved":
      return deserializeFedosDeviceTransferApprovedEvent(record);
    case "package-sent":
      return deserializeFedosDeviceTransferPackageSentEvent(record);
    case "verified":
      return deserializeFedosDeviceTransferVerifiedEvent(record);
    case "completed":
      return deserializeFedosDeviceTransferCompletedEvent(record);
    case "aborted":
      return deserializeFedosDeviceTransferAbortedEvent(record);
    case "failed":
      return deserializeFedosDeviceTransferFailedEvent(record);
    default:
      return null;
  }
}
