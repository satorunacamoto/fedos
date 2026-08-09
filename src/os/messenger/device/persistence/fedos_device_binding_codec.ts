/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Device Binding Codec V1 (Phase D).
 *
 * The ONLY functions permitted to convert between a
 * `FedosDeviceBindingV1`/registration-authority decision and the
 * persisted wire events (`./fedos_persisted_device_binding_event_v1.ts`)
 * — mirrors `../../conversation/capability/persistence/fedos_conversation_capability_codec.ts`'s
 * own exact discipline (Alpha 836).
 *
 * HARD GUARDRAILS:
 *   - Every `deserialize*` function fails closed: `null` for anything
 *     malformed or an unrecognized `schemaVersion`, never throws.
 *   - `schemaVersion` checked EXACTLY against `1`.
 *   - Unknown top-level fields REJECTED.
 *   - No private key, Master Seed, or passphrase field is ever accepted
 *     or produced — `devicePublicKeyRef` round-trips as an opaque string
 *     or `null` only.
 */

import type {
  FedosPersistedDeviceBindingEventV1,
  FedosPersistedDeviceBindingRegisteredEventV1,
  FedosPersistedDeviceBindingRevokedEventV1,
  FedosPersistedDeviceBindingTrustedEventV1,
} from "../../../../device/persistence/fedos_persisted_device_binding_event_v1.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

const REGISTERED_EVENT_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "eventType",
  "deviceId",
  "accountAuthority",
  "accountPublicIdentifier",
  "accountIdentityId",
  "devicePublicKeyRef",
  "label",
  "initialTrustState",
  "registeredAt",
]);

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosDeviceBindingRegisteredEvent(record: unknown): FedosPersistedDeviceBindingRegisteredEventV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => REGISTERED_EVENT_KEYS.has(key))) return null;

  const value = record as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  if (value.eventType !== "registered") return null;
  if (!isNonEmptyString(value.deviceId)) return null;
  if (!isNonEmptyString(value.accountAuthority)) return null;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return null;
  if (!isNullableNonEmptyString(value.accountIdentityId)) return null;
  if (!isNullableNonEmptyString(value.devicePublicKeyRef)) return null;
  if (!isNullableNonEmptyString(value.label)) return null;
  if (value.initialTrustState !== "pending" && value.initialTrustState !== "unavailable") return null;
  if (!isValidTimestamp(value.registeredAt)) return null;

  return {
    schemaVersion: 1,
    eventType: "registered",
    deviceId: value.deviceId,
    accountAuthority: value.accountAuthority,
    accountPublicIdentifier: value.accountPublicIdentifier,
    accountIdentityId: value.accountIdentityId,
    devicePublicKeyRef: value.devicePublicKeyRef,
    label: value.label,
    initialTrustState: value.initialTrustState,
    registeredAt: value.registeredAt,
  };
}

const TRUSTED_EVENT_KEYS: ReadonlySet<string> = new Set(["schemaVersion", "eventType", "deviceId", "trustedAt"]);

export function deserializeFedosDeviceBindingTrustedEvent(record: unknown): FedosPersistedDeviceBindingTrustedEventV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TRUSTED_EVENT_KEYS.has(key))) return null;

  const value = record as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  if (value.eventType !== "trusted") return null;
  if (!isNonEmptyString(value.deviceId)) return null;
  if (!isValidTimestamp(value.trustedAt)) return null;

  return { schemaVersion: 1, eventType: "trusted", deviceId: value.deviceId, trustedAt: value.trustedAt };
}

const REVOKED_EVENT_KEYS: ReadonlySet<string> = new Set(["schemaVersion", "eventType", "deviceId", "revokedAt"]);

export function deserializeFedosDeviceBindingRevokedEvent(record: unknown): FedosPersistedDeviceBindingRevokedEventV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => REVOKED_EVENT_KEYS.has(key))) return null;

  const value = record as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  if (value.eventType !== "revoked") return null;
  if (!isNonEmptyString(value.deviceId)) return null;
  if (!isValidTimestamp(value.revokedAt)) return null;

  return { schemaVersion: 1, eventType: "revoked", deviceId: value.deviceId, revokedAt: value.revokedAt };
}

/** Fails closed to `null` for any malformed record, or one whose `eventType` is not one of the three known kinds. */
export function deserializeFedosDeviceBindingEvent(record: unknown): FedosPersistedDeviceBindingEventV1 | null {
  if (record === null || typeof record !== "object") return null;
  const eventType = (record as Record<string, unknown>).eventType;
  if (eventType === "registered") return deserializeFedosDeviceBindingRegisteredEvent(record);
  if (eventType === "trusted") return deserializeFedosDeviceBindingTrustedEvent(record);
  if (eventType === "revoked") return deserializeFedosDeviceBindingRevokedEvent(record);
  return null;
}
